"""create pet_users and pet_invitations, drop sub_type

Revision ID: 0001_create_pet_users_and_invitations
Revises: 
Create Date: 2025-11-02 00:30:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0001_create_pet_users_and_invitations'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Check if tables exist before creating (idempotent)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()
    
    # create pet_users table
    if 'pet_users' not in existing_tables:
        op.create_table(
            'pet_users',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('pet_id', sa.Integer, sa.ForeignKey('pets.id', ondelete='CASCADE'), nullable=False),
            sa.Column('user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('is_manager', sa.Boolean, server_default=sa.text('false'), nullable=False),
        )

    # create pet_invitations
    if 'pet_invitations' not in existing_tables:
        op.create_table(
            'pet_invitations',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('pet_id', sa.Integer, sa.ForeignKey('pets.id', ondelete='CASCADE'), nullable=False),
            sa.Column('invite_email', sa.String(255), nullable=False),
            sa.Column('token', sa.String(128), nullable=False, unique=True),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
            sa.Column('accepted', sa.Boolean, server_default=sa.text('false'), nullable=False),
            sa.Column('used_by_user_id', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        )

    # Note: sub_type is needed for toilet activities (poop/pee), so we don't drop it


def downgrade():
    # recreate sub_type
    with op.batch_alter_table('activities') as batch_op:
        batch_op.add_column(sa.Column('sub_type', sa.String(10), nullable=True))

    op.drop_table('pet_invitations')
    op.drop_table('pet_users')


