"""add d timestamp format for tables

Revision ID: 422116f431b7
Revises: 956a063c52b3
Create Date: 2016-05-20 19:11:57.218062

"""

# revision identifiers, used by Alembic.
revision = '422116f431b7'
down_revision = '956a063c52b3'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('tables', sa.Column('timestamp_format', sa.String(length=256), nullable=True))


def downgrade():
    op.drop_column('tables', 'timestamp_format')
