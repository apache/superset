"""allow_temp_table

Revision ID: 33459b145c15
Revises: d8bc074f7aad
Create Date: 2016-06-13 15:54:08.117103

"""

# revision identifiers, used by Alembic.
revision = '33459b145c15'
down_revision = 'd8bc074f7aad'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column(
        'dbs', sa.Column('allow_temp_table', sa.Boolean(), nullable=True))


def downgrade():
    op.drop_column('dbs', 'allow_temp_table')
