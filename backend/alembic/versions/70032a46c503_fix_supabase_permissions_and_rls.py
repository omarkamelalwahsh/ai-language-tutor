"""fix_supabase_permissions_and_rls

Revision ID: 70032a46c503
Revises: 31c9c08c60aa
Create Date: 2026-04-17 15:34:37.283673

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '70032a46c503'
down_revision: Union[str, Sequence[str], None] = '31c9c08c60aa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        GRANT USAGE ON SCHEMA public TO anon, authenticated;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
        
        ALTER TABLE public.learner_profiles 
        ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

        ALTER TABLE public.assessments DISABLE ROW LEVEL SECURITY;
        ALTER TABLE public.learner_profiles DISABLE ROW LEVEL SECURITY;

        NOTIFY pydantic, 'reload schema';
    """)


def downgrade() -> None:
    """Downgrade schema."""
    pass
