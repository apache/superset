"""remove_coordinator_from_druid_cluster_model.py

Revision ID: 46f444d8b9b7
Revises: 4ce8df208545
Create Date: 2018-11-26 00:01:04.781119

"""

# revision identifiers, used by Alembic.
revision = '46f444d8b9b7'
down_revision = '4ce8df208545'

from alembic import op
import sqlalchemy as sa
import logging


def upgrade():
    try:
        op.drop_column('clusters', 'coordinator_host')
        op.drop_column('clusters', 'coordinator_endpoint')
        op.drop_column('clusters', 'coordinator_port')
    except Exception as e:
        # Sqlite does not support drop column
        logging.warning(str(e))


def downgrade():
    op.add_column('clusters', sa.Column('coordinator_host', sa.String(length=256), nullable=True))
    op.add_column('clusters', sa.Column('coordinator_port', sa.Integer(), nullable=True))
    op.add_column('clusters', sa.Column('coordinator_endpoint', sa.String(length=256), nullable=True))
