"""add deleted_at to students

Revision ID: 3b7f9c2d1a6e
Revises: 9c2e1a4d7b3f
Create Date: 2026-02-04 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '3b7f9c2d1a6e'
down_revision = '9c2e1a4d7b3f'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('students', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('students', schema=None) as batch_op:
        batch_op.drop_column('deleted_at')
