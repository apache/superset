"""Add verbose name to table/datasources

Revision ID: 699feb3943c0
Revises: ca69c70ec99b
Create Date: 2017-06-25 14:00:04.056776

"""

# revision identifiers, used by Alembic.
revision = '699feb3943c0'
down_revision = 'ca69c70ec99b'


from alembic import op
import sqlalchemy as sa


def upgrade():
    # Druid
    op.add_column('datasources', sa.Column('verbose_name', sa.String(length=64), nullable=True))

    # SQL
    op.add_column('tables', sa.Column('verbose_name', sa.String(length=64), nullable=True))


def downgrade():
    # Druid
    op.drop_column('datasources', 'verbose_name')

    # SQL
    op.drop_column('tables', 'verbose_name')

