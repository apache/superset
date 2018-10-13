"""empty message

Revision ID: 7dbf98566af7
Revises: 8e80a26a31db
Create Date: 2016-01-17 22:00:23.640788

"""

# revision identifiers, used by Alembic.
revision = '7dbf98566af7'
down_revision = '8e80a26a31db'

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('slices', sa.Column('description', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('slices', 'description')
