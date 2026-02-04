"""add teacher_rate to users

Revision ID: 8f4d6b9c1a2e
Revises: 58c3d7ab2a1c
Create Date: 2026-02-04 17:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '8f4d6b9c1a2e'
down_revision = '58c3d7ab2a1c'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('teacher_rate', sa.Numeric(12, 2), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('teacher_rate')
