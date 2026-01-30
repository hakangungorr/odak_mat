from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError

from app.database import db
from app.models.enrollment import Enrollment, EnrollmentStatus

bp = Blueprint("enrollments", __name__, url_prefix="/api/enrollments")

ALLOWED_STATUS = {s.value for s in EnrollmentStatus}  # {"ACTIVE", "PASSIVE"}


@bp.get("")
def list_enrollments():
    student_id = request.args.get("student_id", type=int)
    teacher_user_id = request.args.get("teacher_user_id", type=int)
    status = request.args.get("status", type=str)

    q = Enrollment.query

    if student_id:
        q = q.filter(Enrollment.student_id == student_id)

    if teacher_user_id:
        q = q.filter(Enrollment.teacher_user_id == teacher_user_id)

    if status:
        try:
            status_enum = EnrollmentStatus(status.strip().upper())
        except Exception:
            return jsonify({
                "message": "invalid status",
                "allowed": sorted(ALLOWED_STATUS)
            }), 400
        q = q.filter(Enrollment.status == status_enum)
    else:
        # status verilmemişse default ACTIVE
        q = q.filter(Enrollment.status == EnrollmentStatus.ACTIVE)

    enrollments = q.order_by(Enrollment.id.desc()).all()
    return jsonify([e.to_dict() for e in enrollments]), 200


@bp.get("/<int:enrollment_id>")
def get_enrollment(enrollment_id):
    e = Enrollment.query.get(enrollment_id)
    if not e:
        return jsonify({"message": "Enrollment not found"}), 404
    return jsonify(e.to_dict()), 200


@bp.post("")
def create_enrollment():
    data = request.get_json(silent=True) or {}

    student_id = data.get("student_id")  # ✅ student__id değil
    teacher_user_id = data.get("teacher_user_id")
    status_raw = (data.get("status") or "ACTIVE").strip().upper()

    if student_id is None:
        return jsonify({"message": "student_id zorunlu"}), 400
    if teacher_user_id is None:
        return jsonify({"message": "teacher_user_id zorunlu"}), 400

    try:
        status_enum = EnrollmentStatus(status_raw)
    except Exception:
        return jsonify({
            "message": "invalid status",
            "allowed": sorted(ALLOWED_STATUS)
        }), 400

    e = Enrollment(
        student_id=student_id,
        teacher_user_id=teacher_user_id,
        status=status_enum,
    )

    try:
        e.save()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"message": "Enrollment already exists for this teacher & student"}), 409
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(e.to_dict()), 201


@bp.patch("/<int:enrollment_id>")
def update_enrollment(enrollment_id):
    e = Enrollment.query.get(enrollment_id)
    if not e:
        return jsonify({"message": "Enrollment not found"}), 404

    data = request.get_json(silent=True) or {}

    if "status" in data:
        try:
            e.status = EnrollmentStatus((data.get("status") or "").strip().upper())
        except Exception:
            return jsonify({
                "message": "invalid status",
                "allowed": sorted(ALLOWED_STATUS)
            }), 400

    try:
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(e.to_dict()), 200


@bp.delete("/<int:enrollment_id>")
def delete_enrollment(enrollment_id):
    e = Enrollment.query.get(enrollment_id)
    if not e:
        return jsonify({"message": "Enrollment not found"}), 404

    #soft delete     
    e.status = EnrollmentStatus.PASSIVE

    try:
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify({
        "message": "Enrollment soft-deleted (PASSIVE)",
        "enrollment": e.to_dict()
    }), 200