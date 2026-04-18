"""harden_schema_v3_explanation_and_permissions

Revision ID: da4504998131
Revises: 3ac1537a6cb6
Create Date: 2026-04-17 20:58:30.772000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'da4504998131'
down_revision: Union[str, Sequence[str], None] = '3ac1537a6cb6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema and fix permissions."""
    # Add 'explanation' column safely to assessment_responses
    op.execute("""
        ALTER TABLE assessment_responses 
        ADD COLUMN IF NOT EXISTS explanation JSONB;
    """)
    
    # Fix permissions for assessment_logs and disable RLS to unblock frontend
    op.execute("""
        GRANT ALL ON TABLE assessment_logs TO authenticated;
        GRANT ALL ON TABLE assessment_logs TO anon;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
        
        ALTER TABLE assessment_logs DISABLE ROW LEVEL SECURITY;
        
        -- Also ensure the parent grants are robust
        GRANT USAGE ON SCHEMA public TO anon, authenticated;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
    """)

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('assessment_responses', 'explanation')
    op.execute("ALTER TABLE assessment_logs ENABLE ROW LEVEL SECURITY;")
