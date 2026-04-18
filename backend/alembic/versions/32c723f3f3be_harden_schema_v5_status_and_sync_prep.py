"""harden_schema_v5_status_and_sync_prep

Revision ID: 32c723f3f3be
Revises: d5175a932c6f
Create Date: 2026-04-17 21:20:25.720872

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '32c723f3f3be'
down_revision: Union[str, Sequence[str], None] = 'd5175a932c6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add status column."""
    op.execute("""
        ALTER TABLE assessment_responses 
        ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'completed';
    """)

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('assessment_responses', 'status')
