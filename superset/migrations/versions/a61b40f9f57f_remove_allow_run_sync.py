"""remove allow_run_sync

Revision ID: a61b40f9f57f
Revises: 46f444d8b9b7
Create Date: 2018-11-27 11:53:17.512627

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a61b40f9f57f'
down_revision = '46f444d8b9b7'


def upgrade():
    op.drop_column('dbs', 'allow_run_sync')


def downgrade():
    op.add_column(
        'dbs',
        sa.Column(
            'allow_run_sync',
            sa.Integer(display_width=1),
            autoincrement=False, nullable=True,
        ),
    )
