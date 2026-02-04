from app.routes.auth import bp as auth_bp
from app.routes.students import bp as students_bp
from app.routes.lesson_sessions import bp as lesson_sessions_bp
from app.routes.enrollments import bp as enrollments_bp   
from app.routes.admin_students import bp as admin_students_bp
from app.routes.users import bp as users_bp


def register_routes(app):
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(students_bp)
    app.register_blueprint(lesson_sessions_bp)
    app.register_blueprint(enrollments_bp)
    app.register_blueprint(admin_students_bp)
    app.register_blueprint(users_bp)    
