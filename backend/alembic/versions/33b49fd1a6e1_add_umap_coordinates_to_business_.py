"""add umap coordinates to business clusters

Revision ID: 33b49fd1a6e1
Revises: b8e47417e2e8
Create Date: 2025-12-01 02:50:21.018814

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '33b49fd1a6e1'
down_revision: Union[str, Sequence[str], None] = 'b8e47417e2e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('business_clusters', sa.Column('umap_x', sa.Float(), nullable=True))
    op.add_column('business_clusters', sa.Column('umap_y', sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('business_clusters', 'umap_y')
    op.drop_column('business_clusters', 'umap_x')
