from datetime import datetime
from flask import Blueprint, request, jsonify, g
from app.database import db
from app.models.homework import Homework, HomeworkStatus
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.student import Student
from app.auth.require_auth import require_auth

bp = Blueprint("homeworks", __name__)


def get_my_student_profile():
    return Student.query.filter_by(user_id=g.user_id).first()


@bp.get("/")
@require_auth
def list_homeworks():
    student_id = request.args.get("student_id", type=int)
    q = Homework.query

    if g.role == "ADMIN":
        if student_id:
            q = q.filter(Homework.student_id == student_id)
    elif g.role == "TEACHER":
        q = q.filter(Homework.teacher_user_id == g.user_id)
        if student_id:
            ok = Enrollment.query.filter_by(
                teacher_user_id=g.user_id,
                student_id=student_id,
                status=EnrollmentStatus.ACTIVE
            ).first()
            if not ok:
                return jsonify({"message": "forbidden_student"}), 403
            q = q.filter(Homework.student_id == student_id)
    elif g.role == "STUDENT":
        me = get_my_student_profile()
        if not me:
            return jsonify({"message": "student_profile_not_found"}), 404
        q = q.filter(Homework.student_id == me.id)
    else:
        return jsonify({"message": "forbidden"}), 403

    items = q.order_by(Homework.created_at.desc()).all()
    return jsonify([h.to_dict() for h in items]), 200


@bp.post("/")
@require_auth
def create_homework():
    if g.role not in {"ADMIN", "TEACHER"}:
        return jsonify({"message": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    title = (data.get("title") or "").strip()
    description = data.get("description")
    due_date = data.get("due_date")

    if not student_id:
        return jsonify({"message": "student_id zorunlu"}), 400
    if not title:
        return jsonify({"message": "title zorunlu"}), 400

    try:
        student_id = int(student_id)
    except Exception:
        return jsonify({"message": "student_id must be integer"}), 400

    # teacher sadece kendi öğrencisine ödev verir
    if g.role == "TEACHER":
        ok = Enrollment.query.filter_by(
            teacher_user_id=g.user_id,
            student_id=student_id,
            status=EnrollmentStatus.ACTIVE
        ).first()
        if not ok:
            return jsonify({"message": "forbidden_student"}), 403

    parsed_due = None
    if due_date:
        try:
            parsed_due = datetime.fromisoformat(str(due_date))
        except Exception:
            return jsonify({"message": "due_date must be ISO format"}), 400

    h = Homework(
        student_id=student_id,
        teacher_user_id=g.user_id,
        title=title,
        description=description,
        due_date=parsed_due,
        status=HomeworkStatus.ASSIGNED,
    )

    try:
        db.session.add(h)
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(h.to_dict()), 201


@bp.patch("/<int:homework_id>")
@require_auth
def update_homework(homework_id: int):
    h = Homework.query.get(homework_id)
    if not h:
        return jsonify({"message": "Homework not found"}), 404

    if g.role == "TEACHER":
        if h.teacher_user_id != g.user_id:
            return jsonify({"message": "forbidden"}), 403
    elif g.role == "STUDENT":
        me = get_my_student_profile()
        if not me or h.student_id != me.id:
            return jsonify({"message": "forbidden"}), 403
    elif g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    data = request.get_json(silent=True) or {}

    if "status" in data:
        raw = (data.get("status") or "").strip().upper()
        try:
            h.status = HomeworkStatus(raw)
        except Exception:
            return jsonify({"message": "invalid status", "allowed": [e.value for e in HomeworkStatus]}), 400

    if "student_note" in data and g.role == "STUDENT":
        h.student_note = data.get("student_note")

    if "teacher_note" in data and g.role in {"TEACHER", "ADMIN"}:
        h.teacher_note = data.get("teacher_note")

    if "grade" in data and g.role in {"TEACHER", "ADMIN"}:
        try:
            h.grade = int(data.get("grade"))
        except Exception:
            return jsonify({"message": "grade must be integer"}), 400

    try:
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(h.to_dict()), 200
