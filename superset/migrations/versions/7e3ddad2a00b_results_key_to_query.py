"""results_key to query

Revision ID: 7e3ddad2a00b
Revises: b46fa1b0b39e
Create Date: 2016-10-14 11:17:54.995156

"""

# revision identifiers, used by Alembic.
revision = '7e3ddad2a00b'
down_revision = 'b46fa1b0b39e'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('query', sa.Column('results_key', sa.String(length=64), nullable=True))


def downgrade():
    op.drop_column('query', 'results_key')
