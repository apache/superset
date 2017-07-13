"""cache_timeouts

Revision ID: 836c0bf75904
Revises: 18e88e1cc004
Create Date: 2016-03-17 08:40:03.186534

"""

# revision identifiers, used by Alembic.
revision = '836c0bf75904'
down_revision = '18e88e1cc004'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('datasources', sa.Column('cache_timeout', sa.Integer(), nullable=True))
    op.add_column('dbs', sa.Column('cache_timeout', sa.Integer(), nullable=True))
    op.add_column('slices', sa.Column('cache_timeout', sa.Integer(), nullable=True))
    op.add_column('tables', sa.Column('cache_timeout', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('tables', 'cache_timeout')
    op.drop_column('slices', 'cache_timeout')
    op.drop_column('dbs', 'cache_timeout')
    op.drop_column('datasources', 'cache_timeout')
