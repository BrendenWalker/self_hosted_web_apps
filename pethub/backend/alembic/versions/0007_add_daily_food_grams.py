"""add daily_food_grams to pets

Revision ID: 0007_add_daily_food_grams
Revises: 0006_add_food_transition_fields
Create Date: 2026-07-23 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0007_add_daily_food_grams'
down_revision = '0006_add_food_transition_fields'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'pets' not in inspector.get_table_names():
        return
    columns = [col['name'] for col in inspector.get_columns('pets')]
    if 'daily_food_grams' not in columns:
        op.add_column('pets', sa.Column('daily_food_grams', sa.Numeric(7, 1), nullable=True))


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'pets' not in inspector.get_table_names():
        return
    columns = [col['name'] for col in inspector.get_columns('pets')]
    if 'daily_food_grams' in columns:
        op.drop_column('pets', 'daily_food_grams')
