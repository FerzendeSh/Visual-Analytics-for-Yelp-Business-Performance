"""add cluster timeline metrics table

Revision ID: 717d2b09b08d
Revises: 7efc1fe2cf7d
Create Date: 2026-01-05 14:27:05.859408

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '717d2b09b08d'
down_revision: Union[str, Sequence[str], None] = '7efc1fe2cf7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create cluster_timeline_metrics table
    op.create_table(
        'cluster_timeline_metrics',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('cluster_id', sa.Integer(), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_type', sa.String(length=10), nullable=False),
        sa.Column('avg_rating', sa.Float(), nullable=False),
        sa.Column('avg_sentiment_score', sa.Float(), nullable=False),
        sa.Column('avg_sentiment_expected', sa.Float(), nullable=False),
        sa.Column('review_count', sa.Integer(), nullable=False),
        sa.Column('business_count', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['cluster_id'], ['clusters.cluster_id'], ondelete='CASCADE'),
        sa.UniqueConstraint('cluster_id', 'period_start', 'period_type', name='uq_cluster_period')
    )

    # Create indexes for fast queries
    op.create_index(
        'idx_cluster_metrics_lookup',
        'cluster_timeline_metrics',
        ['cluster_id', 'period_type', 'period_start'],
        unique=False
    )
    op.create_index(
        op.f('ix_cluster_timeline_metrics_cluster_id'),
        'cluster_timeline_metrics',
        ['cluster_id'],
        unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index(op.f('ix_cluster_timeline_metrics_cluster_id'), table_name='cluster_timeline_metrics')
    op.drop_index('idx_cluster_metrics_lookup', table_name='cluster_timeline_metrics')

    # Drop table
    op.drop_table('cluster_timeline_metrics')
