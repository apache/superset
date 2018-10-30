"""add_sql_string_to_table

Revision ID: 3c3ffe173e4f
Revises: ad82a75afd82
Create Date: 2016-08-18 14:06:28.784699

"""

# revision identifiers, used by Alembic.
revision = '3c3ffe173e4f'
down_revision = 'ad82a75afd82'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('tables', sa.Column('sql', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('tables', 'sql')
