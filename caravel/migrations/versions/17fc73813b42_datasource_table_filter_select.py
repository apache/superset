"""datasource_table_filter_select

Revision ID: 17fc73813b42
Revises: 3c3ffe173e4f
Create Date: 2016-08-12 16:41:25.629004

"""

# revision identifiers, used by Alembic.
revision = '17fc73813b42'
down_revision = '3c3ffe173e4f'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('datasources', sa.Column('filter_select_enabled', sa.Boolean(), default=False))
    op.add_column('tables', sa.Column('filter_select_enabled', sa.Boolean(), default=False))


def downgrade():
    op.drop_column('tables', 'filter_select_enabled')
    op.drop_column('datasources', 'filter_select_enabled')
