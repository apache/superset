"""image_url

Revision ID: cd8aba67c8b6
Revises: e8976cf2d39e
Create Date: 2017-04-18 16:21:26.561856

"""

# revision identifiers, used by Alembic.
revision = 'cd8aba67c8b6'
down_revision = 'e8976cf2d39e'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('ab_user', sa.Column('image_url', sa.String(length=1000), nullable=True))
    op.add_column('ab_user', sa.Column('slack_username', sa.String(length=500), nullable=True))


def downgrade():
    op.drop_column('ab_user', 'slack_username')
    op.drop_column('ab_user', 'image_url')
