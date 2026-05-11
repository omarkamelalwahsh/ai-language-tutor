"""add_daily_content_table

Revision ID: 6d8df2b5e1eb
Revises: e127593790ac
Create Date: 2026-05-11 17:54:50.202893

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6d8df2b5e1eb'
down_revision: Union[str, Sequence[str], None] = 'e127593790ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'daily_content',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('target_level', sa.String(), nullable=False),
        sa.Column('field', sa.String(), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.Column('day_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade() -> None:
    op.drop_table('daily_content')

