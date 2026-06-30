"""add index on session status and timestamp

Revision ID: 38133ec623ec
Revises: 
Create Date: 2026-06-29 15:53:08.428791

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '38133ec623ec'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('sessions') as batch_op:
        batch_op.create_index(batch_op.f('ix_sessions_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_sessions_timestamp'), ['timestamp'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('sessions') as batch_op:
        batch_op.drop_index(batch_op.f('ix_sessions_timestamp'))
        batch_op.drop_index(batch_op.f('ix_sessions_status'))
