"""add admin birthdate settings

Revision ID: 0003_add_admin_birthdate_settings
Revises: 0002_drop_amount_from_activities
Create Date: 2025-11-11 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0003_add_admin_birthdate_settings'
down_revision = '0002_drop_amount_from_activities'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_admin to users (idempotent)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        if 'is_admin' not in columns:
            op.add_column('users', sa.Column('is_admin', sa.Boolean(), server_default=sa.text('false'), nullable=False))

    # Add birthdate to pets (idempotent)
    if 'pets' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('pets')]
        if 'birthdate' not in columns:
            op.add_column('pets', sa.Column('birthdate', sa.Date(), nullable=True))

    # Ensure sub_type exists in activities (needed for toilet activities)
    if 'activities' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('activities')]
        if 'sub_type' not in columns:
            op.add_column('activities', sa.Column('sub_type', sa.String(length=50), nullable=True))

    # Create settings table (idempotent)
    existing_tables = inspector.get_table_names()
    if 'settings' not in existing_tables:
        op.create_table(
            'settings',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('key', sa.String(length=100), nullable=False),
            sa.Column('value', sa.Text(), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('key')
        )


def downgrade():
    # Drop settings table
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'settings' in inspector.get_table_names():
        op.drop_table('settings')
    
    # Remove birthdate from pets
    if 'pets' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('pets')]
        if 'birthdate' in columns:
            op.drop_column('pets', 'birthdate')
    
    # Remove is_admin from users
    if 'users' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('users')]
        if 'is_admin' in columns:
            op.drop_column('users', 'is_admin')

