import os
from flask import Flask
from config import Config
from app.database import db, migrate


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # ✅ Env varsa onu baz al (docker'da DATABASE_URL dolu)
    db_url = os.getenv("SQLALCHEMY_DATABASE_URI") or os.getenv("DATABASE_URL")
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

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(lesson_sessions_bp, url_prefix="/api/lesson-sessions")
    app.register_blueprint(students_bp, url_prefix="/api/students")


    return app

