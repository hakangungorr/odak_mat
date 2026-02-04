from app.database import db
from app.models.base import BaseModel


class LessonReport(BaseModel):
    __tablename__ = "lesson_reports"

    lesson_session_id = db.Column(db.Integer, db.ForeignKey("lesson_sessions.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False, index=True)
    teacher_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    topic = db.Column(db.String(300), nullable=True)
    performance_rating = db.Column(db.Integer, nullable=True)  # 1-5
    teacher_note = db.Column(db.Text, nullable=True)
    next_note = db.Column(db.Text, nullable=True)
