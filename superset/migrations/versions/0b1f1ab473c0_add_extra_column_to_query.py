"""Add extra column to Query

Revision ID: 0b1f1ab473c0
Revises: 55e910a74826
Create Date: 2018-11-05 08:42:56.181012

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0b1f1ab473c0'
down_revision = '55e910a74826'


def upgrade():
    with op.batch_alter_table('query') as batch_op:
        batch_op.add_column(sa.Column('extra_json', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('query') as batch_op:
        batch_op.drop_column('extra_json')
