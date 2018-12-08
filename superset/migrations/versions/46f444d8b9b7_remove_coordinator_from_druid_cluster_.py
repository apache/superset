"""remove_coordinator_from_druid_cluster_model.py

Revision ID: 46f444d8b9b7
Revises: 4ce8df208545
Create Date: 2018-11-26 00:01:04.781119

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '46f444d8b9b7'
down_revision = '4ce8df208545'


def upgrade():
    with op.batch_alter_table('clusters') as batch_op:
        batch_op.drop_column('coordinator_host')
        batch_op.drop_column('coordinator_endpoint')
        batch_op.drop_column('coordinator_port')


def downgrade():
    op.add_column(
        'clusters',
        sa.Column('coordinator_host', sa.String(length=256), nullable=True),
    )
    op.add_column('clusters', sa.Column('coordinator_port', sa.Integer(), nullable=True))
    op.add_column(
        'clusters',
        sa.Column('coordinator_endpoint', sa.String(length=256), nullable=True),
    )
