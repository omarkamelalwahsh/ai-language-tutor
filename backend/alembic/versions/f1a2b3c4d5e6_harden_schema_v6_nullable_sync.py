"""harden schema v6 - nullable assessment_id for sync resilience

Revision ID: f1a2b3c4d5e6
Revises: 7a551e8a5e94
Create Date: 2026-04-17 22:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = ('7a551e8a5e94', '32c723f3f3be')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop NOT NULL on assessment_id to decouple frontend persistence from session sync."""
    op.alter_column('assessment_responses', 'assessment_id',
                     existing_type=sa.UUID(),
                     nullable=True)
    op.alter_column('assessment_logs', 'assessment_id',
                     existing_type=sa.UUID(),
                     nullable=True)


def downgrade() -> None:
    """Restore NOT NULL on assessment_id."""
    op.alter_column('assessment_logs', 'assessment_id',
                     existing_type=sa.UUID(),
                     nullable=False)
    op.alter_column('assessment_responses', 'assessment_id',
                     existing_type=sa.UUID(),
                     nullable=False)
