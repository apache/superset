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
import random
from typing import Dict, Set

import pandas as pd
import pytest
from sqlalchemy import column, Float, String

from superset import db
from superset.connectors.sqla.models import SqlaTable, SqlMetric
from superset.models.slice import Slice
from superset.utils.core import get_example_database, get_example_default_schema
from tests.integration_tests.dashboard_utils import create_slice, create_table_metadata
from tests.integration_tests.test_app import app

misc_dash_slices: Set[str] = set()


ENERGY_USAGE_TBL_NAME = "energy_usage"


@pytest.fixture(scope="session")
def load_energy_table_data():
    with app.app_context():
        database = get_example_database()
        df = _get_dataframe()
        df.to_sql(
            ENERGY_USAGE_TBL_NAME,
            database.get_sqla_engine(),
            if_exists="replace",
            chunksize=500,
            index=False,
            dtype={"source": String(255), "target": String(255), "value": Float()},
            method="multi",
            schema=get_example_default_schema(),
        )
    yield
    with app.app_context():
        engine = get_example_database().get_sqla_engine()
        engine.execute("DROP TABLE IF EXISTS energy_usage")


@pytest.fixture()
def load_energy_table_with_slice(load_energy_table_data):
    with app.app_context():
        _create_energy_table()
        yield
        _cleanup()


def _get_dataframe():
    data = _get_energy_data()
    return pd.DataFrame.from_dict(data)


def _create_energy_table():
    table = create_table_metadata(
        table_name=ENERGY_USAGE_TBL_NAME,
        database=get_example_database(),
        table_description="Energy consumption",
    )
    table.fetch_metadata()

    if not any(col.metric_name == "sum__value" for col in table.metrics):
        col = str(column("value").compile(db.engine))
        table.metrics.append(
            SqlMetric(metric_name="sum__value", expression=f"SUM({col})")
        )

    db.session.merge(table)
    db.session.commit()
    table.fetch_metadata()

    for slice_data in _get_energy_slices():
        _create_and_commit_energy_slice(
            table,
            slice_data["slice_title"],
            slice_data["viz_type"],
            slice_data["params"],
        )


def _create_and_commit_energy_slice(
    table: SqlaTable, title: str, viz_type: str, param: Dict[str, str]
):
    slice = create_slice(title, viz_type, table, param)
    existing_slice = (
        db.session.query(Slice).filter_by(slice_name=slice.slice_name).first()
    )
    if existing_slice:
        db.session.delete(existing_slice)
    db.session.add(slice)
    db.session.commit()
    return slice


def _cleanup() -> None:
    for slice_data in _get_energy_slices():
        slice = (
            db.session.query(Slice)
            .filter_by(slice_name=slice_data["slice_title"])
            .first()
        )
        db.session.delete(slice)

    metric = (
        db.session.query(SqlMetric).filter_by(metric_name="sum__value").one_or_none()
    )
    if metric:
        db.session.delete(metric)

    db.session.commit()


def _get_energy_data():
    data = []
    for i in range(85):
        data.append(
            {
                "source": f"energy_source{i}",
                "target": f"energy_target{i}",
                "value": random.uniform(0.1, 11.0),
            }
        )
    return data


def _get_energy_slices():
    return [
        {
            "slice_title": "Energy Sankey",
            "viz_type": "sankey",
            "params": {
                "collapsed_fieldsets": "",
                "groupby": ["source", "target"],
                "metric": "sum__value",
                "row_limit": "5000",
                "slice_name": "Energy Sankey",
                "viz_type": "sankey",
            },
        },
        {
            "slice_title": "Energy Force Layout",
            "viz_type": "graph_chart",
            "params": {
                "source": "source",
                "target": "target",
                "edgeLength": 400,
                "repulsion": 1000,
                "layout": "force",
                "metric": "sum__value",
                "row_limit": "5000",
                "slice_name": "Force",
                "viz_type": "graph_chart",
            },
        },
        {
            "slice_title": "Heatmap",
            "viz_type": "heatmap",
            "params": {
                "all_columns_x": "source",
                "all_columns_y": "target",
                "canvas_image_rendering": "pixelated",
                "collapsed_fieldsets": "",
                "linear_color_scheme": "blue_white_yellow",
                "metric": "sum__value",
                "normalize_across": "heatmap",
                "slice_name": "Heatmap",
                "viz_type": "heatmap",
                "xscale_interval": "1",
                "yscale_interval": "1",
            },
            "query_context": '{"datasource":{"id":12,"type":"table"},"force":false,"queries":[{"time_range":" : ","filters":[],"extras":{"time_grain_sqla":null,"having":"","having_druid":[],"where":""},"applied_time_extras":{},"columns":[],"metrics":[],"annotation_layers":[],"row_limit":5000,"timeseries_limit":0,"order_desc":true,"url_params":{},"custom_params":{},"custom_form_data":{}}],"result_format":"json","result_type":"full"}',
        },
    ]
