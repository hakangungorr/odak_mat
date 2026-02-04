"""add deleted_at to users

Revision ID: 9c2e1a4d7b3f
Revises: 8f4d6b9c1a2e
Create Date: 2026-02-04 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '9c2e1a4d7b3f'
down_revision = '8f4d6b9c1a2e'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deleted_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('deleted_at')
