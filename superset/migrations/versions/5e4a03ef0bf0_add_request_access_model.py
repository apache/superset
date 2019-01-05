"""Add access_request table to manage requests to access datastores.

Revision ID: 5e4a03ef0bf0
Revises: 41f6a59a61f2
Create Date: 2016-09-09 17:39:57.846309

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '5e4a03ef0bf0'
down_revision = 'b347b202819b'


def upgrade():
    op.create_table(
        'access_request',
        sa.Column('created_on', sa.DateTime(), nullable=True),
        sa.Column('changed_on', sa.DateTime(), nullable=True),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('datasource_type', sa.String(length=200), nullable=True),
        sa.Column('datasource_id', sa.Integer(), nullable=True),
        sa.Column('changed_by_fk', sa.Integer(), nullable=True),
        sa.Column('created_by_fk', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade():
    op.drop_table('access_request')
