"""add index vocabulary user mastery

Revision ID: c5e2a1b94d12
Revises: ebfc8aa6e23b
Create Date: 2026-09-10 08:15:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c5e2a1b94d12"
down_revision: Union[str, None] = "ebfc8aa6e23b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_vocabulary_items_user_mastery",
        "vocabulary_items",
        ["user_id", "mastery_score"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_vocabulary_items_user_mastery", table_name="vocabulary_items")
