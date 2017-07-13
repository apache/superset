"""log dt

Revision ID: 1d2ddd543133
Revises: d2424a248d63
Create Date: 2016-03-25 14:35:44.642576

"""

# revision identifiers, used by Alembic.
revision = '1d2ddd543133'
down_revision = 'd2424a248d63'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('logs', sa.Column('dt', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('logs', 'dt')
