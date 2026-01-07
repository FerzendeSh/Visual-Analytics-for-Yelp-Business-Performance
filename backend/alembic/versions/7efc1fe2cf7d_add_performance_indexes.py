"""add_performance_indexes

Revision ID: 7efc1fe2cf7d
Revises: aa94958699b8
Create Date: 2025-12-31 13:55:30.028563

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7efc1fe2cf7d'
down_revision: Union[str, Sequence[str], None] = 'aa94958699b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add performance indexes for frequently queried columns.

    These indexes optimize:
    1. Timeline queries filtered by business + sentiment + date
    2. Date-based filtering with sentiment
    3. Year extraction queries for keyword insights
    """
    # Index 1: Composite index for business timeline queries with sentiment filtering
    # Supports: WHERE business_id = X AND sentiment_label = Y AND date BETWEEN A AND B
    op.create_index(
        'idx_review_business_sentiment_date',
        'reviews',
        ['business_id', 'sentiment_label', 'date'],
        unique=False
    )

    # Index 2: Composite index for date-based sentiment queries
    # Supports: WHERE date BETWEEN A AND B AND sentiment_label = X
    op.create_index(
        'idx_review_date_sentiment',
        'reviews',
        ['date', 'sentiment_label'],
        unique=False
    )

    # Index 3: Index on sentiment_label for filtering
    # Supports: WHERE sentiment_label = X
    op.create_index(
        'idx_review_sentiment',
        'reviews',
        ['sentiment_label'],
        unique=False
    )

    # Index 4: Composite index for business + date (for year extraction queries)
    # Supports: WHERE business_id = X AND date >= Y (for get_most_recent_year_with_reviews)
    op.create_index(
        'idx_review_business_date',
        'reviews',
        ['business_id', 'date'],
        unique=False
    )


def downgrade() -> None:
    """Remove performance indexes."""
    op.drop_index('idx_review_business_date', table_name='reviews')
    op.drop_index('idx_review_sentiment', table_name='reviews')
    op.drop_index('idx_review_date_sentiment', table_name='reviews')
    op.drop_index('idx_review_business_sentiment_date', table_name='reviews')
