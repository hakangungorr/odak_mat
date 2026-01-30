from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash

from app.database import db
from app.models.user import User
from app.models.role import Role

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password")
    full_name = (data.get("full_name") or "").strip()

    # client isterse role gönderebilir, göndermezse default TEACHER (sen öyle istiyordun)
    role_key = (data.get("role") or "TEACHER").strip().upper()

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    if not full_name:
        return jsonify({"error": "full_name is required"}), 400

    existing = User.query.filter_by(email=email).first()
    if existing:
        return jsonify({"error": "email already exists"}), 409

    # role doğrulama DB'den
    role = Role.query.filter_by(key=role_key).first()
    if not role:
        allowed = [r.key for r in Role.query.order_by(Role.key.asc()).all()]
        return jsonify({"error": "invalid role", "allowed": allowed}), 400

    user = User(
        email=email,
        full_name=full_name,
        password_hash=generate_password_hash(password),
        role_id=role.id,
        is_active=True,
    )

    try:
        user.save()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

    return jsonify({
        "message": "User created",
        "user": user.to_dict()
    }), 201
