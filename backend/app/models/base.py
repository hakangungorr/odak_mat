from datetime import datetime
from app.database import db

class BaseModel(db.Model):
    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def save(self):
        db.session.add(self)
        db.session.commit()
        return self

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    def to_dict(self):
        out = {}
        for c in self.__table__.columns:
            v = getattr(self, c.name)

            # Enum -> string
            if hasattr(v, "value"):
                v = v.value

            out[c.name] = v
        return out
