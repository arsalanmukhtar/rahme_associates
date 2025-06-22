"""drop_user_id_from_nsw_addresses

Revision ID: c1d2e3f4g5h6
Revises: 261551f0f8c1
Create Date: 2025-06-22 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4g5h6'
down_revision: Union[str, None] = '261551f0f8c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the user_id column from nsw_addresses table
    op.drop_column('nsw_addresses', 'user_id')


def downgrade() -> None:
    # Re-create the user_id column if needed to rollback
    op.add_column('nsw_addresses',
        sa.Column('user_id', sa.Integer(), nullable=True)
    )
    # If there was a foreign key constraint with the users table, add it back:
    # op.create_foreign_key(
    #     None, 'nsw_addresses', 'users', ['user_id'], ['id']
    # )
