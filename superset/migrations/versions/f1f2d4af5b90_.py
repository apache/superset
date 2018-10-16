"""Enable Filter Select

Revision ID: f1f2d4af5b90
Revises: e46f2d27a08e
Create Date: 2016-11-23 10:27:18.517919

"""

# revision identifiers, used by Alembic.
revision = 'f1f2d4af5b90'
down_revision = 'e46f2d27a08e'

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
