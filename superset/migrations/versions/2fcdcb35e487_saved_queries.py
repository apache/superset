"""saved_queries

Revision ID: 2fcdcb35e487
Revises: a6c18f869a4e
Create Date: 2017-03-29 15:04:35.734190

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2fcdcb35e487'
down_revision = 'a6c18f869a4e'


def upgrade():
    op.create_table(
        'saved_query',
        sa.Column('created_on', sa.DateTime(), nullable=True),
        sa.Column('changed_on', sa.DateTime(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('db_id', sa.Integer(), nullable=True),
        sa.Column('label', sa.String(256), nullable=True),
        sa.Column('schema', sa.String(128), nullable=True),
        sa.Column('sql', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('changed_by_fk', sa.Integer(), nullable=True),
        sa.Column('created_by_fk', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['user_id'], [u'ab_user.id'], ),
        sa.ForeignKeyConstraint(['db_id'], [u'dbs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('saved_query')
