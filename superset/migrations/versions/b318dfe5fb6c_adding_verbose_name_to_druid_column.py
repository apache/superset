"""adding verbose_name to druid column

Revision ID: b318dfe5fb6c
Revises: d6db5a5cdb5d
Create Date: 2017-03-08 11:48:10.835741

"""

# revision identifiers, used by Alembic.
revision = 'b318dfe5fb6c'
down_revision = 'd6db5a5cdb5d'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('columns', sa.Column('verbose_name', sa.String(length=1024), nullable=True))


def downgrade():
    op.drop_column('columns', 'verbose_name')
