"""Add verbose name to DruidCluster and Database

Revision ID: db527d8c4c78
Revises: b318dfe5fb6c
Create Date: 2017-03-16 18:10:57.193035

"""

# revision identifiers, used by Alembic.
revision = 'db527d8c4c78'
down_revision = 'b318dfe5fb6c'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('clusters', sa.Column('verbose_name', sa.String(length=250), nullable=True))
    op.create_unique_constraint(None, 'clusters', ['verbose_name'])
    op.add_column('dbs', sa.Column('verbose_name', sa.String(length=250), nullable=True))
    op.create_unique_constraint(None, 'dbs', ['verbose_name'])


def downgrade():
    op.drop_constraint(None, 'dbs', type_='unique')
    op.drop_column('dbs', 'verbose_name')
    op.drop_constraint(None, 'clusters', type_='unique')
    op.drop_column('clusters', 'verbose_name')
