"""add_normalized_weekly_vocabulary

Revision ID: d7e9f3a1d2c5
Revises: b7e9f3a1d2c4
Create Date: 2026-05-11 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd7e9f3a1d2c5'
down_revision: Union[str, Sequence[str], None] = 'b7e9f3a1d2c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop the temporary table if it exists (cleaning up from previous manual attempt)
    op.execute("DROP TABLE IF EXISTS weekly_vocabulary")

    # 2. Create the normalized weekly_vocabulary table as requested
    op.create_table('weekly_vocabulary',
        sa.Column('id', sa.UUID(), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('day_index', sa.Integer(), nullable=False, comment='0=Saturday, 1=Sunday, ..., 6=Friday'),
        sa.Column('word_c1', sa.String(), nullable=False),
        sa.Column('word_a1', sa.String(), nullable=False),
        sa.Column('insight', sa.Text(), nullable=False),
        sa.Column('audio_url', sa.String(), nullable=True),
        sa.Column('week_start_date', sa.Date(), nullable=False, comment='The Saturday this cycle belongs to'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        # Unique constraint per day index per week start to prevent duplicates
        sa.UniqueConstraint('day_index', 'week_start_date', name='uq_weekly_vocab_day_week')
    )

    # 3. Notify PostgREST/Supabase to refresh
    op.execute("NOTIFY pgrst, 'reload schema'")


def downgrade() -> None:
    op.drop_table('weekly_vocabulary')
