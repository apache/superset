"""Add timestamp format for tables

Revision ID: c9f8bef6f6a0
Revises: 1226819ee0e3
Create Date: 2016-06-02 16:42:24.573924

"""

# revision identifiers, used by Alembic.
revision = 'c9f8bef6f6a0'
down_revision = '1226819ee0e3'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('tables', sa.Column('timestamp_format', sa.String(length=256), nullable=True))


def downgrade():
    op.drop_column('tables', 'timestamp_format')
