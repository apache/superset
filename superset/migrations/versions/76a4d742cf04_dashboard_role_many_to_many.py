"""dashboard role many to many

Revision ID: b21a4c518cab
Revises: e866bd2d4976
Create Date: 2018-03-08 16:30:36.924096

"""

# revision identifiers, used by Alembic.
revision = '76a4d742cf04'
down_revision = '5ccf602336a0'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table('dashboard_role',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=True),
        sa.Column('dashboard_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['dashboard_id'], [u'dashboards.id'], ),
        sa.ForeignKeyConstraint(['role_id'], [u'ab_role.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('dashboard_role')
