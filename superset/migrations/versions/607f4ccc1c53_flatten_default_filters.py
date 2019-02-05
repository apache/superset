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
"""flatten_default_filters.py

Revision ID: 607f4ccc1c53
Revises: 8d49a37823bf
Create Date: 2019-01-31 13:56:28.647647

"""

# revision identifiers, used by Alembic.
revision = '607f4ccc1c53'
down_revision = '8d49a37823bf'

from alembic import op
from sqlalchemy import (Column, Integer, Text)
from sqlalchemy.ext.declarative import declarative_base
from superset import db
import json

Base = declarative_base()

class Dashboard(Base):
    """Declarative class to do query in upgrade"""
    __tablename__ = 'dashboards'
    id = Column(Integer, primary_key=True)
    json_metadata = Column(Text)

# take the default_filters metadata and flatten to remove filter IDs
# convert from {"23": {"col1": ["val1"]}, "39": {"col1": ["val2"], "__time_grain": "PT1H"}}
# convert to {"col1": ["val1", "val2"], "39": {"__time_grain": "PT1H"}}
def upgrade():
    bind = op.get_bind()
    session = db.Session(bind=bind)

    dashboards = session.query(Dashboard).all()
    for dashboard in dashboards:
        if dashboard.json_metadata:
            json_metadata = json.loads(dashboard.json_metadata)
            default_filters_json = json_metadata.get('default_filters', '{}')
            if default_filters_json and default_filters_json != '{}':
                try:
                    default_filters = json.loads(default_filters_json)
                    new_default_filters = flatten_filters(default_filters)
                    json_metadata['default_filters'] = json.dumps(new_default_filters)
                    dashboard.json_metadata = json.dumps(json_metadata)
                except Exception as err:
                    pass

    session.commit()
    session.close()

def flatten_filters(filters):
    filter_columns = {}
    time_filters =  ['__time_range', '__time_col', '__time_grain', '__time_origin', '__granularity']

    for filter_id, filter_value in filters.items():
        for column, values in filter_value.items():
            if column in time_filters:
                # time filters still require a chart ID as e.g., __time_grain can't be shared by multiple filterBoxes
                current_filters = filter_columns.get(filter_id, {})
                filter_columns[filter_id] = {**current_filters, **{column: values}}
            else:
                # append column selections to existing filters
                values_set = set(filter_columns.get(column, []))
                values_set |= set(values)
                filter_columns[column] = values_set

    for column, values in filter_columns.items():
        if isinstance(values, set):
            filter_columns[column] = list(values)

    return filter_columns


# Unable to downgrade as we lost all the filter IDs
def downgrade():
    pass
