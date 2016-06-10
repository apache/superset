"""Add new field 'is_restricted' to SqlMetric and DruidMetric

Revision ID: d8bc074f7aad
Revises: 1226819ee0e3
Create Date: 2016-06-07 12:33:25.756640

"""

# revision identifiers, used by Alembic.
revision = 'd8bc074f7aad'
down_revision = '1226819ee0e3'

from alembic import op
import sqlalchemy as sa
from caravel import db
from caravel import models


def upgrade():
    op.add_column('metrics', sa.Column('is_restricted', sa.Boolean(), nullable=True))
    op.add_column('sql_metrics', sa.Column('is_restricted', sa.Boolean(), nullable=True))

    bind = op.get_bind()
    session = db.Session(bind=bind)

    session.query(models.DruidMetric).update({
        'is_restricted': False
    })
    session.query(models.SqlMetric).update({
        'is_restricted': False
    })

    session.commit()
    session.close()


def downgrade():
    with op.batch_alter_table('sql_metrics', schema=None) as batch_op:
        batch_op.drop_column('is_restricted')

    with op.batch_alter_table('metrics', schema=None) as batch_op:
        batch_op.drop_column('is_restricted')
