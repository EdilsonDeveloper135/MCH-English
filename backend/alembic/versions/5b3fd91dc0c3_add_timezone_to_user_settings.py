"""add_timezone_to_user_settings

Revision ID: 5b3fd91dc0c3
Revises: c5e2a1b94d12
Create Date: 2026-09-11 22:31:44.127680

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5b3fd91dc0c3'
down_revision: Union[str, None] = 'c5e2a1b94d12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_settings",
        sa.Column("timezone", sa.String(length=50), nullable=False, server_default="UTC"),
    )


def downgrade() -> None:
    op.drop_column("user_settings", "timezone")

