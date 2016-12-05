"""Adding refresh_frequency field to dashboard model

Revision ID: 59eddc0ca802
Revises: e46f2d27a08e
Create Date: 2016-11-28 16:55:49.419416

"""

# revision identifiers, used by Alembic.
revision = '59eddc0ca802'
down_revision = 'e46f2d27a08e'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dashboards',sa.Column('refresh_frequency', sa.Integer()))

def downgrade():
    op.drop_column('dashboards','refresh_frequency')
