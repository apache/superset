"""allow_run_sync_async

Revision ID: 4500485bde7d
Revises: 41f6a59a61f2
Create Date: 2016-09-12 23:33:14.789632

"""

# revision identifiers, used by Alembic.
revision = '4500485bde7d'
down_revision = '41f6a59a61f2'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dbs', sa.Column('allow_run_async', sa.Boolean(), nullable=True))
    op.add_column('dbs', sa.Column('allow_run_sync', sa.Boolean(), nullable=True))


def downgrade():
    try:
        op.drop_column('dbs', 'allow_run_sync')
        op.drop_column('dbs', 'allow_run_async')
    except Exception:
        pass

