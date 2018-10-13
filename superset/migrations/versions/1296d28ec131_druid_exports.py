"""Adds params to the datasource (druid) table

Revision ID: 1296d28ec131
Revises: 6414e83d82b7
Create Date: 2016-12-06 17:40:40.389652

"""

# revision identifiers, used by Alembic.
revision = '1296d28ec131'
down_revision = '6414e83d82b7'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('datasources', sa.Column('params', sa.String(length=1000), nullable=True))


def downgrade():
    op.drop_column('datasources', 'params')
