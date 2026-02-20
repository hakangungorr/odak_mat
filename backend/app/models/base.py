from datetime import datetime
from app.database import db

class BaseModel(db.Model):     #Abstract Base Model denir. Normalde SQL Alch ile classlar db de tablo olarak gösterilir fakat burada bu durum yok. 
    __abstract__ = True
    #Diğer modellerden miras almak için vardır. Base Model sayesinde ortak olan her şeyi merkeze koyduk.
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

    def to_dict(self):    #Model objelerini JSON response’a dönüştürmek için generic bir to_dict yazdık.
        out = {}
        for c in self.__table__.columns:
            v = getattr(self, c.name)

            # Enum -> string
            if hasattr(v, "value"):
                v = v.value

            out[c.name] = v
        return out
