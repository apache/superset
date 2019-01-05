"""dim_spec

Revision ID: c611f2b591b8
Revises: ad4d656d92bc
Create Date: 2016-11-02 17:36:04.970448

"""

# revision identifiers, used by Alembic.
revision = 'c611f2b591b8'
down_revision = 'ad4d656d92bc'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('columns', sa.Column('dimension_spec_json', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('columns', 'dimension_spec_json')
