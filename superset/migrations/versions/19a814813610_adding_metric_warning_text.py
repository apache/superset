"""Adding metric warning_text

Revision ID: 19a814813610
Revises: ca69c70ec99b
Create Date: 2017-09-15 15:09:40.495345

"""

# revision identifiers, used by Alembic.
revision = '19a814813610'
down_revision = 'ca69c70ec99b'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('metrics', sa.Column('warning_text', sa.Text(), nullable=True))
    op.add_column('sql_metrics', sa.Column('warning_text', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('sql_metrics') as batch_op_sql_metrics:
        batch_op_sql_metrics.drop_column('warning_text')
    with op.batch_alter_table('metrics') as batch_op_metrics:
        batch_op_metrics.drop_column('warning_text')
