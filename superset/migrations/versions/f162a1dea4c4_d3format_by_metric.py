"""d3format_by_metric

Revision ID: f162a1dea4c4
Revises: 960c69cb1f5b
Create Date: 2016-07-06 22:04:28.685100

"""

# revision identifiers, used by Alembic.
revision = 'f162a1dea4c4'
down_revision = '960c69cb1f5b'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('metrics', sa.Column('d3format', sa.String(length=128), nullable=True))
    op.add_column('sql_metrics', sa.Column('d3format', sa.String(length=128), nullable=True))


def downgrade():
    op.drop_column('sql_metrics', 'd3format')
    op.drop_column('metrics', 'd3format')
