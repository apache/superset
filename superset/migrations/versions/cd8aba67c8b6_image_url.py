"""image_url

Revision ID: cd8aba67c8b6
Revises: e8976cf2d39e
Create Date: 2017-04-18 16:21:26.561856

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'cd8aba67c8b6'
down_revision = 'e8976cf2d39e'


def upgrade():
    try:
        with op.batch_alter_table('ab_user', schema=None) as batch_op:
            batch_op.add_column(
                'ab_user',
                sa.Column('image_url', sa.String(length=1000), nullable=True))
            batch_op.add_column(
                'ab_user',
                sa.Column('slack_username', sa.String(length=500), nullable=True))
    except Exception:
        pass


def downgrade():
    with op.batch_alter_table('ab_user', schema=None) as batch_op:
        batch_op.drop_column('ab_user', 'slack_username')
        batch_op.drop_column('ab_user', 'image_url')
