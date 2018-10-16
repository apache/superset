"""sqla_descr

Revision ID: 55179c7f25c7
Revises: 315b3f4da9b0
Create Date: 2015-12-13 08:38:43.704145

"""

# revision identifiers, used by Alembic.
revision = '55179c7f25c7'
down_revision = '315b3f4da9b0'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('tables', sa.Column('description', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('tables', 'description')
