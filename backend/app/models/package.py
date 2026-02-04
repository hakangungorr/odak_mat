import enum
from datetime import datetime, timedelta
from app.database import db
from app.models.base import BaseModel


class PackageStatus(enum.Enum):
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"
    USED_UP = "USED_UP"


class Package(BaseModel):
    __tablename__ = "packages"

    name = db.Column(db.String(120), nullable=False)
    lesson_count = db.Column(db.Integer, nullable=False)
    price = db.Column(db.Numeric(12, 2), nullable=True)
    expires_in_days = db.Column(db.Integer, nullable=True)  # ör: 60 gün


class StudentPackage(BaseModel):
    __tablename__ = "student_packages"

    student_id = db.Column(db.Integer, db.ForeignKey("students.id"), nullable=False, index=True)
    package_id = db.Column(db.Integer, db.ForeignKey("packages.id"), nullable=False, index=True)

    remaining_lessons = db.Column(db.Integer, nullable=False)
    start_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    end_date = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.Enum(PackageStatus), nullable=False, default=PackageStatus.ACTIVE)

    @staticmethod
    def compute_end_date(start_date, expires_in_days):
        if not expires_in_days:
            return None
        return start_date + timedelta(days=int(expires_in_days))
