from flask import Blueprint, request, jsonify, g
from werkzeug.security import generate_password_hash
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.user import User
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.models.lesson_session import LessonSession
from datetime import datetime
from app.models.role import Role
from app.auth.require_auth import require_auth

bp = Blueprint("admin_students", __name__)


def require_admin() -> bool:
    return getattr(g, "role", None) == "ADMIN"


@bp.post("/student-accounts")
@require_auth
def create_student_account():
    if not require_admin():
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}

    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = (data.get("password") or "").strip()
    grade = data.get("grade")

    if not full_name:
        return jsonify({"message": "full_name zorunlu"}), 400
    if not email:
        return jsonify({"message": "email zorunlu"}), 400
    if not password or len(password) < 6:
        return jsonify({"message": "password en az 6 karakter olmalı"}), 400

    # STUDENT role id'yi DB'den bul
    student_role = Role.query.filter_by(key="STUDENT").first()
    if not student_role:
        return jsonify({"message": "Student role not found"}), 500

    # 1) User oluştur
    u = User(
        full_name=full_name,
        email=email,
        password_hash=generate_password_hash(password),
        role_id=student_role.id,
        is_active=True,
    )

    try:
        db.session.add(u)
        db.session.flush()  # u.id gelsin

        # 2) Student oluştur (senin şemaya göre: user_id + full_name zorunlu)
        s = Student(
            user_id=u.id,
            full_name=full_name,
            grade=grade,
        )

        db.session.add(s)
        db.session.commit()

    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "email already exists"}), 409
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify({
        "user": {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role_id": u.role_id,
            "is_active": u.is_active,
        },
        "student": {
            "id": s.id,
            "user_id": s.user_id,
            "full_name": s.full_name,
            "grade": s.grade,
        }
    }), 201


@bp.delete("/student-accounts/<int:student_id>")
@require_auth
def delete_student_account(student_id: int):
    if not require_admin():
        return jsonify({"error": "forbidden"}), 403

    student = Student.query.get(student_id)
    if not student:
        return jsonify({"message": "Student not found"}), 404

    # Enrollments: hard delete to avoid FK constraint issues
    try:
        # Soft delete student, keep records for history/marketing
        student.deleted_at = datetime.utcnow()
        user = User.query.get(student.user_id)
        # Deactivate user so they cannot login again
        if user:
            user.is_active = False
            user.deleted_at = datetime.utcnow()
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify({"message": "student_account_deleted", "student_id": student_id}), 200
