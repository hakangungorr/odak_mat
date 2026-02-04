from __future__ import annotations

from functools import wraps
from flask import jsonify, g

from app.auth.require_auth import require_auth


def _extract_session_id(args, kwargs):
    session_id = kwargs.get("session_id")
    if session_id is None and args:
        session_id = args[0]
    return session_id


def require_teacher_for_session(fn):
    @wraps(fn)
    @require_auth
    def wrapper(*args, **kwargs):
        session_id = _extract_session_id(args, kwargs)
        if session_id is None:
            return jsonify({"message": "session_id missing"}), 400

        from app.models.lesson_session import LessonSession

        s = LessonSession.query.get(session_id)
        if not s:
            return jsonify({"message": "LessonSession not found"}), 404

        # ADMIN override
        if getattr(g, "role", None) == "ADMIN":
            g.session = s
            return fn(*args, **kwargs)

        # sadece TEACHER rolü + kendi session'ı
        if getattr(g, "role", None) != "TEACHER":
            return jsonify({"message": "forbidden"}), 403

        if g.user_id != s.teacher_user_id:
            return jsonify({"message": "forbidden"}), 403

        g.session = s
        return fn(*args, **kwargs)

    return wrapper


def require_student_for_session(fn):
    """
    Eski require_client_for_session yerine:
    STUDENT kendi hesabıyla giriş yapıyor -> Student.user_id ile kontrol
    """
    @wraps(fn)
    @require_auth
    def wrapper(*args, **kwargs):
        session_id = _extract_session_id(args, kwargs)
        if session_id is None:
            return jsonify({"message": "session_id missing"}), 400

        from app.models.lesson_session import LessonSession
        from app.models.student import Student

        s = LessonSession.query.get(session_id)
        if not s:
            return jsonify({"message": "LessonSession not found"}), 404

        student = Student.query.get(s.student_id)
        if not student:
            return jsonify({"message": "Student not found"}), 404

        # ADMIN override
        if getattr(g, "role", None) == "ADMIN":
            g.session = s
            g.student = student
            return fn(*args, **kwargs)

        # sadece STUDENT rolü + kendi student profili
        if getattr(g, "role", None) != "STUDENT":
            return jsonify({"message": "forbidden"}), 403

        # ✅ Student modelinde alan adı artık user_id olmalı
        if g.user_id != student.user_id:
            return jsonify({"message": "forbidden"}), 403

        g.session = s
        g.student = student
        return fn(*args, **kwargs)

    return wrapper


def require_owner_for_session(fn):
    """
    Owner = (admin) OR (teacher of session) OR (student of session)
    """
    @wraps(fn)
    @require_auth
    def wrapper(*args, **kwargs):
        session_id = _extract_session_id(args, kwargs)
        if session_id is None:
            return jsonify({"message": "session_id missing"}), 400

        from app.models.lesson_session import LessonSession
        from app.models.student import Student

        s = LessonSession.query.get(session_id)
        if not s:
            return jsonify({"message": "LessonSession not found"}), 404

        student = Student.query.get(s.student_id)
        if not student:
            return jsonify({"message": "Student not found"}), 404

        # ADMIN override
        if getattr(g, "role", None) == "ADMIN":
            g.session = s
            g.student = student
            g.is_teacher = False
            g.is_student = False
            return fn(*args, **kwargs)

        is_teacher = (getattr(g, "role", None) == "TEACHER" and g.user_id == s.teacher_user_id)
        is_student = (getattr(g, "role", None) == "STUDENT" and g.user_id == student.user_id)

        if not (is_teacher or is_student):
            return jsonify({"message": "forbidden"}), 403

        g.session = s
        g.student = student
        g.is_teacher = is_teacher
        g.is_student = is_student
        return fn(*args, **kwargs)

    return wrapper


# Geriye dönük uyumluluk istersen:
require_client_for_session = require_student_for_session
