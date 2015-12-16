"""is_featured

Revision ID: 12d55656cbca
Revises: 55179c7f25c7
Create Date: 2015-12-14 13:37:17.374852

"""

# revision identifiers, used by Alembic.
revision = '12d55656cbca'
down_revision = '55179c7f25c7'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('tables', sa.Column('is_featured', sa.Boolean(), nullable=True))


def downgrade():
    op.drop_column('tables', 'is_featured')

