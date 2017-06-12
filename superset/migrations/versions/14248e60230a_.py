"""Multi Language Name

Revision ID: 14248e60230a
Revises: 2fcdcb35e487
Create Date: 2017-05-24 07:54:34.235510

"""

# revision identifiers, used by Alembic.
revision = '14248e60230a'
down_revision = 'a65458420354'

from alembic import op
import sqlalchemy as sa


def upgrade():
    # Druid
    op.add_column('datasources', sa.Column('multi_lang_name', sa.Text(), nullable=True))
    op.add_column('columns', sa.Column('multi_lang_name', sa.Text(), nullable=True))
    op.add_column('metrics', sa.Column('multi_lang_name', sa.Text(), nullable=True))

    # SQL
    op.add_column('tables', sa.Column('multi_lang_name', sa.Text(), nullable=True))
    op.add_column('table_columns', sa.Column('multi_lang_name', sa.Text(), nullable=True))
    op.add_column('sql_metrics', sa.Column('multi_lang_name', sa.Text(), nullable=True))


def downgrade():
    # Druid
    op.drop_column('datasources', 'multi_lang_name')
    op.drop_column('columns', 'multi_lang_name')
    op.drop_column('metrics', 'multi_lang_name')

    # SQL
    op.drop_column('tables', 'multi_lang_name')
    op.drop_column('table_columns', 'multi_lang_name')
    op.drop_column('sql_metrics', 'multi_lang_name')