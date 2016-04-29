"""post_aggs

Revision ID: b4a0abe21630
Revises: 430039611635
Create Date: 2016-02-10 15:16:58.953042

"""

# revision identifiers, used by Alembic.
revision = 'b4a0abe21630'
down_revision = '430039611635'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table('post_aggregators',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=512), nullable=True),
        sa.Column('verbose_name', sa.String(length=1024), nullable=True),
        sa.Column('datasource_name', sa.String(length=250), nullable=True),
        sa.Column('json', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['datasource_name'], ['datasources.datasource_name'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('post_aggregators')
