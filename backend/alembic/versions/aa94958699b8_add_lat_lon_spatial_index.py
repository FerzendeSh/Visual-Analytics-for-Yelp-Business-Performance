"""add_lat_lon_spatial_index

Revision ID: aa94958699b8
Revises: 33b49fd1a6e1
Create Date: 2025-12-06 21:24:19.800908

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa94958699b8'
down_revision: Union[str, Sequence[str], None] = '33b49fd1a6e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add spatial index for lat/lon viewport queries."""
    # Add composite index on latitude/longitude for faster viewport queries
    op.create_index('idx_lat_lon', 'businesses', ['latitude', 'longitude'], unique=False)
    
    # Add composite index for sentiment-based time queries (if not exists)
    op.create_index(
        'idx_business_date_sentiment', 
        'reviews', 
        ['business_id', 'date', 'sentiment_label'], 
        unique=False,
        if_not_exists=True
    )


def downgrade() -> None:
    """Remove spatial index."""
    op.drop_index('idx_business_date_sentiment', table_name='reviews')
    op.drop_index('idx_lat_lon', table_name='businesses')
    op.drop_index('idx_lat_lon', table_name='businesses')
    op.create_table('city_category_timeline_metrics',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('state', sa.VARCHAR(length=2), autoincrement=False, nullable=False),
    sa.Column('city', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('category', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('period_start', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('period_type', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('avg_rating', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_expected', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('review_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('business_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('city_category_timeline_metrics_pkey')),
    sa.UniqueConstraint('state', 'city', 'category', 'period_start', 'period_type', name=op.f('uq_city_category_period'), postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
    op.create_index(op.f('ix_city_category_timeline_metrics_state'), 'city_category_timeline_metrics', ['state'], unique=False)
    op.create_index(op.f('ix_city_category_timeline_metrics_city'), 'city_category_timeline_metrics', ['city'], unique=False)
    op.create_index(op.f('ix_city_category_timeline_metrics_category'), 'city_category_timeline_metrics', ['category'], unique=False)
    op.create_index(op.f('idx_city_category_metrics_lookup'), 'city_category_timeline_metrics', ['state', 'city', 'category', 'period_type', 'period_start'], unique=False)
    op.create_table('city_timeline_metrics',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('state', sa.VARCHAR(length=2), autoincrement=False, nullable=False),
    sa.Column('city', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('period_start', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('period_type', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('avg_rating', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_expected', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('review_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('business_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('city_timeline_metrics_pkey')),
    sa.UniqueConstraint('state', 'city', 'period_start', 'period_type', name=op.f('uq_city_period'), postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
    op.create_index(op.f('ix_city_timeline_metrics_state'), 'city_timeline_metrics', ['state'], unique=False)
    op.create_index(op.f('ix_city_timeline_metrics_city'), 'city_timeline_metrics', ['city'], unique=False)
    op.create_index(op.f('idx_city_metrics_lookup'), 'city_timeline_metrics', ['state', 'city', 'period_type', 'period_start'], unique=False)
    op.create_table('state_category_timeline_metrics',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('state', sa.VARCHAR(length=2), autoincrement=False, nullable=False),
    sa.Column('category', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('period_start', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('period_type', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('avg_rating', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_expected', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('review_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('business_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('state_category_timeline_metrics_pkey')),
    sa.UniqueConstraint('state', 'category', 'period_start', 'period_type', name=op.f('uq_state_category_period'), postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
    op.create_index(op.f('ix_state_category_timeline_metrics_state'), 'state_category_timeline_metrics', ['state'], unique=False)
    op.create_index(op.f('ix_state_category_timeline_metrics_category'), 'state_category_timeline_metrics', ['category'], unique=False)
    op.create_index(op.f('idx_state_category_metrics_lookup'), 'state_category_timeline_metrics', ['state', 'category', 'period_type', 'period_start'], unique=False)
    op.create_table('state_timeline_metrics',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('state', sa.VARCHAR(length=2), autoincrement=False, nullable=False),
    sa.Column('period_start', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('period_type', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('avg_rating', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_expected', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('review_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('business_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('state_timeline_metrics_pkey')),
    sa.UniqueConstraint('state', 'period_start', 'period_type', name=op.f('uq_state_period'), postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
    op.create_index(op.f('ix_state_timeline_metrics_state'), 'state_timeline_metrics', ['state'], unique=False)
    op.create_index(op.f('idx_state_metrics_lookup'), 'state_timeline_metrics', ['state', 'period_type', 'period_start'], unique=False)
    op.create_table('business_timeline_metrics',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('business_id', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
    sa.Column('period_start', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('period_type', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('avg_rating', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_expected', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('review_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('business_timeline_metrics_pkey')),
    sa.UniqueConstraint('business_id', 'period_start', 'period_type', name=op.f('uq_business_period'), postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
    op.create_index(op.f('ix_business_timeline_metrics_business_id'), 'business_timeline_metrics', ['business_id'], unique=False)
    op.create_index(op.f('idx_business_metrics_lookup'), 'business_timeline_metrics', ['business_id', 'period_type', 'period_start'], unique=False)
    op.create_table('neighborhood_timeline_metrics',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('state', sa.VARCHAR(length=2), autoincrement=False, nullable=False),
    sa.Column('city', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('neighborhood', sa.VARCHAR(length=100), autoincrement=False, nullable=False),
    sa.Column('period_start', sa.DATE(), autoincrement=False, nullable=False),
    sa.Column('period_type', sa.VARCHAR(length=10), autoincrement=False, nullable=False),
    sa.Column('avg_rating', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_score', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('avg_sentiment_expected', sa.DOUBLE_PRECISION(precision=53), autoincrement=False, nullable=False),
    sa.Column('review_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.Column('business_count', sa.INTEGER(), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('neighborhood_timeline_metrics_pkey')),
    sa.UniqueConstraint('state', 'city', 'neighborhood', 'period_start', 'period_type', name=op.f('uq_neighborhood_period'), postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
    op.create_index(op.f('ix_neighborhood_timeline_metrics_state'), 'neighborhood_timeline_metrics', ['state'], unique=False)
    op.create_index(op.f('ix_neighborhood_timeline_metrics_neighborhood'), 'neighborhood_timeline_metrics', ['neighborhood'], unique=False)
    op.create_index(op.f('ix_neighborhood_timeline_metrics_city'), 'neighborhood_timeline_metrics', ['city'], unique=False)
    op.create_index(op.f('idx_neighborhood_metrics_lookup'), 'neighborhood_timeline_metrics', ['state', 'city', 'neighborhood', 'period_type', 'period_start'], unique=False)
    # ### end Alembic commands ###
