"""harden_schema_v2

Revision ID: 3ac1537a6cb6
Revises: eeb68317b365
Create Date: 2026-04-17 19:37:53.443268

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ac1537a6cb6'
down_revision: Union[str, Sequence[str], None] = 'eeb68317b365'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
