"""add_cache_timeout_to_druid_cluster

Revision ID: ab3d66c4246e
Revises: eca4694defa7
Create Date: 2016-09-30 18:01:30.579760

"""

# revision identifiers, used by Alembic.
revision = 'ab3d66c4246e'
down_revision = 'eca4694defa7'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column(
        'clusters', sa.Column('cache_timeout', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('clusters', 'cache_timeout')
