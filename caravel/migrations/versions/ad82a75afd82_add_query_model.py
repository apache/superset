"""empty message

Revision ID: ad82a75afd82
Revises: f162a1dea4c4
Create Date: 2016-07-25 17:48:12.771103

"""

# revision identifiers, used by Alembic.
revision = 'ad82a75afd82'
down_revision = 'f162a1dea4c4'

from alembic import op
import sqlalchemy as sa

def upgrade():
    op.create_table('query',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('database_id', sa.Integer(), nullable=False),
        sa.Column('table_names', sa.Integer(), nullable=True),
        sa.Column('tmp_table_name', sa.String(length=64), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('query_status', sa.String(length=16), nullable=True),
        sa.Column('query_name', sa.String(length=64), nullable=True),
        sa.Column('query_text', sa.String(length=10000), nullable=True),
        sa.Column('query_limit', sa.Integer(), nullable=True),
        sa.Column('query_progress', sa.Integer(), nullable=True),
        sa.Column('start_time', sa.BigInteger(), nullable=True),
        sa.Column('end_time', sa.BigInteger(), nullable=True),
        sa.ForeignKeyConstraint(['database_id'], [u'dbs.id'], ),
        sa.ForeignKeyConstraint(['table_names'], [u'tables.id'], ),
        sa.ForeignKeyConstraint(['user_id'], [u'ab_user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('query')
