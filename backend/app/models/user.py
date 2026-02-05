from werkzeug.security import generate_password_hash, check_password_hash
from app.database import db
from app.models.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, index=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    role_id = db.Column(
        db.Integer,
        db.ForeignKey("roles.id"),
        nullable =False,
        index = True,
    )
    role = db.relationship("Role", lazy="joined")
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    teacher_rate = db.Column(db.Numeric(12, 2), nullable=True)
    deleted_at = db.Column(db.DateTime, nullable=True)
    phones = db.Column(db.Text, nullable=True)

    def set_password(self, raw_password: str):
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password_hash(self.password_hash, raw_password)
    
    def has_role(self,key:str) -> bool:
        return self.role and self.role.key == key

        

    
