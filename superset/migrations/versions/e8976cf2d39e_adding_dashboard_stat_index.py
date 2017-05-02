"""Adding dashboard stat index

Revision ID: e8976cf2d39e
Revises: 2fcdcb35e487
Create Date: 2017-04-17 21:09:46.655435

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e8976cf2d39e'
down_revision = '2fcdcb35e487'


def upgrade():
    try:
        op.alter_column(
            'logs',
            'action',
            type_=sa.String(length=64),
            existing_nullable=True)
        op.create_index(
            'log_dash_status',
            'logs',
            ['dashboard_id', 'action', 'dttm', 'user_id'],
            unique=False)
    except Exception:
        pass


def downgrade():
    op.drop_index('log_dash_status', table_name='logs')
