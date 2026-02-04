from werkzeug.security import generate_password_hash

from app.database import db
from app.models.role import Role
from app.models.user import User

# ✅ app factory'yi import et (sende adı neyse onu kullanacağız)
from app import create_app   # <-- eğer sende farklıysa aşağıda anlatacağım


def seed_roles():
    roles = ["ADMIN", "TEACHER", "STUDENT"]

    for key in roles:
        exists = Role.query.filter_by(key=key).first()
        if not exists:
            db.session.add(Role(key=key))

    db.session.commit()
    print("✅ Roles seeded")


def seed_admin():
    admin_email = "admin@odak.com"

    admin_role = Role.query.filter_by(key="ADMIN").first()
    if not admin_role:
        raise Exception("ADMIN role not found. Run seed_roles first.")

    existing = User.query.filter_by(email=admin_email).first()
    if existing:
        print("ℹ️ Admin already exists")
        return

    admin = User(
        full_name="System Admin",
        email=admin_email,
        password_hash=generate_password_hash("admin123"),
        role_id=admin_role.id,
        is_active=True,
    )

    db.session.add(admin)
    db.session.commit()
    print("✅ Admin user created")


def run_seed():
    print("🌱 Running seed...")
    seed_roles()
    seed_admin()
    print("🌱 Seed completed")


if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        run_seed()
