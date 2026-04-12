"""replace moving_avg with trend and variance

Revision ID: 0005_trend_variance_replace_moving_avg
Revises: 0004_add_moving_avg_to_activities
Create Date: 2025-12-16 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0005_trend_variance_replace_moving_avg'
down_revision = '0004_add_moving_avg_to_activities'
branch_labels = None
depends_on = None


def upgrade():
    # Replace moving_avg with trend/variance; drop legacy amount column
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'activities' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('activities')]

        # Add new columns if missing
        if 'trend' not in columns:
            op.add_column('activities', sa.Column('trend', sa.Float(), nullable=True))
        if 'variance' not in columns:
            op.add_column('activities', sa.Column('variance', sa.Float(), nullable=True))

        # Drop old columns if present
        if 'moving_avg' in columns:
            with op.batch_alter_table('activities') as batch_op:
                batch_op.drop_column('moving_avg')
        if 'amount' in columns:
            with op.batch_alter_table('activities') as batch_op:
                batch_op.drop_column('amount')


def downgrade():
    # Recreate moving_avg and amount, drop trend/variance
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'activities' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('activities')]

        if 'moving_avg' not in columns:
            op.add_column('activities', sa.Column('moving_avg', sa.Float(), nullable=True))
        if 'amount' not in columns:
            op.add_column('activities', sa.Column('amount', sa.String(length=10), nullable=True))

        if 'trend' in columns:
            with op.batch_alter_table('activities') as batch_op:
                batch_op.drop_column('trend')
        if 'variance' in columns:
            with op.batch_alter_table('activities') as batch_op:
                batch_op.drop_column('variance')

