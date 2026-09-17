"""add seen column to user_achievements

Revision ID: a1f893d50b91
Revises: 5b3fd91dc0c3
Create Date: 2026-09-16 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1f893d50b91'
down_revision: Union[str, None] = '5b3fd91dc0c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_achievements',
        sa.Column('seen', sa.Boolean(), server_default='false', nullable=False)
    )


def downgrade() -> None:
    op.drop_column('user_achievements', 'seen')
