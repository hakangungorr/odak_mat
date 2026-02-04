from app.database import db
from app.models.base import BaseModel

class Student(BaseModel):
    __tablename__ = "students"

    full_name = db.Column(db.String(120), nullable=False)
    grade = db.Column(db.Integer, nullable=True)

    # öğrenci login hesabı
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id"),
        nullable=False,
        unique=True,
        index=True
    )
