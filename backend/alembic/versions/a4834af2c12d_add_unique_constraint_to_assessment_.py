"""add unique constraint to assessment responses

Revision ID: a4834af2c12d
Revises: 8d166c9ab252
Create Date: 2026-04-17 16:45:54.260427

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4834af2c12d'
down_revision: Union[str, Sequence[str], None] = '8d166c9ab252'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_unique_constraint('uq_assessment_question', 'assessment_responses', ['assessment_id', 'question_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_assessment_question', 'assessment_responses', type_='unique')
