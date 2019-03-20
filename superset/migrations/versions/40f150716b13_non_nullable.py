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
"""non-nullable

Revision ID: 40f150716b13
Revises: c82ee8a39623
Create Date: 2019-03-20 11:46:24.211389

"""

# revision identifiers, used by Alembic.
revision = '40f150716b13'
down_revision = 'c82ee8a39623'

from alembic import op
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Text

from superset import db

Base = declarative_base()


class BaseColumnMixin(object):
    id = Column(Integer, primary_key=True)
    column_name = Column(String(255), nullable=False)


class BaseDatasourceMixin(object):
    id = Column(Integer, primary_key=True)


class BaseMetricMixin(object):
    id = Column(Integer, primary_key=True)
    metric_name = Column(String(512), nullable=False)


class DruidColumn(BaseColumnMixin, Base):
    __tablename__ = 'columns'

    dimension_spec_json = Column(Text)


class DruidDatasource(BaseDatasourceMixin, Base):
    __tablename__ = 'datasources'

    datasource_name = Column(String(255), nullable=False)


class DruidMetric(BaseMetricMixin, Base):
    __tablename__ = 'metrics'

    json = Column(Text, nullable=False)


class SqlaTable(BaseDatasourceMixin, Base):
    __tablename__ = 'tables'

    table_name = Column(String(250), nullable=False)


class SqlMetric(BaseMetricMixin, Base):
    __tablename__ = 'sql_metrics'

    expression = Column(Text, nullable=False)


class TableColumn(BaseColumnMixin, Base):
    __tablename__ = 'table_columns'

    expression = Column(Text)


tables = [
    {
        'can_delete': True,
        'class': DruidColumn,
        'optional': ['dimension_spec_json'],
        'required': ['column_name'],
    },
    {
        'can_delete': False,
        'class': DruidDatasource,
        'optional': [],
        'required': ['datasource_name'],
    },
    {
        'can_delete': True,
        'class': DruidMetric,
        'optional': [],
        'required': ['metric_name', 'json'],
    },
    {
        'can_delete': True,
        'class': SqlMetric,
        'optional': [],
        'required': ['metric_name', 'expression'],
    },
    {
        'can_delete': False,
        'class': SqlaTable,
        'optional': [],
        'required': ['table_name'],
    },
    {
        'can_delete': True,
        'class': TableColumn,
        'optional': ['expression'],
        'required': ['column_name'],
    },
]


def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    # Delete erroneous records (if allowed) otherwise mutate ill-defined records.
    for table in tables:
        idx = 1

        for record in session.query(table['class']).all():
            optional = [getattr(record, column) for column in table['optional']]
            required = [getattr(record, column) for column in table['required']]

            if not all(required):
                if table['can_delete'] and not (any(required) or any(optional)):
                    session.delete(record)
                else:
                    for column in table['required']:
                        if not getattr(record, column):
                            setattr(record, column, f'migration_40f150716b13_{str(idx)}')
                            idx += 1

        session.commit()

    # Make the fields non-nullable.
    for table in tables:
        with op.batch_alter_table(table['class'].__tablename__) as batch_op:
            for column in table['required']:
                batch_op.alter_column(
                    column,
                    existing_type=getattr(table['class'], column).type,
                    existing_nullable=True,
                    nullable=False,
                )


def downgrade():

    # Make the fields nullable.
    for table in tables:
        with op.batch_alter_table(table['class'].__tablename__) as batch_op:
            for column in table['required']:
                batch_op.alter_column(
                    column,
                    existing_type=getattr(table['class'], column).type,
                    existing_nullable=False,
                    nullable=True,
                )
