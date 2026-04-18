"""harden_schema_v4_auto_uuid_and_response_time

Revision ID: d5175a932c6f
Revises: da4504998131
Create Date: 2026-04-17 21:06:22.389387

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5175a932c6f'
down_revision: Union[str, Sequence[str], None] = 'da4504998131'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - Add response_time_ms and set Auto-UUID defaults."""
    # 1. Add missing column
    op.execute("""
        ALTER TABLE assessment_responses 
        ADD COLUMN IF NOT EXISTS response_time_ms INTEGER DEFAULT 0;
    """)
    
    # 2. Enable pgcrypto for gen_random_uuid() if not exists
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
    
    # 3. Set DEFAULT gen_random_uuid() for all relevant tables
    tables = [
        'assessment_responses', 
        'assessment_logs', 
        'assessments', 
        'learner_profiles',
        'learning_journeys',
        'journey_steps',
        'user_error_profiles',
        'user_error_analysis',
        'user_skills'
    ]
    
    for table in tables:
        op.execute(f"ALTER TABLE {table} ALTER COLUMN id SET DEFAULT gen_random_uuid();")
    
    # Ensure RLS is disabled for logs as previously requested
    op.execute("ALTER TABLE assessment_logs DISABLE ROW LEVEL SECURITY;")

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('assessment_responses', 'response_time_ms')
    # Note: Removing defaults is unusual in downgrade but for completeness:
    # ALTER TABLE {table} ALTER COLUMN id DROP DEFAULT;
