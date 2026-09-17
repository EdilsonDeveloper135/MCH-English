"""add performance composite indexes

Revision ID: f2a71c8901be
Revises: a1f893d50b91
Create Date: 2026-09-16 22:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f2a71c8901be"
down_revision: Union[str, None] = "a1f893d50b91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "idx_sessions_user_finished",
        "typing_sessions",
        ["user_id", "finished_at"],
        unique=False,
    )
    op.create_index(
        "idx_user_achievements_user_seen",
        "user_achievements",
        ["user_id", "seen"],
        unique=False,
    )
    op.create_index(
        "idx_user_vocab_user_last_seen",
        "vocabulary_items",
        ["user_id", "last_seen"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_user_vocab_user_last_seen", table_name="vocabulary_items")
    op.drop_index("idx_user_achievements_user_seen", table_name="user_achievements")
    op.drop_index("idx_sessions_user_finished", table_name="typing_sessions")
