"""log_this_plus

Revision ID: 525c854f0005
Revises: e46f2d27a08e
Create Date: 2016-12-13 16:19:02.239322

"""

# revision identifiers, used by Alembic.
revision = '525c854f0005'
down_revision = 'e46f2d27a08e'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('logs', sa.Column('duration_ms', sa.Integer(), nullable=True))
    op.add_column('logs', sa.Column('referrer', sa.String(length=1024), nullable=True))


def downgrade():
    op.drop_column('logs', 'referrer')
    op.drop_column('logs', 'duration_ms')
