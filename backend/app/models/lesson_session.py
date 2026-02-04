import enum
from app.database import db
from app.models.base import BaseModel
from sqlalchemy.schema import CheckConstraint


class SessionMode(enum.Enum):
    ONLINE = "ONLINE"
    IN_PERSON = "IN_PERSON"


class SessionStatus(enum.Enum):
    PLANNED = "PLANNED"
    PENDING_CONFIRMATION = "PENDING_CONFIRMATION"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    MISSED = "MISSED"


class LessonSession(BaseModel):
    __tablename__ = "lesson_sessions"

    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False, index=True)
    teacher_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    scheduled_start = db.Column(db.DateTime, nullable=False, index=True)
    duration_min = db.Column(db.Integer, nullable=False, default=60)

    mode = db.Column(db.Enum(SessionMode , name="sessionmode"), nullable=False, default=SessionMode.ONLINE)
    topic = db.Column(db.String(300), nullable=True)

    status = db.Column(db.Enum(SessionStatus, name="sessionstatus"), nullable=False, default=SessionStatus.PLANNED)


    created_by_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # Teacher -> Student feedback
    teacher_rating_to_student = db.Column(db.Integer, nullable=True)
    teacher_mark_note = db.Column(db.Text, nullable=True)
    teacher_marked_at = db.Column(db.DateTime, nullable=True)

    # Student -> Teacher feedback  (eski "client_*")
    student_rating_to_teacher = db.Column(db.Integer, nullable=True)
    student_note = db.Column(db.Text, nullable=True)
    student_marked_at = db.Column(db.DateTime, nullable=True)

    admin_note = db.Column(db.Text, nullable=True)

    __table_args__ = (
        CheckConstraint("student_rating_to_teacher BETWEEN 1 AND 5", name="ck_student_rating_1_5"),
        CheckConstraint("teacher_rating_to_student BETWEEN 1 AND 5", name="ck_teacher_rating_1_5"),
    )
