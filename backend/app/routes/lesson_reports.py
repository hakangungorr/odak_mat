from flask import Blueprint, request, jsonify, g
from app.database import db
from app.models.lesson_report import LessonReport
from app.models.lesson_session import LessonSession
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.student import Student
from app.auth.require_auth import require_auth

bp = Blueprint("lesson_reports", __name__)


def can_access_student(student_id: int):
    if g.role == "ADMIN":
        return True
    if g.role == "TEACHER":
        ok = Enrollment.query.filter_by(
            teacher_user_id=g.user_id,
            student_id=student_id,
            status=EnrollmentStatus.ACTIVE
        ).first()
        return bool(ok)
    if g.role == "STUDENT":
        return False
    return False


@bp.get("/")
@require_auth
def list_reports():
    student_id = request.args.get("student_id", type=int)
    session_id = request.args.get("lesson_session_id", type=int)

    q = LessonReport.query

    if g.role == "ADMIN":
        if student_id:
            q = q.filter(LessonReport.student_id == student_id)
        if session_id:
            q = q.filter(LessonReport.lesson_session_id == session_id)
    elif g.role == "TEACHER":
        q = q.filter(LessonReport.teacher_user_id == g.user_id)
        if student_id:
            if not can_access_student(student_id):
                return jsonify({"message": "forbidden_student"}), 403
            q = q.filter(LessonReport.student_id == student_id)
    elif g.role == "STUDENT":
        me = Student.query.filter_by(user_id=g.user_id).first()
        if not me:
            return jsonify({"message": "student_profile_not_found"}), 404
        q = q.filter(LessonReport.student_id == me.id)
    else:
        return jsonify({"message": "forbidden"}), 403

    reports = q.order_by(LessonReport.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reports]), 200


@bp.post("/")
@require_auth
def create_report():
    if g.role not in {"ADMIN", "TEACHER"}:
        return jsonify({"message": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    lesson_session_id = data.get("lesson_session_id")
    topic = data.get("topic")
    performance_rating = data.get("performance_rating")
    teacher_note = data.get("teacher_note")
    next_note = data.get("next_note")

    if not lesson_session_id:
        return jsonify({"message": "lesson_session_id zorunlu"}), 400
    try:
        lesson_session_id = int(lesson_session_id)
    except Exception:
        return jsonify({"message": "lesson_session_id must be integer"}), 400

    session = LessonSession.query.get(lesson_session_id)
    if not session:
        return jsonify({"message": "LessonSession not found"}), 404

    # teacher sadece kendi dersi
    if g.role == "TEACHER" and session.teacher_user_id != g.user_id:
        return jsonify({"message": "forbidden"}), 403

    if performance_rating is not None:
        try:
            performance_rating = int(performance_rating)
        except Exception:
            return jsonify({"message": "performance_rating must be integer"}), 400
        if performance_rating < 1 or performance_rating > 5:
            return jsonify({"message": "performance_rating 1-5 olmalı"}), 400

    report = LessonReport(
        lesson_session_id=lesson_session_id,
        student_id=session.student_id,
        teacher_user_id=session.teacher_user_id,
        topic=topic,
        performance_rating=performance_rating,
        teacher_note=teacher_note,
        next_note=next_note,
    )

    try:
        db.session.add(report)
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(report.to_dict()), 201
