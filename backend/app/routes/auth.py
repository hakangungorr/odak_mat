# Auth modülünde /api/auth/login endpoint’imiz var.
# Email ve şifreyi alıp validate ediyoruz, kullanıcıyı DB’den buluyoruz, hashlenmiş şifreyi doğruluyoruz.
# Hesap aktifse kullanıcının rolünü alıp JWT token üretiyoruz ve frontend’e token ile birlikte temel kullanıcı bilgisini dönüyoruz.
# Frontend token’ı Authorization Bearer olarak sonraki isteklerde kullanıyor

from flask import request, jsonify
from werkzeug.security import check_password_hash
from app.models.user import User
from app.auth.jwt import make_token
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

    role_key = user.role.key if getattr(user, "role", None) else None
    token = make_token(user.id, role_key)

    return jsonify({
        "access_token": token,
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": role_key,
            "teacher_rate": float(user.teacher_rate) if getattr(user, "teacher_rate", None) is not None else None,
        }
    }), 200
