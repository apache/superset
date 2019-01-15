"""Add extra column to SavedQuery

Revision ID: a33a03f16c4a
Revises: fb13d49b72f9
Create Date: 2019-01-14 16:00:26.344439

"""

# revision identifiers, used by Alembic.
revision = 'a33a03f16c4a'
down_revision = 'fb13d49b72f9'

from alembic import op
import sqlalchemy as sa


def upgrade():
    with op.batch_alter_table('saved_query') as batch_op:
        batch_op.add_column(sa.Column('extra_json', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('saved_query') as batch_op:
        batch_op.drop_column('extra_json')
