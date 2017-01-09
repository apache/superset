"""Adds params to the datasource (druid) table

Revision ID: 1296d28ec131
Revises: e46f2d27a08e
Create Date: 2016-12-06 17:40:40.389652

"""

# revision identifiers, used by Alembic.
revision = '1296d28ec131'
down_revision = '1b2c3f7c96f9'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('datasources', sa.Column('params', sa.String(length=1000), nullable=True))


def downgrade():
    op.drop_column('datasources', 'params')
