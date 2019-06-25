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
"""form nullable

Revision ID: c617da68de7d
Revises: 18dc26817ad2
Create Date: 2018-07-19 23:41:32.631556

"""

# revision identifiers, used by Alembic.
revision = "c617da68de7d"
down_revision = "18dc26817ad2"

from alembic import op
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Text

from superset import db
from superset.utils.core import MediumText

Base = declarative_base()


class BaseColumnMixin(object):
    id = Column(Integer, primary_key=True)
    column_name = Column(String(255))
    description = Column(Text)
    type = Column(String(32))
    verbose_name = Column(String(1024))


class BaseDatasourceMixin(object):
    id = Column(Integer, primary_key=True)
    description = Column(Text)


class BaseMetricMixin(object):
    id = Column(Integer, primary_key=True)
    d3format = Column(String(128))
    description = Column(Text)
    metric_name = Column(String(512))
    metric_type = Column(String(32))
    verbose_name = Column(String(1024))
    warning_text = Column(Text)


class Annotation(Base):
    __tablename__ = "annotation"

    id = Column(Integer, primary_key=True)
    long_descr = Column(Text)
    json_metadata = Column(Text)
    short_descr = Column(String(500))


class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(Integer, primary_key=True)
    css = Column(Text)
    dashboard_title = Column(String(500))
    description = Column(Text)
    json_metadata = Column(Text)
    position_json = Column(MediumText())
    slug = Column(String(255))


class Database(Base):
    __tablename__ = "dbs"

    id = Column(Integer, primary_key=True)
    database_name = Column(String(250))
    extra = Column(Text)
    force_ctas_schema = Column(String(250))
    sqlalchemy_uri = Column(String(1024))
    verbose_name = Column(String(250))


class DruidCluster(Base):
    __tablename__ = "clusters"

    id = Column(Integer, primary_key=True)
    broker_host = Column(String(255))
    broker_endpoint = Column(String(255))
    cluster_name = Column(String(250))
    verbose_name = Column(String(250))


class DruidColumn(BaseColumnMixin, Base):
    __tablename__ = "columns"

    dimension_spec_json = Column(Text)


class DruidDatasource(BaseDatasourceMixin, Base):
    __tablename__ = "datasources"

    datasource_name = Column(String(255))
    default_endpoint = Column(Text)
    fetch_values_from = Column(String(100))


class DruidMetric(BaseMetricMixin, Base):
    __tablename__ = "metrics"

    json = Column(Text)


class Slice(Base):
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True)
    description = Column(Text)
    params = Column(Text)
    slice_name = Column(String(250))
    viz_type = Column(String(250))


class SqlaTable(BaseDatasourceMixin, Base):
    __tablename__ = "tables"

    default_endpoint = Column(MediumText())
    fetch_values_predicate = Column(String(1000))
    main_dttm_col = Column(String(250))
    schema = Column(String(255))
    sql = Column(Text)
    table_name = Column(String(250))
    template_params = Column(Text)


class SqlMetric(BaseMetricMixin, Base):
    __tablename__ = "sql_metrics"

    expression = Column(Text)


class TableColumn(BaseColumnMixin, Base):
    __tablename__ = "table_columns"

    database_expression = Column(String(255))
    expression = Column(Text)
    python_date_format = Column(String(255))


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    tables = [
        Annotation,
        Dashboard,
        Database,
        DruidCluster,
        DruidColumn,
        DruidDatasource,
        DruidMetric,
        Slice,
        SqlaTable,
        SqlMetric,
        TableColumn,
    ]

    for table in tables:
        for record in session.query(table).all():
            for col in record.__table__.columns.values():
                if not col.primary_key:
                    if getattr(record, col.name) == "":
                        setattr(record, col.name, None)

        session.commit()

    session.close()


def downgrade():
    pass
