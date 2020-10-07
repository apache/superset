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
"""Utils to provide dashboards for tests"""

import json
from typing import Any, Dict

from pandas import DataFrame

from superset import ConnectorRegistry, db
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice


def create_table_for_dashboard(
    df: DataFrame, table_name: str, database: Database, dtype: Dict[str, Any]
) -> SqlaTable:
    df.to_sql(
        table_name,
        database.get_sqla_engine(),
        if_exists="replace",
        chunksize=500,
        dtype=dtype,
        index=False,
        method="multi",
    )

    table_source = ConnectorRegistry.sources["table"]
    table = (
        db.session.query(table_source).filter_by(table_name=table_name).one_or_none()
    )
    if not table:
        table = table_source(table_name=table_name)
    table.database = database
    db.session.merge(table)
    db.session.commit()

    return table


def create_slice(
    title: str, viz_type: str, table: SqlaTable, slices_dict: Dict[str, str]
) -> Slice:
    return Slice(
        slice_name=title,
        viz_type=viz_type,
        datasource_type="table",
        datasource_id=table.id,
        params=json.dumps(slices_dict, indent=4, sort_keys=True),
    )


def create_dashboard(slug: str, title: str, position: str, slice: Slice) -> Dashboard:
    dash = db.session.query(Dashboard).filter_by(slug=slug).one_or_none()

    if not dash:
        dash = Dashboard()
    dash.dashboard_title = title
    if position is not None:
        js = position
        pos = json.loads(js)
        dash.position_json = json.dumps(pos, indent=4)
    dash.slug = slug
    if slice is not None:
        dash.slices = [slice]
    db.session.merge(dash)
    db.session.commit()

    return dash
