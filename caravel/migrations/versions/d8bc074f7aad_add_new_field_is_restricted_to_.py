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

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import (
    Column, Integer, String, ForeignKey, Boolean)
import traceback
import logging

Base = declarative_base()
class DruidMetric(Base):
    __tablename__ = 'metrics'
    id = Column(Integer, primary_key=True)
    # metric_name = Column(String(512))
    # verbose_name = Column(String(1024))
    # metric_type = Column(String(32))
    # datasource_name = Column(
    #     String(250),
    #     ForeignKey('datasources.datasource_name'))
    # # Setting enable_typechecks=False disables polymorphic inheritance.
    # datasource = relationship('DruidDatasource', backref='metrics',
    #                           enable_typechecks=False)
    # json = Column(Text)
    # description = Column(Text)
    is_restricted = Column(Boolean, default=False, nullable=True)

class SqlMetric(Base):
    __tablename__ = 'sql_metrics'
    id = Column(Integer, primary_key=True)
    # metric_name = Column(String(512))
    # verbose_name = Column(String(1024))
    # metric_type = Column(String(32))
    # table_id = Column(Integer, ForeignKey('tables.id'))
    # table = relationship(
    #     'SqlaTable', backref='metrics', foreign_keys=[table_id])
    # expression = Column(Text)
    # description = Column(Text)
    is_restricted = Column(Boolean, default=False, nullable=True)
def upgrade():
    op.add_column('metrics', sa.Column('is_restricted', sa.Boolean(), nullable=True))
    op.add_column('sql_metrics', sa.Column('is_restricted', sa.Boolean(), nullable=True))

    bind = op.get_bind()
    session = db.Session(bind=bind)

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
