"""drop amount from activities

Revision ID: 0002_drop_amount_from_activities
Revises: 0001_create_pet_users_and_invitations
Create Date: 2025-11-04 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0002_drop_amount_from_activities'
down_revision = '0001_create_pet_users_and_invitations'
branch_labels = None
depends_on = None


def upgrade():
    # Drop the legacy `amount` column from activities (no longer used)
    # Check if column exists first (idempotent)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'activities' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('activities')]
        if 'amount' in columns:
            with op.batch_alter_table('activities') as batch_op:
                batch_op.drop_column('amount')


def downgrade():
    # Re-create the `amount` column as nullable string
    with op.batch_alter_table('activities') as batch_op:
        batch_op.add_column(sa.Column('amount', sa.String(10), nullable=True))


