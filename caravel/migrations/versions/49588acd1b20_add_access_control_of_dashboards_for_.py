"""Add access control of dashboards for different roles

Revision ID: 49588acd1b20
Revises: 956a063c52b3
Create Date: 2016-05-17 16:31:18.804310

"""

# revision identifiers, used by Alembic.
revision = '49588acd1b20'
down_revision = '956a063c52b3'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table('dashboard_role_access',
                    sa.Column('id', sa.Integer(), nullable=False),
                    sa.Column('role_id', sa.Integer(), nullable=True),
                    sa.Column('dashboard_id', sa.Integer(), nullable=True),
                    sa.ForeignKeyConstraint(['dashboard_id'],
                                            [u'dashboards.id'], ),
                    sa.ForeignKeyConstraint(['role_id'], [u'ab_role.id'], ),
                    sa.PrimaryKeyConstraint('id')
                    )


def downgrade():
    op.drop_table('dashboard_role_access')
