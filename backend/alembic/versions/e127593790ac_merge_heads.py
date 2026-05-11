"""merge heads

Revision ID: e127593790ac
Revises: 38dcafcb01e1, d7e9f3a1d2c5
Create Date: 2026-05-11 17:01:48.357759

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e127593790ac'
down_revision: Union[str, Sequence[str], None] = ('38dcafcb01e1', 'd7e9f3a1d2c5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
