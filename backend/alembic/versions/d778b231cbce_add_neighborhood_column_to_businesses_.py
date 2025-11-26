"""add neighborhood column to businesses table

Revision ID: d778b231cbce
Revises: 10f6fd511a8d
Create Date: 2025-11-20 11:40:50.780772

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'd778b231cbce'
down_revision: Union[str, Sequence[str], None] = '10f6fd511a8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add neighborhood column to businesses table
    op.add_column('businesses', sa.Column('neighborhood', sa.String(length=100), nullable=True))

    # Create indexes for neighborhood queries
    op.create_index('idx_location_neighborhood', 'businesses', ['city', 'state', 'neighborhood'], unique=False)
    op.create_index(op.f('ix_businesses_neighborhood'), 'businesses', ['neighborhood'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index(op.f('ix_businesses_neighborhood'), table_name='businesses')
    op.drop_index('idx_location_neighborhood', table_name='businesses')

    # Drop neighborhood column
    op.drop_column('businesses', 'neighborhood')
