"""empty message

Revision ID: 5a7bad26f2a7
Revises: 4e6a06bad7a8
Create Date: 2015-10-05 10:32:15.850753

"""

# revision identifiers, used by Alembic.
revision = '5a7bad26f2a7'
down_revision = '4e6a06bad7a8'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dashboards', sa.Column('css', sa.Text(), nullable=True))
    op.add_column('dashboards', sa.Column('description', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('dashboards', 'description')
    op.drop_column('dashboards', 'css')
