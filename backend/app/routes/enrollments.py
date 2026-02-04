from flask import Blueprint, request, jsonify, g
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.student import Student
from app.auth.require_auth import require_auth

bp = Blueprint("enrollments", __name__)

ALLOWED_STATUS = {s.value for s in EnrollmentStatus}  # {"ACTIVE","PASSIVE"}


def get_my_student_profile():
    # Student.user_id = users.id (öğrenci login)
    return Student.query.filter_by(user_id=g.user_id).first()


@bp.get("/")
@require_auth
def list_enrollments():
    student_id = request.args.get("student_id", type=int)
    teacher_user_id = request.args.get("teacher_user_id", type=int)
    status = request.args.get("status", type=str)

    q = Enrollment.query

    if g.role == "ADMIN":
        # admin serbest filtre
        if student_id:
            q = q.filter(Enrollment.student_id == student_id)
        if teacher_user_id:
            q = q.filter(Enrollment.teacher_user_id == teacher_user_id)

    elif g.role == "TEACHER":
        # teacher sadece kendi atamaları
        q = q.filter(Enrollment.teacher_user_id == g.user_id)

        if teacher_user_id and teacher_user_id != g.user_id:
            return jsonify({"message": "forbidden_filter"}), 403

        if student_id:
            # teacher kendi öğrencisi değilse açıkça forbidden dönelim
            ok = Enrollment.query.filter_by(
                teacher_user_id=g.user_id,
                student_id=student_id
            ).first()
            if not ok:
                return jsonify({"message": "forbidden_student"}), 403
            q = q.filter(Enrollment.student_id == student_id)

    elif g.role == "STUDENT":
        me = get_my_student_profile()
        if not me:
            return jsonify({"message": "student_profile_not_found"}), 404

        q = q.filter(Enrollment.student_id == me.id)

        if student_id and student_id != me.id:
            return jsonify({"message": "forbidden_student"}), 403

        if teacher_user_id:
            my = Enrollment.query.filter_by(student_id=me.id).first()
            if not my:
                return jsonify({"message": "teacher_not_assigned"}), 409
            if teacher_user_id != my.teacher_user_id:
                return jsonify({"message": "forbidden_teacher"}), 403
            q = q.filter(Enrollment.teacher_user_id == teacher_user_id)

    else:
        return jsonify({"message": "forbidden"}), 403

    # status filtresi
    if status:
        try:
            status_enum = EnrollmentStatus(status.strip().upper())
        except Exception:
            return jsonify({"message": "invalid status", "allowed": sorted(ALLOWED_STATUS)}), 400
        q = q.filter(Enrollment.status == status_enum)
    else:
        q = q.filter(Enrollment.status == EnrollmentStatus.ACTIVE)

    enrollments = q.order_by(Enrollment.id.desc()).all()
    return jsonify([e.to_dict() for e in enrollments]), 200


@bp.get("/<int:enrollment_id>")
@require_auth
def get_enrollment(enrollment_id: int):
    e = Enrollment.query.get(enrollment_id)
    if not e:
        return jsonify({"message": "Enrollment not found"}), 404

    if g.role == "ADMIN":
        pass
    elif g.role == "TEACHER":
        if e.teacher_user_id != g.user_id:
            return jsonify({"message": "forbidden"}), 403
    elif g.role == "STUDENT":
        me = get_my_student_profile()
        if not me:
            return jsonify({"message": "student_profile_not_found"}), 404
        if e.student_id != me.id:
            return jsonify({"message": "forbidden"}), 403
    else:
        return jsonify({"message": "forbidden"}), 403

    return jsonify(e.to_dict()), 200


@bp.post("/")
@require_auth
def create_enrollment():
    # sadece admin atama yapabilir
    if g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    teacher_user_id = data.get("teacher_user_id")
    status_raw = (data.get("status") or "ACTIVE").strip().upper()

    if student_id is None:
        return jsonify({"message": "student_id zorunlu"}), 400
    if teacher_user_id is None:
        return jsonify({"message": "teacher_user_id zorunlu"}), 400

    try:
        student_id = int(student_id)
        teacher_user_id = int(teacher_user_id)
    except Exception:
        return jsonify({"message": "student_id / teacher_user_id must be integer"}), 400

    try:
        status_enum = EnrollmentStatus(status_raw)
    except Exception:
        return jsonify({"message": "invalid status", "allowed": sorted(ALLOWED_STATUS)}), 400

    # aynı student için varsa update
    existing = Enrollment.query.filter_by(student_id=student_id).first()
    if existing:
        existing.teacher_user_id = teacher_user_id
        existing.status = status_enum
        try:
            db.session.commit()
        except Exception as ex:
            db.session.rollback()
            return jsonify({"message": "DB error", "error": str(ex)}), 400
        return jsonify(existing.to_dict()), 200

    e = Enrollment(student_id=student_id, teacher_user_id=teacher_user_id, status=status_enum)

    try:
        e.save()
    except IntegrityError as ex:
        db.session.rollback()
        # unique(student_id) varsa burası güvence
        return jsonify({"message": "Enrollment already exists", "error": str(ex)}), 409
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(e.to_dict()), 201


@bp.patch("/<int:enrollment_id>")
@require_auth
def update_enrollment(enrollment_id: int):
    if g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    e = Enrollment.query.get(enrollment_id)
    if not e:
        return jsonify({"message": "Enrollment not found"}), 404

    data = request.get_json(silent=True) or {}

    if "teacher_user_id" in data:
        try:
            e.teacher_user_id = int(data.get("teacher_user_id"))
        except Exception:
            return jsonify({"message": "teacher_user_id must be integer"}), 400

    if "status" in data:
        try:
            e.status = EnrollmentStatus((data.get("status") or "").strip().upper())
        except Exception:
            return jsonify({"message": "invalid status", "allowed": sorted(ALLOWED_STATUS)}), 400

    try:
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(e.to_dict()), 200


@bp.delete("/<int:enrollment_id>")
@require_auth
def delete_enrollment(enrollment_id: int):
    if g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    e = Enrollment.query.get(enrollment_id)
    if not e:
        return jsonify({"message": "Enrollment not found"}), 404

    e.status = EnrollmentStatus.PASSIVE

    try:
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify({"message": "Enrollment soft-deleted (PASSIVE)", "enrollment": e.to_dict()}), 200
