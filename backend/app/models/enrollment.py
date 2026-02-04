import enum
from app.database import db
from app.models.base import BaseModel


class EnrollmentStatus(enum.Enum):
    ACTIVE = "ACTIVE"
    PASSIVE = "PASSIVE"


class Enrollment(BaseModel):
    __tablename__ = "enrollments"

    teacher_user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False, index=True)

    status = db.Column(db.Enum(EnrollmentStatus), nullable=False, default=EnrollmentStatus.ACTIVE)

    __table_args__ = (
    db.UniqueConstraint("student_id", name="uq_enrollment_student"),
)