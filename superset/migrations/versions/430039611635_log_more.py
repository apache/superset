"""log more

Revision ID: 430039611635
Revises: d827694c7555
Create Date: 2016-02-10 08:47:28.950891

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '430039611635'
down_revision = 'd827694c7555'


def upgrade():
    op.add_column('logs', sa.Column('dashboard_id', sa.Integer(), nullable=True))
    op.add_column('logs', sa.Column('slice_id', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('logs', 'slice_id')
    op.drop_column('logs', 'dashboard_id')
