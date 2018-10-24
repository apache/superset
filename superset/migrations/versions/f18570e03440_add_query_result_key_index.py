"""Add index on the result key to the query table.

Revision ID: f18570e03440
Revises: 1296d28ec131
Create Date: 2017-01-24 12:40:42.494787

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'f18570e03440'
down_revision = '1296d28ec131'


def upgrade():
    op.create_index(op.f('ix_query_results_key'), 'query', ['results_key'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_query_results_key'), table_name='query')
