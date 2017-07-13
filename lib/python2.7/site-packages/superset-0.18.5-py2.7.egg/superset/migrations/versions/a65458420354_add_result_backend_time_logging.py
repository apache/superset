"""add_result_backend_time_logging

Revision ID: a65458420354
Revises: 2fcdcb35e487
Create Date: 2017-04-25 10:00:58.053120

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a65458420354'
down_revision = '2fcdcb35e487'


def upgrade():
    op.add_column(
        'query',
        sa.Column(
            'end_result_backend_time',
            sa.Numeric(precision=20, scale=6),
            nullable=True))


def downgrade():
    op.drop_column('query', 'end_result_backend_time')
