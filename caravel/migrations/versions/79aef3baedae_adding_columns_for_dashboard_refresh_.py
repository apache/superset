"""Adding Columns for Dashboard Refresh Properties

Revision ID: 79aef3baedae
Revises: f162a1dea4c4
Create Date: 2016-07-02 14:51:00.106192

"""

# revision identifiers, used by Alembic.
revision = '79aef3baedae'
down_revision = 'f162a1dea4c4'

from alembic import op
import sqlalchemy as sa


def upgrade():
    try:
        op.add_column('dashboards', sa.Column('autorefresh_from_cache', sa.Boolean(), nullable=False, server_default='True'))
    except:
        # To pick up databases (like some MySQL variants) without a true Boolean value
        op.add_column('dashboards', sa.Column('autorefresh_from_cache', sa.Boolean(), nullable=False, server_default='1'))

    op.add_column('dashboards', sa.Column('autorefresh_seconds', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('dashboards', 'autorefresh_seconds')
    op.drop_column('dashboards', 'autorefresh_from_cache')
