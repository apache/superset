# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
"""Adds uuid columns to all classes with ImportExportMixin: dashboards, datasources, dbs, slices, tables, dashboard_email_schedules, slice_email_schedules

Revision ID: e5200a951e62
Revises: e9df189e5c7e
Create Date: 2019-05-08 13:42:48.479145

"""
import uuid

from alembic import op
from sqlalchemy import CHAR, Column, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy_utils.types.uuid import UUIDType

from superset import db

# revision identifiers, used by Alembic.
revision = 'e5200a951e62'
down_revision = 'd7c1a0d6f2da'

Base = declarative_base()


def get_uuid():
    return str(uuid.uuid4())


class Dashboard(Base):
    __tablename__ = 'dashboards'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)


class Datasource(Base):
    __tablename__ = 'datasources'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)


class Database(Base):
    __tablename__ = 'dbs'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)


class DruidCluster(Base):
    __tablename__ = 'clusters'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)


class DruidMetric(Base):
    __tablename__ = 'metrics'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)


class Slice(Base):
    __tablename__ = 'slices'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)


class SqlaTable(Base):
    __tablename__ = 'tables'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)


class SqlMetric(Base):
    __tablename__ = 'sql_metrics'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)


class TableColumn(Base):
    __tablename__ = 'table_columns'
    id = Column(Integer, primary_key=True)
    uuid = Column(UUIDType(binary=False), default=get_uuid)


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    db_type = session.bind.dialect.name

    def add_uuid_column(col_name, _type):
        """Add a uuid column to a given table"""
        with op.batch_alter_table(col_name) as batch_op:
            batch_op.add_column(Column('uuid', UUIDType(binary=False), default=get_uuid))
        for s in session.query(_type):
            s.uuid = get_uuid()
            session.merge(s)

        if db_type != 'postgresql':
            with op.batch_alter_table(col_name) as batch_op:
                batch_op.alter_column('uuid', existing_type=CHAR(32),
                                      new_column_name='uuid', nullable=False)
                batch_op.create_unique_constraint('uq_uuid', ['uuid'])

        session.commit()

    add_uuid_column('dashboards', Dashboard)
    add_uuid_column('datasources', Datasource)
    add_uuid_column('dbs', Database)
    add_uuid_column('clusters', DruidCluster)
    add_uuid_column('metrics', DruidMetric)
    add_uuid_column('slices', Slice)
    add_uuid_column('sql_metrics', SqlMetric)
    add_uuid_column('tables', SqlaTable)
    add_uuid_column('table_columns', TableColumn)

    session.close()


def downgrade():
    with op.batch_alter_table('dashboards') as batch_op:
        batch_op.drop_column('uuid')

    with op.batch_alter_table('datasources') as batch_op:
        batch_op.drop_column('uuid')

    with op.batch_alter_table('dbs') as batch_op:
        batch_op.drop_column('uuid')

    with op.batch_alter_table('clusters') as batch_op:
        batch_op.drop_column('uuid')

    with op.batch_alter_table('metrics') as batch_op:
        batch_op.drop_column('uuid')

    with op.batch_alter_table('slices') as batch_op:
        batch_op.drop_column('uuid')

    with op.batch_alter_table('sql_metrics') as batch_op:
        batch_op.drop_column('uuid')

    with op.batch_alter_table('tables') as batch_op:
        batch_op.drop_column('uuid')

    with op.batch_alter_table('table_columns') as batch_op:
        batch_op.drop_column('uuid')
