"""adding_sql_expr_macro_model

Revision ID: 09548f11f197
Revises: b347b202819b
Create Date: 2016-08-11 07:45:43.854832

"""

# revision identifiers, used by Alembic.
revision = '09548f11f197'
down_revision = 'b347b202819b'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.create_table('sql_expr_macros',
        sa.Column('created_on', sa.DateTime(), nullable=False),
        sa.Column('changed_on', sa.DateTime(), nullable=False),
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('namespace', sa.String(length=50), nullable=True),
        sa.Column('source_code', sa.Text(), nullable=True),
        sa.Column('changed_by_fk', sa.Integer(), nullable=True),
        sa.Column('created_by_fk', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['changed_by_fk'], ['ab_user.id'], ),
        sa.ForeignKeyConstraint(['created_by_fk'], ['ab_user.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

def downgrade():
    op.drop_table('sql_expr_macros')
