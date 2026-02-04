from flask import request, jsonify
from werkzeug.security import check_password_hash
from app.models.user import User
import jwt, os
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify

bp = Blueprint("auth", __name__)

@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({"error": "invalid credentials"}), 401

    # ✅ doğru doğrulama
    if not check_password_hash(user.password_hash, password):
        return jsonify({"error": "invalid credentials"}), 401

    if not user.is_active:
        return jsonify({"error": "user is inactive"}), 403

    payload = {
        "sub": user.id,
        "role": user.role.key if getattr(user, "role", None) else None,
        "exp": datetime.utcnow() + timedelta(days=7),
    }
    token = jwt.encode(payload, os.getenv("JWT_SECRET", "dev-secret"), algorithm="HS256")

    return jsonify({
        "access_token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": payload["role"],
        }
    }), 200
