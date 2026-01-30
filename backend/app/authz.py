from __future__ import annotations

from functools import wraps
from flask import request,jsonify, g

def get_current_user_id() -> int | None:
    v = request.headers.get("X-User-Id")
    return int(v) if v and v.isdigit() else None

def require_user_id(fn):
    @wraps(fn)

    def wrapper(*args,**kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify ({"message":"X-User-Id header required"}), 401
        g.current_user_id = user_id 
        return fn(*args,**kwargs)

    return wrapper

def require_teacher_for_session(fn):
    @wraps(fn)
    @require_user_id
    
    def wrapper(*args, **kwargs):
        #session_id genelde route param.
        session_id = kwargs.get("session_id")
        if session_id is None and args:
            session_id = args[0]
        
        from app.models.lesson_session import LessonSession

        s = LessonSession.query.get(session_id)
        if not s:
            return jsonify({"message":"LessonSession not found"}), 404

        current_user_id = g.current_user_id
        if current_user_id != s.teacher_user_id:
            return jsonify({"message":"forbidden"}), 403

        g.session = s
        return fn(*args, **kwargs)

    return wrapper

def require_client_for_session(fn):
    @wraps(fn)
    @require_user_id
    def wrapper(*args, **kwargs):
        session_id = kwargs.get("session_id")
        if session_id is None and args:
            session_id = args[0]

        from app.models.lesson_session import LessonSession
        from app.models.student import Student

        s=LessonSession.query.get(session_id)

        if not s:
            return jsonify({"message":"LessonSession not found"}), 404

        student = Student.query.get(s.student_id)
        if not student:
            return jsonify({"message":"Student not found"}), 404

        current_user_id = g.current_user_id
        if current_user_id != student.client_user_id:
            return jsonify({"message":"forbidden"}),403

        g.session = s
        g.student = student
        return fn(*args, **kwargs)

    return wrapper 



def require_owner_for_session(fn):
    @wraps(fn)
    @require_user_id
    def wrapper(*args, **kwargs):
        session_id = kwargs.get("session_id")
        if session_id is None and args:
            session_id = args[0]

        from app.models.lesson_session import LessonSession
        from app.models.student import Student

        s = LessonSession.query.get(session_id)
        if not s:
            return jsonify({"message": "LessonSession not found"}), 404

        student = Student.query.get(s.student_id)
        if not student:
            return jsonify({"message": "Student not found"}), 404

        current_user_id = g.current_user_id

        is_teacher = (current_user_id == s.teacher_user_id)
        is_client = (current_user_id == student.client_user_id)

        if not (is_teacher or is_client):
            return jsonify({"message": "forbidden"}), 403

        g.session = s
        g.student = student
        g.is_teacher = is_teacher
        g.is_client = is_client
        return fn(*args, **kwargs)

    return wrapper