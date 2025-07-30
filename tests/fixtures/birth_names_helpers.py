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

"""
Test helper functions for birth_names dataset.
Extracted from the original birth_names.py example file.
"""

import textwrap
from typing import Union

from sqlalchemy.sql import column

from superset import app, db
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.examples.helpers import (
    get_slice_json,
    merge_slice,
    misc_dash_slices,
    update_slice_ids,
)
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import DatasourceType


def gen_filter(
    subject: str, comparator: str, operator: str = "=="
) -> dict[str, Union[bool, str]]:
    return {
        "clause": "WHERE",
        "comparator": comparator,
        "expressionType": "SIMPLE",
        "operator": operator,
        "subject": subject,
    }


def _set_table_metadata(datasource: SqlaTable, database) -> None:
    datasource.main_dttm_col = "ds"
    datasource.database = database
    datasource.filter_select_enabled = True
    datasource.fetch_metadata()


def _add_table_metrics(datasource: SqlaTable) -> None:
    # By accessing the attribute first, we make sure `datasource.columns` and
    # `datasource.metrics` are already loaded. Otherwise accessing them later
    # may trigger an unnecessary and unexpected `after_update` event.
    columns, metrics = datasource.columns, datasource.metrics

    if not any(col.column_name == "num_california" for col in columns):
        col_state = str(column("state").compile(db.engine))
        col_num = str(column("num").compile(db.engine))
        columns.append(
            TableColumn(
                column_name="num_california",
                expression=f"CASE WHEN {col_state} = 'CA' THEN {col_num} ELSE 0 END",
            )
        )

    if not any(col.metric_name == "sum__num" for col in metrics):
        col = str(column("num").compile(db.engine))
        metrics.append(SqlMetric(metric_name="sum__num", expression=f"SUM({col})"))

    for col in columns:
        if col.column_name == "ds":  # type: ignore
            col.is_dttm = True  # type: ignore
            break

    datasource.columns = columns
    datasource.metrics = metrics


def create_slices(tbl: SqlaTable) -> tuple[list[Slice], list[Slice]]:
    metrics = [
        {
            "expressionType": "SIMPLE",
            "column": {"column_name": "num", "type": "BIGINT"},
            "aggregate": "SUM",
            "label": "Births",
            "optionName": "metric_11",
        }
    ]
    metric = "sum__num"

    defaults = {
        "compare_lag": "10",
        "compare_suffix": "o10Y",
        "limit": "25",
        "granularity_sqla": "ds",
        "groupby": [],
        "row_limit": app.config["ROW_LIMIT"],
        "time_range": "100 years ago : now",
        "viz_type": "table",
        "markup_type": "markdown",
    }

    slice_kwargs = {
        "datasource_id": tbl.id,
        "datasource_type": DatasourceType.TABLE,
    }

    slices = [
        Slice(
            **slice_kwargs,
            slice_name="Participants",
            viz_type="big_number",
            params=get_slice_json(
                defaults,
                viz_type="big_number",
                granularity_sqla="ds",
                compare_lag="5",
                compare_suffix="over 5Y",
                metric=metric,
            ),
            owners=[],
        ),
        Slice(
            **slice_kwargs,
            slice_name="Genders",
            viz_type="pie",
            params=get_slice_json(
                defaults, viz_type="pie", groupby=["gender"], metric=metric
            ),
            owners=[],
        ),
        Slice(
            **slice_kwargs,
            slice_name="Trends",
            viz_type="echarts_timeseries_line",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_line",
                groupby=["name"],
                granularity_sqla="ds",
                rich_tooltip=True,
                show_legend=True,
                metrics=metrics,
            ),
            owners=[],
        ),
        Slice(
            **slice_kwargs,
            slice_name="Pivot Table",
            viz_type="pivot_table_v2",
            params=get_slice_json(
                defaults,
                viz_type="pivot_table_v2",
                groupbyRows=["name"],
                groupbyColumns=["state"],
                metrics=metrics,
            ),
            owners=[],
        ),
    ]

    misc_slices: list[Slice] = []

    for slc in slices:
        merge_slice(slc)

    for slc in misc_slices:
        merge_slice(slc)
        misc_dash_slices.add(slc.slice_name)

    return slices, misc_slices


def create_dashboard(slices: list[Slice]) -> Dashboard:
    dash = db.session.query(Dashboard).filter_by(slug="births").first()
    if not dash:
        dash = Dashboard()
        db.session.add(dash)

    dash.published = True
    dash.json_metadata = textwrap.dedent(
        """\
    {
        "label_colors": {
            "Girls": "#FF69B4",
            "Boys": "#ADD8E6",
            "girl": "#FF69B4",
            "boy": "#ADD8E6"
        }
    }"""
    )

    pos = {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "GRID_ID": {
            "children": [],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
    }

    dash.slices = [slc for slc in slices if slc.viz_type != "markup"]
    update_slice_ids(pos)
    dash.dashboard_title = "USA Births Names"
    dash.position_json = json.dumps(pos, indent=4)
    dash.slug = "births"
    return dash
