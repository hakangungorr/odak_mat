from datetime import datetime, timedelta, timezone
import jwt
from flask import current_app

def make_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=current_app.config.get("JWT_EXPIRE_MIN", 1440))

    payload = {
        "user_id": user_id,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }

    secret = current_app.config["JWT_SECRET"]
    alg = current_app.config.get("JWT_ALG", "HS256")
    return jwt.encode(payload, secret, algorithm=alg)

def decode_token(token: str) -> dict:
    secret = current_app.config["JWT_SECRET"]
    alg = current_app.config.get("JWT_ALG", "HS256")
    return jwt.decode(token, secret, algorithms=[alg])
