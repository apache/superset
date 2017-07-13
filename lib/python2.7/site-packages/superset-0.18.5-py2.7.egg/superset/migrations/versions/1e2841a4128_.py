"""empty message

Revision ID: 1e2841a4128
Revises: 5a7bad26f2a7
Create Date: 2015-10-05 22:11:00.537054

"""

# revision identifiers, used by Alembic.
revision = '1e2841a4128'
down_revision = '5a7bad26f2a7'

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('table_columns', sa.Column('expression', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('table_columns', 'expression')
