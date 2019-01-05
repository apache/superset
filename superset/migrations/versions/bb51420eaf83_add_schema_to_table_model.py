"""add schema to table model

Revision ID: bb51420eaf83
Revises: 867bf4f117f9
Create Date: 2016-04-11 22:41:06.185955

"""

# revision identifiers, used by Alembic.
revision = 'bb51420eaf83'
down_revision = '867bf4f117f9'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('tables', sa.Column('schema', sa.String(length=255), nullable=True))


def downgrade():
    op.drop_column('tables', 'schema')
