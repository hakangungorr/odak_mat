import os
from flask import Flask
from config import Config
from app.database import db, migrate
from pathlib import Path
from dotenv import load_dotenv
from flask_cors import CORS



   # Blueprint register

def create_app():
    root_env = Path(__file__).resolve().parents[2] / ".env"
    load_dotenv(str(root_env))


    app = Flask(__name__)
    app.config.from_object(Config)
    app.url_map.strict_slashes = False

    CORS(
        app,
        resources={r"/api/*": {"origins": "*"}},
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        expose_headers=["Content-Type", "Authorization"],
        supports_credentials=True,
    )

    # ✅ Env varsa onu baz al (docker'da DATABASE_URL dolu)
    db_url = os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI")

    if db_url:
        app.config["SQLALCHEMY_DATABASE_URI"] = db_url

    # (opsiyonel ama iyi pratik)
    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)

    db.init_app(app)
    migrate.init_app(app, db)

    # 🔥 Modellerin Alembic tarafından görülmesi için şart
    from app import models  # noqa: F401

    # Blueprint register
    from app.routes.auth import bp as auth_bp
    from app.routes.lesson_sessions import bp as lesson_sessions_bp
    from app.routes.students import bp as students_bp
    from app.routes.enrollments import bp as enrollments_bp
    from app.routes.admin_students import bp as admin_students_bp
    from app.routes.users import bp as users_bp


    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(lesson_sessions_bp, url_prefix="/api/lesson-sessions")
    app.register_blueprint(students_bp, url_prefix="/api/students")
    app.register_blueprint(enrollments_bp, url_prefix="/api/enrollments")
    app.register_blueprint(admin_students_bp, url_prefix="/api/admin/students")
    app.register_blueprint(users_bp, url_prefix="/api/users")

    
    return app

