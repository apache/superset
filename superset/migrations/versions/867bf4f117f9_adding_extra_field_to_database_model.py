"""Adding extra field to Database model

Revision ID: 867bf4f117f9
Revises: fee7b758c130
Create Date: 2016-04-03 15:23:20.280841

"""
# revision identifiers, used by Alembic.
revision = '867bf4f117f9'
down_revision = 'fee7b758c130'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dbs', sa.Column('extra', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('dbs', 'extra')
