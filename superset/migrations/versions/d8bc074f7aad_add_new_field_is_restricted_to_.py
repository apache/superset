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
from superset import db
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import (
    Column, Integer, Boolean)

Base = declarative_base()

class DruidMetric(Base):
    """Declarative class used to do query in upgrade"""
    __tablename__ = 'metrics'
    id = Column(Integer, primary_key=True)
    is_restricted = Column(Boolean, default=False, nullable=True)

class SqlMetric(Base):
    """Declarative class used to do query in upgrade"""
    __tablename__ = 'sql_metrics'
    id = Column(Integer, primary_key=True)
    is_restricted = Column(Boolean, default=False, nullable=True)

def upgrade():
    op.add_column('metrics', sa.Column('is_restricted', sa.Boolean(), nullable=True))
    op.add_column('sql_metrics', sa.Column('is_restricted', sa.Boolean(), nullable=True))

    bind = op.get_bind()
    session = db.Session(bind=bind)

    # don't use models.DruidMetric
    # because it assumes the context is consistent with the application
    for obj in session.query(DruidMetric).all():
        obj.is_restricted = False

    for obj in session.query(SqlMetric).all():
        obj.is_restricted = False

    session.commit()
    session.close()


def downgrade():
    with op.batch_alter_table('sql_metrics', schema=None) as batch_op:
        batch_op.drop_column('is_restricted')

    with op.batch_alter_table('metrics', schema=None) as batch_op:
        batch_op.drop_column('is_restricted')
