from flask import Blueprint, request, jsonify, g
from app.database import db
from app.models.student import Student
from app.models.enrollment import Enrollment
from app.models.user import User
from app.auth.require_auth import require_auth

bp = Blueprint("students", __name__)


def get_my_student_profile():
    return Student.query.filter_by(user_id=g.user_id, deleted_at=None).first()

def student_to_dict_with_user(student: Student):
    data = student.to_dict()
    user = User.query.get(student.user_id)
    data["email"] = user.email if user else None
    data["phones"] = user.phones if user else None
    return data


@bp.get("/")
@require_auth
def list_students():
    """
    ADMIN: tüm öğrenciler
    TEACHER: sadece kendisine atanmış öğrenciler
    STUDENT: sadece kendi profili (liste yerine 1 kayıt döner)
    """
    include_deleted = request.args.get("include_deleted") == "1"
    if g.role == "ADMIN":
        q = Student.query
        if not include_deleted:
            q = q.filter(Student.deleted_at.is_(None))
        students = q.order_by(Student.id.desc()).all()
        return jsonify([student_to_dict_with_user(s) for s in students]), 200

    if g.role == "TEACHER":
        # teacher'ın öğrencileri: enrollment üzerinden
        student_ids = [
            e.student_id
            for e in Enrollment.query.filter_by(teacher_user_id=g.user_id).all()
        ]
        if not student_ids:
            return jsonify([]), 200
        students = Student.query.filter(Student.id.in_(student_ids)).filter(Student.deleted_at.is_(None)).order_by(Student.id.desc()).all()
        return jsonify([student_to_dict_with_user(s) for s in students]), 200

    if g.role == "STUDENT":
        me = get_my_student_profile()
        if not me:
            return jsonify({"message": "student_profile_not_found"}), 404
        return jsonify([student_to_dict_with_user(me)]), 200  # liste endpoint'i ama tek kayıt

    return jsonify({"message": "forbidden"}), 403


@bp.post("/")
@require_auth
def create_student():
    """
    SADECE ADMIN öğrenci oluşturur.
    Öğrencinin login hesabı user_id ile bağlanır.
    """
    if g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    data = request.get_json(silent=True) or {}

    full_name = (data.get("full_name") or "").strip()
    grade = data.get("grade")
    user_id = data.get("user_id")

    if not full_name:
        return jsonify({"message": "full_name boş olamaz"}), 400
    if user_id is None:
        return jsonify({"message": "user_id gerekli"}), 400

    try:
        user_id = int(user_id)
    except Exception:
        return jsonify({"message": "user_id must be integer"}), 400

    # 1 user -> 1 student profili
    exists = Student.query.filter_by(user_id=user_id).first()
    if exists:
        return jsonify({"message": "student profile already exists for this user_id", "student": exists.to_dict()}), 409

    student = Student(full_name=full_name, grade=grade, user_id=user_id)

    try:
        db.session.add(student)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(e)}), 400

    return jsonify(student.to_dict()), 201


@bp.get("/me")
@require_auth
def get_my_student():
    """
    STUDENT kendi profilini buradan net şekilde alır.
    """
    if g.role != "STUDENT":
        return jsonify({"message": "forbidden"}), 403

    me = get_my_student_profile()
    if not me:
        return jsonify({"message": "student_profile_not_found"}), 404
    return jsonify(student_to_dict_with_user(me)), 200


@bp.get("/<int:student_id>")
@require_auth
def get_student(student_id: int):
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"message": "Student not found"}), 404

    if g.role == "ADMIN":
        return jsonify(student_to_dict_with_user(student)), 200

    if g.role == "TEACHER":
        ok = Enrollment.query.filter_by(student_id=student_id, teacher_user_id=g.user_id).first()
        if not ok:
            return jsonify({"message": "forbidden"}), 403
        return jsonify(student_to_dict_with_user(student)), 200

    if g.role == "STUDENT":
        me = get_my_student_profile()
        if not me:
            return jsonify({"message": "student_profile_not_found"}), 404
        if me.id != student_id:
            return jsonify({"message": "forbidden"}), 403
        return jsonify(student_to_dict_with_user(student)), 200

    return jsonify({"message": "forbidden"}), 403


@bp.patch("/<int:student_id>")
@require_auth
def update_student(student_id: int):
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"message": "Student not found"}), 404

    # ADMIN her şeyi güncelleyebilir
    if g.role == "ADMIN":
        pass
    # STUDENT sadece kendi profilini güncelleyebilir
    elif g.role == "STUDENT":
        me = get_my_student_profile()
        if not me:
            return jsonify({"message": "student_profile_not_found"}), 404
        if me.id != student_id:
            return jsonify({"message": "forbidden"}), 403
    else:
        # TEACHER sadece eğitim alanlarını güncelleyebilir
        if g.role != "TEACHER":
            return jsonify({"message": "forbidden"}), 403
        ok = Enrollment.query.filter_by(student_id=student_id, teacher_user_id=g.user_id).first()
        if not ok:
            return jsonify({"message": "forbidden"}), 403

    data = request.get_json(silent=True) or {}

    if "full_name" in data:
        full_name = (data.get("full_name") or "").strip()
        if not full_name:
            return jsonify({"message": "full_name boş olamaz"}), 400
        student.full_name = full_name

    if "grade" in data:
        student.grade = data.get("grade")

    if "level" in data:
        student.level = data.get("level")

    if "target_exam" in data:
        student.target_exam = data.get("target_exam")

    if "strengths" in data:
        student.strengths = data.get("strengths")

    if "weaknesses" in data:
        student.weaknesses = data.get("weaknesses")

    # admin isterse student.user_id'yi de değiştirebilir (opsiyonel)
    if g.role == "ADMIN" and "user_id" in data:
        try:
            new_user_id = int(data.get("user_id"))
        except Exception:
            return jsonify({"message": "user_id must be integer"}), 400

        other = Student.query.filter_by(user_id=new_user_id).first()
        if other and other.id != student.id:
            return jsonify({"message": "user_id already bound to another student"}), 409
        student.user_id = new_user_id

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(e)}), 400

    return jsonify(student_to_dict_with_user(student)), 200
