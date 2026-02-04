from datetime import datetime, timedelta, timezone
import os

import jwt
from flask import current_app


def _get_jwt_secret() -> str:
    # Önce Flask config, yoksa env, yoksa hata
    secret = current_app.config.get("JWT_SECRET") or os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is missing (set app.config['JWT_SECRET'] or env JWT_SECRET)")
    return secret


def _get_jwt_alg() -> str:
    return current_app.config.get("JWT_ALG") or os.environ.get("JWT_ALG", "HS256")


def _get_expire_min() -> int:
    v = current_app.config.get("JWT_EXPIRE_MIN") or os.environ.get("JWT_EXPIRE_MIN", "1440")
    try:
        return int(v)
    except Exception:
        return 1440


def make_token(user_id: int, role: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=_get_expire_min())

    payload = {
        "user_id": user_id,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }

    secret = _get_jwt_secret()
    alg = _get_jwt_alg()
    return jwt.encode(payload, secret, algorithm=alg)


def decode_token(token: str) -> dict:
    secret = _get_jwt_secret()
    alg = _get_jwt_alg()
    return jwt.decode(token, secret, algorithms=[alg])
