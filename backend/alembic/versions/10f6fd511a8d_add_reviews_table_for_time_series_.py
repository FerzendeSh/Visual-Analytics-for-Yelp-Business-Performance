"""add reviews table for time-series analytics

Revision ID: 10f6fd511a8d
Revises: 40900a1eaa6d
Create Date: 2025-11-02 01:20:57.479322

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '10f6fd511a8d'
down_revision: Union[str, Sequence[str], None] = '40900a1eaa6d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create reviews table
    op.create_table(
        'reviews',
        sa.Column('review_id', sa.String(length=50), nullable=False),
        sa.Column('business_id', sa.String(length=50), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('stars', sa.Float(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('user_id', sa.String(length=50), nullable=False),
        sa.Column('useful', sa.Integer(), nullable=False),
        sa.Column('funny', sa.Integer(), nullable=False),
        sa.Column('cool', sa.Integer(), nullable=False),
        sa.Column('sentiment_label', sa.String(length=20), nullable=False),
        sa.Column('sentiment_confidence', sa.Float(), nullable=False),
        sa.Column('prob_negative', sa.Float(), nullable=False),
        sa.Column('prob_neutral', sa.Float(), nullable=False),
        sa.Column('prob_positive', sa.Float(), nullable=False),
        sa.Column('sentiment_score_prob_diff', sa.Float(), nullable=False),
        sa.Column('sentiment_score_expected', sa.Float(), nullable=False),
        sa.Column('sentiment_score_logit', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['business_id'], ['businesses.business_id'], ),
        sa.PrimaryKeyConstraint('review_id')
    )

    # Create indexes for efficient time-series queries
    op.create_index('idx_business_date', 'reviews', ['business_id', 'date'], unique=False)
    op.create_index('idx_date_business', 'reviews', ['date', 'business_id'], unique=False)
    op.create_index(op.f('ix_reviews_business_id'), 'reviews', ['business_id'], unique=False)
    op.create_index(op.f('ix_reviews_date'), 'reviews', ['date'], unique=False)
    op.create_index(op.f('ix_reviews_user_id'), 'reviews', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index(op.f('ix_reviews_user_id'), table_name='reviews')
    op.drop_index(op.f('ix_reviews_date'), table_name='reviews')
    op.drop_index(op.f('ix_reviews_business_id'), table_name='reviews')
    op.drop_index('idx_date_business', table_name='reviews')
    op.drop_index('idx_business_date', table_name='reviews')

    # Drop table
    op.drop_table('reviews')
