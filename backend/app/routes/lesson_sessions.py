from datetime import datetime
from flask import Blueprint, request, jsonify, g
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.lesson_session import LessonSession, SessionMode, SessionStatus
from app.models.student import Student
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.auth.require_auth import require_auth

bp = Blueprint("lesson_sessions", __name__)


# ---------- helpers ----------
def parse_enum(enum_cls, raw, field_name: str):
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


def get_my_student_profile():
    """
    STUDENT kullanıcısının Student kaydı.
    Senin schema: students.client_user_id -> users.id
    """
    return Student.query.filter_by(client_user_id=g.user_id).first()


def enrollment_teacher_for_student(student_id: int):
    return [
        e.teacher_user_id
        for e in Enrollment.query.filter_by(student_id=student_id, status=EnrollmentStatus.ACTIVE).all()
    ]


def recalc_status(s: LessonSession) -> SessionStatus:
    # CANCELLED/MISSED sabit
    if s.status in {SessionStatus.CANCELLED, SessionStatus.MISSED}:
        return s.status

    teacher_ok = bool(s.teacher_marked_at)
    student_ok = bool(s.student_marked_at)

    if teacher_ok and student_ok:
        return SessionStatus.COMPLETED
    if teacher_ok or student_ok:
        return SessionStatus.PENDING_CONFIRMATION
    return SessionStatus.PLANNED


ALLOWED_TRANSITIONS = {
    SessionStatus.PLANNED: {SessionStatus.CANCELLED, SessionStatus.MISSED},
    SessionStatus.PENDING_CONFIRMATION: {SessionStatus.CANCELLED, SessionStatus.MISSED},
    SessionStatus.COMPLETED: set(),
    SessionStatus.CANCELLED: set(),
    SessionStatus.MISSED: set(),
}


def load_session_or_404(session_id: int):
    s = LessonSession.query.get(session_id)
    if not s:
        return None, (jsonify({"message": "LessonSession not found"}), 404)
    return s, None


def require_owner_for_view(s: LessonSession):
    """
    VIEW owner:
      ADMIN: ok
      TEACHER: kendi session'ı
      STUDENT: kendi student profiline ait session
    """
    if g.role == "ADMIN":
        return None

    if g.role == "TEACHER":
        if s.teacher_user_id != g.user_id:
            return jsonify({"message": "forbidden"}), 403
        return None

    if g.role == "STUDENT":
        me = get_my_student_profile()
        if not me:
            return jsonify({"message": "student_profile_not_found"}), 404
        if s.student_id != me.id:
            return jsonify({"message": "forbidden"}), 403
        return None

    return jsonify({"message": "forbidden"}), 403


# ---------- routes ----------
@bp.get("/")
@require_auth
def list_lesson_sessions():
    """
    ADMIN: tüm dersler (filtre serbest)
    TEACHER: sadece kendi dersleri (filtre kısıtlı)
    STUDENT: sadece kendi dersleri (filtre kısıtlı)
    """
    teacher_user_id = request.args.get("teacher_user_id", type=int)
    student_id = request.args.get("student_id", type=int)
    status_raw = request.args.get("status", type=str)

    q = LessonSession.query

    if g.role == "ADMIN":
        if teacher_user_id:
            q = q.filter(LessonSession.teacher_user_id == teacher_user_id)
        if student_id:
            q = q.filter(LessonSession.student_id == student_id)

    elif g.role == "TEACHER":
        q = q.filter(LessonSession.teacher_user_id == g.user_id)

        if teacher_user_id and teacher_user_id != g.user_id:
            return jsonify({"message": "forbidden_filter"}), 403

        if student_id:
            ok = Enrollment.query.filter_by(
                teacher_user_id=g.user_id,
                student_id=student_id,
                status=EnrollmentStatus.ACTIVE
            ).first()
            if not ok:
                return jsonify({"message": "forbidden_student"}), 403
            q = q.filter(LessonSession.student_id == student_id)

    elif g.role == "STUDENT":
        me = get_my_student_profile()
        if not me:
            return jsonify({"message": "student_profile_not_found"}), 404

        q = q.filter(LessonSession.student_id == me.id)

        if teacher_user_id:
            my_teacher = enrollment_teacher_for_student(me.id)
            if not my_teacher:
                return jsonify({"message": "teacher_not_assigned"}), 409
            if teacher_user_id != my_teacher:
                return jsonify({"message": "forbidden_teacher"}), 403
            q = q.filter(LessonSession.teacher_user_id == teacher_user_id)

        if student_id and student_id != me.id:
            return jsonify({"message": "forbidden_student"}), 403

    else:
        return jsonify({"message": "forbidden"}), 403

    if status_raw:
        parsed = parse_enum(SessionStatus, status_raw, "status")
        if isinstance(parsed, tuple):
            return parsed
        status_enum = parsed
        q = q.filter(LessonSession.status == status_enum)

    sessions = q.order_by(LessonSession.scheduled_start.desc()).all()
    return jsonify([s.to_dict() for s in sessions]), 200


@bp.get("/<int:session_id>")
@require_auth
def get_lesson_session(session_id: int):
    s, err = load_session_or_404(session_id)
    if err:
        return err

    owner_err = require_owner_for_view(s)
    if owner_err:
        return owner_err

    return jsonify(s.to_dict()), 200


@bp.post("/")
@require_auth
def create_lesson_session():
    """
    ✅ TEACHER ve ADMIN oluşturabilir.
    ❌ STUDENT oluşturamaz.
    Kurala göre: sadece öğretmen ders planlar.
    """
    if g.role not in {"TEACHER", "ADMIN"}:
        return jsonify({"message": "forbidden"}), 403

    data = request.get_json(silent=True) or {}

    scheduled_start_raw = data.get("scheduled_start")
    duration_min_raw = data.get("duration_min")
    mode_raw = data.get("mode")
    topic = data.get("topic")

    scheduled_start = parse_iso_datetime(scheduled_start_raw, "scheduled_start", required=True)
    if isinstance(scheduled_start, tuple):
        return scheduled_start

    duration_min = parse_int(duration_min_raw, "duration_min", required=True)
    if isinstance(duration_min, tuple):
        return duration_min
    if duration_min <= 0:
        return jsonify({"message": "duration_min must be > 0"}), 400

    if mode_raw:
        parsed = parse_enum(SessionMode, mode_raw, "mode")
        if isinstance(parsed, tuple):
            return parsed
        mode_enum = parsed
    else:
        mode_enum = SessionMode.ONLINE

    created_by_user_id = g.user_id

    if g.role == "ADMIN":
        student_id = data.get("student_id")
        teacher_user_id = data.get("teacher_user_id")

        student_id_parsed = parse_int(student_id, "student_id", required=True)
        if isinstance(student_id_parsed, tuple):
            return student_id_parsed

        teacher_user_id_parsed = parse_int(teacher_user_id, "teacher_user_id", required=True)
        if isinstance(teacher_user_id_parsed, tuple):
            return teacher_user_id_parsed

        # Admin status set edebilir (opsiyonel)
        status_raw = data.get("status")
        if status_raw:
            parsed = parse_enum(SessionStatus, status_raw, "status")
            if isinstance(parsed, tuple):
                return parsed
            status_enum = parsed
        else:
            status_enum = SessionStatus.PLANNED

    else:
        # TEACHER
        teacher_user_id_parsed = g.user_id

        student_id = data.get("student_id")
        student_id_parsed = parse_int(student_id, "student_id", required=True)
        if isinstance(student_id_parsed, tuple):
            return student_id_parsed

        ok = Enrollment.query.filter_by(
            teacher_user_id=g.user_id,
            student_id=student_id_parsed,
            status=EnrollmentStatus.ACTIVE
        ).first()
        if not ok:
            return jsonify({"message": "forbidden_student"}), 403

        status_enum = SessionStatus.PLANNED

    s = LessonSession(
        student_id=student_id_parsed,
        teacher_user_id=teacher_user_id_parsed,
        created_by_user_id=created_by_user_id,
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
@require_auth
def update_lesson_session(session_id: int):
    """
    ✅ ADMIN: update
    ✅ TEACHER: sadece kendi dersini update
    ❌ STUDENT: update edemez (planlama teacher işi)
    """
    s, err = load_session_or_404(session_id)
    if err:
        return err

    if g.role not in {"TEACHER", "ADMIN"}:
        return jsonify({"message": "forbidden"}), 403

    if g.role == "TEACHER" and s.teacher_user_id != g.user_id:
        return jsonify({"message": "forbidden"}), 403

    data = request.get_json(silent=True) or {}

    # status manual (only CANCELLED/MISSED)
    if "status" in data:
        raw = (data.get("status") or "").strip().upper()
        parsed = parse_enum(SessionStatus, raw, "status")
        if isinstance(parsed, tuple):
            return parsed
        new_status = parsed

        if new_status not in {SessionStatus.CANCELLED, SessionStatus.MISSED}:
            return jsonify({"message": "status can only be set to CANCELLED or MISSED manually"}), 409

        allowed = ALLOWED_TRANSITIONS.get(s.status, set())
        if new_status not in allowed:
            return jsonify({
                "message": "invalid status transition",
                "from": s.status.value,
                "to": new_status.value,
                "allowed_to": [st.value for st in allowed],
            }), 409

        s.status = new_status

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
@require_auth
def teacher_mark(session_id: int):
    s, err = load_session_or_404(session_id)
    if err:
        return err

    # only TEACHER owner or ADMIN
    if g.role not in {"TEACHER", "ADMIN"}:
        return jsonify({"message": "forbidden"}), 403
    if g.role == "TEACHER" and s.teacher_user_id != g.user_id:
        return jsonify({"message": "forbidden"}), 403

    if s.status in {SessionStatus.CANCELLED, SessionStatus.MISSED}:
        return jsonify({"message": "cannot mark a cancelled/missed session"}), 409

    data = request.get_json(silent=True) or {}
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


@bp.patch("/<int:session_id>/student-mark")
@require_auth
def student_mark(session_id: int):
    """
    Student kendi dersi için mark atar.
    """
    s, err = load_session_or_404(session_id)
    if err:
        return err

    # only STUDENT owner or ADMIN
    if g.role not in {"STUDENT", "ADMIN"}:
        return jsonify({"message": "forbidden"}), 403

    if g.role == "STUDENT":
        me = get_my_student_profile()
        if not me:
            return jsonify({"message": "student_profile_not_found"}), 404
        if s.student_id != me.id:
            return jsonify({"message": "forbidden"}), 403

    if s.status in {SessionStatus.CANCELLED, SessionStatus.MISSED}:
        return jsonify({"message": "cannot mark a cancelled/missed session"}), 409

    data = request.get_json(silent=True) or {}

    rating = data.get("student_rating_to_teacher") or data.get("rating")
    note = data.get("student_note") or data.get("note")

    if rating is not None:
        parsed = parse_int(rating, "student_rating_to_teacher", required=False)
        if isinstance(parsed, tuple):
            return parsed
        rating_int = parsed
        if rating_int < 1 or rating_int > 5:
            return jsonify({"message": "rating must be 1-5"}), 400
        s.student_rating_to_teacher = rating_int

    if note is not None:
        s.student_note = str(note).strip()

    s.student_marked_at = datetime.utcnow()
    s.status = recalc_status(s)

    try:
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(s.to_dict()), 200
