"""empty message

Revision ID: 97334f891105
Revises: fee7b758c130
Create Date: 2016-04-03 22:49:44.913824

"""

# revision identifiers, used by Alembic.
revision = '97334f891105'
down_revision = 'fee7b758c130'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dbs', sa.Column('schema_name', sa.String(length=250), nullable=True))

def downgrade():
    op.drop_column('dbs', 'schema_name')

