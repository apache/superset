"""empty message

Revision ID: 43df8de3a5f4
Revises: 7dbf98566af7
Create Date: 2016-01-18 23:43:16.073483

"""

# revision identifiers, used by Alembic.
revision = '43df8de3a5f4'
down_revision = '7dbf98566af7'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dashboards', sa.Column('json_metadata', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('dashboards', 'json_metadata')
