"""Update models to support storing the queries.

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
        sa.Column('tmp_table_name', sa.String(length=64), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=16), nullable=True),
        sa.Column('name', sa.String(length=64), nullable=True),
        sa.Column('sql', sa.Text, nullable=True),
        sa.Column('limit', sa.Integer(), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True),
        sa.Column('start_time', sa.DateTime(), nullable=True),
        sa.Column('end_time', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['database_id'], [u'dbs.id'], ),
        sa.ForeignKeyConstraint(['user_id'], [u'ab_user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.add_column('dbs', sa.Column('select_as_create_table_as', sa.Boolean(),
                                   nullable=True))


def downgrade():
    op.drop_table('query')
    op.drop_column('dbs', 'select_as_create_table_as')
