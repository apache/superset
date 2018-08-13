"""position_json

Revision ID: 1a1d627ebd8e
Revises: 0c5070e96b57
Create Date: 2018-08-13 11:30:07.101702

"""

# revision identifiers, used by Alembic.
revision = '1a1d627ebd8e'
down_revision = '0c5070e96b57'

from alembic import op
import sqlalchemy as sa

from superset.utils import MediumText


def upgrade():
    with op.batch_alter_table('dashboards') as batch_op:
        batch_op.alter_column(
            'position_json',
            existing_type=sa.Text(),
            type_=MediumText(),
            existing_nullable=True,
        )


def downgrade():
    with op.batch_alter_table('dashboards') as batch_op:
        batch_op.alter_column(
            'position_json',
            existing_type=MediumText(),
            type_=sa.Text(),
            existing_nullable=True,
        )
