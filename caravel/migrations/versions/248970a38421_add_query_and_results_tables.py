"""empty message

Revision ID: 248970a38421
Revises: f162a1dea4c4
Create Date: 2016-07-20 12:34:01.731233

"""

# revision identifiers, used by Alembic.
revision = '248970a38421'
down_revision = 'f162a1dea4c4'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table('query',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('database_id', sa.Integer(), nullable=False),
    sa.Column('table_ids', sa.Integer(), nullable=True),
    sa.Column('user_id', sa.Integer(), nullable=True),
    sa.Column('result_id', sa.Integer(), nullable=True),
    sa.Column('name', sa.String(length=256), nullable=True),
    sa.Column('query', sa.String(length=10000), nullable=True),
    sa.Column('query_limit', sa.Integer(), nullable=True),
    sa.Column('query_status', sa.Enum(
        u'SCHEDULED',
        u'CANCELLED',
        u'IN_PROGRESS',
        u'FINISHED',
        u'TIMED_OUT',
        u'FAILED',
        name='query_status'),
              nullable=True),
    sa.Column('query_progress', sa.Integer(), nullable=True),
    sa.Column('start_time', sa.DateTime(), nullable=True),
    sa.Column('end_time', sa.DateTime(), nullable=True),
    sa.Column('viewed_on', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['database_id'], [u'dbs.id'], ),
    sa.ForeignKeyConstraint(['result_id'], [u'query_result.id'], ),
    sa.ForeignKeyConstraint(['table_ids'], [u'tables.id'], ),
    sa.ForeignKeyConstraint(['user_id'], [u'ab_user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('query_result',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('query_id', sa.Integer(), nullable=False),
    sa.Column('tmp_table_id', sa.Integer(), nullable=True),
    sa.Column('expiration_date', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['query_id'], [u'query.id'], ),
    sa.ForeignKeyConstraint(['tmp_table_id'], [u'tables.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('query_result')
    op.drop_table('query')
