from datetime import datetime
from flask import Blueprint, request, jsonify, g
from app.database import db
from app.models.package import Package, StudentPackage, PackageStatus
from app.models.student import Student
from app.auth.require_auth import require_auth

bp = Blueprint("packages", __name__)


def get_my_student_profile():
    return Student.query.filter_by(user_id=g.user_id).first()


@bp.get("/")
@require_auth
def list_packages():
    items = Package.query.order_by(Package.id.desc()).all()
    return jsonify([p.to_dict() for p in items]), 200


@bp.post("/")
@require_auth
def create_package():
    if g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    lesson_count = data.get("lesson_count")
    price = data.get("price")
    expires_in_days = data.get("expires_in_days")

    if not name:
        return jsonify({"message": "name zorunlu"}), 400
    if lesson_count is None:
        return jsonify({"message": "lesson_count zorunlu"}), 400
    try:
        lesson_count = int(lesson_count)
    except Exception:
        return jsonify({"message": "lesson_count must be integer"}), 400

    p = Package(
        name=name,
        lesson_count=lesson_count,
        price=price,
        expires_in_days=expires_in_days,
    )

    try:
        db.session.add(p)
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(p.to_dict()), 201


@bp.get("/student-packages")
@require_auth
def list_student_packages():
    if g.role == "STUDENT":
        me = get_my_student_profile()
        if not me:
            return jsonify({"message": "student_profile_not_found"}), 404
        items = StudentPackage.query.filter_by(student_id=me.id).order_by(StudentPackage.id.desc()).all()
        return jsonify([sp.to_dict() for sp in items]), 200

    if g.role == "ADMIN":
        student_id = request.args.get("student_id", type=int)
        q = StudentPackage.query
        if student_id:
            q = q.filter(StudentPackage.student_id == student_id)
        items = q.order_by(StudentPackage.id.desc()).all()
        return jsonify([sp.to_dict() for sp in items]), 200

    if g.role == "TEACHER":
        student_id = request.args.get("student_id", type=int)
        if not student_id:
            return jsonify({"message": "student_id required"}), 400
        # teacher sadece kendi öğrencisinin paketini görebilir
        from app.models.enrollment import Enrollment, EnrollmentStatus
        ok = Enrollment.query.filter_by(
            teacher_user_id=g.user_id,
            student_id=student_id,
            status=EnrollmentStatus.ACTIVE,
        ).first()
        if not ok:
            return jsonify({"message": "forbidden_student"}), 403
        items = StudentPackage.query.filter_by(student_id=student_id).order_by(StudentPackage.id.desc()).all()
        return jsonify([sp.to_dict() for sp in items]), 200

    return jsonify({"message": "forbidden"}), 403


@bp.post("/student-packages")
@require_auth
def assign_package_to_student():
    if g.role != "ADMIN":
        return jsonify({"message": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    package_id = data.get("package_id")
    start_date_raw = data.get("start_date")

    if not student_id or not package_id:
        return jsonify({"message": "student_id ve package_id zorunlu"}), 400

    try:
        student_id = int(student_id)
        package_id = int(package_id)
    except Exception:
        return jsonify({"message": "student_id/package_id must be integer"}), 400

    package = Package.query.get(package_id)
    if not package:
        return jsonify({"message": "Package not found"}), 404

    start_date = datetime.utcnow()
    if start_date_raw:
        try:
            start_date = datetime.fromisoformat(str(start_date_raw))
        except Exception:
            return jsonify({"message": "start_date must be ISO format"}), 400

    end_date = StudentPackage.compute_end_date(start_date, package.expires_in_days)

    sp = StudentPackage(
        student_id=student_id,
        package_id=package_id,
        remaining_lessons=package.lesson_count,
        start_date=start_date,
        end_date=end_date,
        status=PackageStatus.ACTIVE,
    )

    try:
        db.session.add(sp)
        db.session.commit()
    except Exception as ex:
        db.session.rollback()
        return jsonify({"message": "DB error", "error": str(ex)}), 400

    return jsonify(sp.to_dict()), 201
