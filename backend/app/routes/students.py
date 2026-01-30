from flask import Blueprint, request, jsonify
from app.database import db
from app.models.student import Student

bp = Blueprint("students", __name__, url_prefix="/api/students")


@bp.get("")
def list_students():
    students = Student.query.all()
    return jsonify([s.to_dict() for s in students]), 200


@bp.post("")
def create_student():
    data = request.get_json(silent=True) or {}

    full_name = (data.get("full_name") or "").strip()
    grade = data.get("grade")
    client_user_id = data.get("client_user_id")

    if not full_name:
        return jsonify({"message": "full_name boş olamaz"}), 400
    if client_user_id is None:
        return jsonify({"message": "client_user_id gerekli"}), 400

    student = Student(full_name=full_name, grade=grade, client_user_id=client_user_id)

    try:
        db.session.add(student)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(e)}), 400

    return jsonify(student.to_dict()), 201

@bp.get("/<int:student_id>")
def get_student(student_id):
    student = Student.query.get(student_id)
    if not student:
        return jsonify ({"message": "Student not found"}) , 404
    return jsonify(student.to_dict()) ,200




@bp.patch("/<int:student_id>")
def update_student(student_id):
    student = Student.query.get(student_id)
    if not student:
        return jsonify({"message": "Student not found"}), 404

    data = request.get_json(silent=True) or {}

    if "full_name" in data:
        full_name = (data.get("full_name") or "").strip()
        if not full_name:
            return jsonify({"message": "full_name boş olamaz"}), 400
        student.full_name = full_name

    if "grade" in data:
        student.grade = data.get("grade")

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(e)}), 400

    return jsonify(student.to_dict()), 200
