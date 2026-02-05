from flask import Blueprint, request, jsonify, g
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from app.database import db
from app.models.user import User
from app.models.role import Role
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.lesson_session import LessonSession
from app.auth.require_auth import require_auth

bp = Blueprint("users", __name__)


def norm_key(raw):
    if raw is None:
        return None
    v = str(raw).strip().upper()
    return v if v else None


def user_to_dict(u: User):
    # password_hash asla dönme
    return {
        "id": u.id,
        "full_name": u.full_name,
        "email": u.email,
        "role_id": u.role_id,
        "role_key": u.role.key if u.role else None,
        "is_active": u.is_active,
        "teacher_rate": float(u.teacher_rate) if getattr(u, "teacher_rate", None) is not None else None,
        "phones": u.phones,
        "created_at": u.created_at.isoformat() if getattr(u, "created_at", None) else None,
        "updated_at": u.updated_at.isoformat() if getattr(u, "updated_at", None) else None,
    }


@bp.get("/")
@require_auth
def list_users():
    """
    ADMIN: tüm user'ları listeler, role_key filtresi destekler.
    GET /api/users?role=TEACHER
    """
    if g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    role_key = norm_key(request.args.get("role"))

    q = User.query
    include_deleted = request.args.get("include_deleted") == "1"
    if not include_deleted:
        q = q.filter(User.is_active.is_(True), User.deleted_at.is_(None))

    if role_key:
        role = Role.query.filter_by(key=role_key).first()
        if not role:
            return jsonify({"message": "invalid role", "role": role_key}), 400
        q = q.filter(User.role_id == role.id)

    users = q.order_by(User.id.desc()).all()
    return jsonify([user_to_dict(u) for u in users]), 200


@bp.get("/<int:user_id>")
@require_auth
def get_user(user_id: int):
    if g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    u = User.query.get(user_id)
    if not u:
        return jsonify({"message": "User not found"}), 404

    return jsonify(user_to_dict(u)), 200


@bp.post("/")
@require_auth
def create_user():
    """
    ADMIN user oluşturur.
    Body: { full_name, email, password, role_key }
    role_key verilmezse TEACHER varsayıyoruz.
    """
    if g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    data = request.get_json(silent=True) or {}

    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role_key = norm_key(data.get("role_key")) or "TEACHER"
    is_active = bool(data.get("is_active", True))
    teacher_rate = data.get("teacher_rate")
    phones = data.get("phones")

    if not full_name:
        return jsonify({"message": "full_name boş olamaz"}), 400
    if not email:
        return jsonify({"message": "email boş olamaz"}), 400
    if not password or len(password) < 6:
        return jsonify({"message": "password en az 6 karakter olmalı"}), 400

    role = Role.query.filter_by(key=role_key).first()
    if not role:
        return jsonify({
            "message": "invalid role_key",
            "role_key": role_key
        }), 400

    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({"message": "email already exists"}), 409

    u = User(
        full_name=full_name,
        email=email,
        role_id=role.id,
        is_active=is_active,
    )
    if teacher_rate is not None:
        try:
            u.teacher_rate = float(teacher_rate)
        except Exception:
            return jsonify({"message": "teacher_rate must be number"}), 400
    if phones is not None:
        u.phones = str(phones)
    u.set_password(password)

    try:
        db.session.add(u)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "email already exists"}), 409
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(user_to_dict(u)), 201


@bp.patch("/<int:user_id>")
@require_auth
def update_user(user_id: int):
    if g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    u = User.query.get(user_id)
    if not u:
        return jsonify({"message": "User not found"}), 404

    data = request.get_json(silent=True) or {}

    if "teacher_rate" in data:
        try:
            u.teacher_rate = float(data.get("teacher_rate"))
        except Exception:
            return jsonify({"message": "teacher_rate must be number"}), 400
    if "phones" in data:
        u.phones = str(data.get("phones"))

    try:
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(user_to_dict(u)), 200


@bp.delete("/<int:user_id>")
@require_auth
def delete_user(user_id: int):
    """
    ADMIN teacher (veya user) siler.
    """
    if g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    u = User.query.get(user_id)
    if not u:
        return jsonify({"message": "User not found"}), 404

    # Admin hesabını silmeye izin verme
    if u.role and u.role.key == "ADMIN":
        return jsonify({"message": "cannot_delete_admin"}), 400

    try:
        # Öğretmene bağlı enrollments pasif (silmeden)
        Enrollment.query.filter_by(teacher_user_id=u.id).update(
            {"status": EnrollmentStatus.PASSIVE},
            synchronize_session=False,
        )
        u.is_active = False
        u.deleted_at = datetime.utcnow()
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify({"message": "user_deleted", "user_id": user_id}), 200
