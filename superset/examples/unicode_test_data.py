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
import datetime
import json
import random

import pandas as pd
from sqlalchemy import Date, Float, String

from superset import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import core as utils

from .helpers import (
    config,
    get_example_data,
    get_slice_json,
    merge_slice,
    TBL,
    update_slice_ids,
)


def load_unicode_test_data(
    only_metadata: bool = False, force: bool = False, sample: bool = False
) -> None:
    """Loading unicode test dataset from a csv file in the repo"""
    tbl_name = "unicode_test"
    database = utils.get_example_database()
    table_exists = database.has_table_by_name(tbl_name)

    if not only_metadata and (not table_exists or force):
        data = get_example_data(
            "unicode_utf8_unixnl_test.csv", is_gzip=False, make_bytes=True
        )
        df = pd.read_csv(data, encoding="utf-8")
        # generate date/numeric data
        df["dttm"] = datetime.datetime.now().date()
        df["value"] = [random.randint(1, 100) for _ in range(len(df))]
        df = df.head(100) if sample else df
        df.to_sql(  # pylint: disable=no-member
            tbl_name,
            database.get_sqla_engine(),
            if_exists="replace",
            chunksize=500,
            dtype={
                "phrase": String(500),
                "short_phrase": String(10),
                "with_missing": String(100),
                "dttm": Date(),
                "value": Float(),
            },
            index=False,
        )
        print("Done loading table!")
        print("-" * 80)

    print("Creating table [unicode_test] reference")
    obj = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not obj:
        obj = TBL(table_name=tbl_name)
    obj.main_dttm_col = "dttm"
    obj.database = database
    db.session.merge(obj)
    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    slice_data = {
        "granularity_sqla": "dttm",
        "groupby": [],
        "metric": {
            "aggregate": "SUM",
            "column": {"column_name": "value"},
            "expressionType": "SIMPLE",
            "label": "Value",
        },
        "row_limit": config["ROW_LIMIT"],
        "since": "100 years ago",
        "until": "now",
        "viz_type": "word_cloud",
        "size_from": "10",
        "series": "short_phrase",
        "size_to": "70",
        "rotation": "square",
        "limit": "100",
    }

    print("Creating a slice")
    slc = Slice(
        slice_name="Unicode Cloud",
        viz_type="word_cloud",
        datasource_type="table",
        datasource_id=tbl.id,
        params=get_slice_json(slice_data),
    )
    merge_slice(slc)

    print("Creating a dashboard")
    dash = db.session.query(Dashboard).filter_by(slug="unicode-test").first()

    if not dash:
        dash = Dashboard()
    js = """\
{
    "CHART-Hkx6154FEm": {
        "children": [],
        "id": "CHART-Hkx6154FEm",
        "meta": {
            "chartId": 2225,
            "height": 30,
            "sliceName": "slice 1",
            "width": 4
        },
        "type": "CHART"
    },
    "GRID_ID": {
        "children": [
            "ROW-SyT19EFEQ"
        ],
        "id": "GRID_ID",
        "type": "GRID"
    },
    "ROOT_ID": {
        "children": [
            "GRID_ID"
        ],
        "id": "ROOT_ID",
        "type": "ROOT"
    },
    "ROW-SyT19EFEQ": {
        "children": [
            "CHART-Hkx6154FEm"
        ],
        "id": "ROW-SyT19EFEQ",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW"
    },
    "DASHBOARD_VERSION_KEY": "v2"
}
    """
    dash.dashboard_title = "Unicode Test"
    pos = json.loads(js)
    update_slice_ids(pos, [slc])
    dash.position_json = json.dumps(pos, indent=4)
    dash.slug = "unicode-test"
    dash.slices = [slc]
    db.session.merge(dash)
    db.session.commit()
