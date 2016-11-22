"""add index to Log

Revision ID: e27bbff06636
Revises: e46f2d27a08e
Create Date: 2016-11-22 15:29:43.860727

"""

# revision identifiers, used by Alembic.
revision = 'e27bbff06636'
down_revision = 'e46f2d27a08e'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_index(
        'views',
        'logs', ['dashboard_id', 'user_id', 'action', 'dttm'], unique=False)


def downgrade():
    op.drop_index('views', table_name='logs')
