"""empty message

Revision ID: 6400c588de5e
Revises: bddc498dd179
Create Date: 2018-07-13 17:10:00.156708

"""

# revision identifiers, used by Alembic.
revision = '6400c588de5e'
down_revision = 'bddc498dd179'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dbs', sa.Column('allow_csv_upload', sa.Boolean(), nullable=True))

def downgrade():
    op.drop_column('dbs', 'allow_csv_upload')
