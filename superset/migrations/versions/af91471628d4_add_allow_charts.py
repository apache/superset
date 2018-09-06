"""empty message

Revision ID: af91471628d4
Revises: 55e910a74826
Create Date: 2018-09-06 02:04:06.340732

"""

# revision identifiers, used by Alembic.
revision = 'af91471628d4'
down_revision = '55e910a74826'

from alembic import op
import sqlalchemy as sa


from sqlalchemy.sql import expression


def upgrade():
    op.add_column(
    	'dbs',
    	sa.Column(
    		'allow_charts',
    		sa.Boolean(),
    		nullable=False,
    		server_default=expression.true()))

def downgrade():
    op.drop_column('dbs', 'allow_charts')

