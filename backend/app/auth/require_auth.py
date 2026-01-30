from functools import wraps
from flask import request, jsonify, g
import jwt as pyjwt
from app.auth.jwt import decode_token

def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization") or ""
        if not auth.startswith("Bearer "):
            return jsonify({"message": "missing_token"}), 401

        token = auth.split(" ", 1)[1].strip()
        if not token:
            return jsonify({"message": "missing_token"}), 401

        try:
            payload = decode_token(token)
        except pyjwt.ExpiredSignatureError:
            return jsonify({"message": "token_expired"}), 401
        except pyjwt.InvalidTokenError:
            return jsonify({"message": "invalid_token"}), 401

        g.user_id = payload.get("user_id")
        g.role = payload.get("role")

        if not g.user_id:
            return jsonify({"message": "invalid_token_payload"}), 401

        return fn(*args, **kwargs)
    return wrapper
