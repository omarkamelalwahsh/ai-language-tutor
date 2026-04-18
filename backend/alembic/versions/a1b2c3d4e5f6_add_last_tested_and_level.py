"""add_last_tested_and_level_to_skill_states

Revision ID: a1b2c3d4e5f6
Revises: 647772ddec5b
Create Date: 2026-04-17 23:46:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '647772ddec5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add missing columns that frontend sends
    op.add_column('skill_states', sa.Column('level', sa.String(), nullable=True, server_default='A1'))
    op.add_column('skill_states', sa.Column('last_tested', sa.DateTime(timezone=True), nullable=True, server_default=sa.text('now()')))
    
    # Force PostgREST schema cache reload
    op.execute("NOTIFY pgrst, 'reload schema'")


def downgrade() -> None:
    op.drop_column('skill_states', 'last_tested')
    op.drop_column('skill_states', 'level')
