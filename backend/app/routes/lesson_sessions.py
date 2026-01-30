from datetime import datetime

from flask import Blueprint, request, jsonify, g
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.lesson_session import LessonSession, SessionMode, SessionStatus
from app.authz import (
    require_teacher_for_session,
    require_client_for_session,
    require_owner_for_session,
)

from app.auth.require_auth import require_auth

bp = Blueprint("lesson_sessions", __name__, url_prefix="/api/lesson-sessions")



@bp.post("/_debug-echo")
def debug_echo():
    raw = request.get_data(cache=True, as_text=True)
    return jsonify({
        "content_type": request.headers.get("Content-Type"),
        "content_length": request.content_length,
        "raw_len": len(raw),
        "raw_first100": raw[:100],
        "json": request.get_json(silent=True),
    }), 200

# ---------- helpers ----------
def parse_enum(enum_cls, raw, field_name: str):
    """
    raw -> enum_cls(...) dönüşümü.
    Hatalıysa (json, status_code) döner.
    """
    try:
        v = str(raw).strip().upper()
        return enum_cls(v)
    except Exception:
        return jsonify({
            "message": f"invalid {field_name}",
            "allowed": [e.value for e in enum_cls],
        }), 400


def parse_int(raw, field_name: str, required: bool = False):
    if raw is None:
        if required:
            return jsonify({"message": f"{field_name} zorunlu"}), 400
        return None
    try:
        return int(raw)
    except Exception:
        return jsonify({"message": f"{field_name} must be integer"}), 400


def parse_iso_datetime(raw, field_name: str, required: bool = False):
    if not raw:
        if required:
            return jsonify({"message": f"{field_name} zorunlu"}), 400
        return None
    try:
        return datetime.fromisoformat(str(raw))
    except Exception:
        return jsonify({
            "message": f"{field_name} must be ISO format (örn: 2026-01-29T15:00:00)"
        }), 400


def recalc_status(s: LessonSession) -> SessionStatus:
    # terminal statüler: dokunma
    if s.status in {SessionStatus.CANCELLED, SessionStatus.MISSED}:
        return s.status

    teacher_ok = bool(s.teacher_marked_at)
    client_ok = bool(s.client_marked_at)

    if teacher_ok and client_ok:
        return SessionStatus.COMPLETED
    if teacher_ok or client_ok:
        return SessionStatus.PENDING_CONFIRMATION
    return SessionStatus.PLANNED


ALLOWED_TRANSITIONS = {
    SessionStatus.PLANNED: {SessionStatus.CANCELLED, SessionStatus.MISSED},
    SessionStatus.PENDING_CONFIRMATION: {SessionStatus.CANCELLED, SessionStatus.MISSED},
    SessionStatus.COMPLETED: set(),
    SessionStatus.CANCELLED: set(),
    SessionStatus.MISSED: set(),
}


# ---------- routes ----------
@bp.get("")
def list_lesson_sessions():
    student_id = request.args.get("student_id", type=int)
    teacher_user_id = request.args.get("teacher_user_id", type=int)
    status_raw = request.args.get("status", type=str)

    q = LessonSession.query

    if g.role == "TEACHER":
        q = q.filter(LessonSession.teacher_user_id == g.user_id)

        if teacher_user_id and teacher_user_id != g.user_id:
            return jsonify({"message":"forbidden_filter"}), 403

    elif g.role == "CLIENT":
        q = q.join(student)




    if student_id:
        q = q.filter(LessonSession.student_id == student_id)
    if teacher_user_id:
        q = q.filter(LessonSession.teacher_user_id == teacher_user_id)

    if status_raw:
        parsed = parse_enum(SessionStatus, status_raw, "status")
        if isinstance(parsed, tuple):
            return parsed
        status_enum = parsed
        q = q.filter(LessonSession.status == status_enum)

    sessions = q.order_by(LessonSession.scheduled_start.desc()).all()
    return jsonify([s.to_dict() for s in sessions]), 200


@bp.get("/<int:session_id>")
@require_owner_for_session
def get_lesson_session(session_id):
    # decorator session'ı buldu ve g.session'a koydu varsayıyoruz
    s = g.session
    return jsonify(s.to_dict()), 200


@bp.post("")
def create_lesson_session():

    data = request.get_json(silent=True)  # force yok!
    if data is None:
        raw = request.get_data(cache=True, as_text=True)
        return jsonify({
    "message": "invalid or missing JSON body",
    "content_type": request.headers.get("Content-Type"),
    "content_length": request.content_length,
    "transfer_encoding": request.headers.get("Transfer-Encoding"),
    "raw_len": len(raw),
    "raw_first100": raw[:100],
}), 400



    # required fields
    student_id = data.get("student_id")
    teacher_user_id = data.get("teacher_user_id")
    created_by_user_id = data.get("created_by_user_id")
    scheduled_start_raw = data.get("scheduled_start")
    duration_min_raw = data.get("duration_min")

    # optional fields
    mode_raw = data.get("mode")
    topic = data.get("topic")
    status_raw = data.get("status")

    # ---- validation ----
    student_id_parsed = parse_int(student_id, "student_id", required=True)
    if isinstance(student_id_parsed, tuple):
        return student_id_parsed
    teacher_user_id_parsed = parse_int(teacher_user_id, "teacher_user_id", required=True)
    if isinstance(teacher_user_id_parsed, tuple):
        return teacher_user_id_parsed
    created_by_user_id_parsed = parse_int(created_by_user_id, "created_by_user_id", required=True)
    if isinstance(created_by_user_id_parsed, tuple):
        return created_by_user_id_parsed

    scheduled_start = parse_iso_datetime(scheduled_start_raw, "scheduled_start", required=True)
    if isinstance(scheduled_start, tuple):
        return scheduled_start

    duration_min = parse_int(duration_min_raw, "duration_min", required=True)
    if isinstance(duration_min, tuple):
        return duration_min
    if duration_min <= 0:
        return jsonify({"message": "duration_min must be > 0"}), 400

    # ---- enum parsing ----
    if mode_raw:
        parsed = parse_enum(SessionMode, mode_raw, "mode")
        if isinstance(parsed, tuple):
            return parsed
        mode_enum = parsed
    else:
        mode_enum = SessionMode.ONLINE

    if status_raw:
        parsed = parse_enum(SessionStatus, status_raw, "status")
        if isinstance(parsed, tuple):
            return parsed
        status_enum = parsed
    else:
        status_enum = SessionStatus.PLANNED

    s = LessonSession(
        student_id=student_id_parsed,
        teacher_user_id=teacher_user_id_parsed,
        created_by_user_id=created_by_user_id_parsed,
        scheduled_start=scheduled_start,
        duration_min=duration_min,
        mode=mode_enum,
        topic=topic,
        status=status_enum,
    )

    try:
        s.save()
    except IntegrityError as ex:
        db.session.rollback()
        return jsonify({"message": "DB integrity error", "error": str(ex)}), 400
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(s.to_dict()), 201


@bp.patch("/<int:session_id>")
@require_owner_for_session
def update_lesson_session(session_id):
    # decorator session'ı buldu ve yetkiyi doğruladı varsayıyoruz
    s = g.session

    data = request.get_json(silent=True) or {}

    # status update (manual: only CANCELLED/MISSED)
    if "status" in data:
        raw = (data.get("status") or "").strip().upper()
        parsed = parse_enum(SessionStatus, raw, "status")
        if isinstance(parsed, tuple):
            return parsed
        new_status = parsed

        if new_status not in {SessionStatus.CANCELLED, SessionStatus.MISSED}:
            return jsonify({
                "message": "status can only be set to CANCELLED or MISSED manually"
            }), 409

        allowed = ALLOWED_TRANSITIONS.get(s.status, set())
        if new_status not in allowed:
            return jsonify({
                "message": "invalid status transition",
                "from": s.status.value,
                "to": new_status.value,
                "allowed_to": [st.value for st in allowed],
            }), 409

        s.status = new_status

    # optional updates
    if "topic" in data:
        s.topic = data.get("topic")

    if "scheduled_start" in data:
        parsed = parse_iso_datetime(data.get("scheduled_start"), "scheduled_start", required=False)
        if isinstance(parsed, tuple):
            return parsed
        if parsed is not None:
            s.scheduled_start = parsed

    if "duration_min" in data:
        parsed = parse_int(data.get("duration_min"), "duration_min", required=False)
        if isinstance(parsed, tuple):
            return parsed
        if parsed is not None:
            if parsed <= 0:
                return jsonify({"message": "duration_min must be > 0"}), 400
            s.duration_min = parsed

    if "mode" in data:
        parsed = parse_enum(SessionMode, data.get("mode"), "mode")
        if isinstance(parsed, tuple):
            return parsed
        s.mode = parsed

    try:
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(s.to_dict()), 200


@bp.patch("/<int:session_id>/teacher-mark")
@require_teacher_for_session
def teacher_mark(session_id):
    s = g.session
    if s.status in {SessionStatus.CANCELLED, SessionStatus.MISSED}:
        return jsonify({"message": "cannot mark a cancelled/missed session"}), 409

    data = request.get_json(silent=True) or {}

    # destek: eski key'ler
    rating = data.get("teacher_rating_to_student")
    note = data.get("teacher_mark_note")

    if rating is not None:
        parsed = parse_int(rating, "teacher_rating_to_student", required=False)
        if isinstance(parsed, tuple):
            return parsed
        rating_int = parsed
        if rating_int < 1 or rating_int > 5:
            return jsonify({"message": "rating must be 1-5"}), 400
        s.teacher_rating_to_student = rating_int

    if note is not None:
        s.teacher_mark_note = str(note).strip()

    s.teacher_marked_at = datetime.utcnow()
    s.status = recalc_status(s)

    try:
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(s.to_dict()), 200


@bp.patch("/<int:session_id>/client-mark")
@require_client_for_session
def client_mark(session_id):
    s = g.session
    if s.status in {SessionStatus.CANCELLED, SessionStatus.MISSED}:
        return jsonify({"message": "cannot mark a cancelled/missed session"}), 409

    data = request.get_json(silent=True) or {}

    # yeni key'ler (tutarlı)
    rating = data.get("client_rating_to_teacher")
    note = data.get("client_note")

    # geriye dönük uyumluluk: eski key'ler gelirse de kabul et
    if rating is None:
        rating = data.get("rating")
    if note is None:
        note = data.get("note")

    if rating is not None:
        parsed = parse_int(rating, "client_rating_to_teacher", required=False)
        if isinstance(parsed, tuple):
            return parsed
        rating_int = parsed
        if rating_int < 1 or rating_int > 5:
            return jsonify({"message": "rating must be 1-5"}), 400
        s.client_rating_to_teacher = rating_int

    if note is not None:
        s.client_note = str(note).strip()

    s.client_marked_at = datetime.utcnow()
    s.status = recalc_status(s)

    try:
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(s.to_dict()), 200
