"""Fix wrong constraint on table columns

Revision ID: 1226819ee0e3
Revises: 956a063c52b3
Create Date: 2016-05-27 15:03:32.980343

"""

# revision identifiers, used by Alembic.
revision = '1226819ee0e3'
down_revision = '956a063c52b3'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.drop_constraint('columns_ibfk_1', 'columns')
    op.create_foreign_key('columns_ibfk_1', 'columns', 'datasources', ['datasource_name'], ['datasource_name'])


def downgrade():
    op.drop_constraint('columns_ibfk_1', 'columns')
    op.create_foreign_key('columns_ibfk_1', 'columns', 'datasources', ['columns'], ['datasource_name'])
