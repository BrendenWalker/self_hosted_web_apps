"""add food transition fields to pets

Revision ID: 0006_add_food_transition_fields
Revises: 0005_trend_variance_replace_moving_avg
Create Date: 2026-07-12 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0006_add_food_transition_fields'
down_revision = '0005_trend_variance_replace_moving_avg'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'pets' not in inspector.get_table_names():
        return
    columns = [col['name'] for col in inspector.get_columns('pets')]
    if 'adult_food_transition_start' not in columns:
        op.add_column('pets', sa.Column('adult_food_transition_start', sa.Date(), nullable=True))
    if 'daily_food_cups' not in columns:
        op.add_column('pets', sa.Column('daily_food_cups', sa.Numeric(5, 2), nullable=True))


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'pets' not in inspector.get_table_names():
        return
    columns = [col['name'] for col in inspector.get_columns('pets')]
    if 'daily_food_cups' in columns:
        op.drop_column('pets', 'daily_food_cups')
    if 'adult_food_transition_start' in columns:
        op.drop_column('pets', 'adult_food_transition_start')
