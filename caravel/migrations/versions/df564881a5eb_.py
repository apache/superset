"""empty message

Revision ID: df564881a5eb
Revises: ad82a75afd82
Create Date: 2016-07-27 17:35:40.953223

"""

# revision identifiers, used by Alembic.
revision = 'df564881a5eb'
down_revision = 'ad82a75afd82'

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.add_column('dbs', sa.Column('select_as_create_table_as', sa.Boolean(), nullable=True))


def downgrade():
    op.drop_column('dbs', 'select_as_create_table_as')
