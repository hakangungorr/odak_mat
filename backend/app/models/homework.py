import enum
from app.database import db
from app.models.base import BaseModel


class HomeworkStatus(enum.Enum):
    ASSIGNED = "ASSIGNED"
    SUBMITTED = "SUBMITTED"
    GRADED = "GRADED"


class Homework(BaseModel):
    __tablename__ = "homeworks"

    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False, index=True)
    teacher_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    due_date = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.Enum(HomeworkStatus), nullable=False, default=HomeworkStatus.ASSIGNED)

    grade = db.Column(db.Integer, nullable=True)  # 1-100
    teacher_note = db.Column(db.Text, nullable=True)
    student_note = db.Column(db.Text, nullable=True)
