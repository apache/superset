"""allow_dml

Revision ID: 65903709c321
Revises: 4500485bde7d
Create Date: 2016-09-15 08:48:27.284752

"""

# revision identifiers, used by Alembic.
revision = '65903709c321'
down_revision = '4500485bde7d'

from alembic import op
import sqlalchemy as sa


def upgrade():
    op.add_column('dbs', sa.Column('allow_dml', sa.Boolean(), nullable=True))


def downgrade():
    try:
        op.drop_column('dbs', 'allow_dml')
    except Exception as e:
        logging.exception(e)
        pass
