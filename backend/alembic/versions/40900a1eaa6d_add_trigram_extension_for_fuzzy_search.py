"""add_trigram_extension_for_fuzzy_search

Revision ID: 40900a1eaa6d
Revises: 16a023295c6a
Create Date: 2025-11-01 23:11:47.866219

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '40900a1eaa6d'
down_revision: Union[str, Sequence[str], None] = '16a023295c6a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Enable PostgreSQL trigram extension for fuzzy text search."""
    # Enable pg_trgm extension for similarity and fuzzy matching
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')

    # Add GIN indexes for faster similarity searches
    # These indexes dramatically improve performance for LIKE, ILIKE, and similarity queries
    op.execute('CREATE INDEX IF NOT EXISTS idx_business_name_trgm ON businesses USING gin (name gin_trgm_ops)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_business_city_trgm ON businesses USING gin (city gin_trgm_ops)')
    op.execute('CREATE INDEX IF NOT EXISTS idx_business_categories_trgm ON businesses USING gin (categories gin_trgm_ops)')


def downgrade() -> None:
    """Remove trigram indexes and extension."""
    # Drop GIN indexes
    op.execute('DROP INDEX IF EXISTS idx_business_name_trgm')
    op.execute('DROP INDEX IF EXISTS idx_business_city_trgm')
    op.execute('DROP INDEX IF EXISTS idx_business_categories_trgm')

    # Drop extension (only if no other tables use it)
    op.execute('DROP EXTENSION IF EXISTS pg_trgm')
