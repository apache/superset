"""tracking_url

Revision ID: ca69c70ec99b
Revises: a65458420354
Create Date: 2017-07-26 20:09:52.606416

"""

# revision identifiers, used by Alembic.
revision = 'ca69c70ec99b'
down_revision = 'a65458420354'

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


def upgrade():
    op.add_column('query', sa.Column('tracking_url', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('query', 'tracking_url')
