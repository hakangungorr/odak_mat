from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash

from app.database import db
from app.models.user import User
from app.models.role import Role
from werkzeug.security import generate_password_hash, check_password_hash
from app.auth.jwt import make_token


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




@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}

    email = {data.get("email") or ""}.strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error":"email and password are required"})

    user = User.quer.filter_by(email=email).first()
    if not user:
        return jsonify({"error":"invalid credentials"}),401

    if not user.is_active:
        return jsonify({"error":"user is inactive"}), 403

    if not check_password_hash(user.password_hash,password):
        return jsonify({"error":"invalid credentials"}), 401


    #Role tablosundan key al (TEACHER/CLIENT/ADMIN)
    role_key = None

    if getattr(user,"role",None) is not None:
        role_key = user.role.key

    else:
        role = Role.query.get(user.role_id)
        role_key = role.key if role else "CLIENT"
    
    token = make_token(user.id,role_key)

    return jsonify({
    "token": token ,
    "user": user.to_dict(),
}), 200