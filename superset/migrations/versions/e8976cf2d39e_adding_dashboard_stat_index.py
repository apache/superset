"""Adding dashboard stat index

Revision ID: e8976cf2d39e
Revises: 2fcdcb35e487
Create Date: 2017-04-17 21:09:46.655435

"""

# revision identifiers, used by Alembic.
revision = 'e8976cf2d39e'
down_revision = '2fcdcb35e487'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


def upgrade():
    op.alter_column(
        'logs',
        'action',
        existing_type=mysql.VARCHAR(length=512),
        type_=sa.String(length=64),
        existing_nullable=True)
    op.create_index(
        'log_dash_status',
        'logs',
        ['dashboard_id', 'action', 'dttm', 'user_id'],
        unique=False)


def downgrade():
    op.drop_index('log_dash_status', table_name='logs')
