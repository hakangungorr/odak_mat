from app.routes.auth import bp as auth_bp
from app.routes.students import bp as students_bp
from app.routes.lesson_sessions import bp as lesson_sessions_bp
from app.routes.enrollments import bp as enrollments_bp   
from app.routes.admin_students import bp as admin_students_bp
from app.routes.users import bp as users_bp
from app.routes.homeworks import bp as homeworks_bp
from app.routes.lesson_reports import bp as lesson_reports_bp
from app.routes.packages import bp as packages_bp


def register_routes(app):
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(students_bp, url_prefix="/api/students")
    app.register_blueprint(lesson_sessions_bp, url_prefix="/api/lesson-sessions")
    app.register_blueprint(enrollments_bp, url_prefix="/api/enrollments")
    app.register_blueprint(admin_students_bp, url_prefix="/api/admin/students")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(homeworks_bp, url_prefix="/api/homeworks")
    app.register_blueprint(lesson_reports_bp, url_prefix="/api/lesson-reports")
    app.register_blueprint(packages_bp, url_prefix="/api/packages")
