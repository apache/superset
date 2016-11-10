"""Enable Filter Select

Revision ID: 6584a92c17a3
Revises: c611f2b591b8
Create Date: 2016-11-07 17:25:33.081565

"""

# revision identifiers, used by Alembic.
revision = '6584a92c17a3'
down_revision = 'c611f2b591b8'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('datasources', sa.Column('filter_select_enabled',
                                           sa.Boolean(), default=False))
    op.add_column('tables', sa.Column('filter_select_enabled',
                                      sa.Boolean(), default=False))


def downgrade():
    op.drop_column('tables', 'filter_select_enabled')
    op.drop_column('datasources', 'filter_select_enabled')
