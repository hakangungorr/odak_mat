"""add cancel fields to lesson_sessions

Revision ID: 58c3d7ab2a1c
Revises: c5fb4e8fd540
Create Date: 2026-02-04 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '58c3d7ab2a1c'
down_revision = 'c5fb4e8fd540'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('lesson_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('cancelled_by_role', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('cancelled_by_user_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('cancelled_at', sa.DateTime(), nullable=True))
        batch_op.create_index(batch_op.f('ix_lesson_sessions_cancelled_by_user_id'), ['cancelled_by_user_id'], unique=False)
        batch_op.create_foreign_key(None, 'users', ['cancelled_by_user_id'], ['id'])


def downgrade():
    with op.batch_alter_table('lesson_sessions', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('lesson_sessions_cancelled_by_user_id_fkey'), type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_lesson_sessions_cancelled_by_user_id'))
        batch_op.drop_column('cancelled_at')
        batch_op.drop_column('cancelled_by_user_id')
        batch_op.drop_column('cancelled_by_role')
