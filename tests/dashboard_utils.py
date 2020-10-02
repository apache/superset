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
# isort:skip_file
"""Utils to provide dashboards for tests"""

import json

from pandas import DataFrame
from typing import Dict, Any

from superset import db, ConnectorRegistry
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice


def create_table_for_dashboard(
    df: DataFrame, tbl_name: str, database, schema: Dict[str, Any]
):
    df.to_sql(
        tbl_name,
        database.get_sqla_engine(),
        if_exists="replace",
        chunksize=500,
        dtype=schema,
        index=False,
        method="multi",
    )

    tbl_source = ConnectorRegistry.sources["table"]
    obj = db.session.query(tbl_source).filter_by(table_name=tbl_name).first()
    if not obj:
        obj = tbl_source(table_name=tbl_name)
    obj.database = database
    db.session.merge(obj)
    db.session.commit()

    return obj


def create_slice(tbl, slices_dict: Dict[str, str]):
    return Slice(
        slice_name="Unicode Cloud",
        viz_type="word_cloud",
        datasource_type="table",
        datasource_id=tbl.id,
        params=json.dumps(slices_dict, indent=4, sort_keys=True),
    )


def create_dashboard(slug: str, title: str, position: str, slc: Slice):
    dash = db.session.query(Dashboard).filter_by(slug=slug).first()

    if not dash:
        dash = Dashboard()
    dash.dashboard_title = title
    if position is not None:
        js = position
        pos = json.loads(js)
        dash.position_json = json.dumps(pos, indent=4)
    dash.slug = slug
    if slc is not None:
        dash.slices = [slc]
        db.session.merge(dash)
    db.session.commit()
