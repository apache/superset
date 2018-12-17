"""empty message

Revision ID: d6ffdf31bdd4
Revises: 55e910a74826
Create Date: 2018-03-30 14:00:44.929483

"""

# revision identifiers, used by Alembic.
revision = 'd6ffdf31bdd4'
down_revision = '6c7537a6004a'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dashboards', sa.Column('published', sa.Boolean(), nullable=True))


def downgrade():
    op.drop_column('dashboards', 'published')
