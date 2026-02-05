"""add phones to users

Revision ID: 4e1a2b3c4d5e
Revises: 3b7f9c2d1a6e
Create Date: 2026-02-04 18:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '4e1a2b3c4d5e'
down_revision = '3b7f9c2d1a6e'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('phones', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('phones')
