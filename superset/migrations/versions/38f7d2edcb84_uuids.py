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
"""Adds uuid columns to all classes with ImportExportMixin: dashboards, datasources, dbs, slices, tables
Revision ID: e5200a951e62
Revises: e9df189e5c7e
Create Date: 2019-05-08 13:42:48.479145
"""
import uuid

from alembic import op
from sqlalchemy import CHAR, Column, Integer
from sqlalchemy.ext.declarative import declarative_base

from superset import db
from superset.utils.sqla import get_uuid, uuid_sqla_column

# revision identifiers, used by Alembic.
revision = "38f7d2edcb84"
down_revision = "b4a38aa87893"

Base = declarative_base()


class ImportExportMixin:
    id = Column(Integer, primary_key=True)
    uuid = uuid_sqla_column


class Dashboard(Base, ImportExportMixin):
    __tablename__ = "dashboards"


class Datasource(Base, ImportExportMixin):
    __tablename__ = "datasources"


class Database(Base, ImportExportMixin):
    __tablename__ = "dbs"


class DruidCluster(Base, ImportExportMixin):
    __tablename__ = "clusters"


class DruidMetric(Base, ImportExportMixin):
    __tablename__ = "metrics"


class DruidColumn(Base, ImportExportMixin):
    __tablename__ = "columns"


class Slice(Base, ImportExportMixin):
    __tablename__ = "slices"


class SqlaTable(Base, ImportExportMixin):
    __tablename__ = "tables"


class SqlMetric(Base, ImportExportMixin):
    __tablename__ = "sql_metrics"


class TableColumn(Base, ImportExportMixin):
    __tablename__ = "table_columns"


def batch_commit(iterable, mutator, session, batch_size=100):
    count = len(iterable)
    for i, obj in enumerate(iterable):
        mutator(obj)
        session.merge(obj)
        if i % 100 == 0:
            session.commit()
            print(f"uuid assigned to {i} out of {count}")
    session.commit()
    print(f"Done! Assigned {count} uuids")


def default_mutator(obj):
    obj.uuid = get_uuid()


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)
    db_type = session.bind.dialect.name

    def add_uuid_column(tbl_name, _type):
        """Add a uuid column to a given table"""
        print(f"Add uuid column to table '{tbl_name}'")
        with op.batch_alter_table(tbl_name) as batch_op:
            batch_op.add_column(Column("uuid", CHAR(36), default=get_uuid))
        batch_commit(session.query(_type).all(), default_mutator, session)

    add_uuid_column("dashboards", Dashboard)
    add_uuid_column("datasources", Datasource)
    add_uuid_column("dbs", Database)
    add_uuid_column("clusters", DruidCluster)
    add_uuid_column("metrics", DruidMetric)
    add_uuid_column("columns", DruidColumn)
    add_uuid_column("slices", Slice)
    add_uuid_column("sql_metrics", SqlMetric)
    add_uuid_column("tables", SqlaTable)
    add_uuid_column("table_columns", TableColumn)

    session.close()


def downgrade():
    for tbl in [
        "dashboards",
        "datasources",
        "dbs",
        "clusters",
        "metrics",
        "columns",
        "slices",
        "sql_metrics",
        "tables",
        "table_columns",
    ]:
        try:
            with op.batch_alter_table(tbl) as batch_op:
                batch_op.drop_column("uuid")
        except Exception:
            pass
