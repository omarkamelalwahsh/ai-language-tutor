"""restructure_weekly_vocabulary

Revision ID: b7e9f3a1d2c4
Revises: 647772ddec5b
Create Date: 2026-05-11 16:23:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b7e9f3a1d2c4'
down_revision: Union[str, Sequence[str], None] = '647772ddec5b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop the old JSONB-based weekly_vocabulary table
    op.execute("DROP TABLE IF EXISTS weekly_vocabulary")

    # 2. Create the new normalized weekly_vocabulary table
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
        sa.UniqueConstraint('day_index', 'week_start_date', name='uq_weekly_vocab_day_week')
    )

    # 3. Create index for fast lookups
    op.create_index('ix_weekly_vocab_week_start', 'weekly_vocabulary', ['week_start_date'])

    # 4. Notify PostgREST to reload schema
    op.execute("NOTIFY pgrst, 'reload schema'")


def downgrade() -> None:
    op.drop_index('ix_weekly_vocab_week_start', table_name='weekly_vocabulary')
    op.drop_table('weekly_vocabulary')
