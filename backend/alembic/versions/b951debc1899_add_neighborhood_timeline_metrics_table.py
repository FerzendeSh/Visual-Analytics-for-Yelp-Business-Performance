"""add neighborhood timeline metrics table

Revision ID: b951debc1899
Revises: d778b231cbce
Create Date: 2025-11-20 12:24:56.172882

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b951debc1899'
down_revision: Union[str, Sequence[str], None] = 'd778b231cbce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create neighborhood_timeline_metrics table
    op.create_table(
        'neighborhood_timeline_metrics',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('state', sa.String(length=2), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('neighborhood', sa.String(length=100), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_type', sa.String(length=10), nullable=False),
        sa.Column('avg_rating', sa.Float(), nullable=False),
        sa.Column('avg_sentiment_score', sa.Float(), nullable=False),
        sa.Column('avg_sentiment_expected', sa.Float(), nullable=False),
        sa.Column('review_count', sa.Integer(), nullable=False),
        sa.Column('business_count', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('state', 'city', 'neighborhood', 'period_start', 'period_type',
                           name='uq_neighborhood_period')
    )

    # Create indexes
    op.create_index('ix_neighborhood_timeline_metrics_state', 'neighborhood_timeline_metrics', ['state'])
    op.create_index('ix_neighborhood_timeline_metrics_city', 'neighborhood_timeline_metrics', ['city'])
    op.create_index('ix_neighborhood_timeline_metrics_neighborhood', 'neighborhood_timeline_metrics', ['neighborhood'])
    op.create_index('idx_neighborhood_metrics_lookup', 'neighborhood_timeline_metrics',
                   ['state', 'city', 'neighborhood', 'period_type', 'period_start'])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index('idx_neighborhood_metrics_lookup', table_name='neighborhood_timeline_metrics')
    op.drop_index('ix_neighborhood_timeline_metrics_neighborhood', table_name='neighborhood_timeline_metrics')
    op.drop_index('ix_neighborhood_timeline_metrics_city', table_name='neighborhood_timeline_metrics')
    op.drop_index('ix_neighborhood_timeline_metrics_state', table_name='neighborhood_timeline_metrics')

    # Drop table
    op.drop_table('neighborhood_timeline_metrics')
