import os

class Config:
    # DB
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://odak:odak123@db:5432/odakdb"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT
    JWT_SECRET = os.getenv(
        "JWT_SECRET",
        "dev_jwt_secret_change_me_32_chars_min!!"
    )
    JWT_ALG = os.getenv("JWT_ALG", "HS256")
    JWT_EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MIN", "43200"))  # 30 gün (dev)

