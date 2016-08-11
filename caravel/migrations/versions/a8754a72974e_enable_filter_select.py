"""Enable Filter Select Dropdown

Revision ID: a8754a72974e
Revises: 5e4a03ef0bf0
Create Date: 2016-09-22 11:20:56.589074

"""

# revision identifiers, used by Alembic.
revision = 'a8754a72974e'
down_revision = '5e4a03ef0bf0'

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
