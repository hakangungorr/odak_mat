#“Protected endpoint’lerde require_auth decorator kullanıyoruz. 
# Authorization header’daki Bearer token’ı alıp decode ediyoruz, expire ve signature kontrolü yapıyoruz. 
# Token içindeki user_id ile DB’den kullanıcıyı tekrar çekiyoruz; is_active ve rol kontrolü yapıyoruz.
#  Request context’e g.user_id ve g.role koyarak endpoint içinde yetkilendirme yapabiliyoruz. 
# Sistem stateless çalışıyor.”


from functools import wraps
from flask import request, jsonify, g
import jwt as pyjwt

from app.auth.jwt import decode_token
from app.models.user import User


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
        except Exception:
            return jsonify({"message": "invalid_token"}), 401

        user_id = payload.get("user_id")
        if not user_id:
            return jsonify({"message": "invalid_token_payload"}), 401

        try:
            user_id = int(user_id)
        except Exception:
            return jsonify({"message": "invalid_token_payload"}), 401

        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "user_not_found"}), 401

        if not user.is_active:
            return jsonify({"message": "user_inactive"}), 403

        # ✅ tek kaynak: DB
        g.user_id = user.id
        g.role = user.role.key if getattr(user, "role", None) is not None else None

        if not g.role:
            return jsonify({"message": "role_not_found"}), 500

        return fn(*args, **kwargs)

    return wrapper
