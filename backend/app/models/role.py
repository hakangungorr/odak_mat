from app.database import db
from app.models.base import BaseModel

class Role(BaseModel):
    __tablename__ = "roles"

    key = db.Column(db.String(50),unique=True,nullable =False)

    def __repr__(self):
        return f"Role is {self.key}"