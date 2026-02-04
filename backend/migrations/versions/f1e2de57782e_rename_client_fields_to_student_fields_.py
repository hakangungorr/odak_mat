"""rename client fields to student fields in lesson_sessions

Revision ID: f1e2de57782e
Revises: 70ef2a840e17
Create Date: 2026-02-02 07:37:33.338866

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1e2de57782e'
down_revision = '70ef2a840e17'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TABLE lesson_sessions RENAME COLUMN client_rating_to_teacher TO student_rating_to_teacher;")
    op.execute("ALTER TABLE lesson_sessions RENAME COLUMN client_note TO student_note;")
    op.execute("ALTER TABLE lesson_sessions RENAME COLUMN client_marked_at TO student_marked_at;")
    op.execute("ALTER TABLE lesson_sessions RENAME CONSTRAINT ck_client_rating_1_5 TO ck_student_rating_1_5;")


def downgrade():
    op.execute("ALTER TABLE lesson_sessions RENAME CONSTRAINT ck_student_rating_1_5 TO ck_client_rating_1_5;")
    op.execute("ALTER TABLE lesson_sessions RENAME COLUMN student_marked_at TO client_marked_at;")
    op.execute("ALTER TABLE lesson_sessions RENAME COLUMN student_note TO client_note;")
    op.execute("ALTER TABLE lesson_sessions RENAME COLUMN student_rating_to_teacher TO client_rating_to_teacher;")