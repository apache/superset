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
import json
import textwrap

import pandas as pd
from sqlalchemy import DateTime, String
from sqlalchemy.sql import column

from superset import db, security_manager
from superset.connectors.sqla.models import SqlMetric, TableColumn
from superset.utils.core import get_example_database
from .helpers import (
    config,
    Dash,
    get_example_data,
    get_slice_json,
    merge_slice,
    Slice,
    TBL,
    update_slice_ids,
)


def load_birth_names(only_metadata=False, force=False):
    """Loading birth name dataset from a zip file in the repo"""
    # pylint: disable=too-many-locals
    tbl_name = "birth_names"
    database = get_example_database()
    table_exists = database.has_table_by_name(tbl_name)

    if not only_metadata and (not table_exists or force):
        pdf = pd.read_json(get_example_data("birth_names.json.gz"))
        pdf.ds = pd.to_datetime(pdf.ds, unit="ms")
        pdf.to_sql(
            tbl_name,
            database.get_sqla_engine(),
            if_exists="replace",
            chunksize=500,
            dtype={
                "ds": DateTime,
                "gender": String(16),
                "state": String(10),
                "name": String(255),
            },
            index=False,
        )
        print("Done loading table!")
        print("-" * 80)

    obj = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not obj:
        print(f"Creating table [{tbl_name}] reference")
        obj = TBL(table_name=tbl_name)
        db.session.add(obj)
    obj.main_dttm_col = "ds"
    obj.database = database
    obj.filter_select_enabled = True

    if not any(col.column_name == "num_california" for col in obj.columns):
        col_state = str(column("state").compile(db.engine))
        col_num = str(column("num").compile(db.engine))
        obj.columns.append(
            TableColumn(
                column_name="num_california",
                expression=f"CASE WHEN {col_state} = 'CA' THEN {col_num} ELSE 0 END",
            )
        )

    if not any(col.metric_name == "sum__num" for col in obj.metrics):
        col = str(column("num").compile(db.engine))
        obj.metrics.append(SqlMetric(metric_name="sum__num", expression=f"SUM({col})"))

    db.session.commit()
    obj.fetch_metadata()
    tbl = obj

    defaults = {
        "compare_lag": "10",
        "compare_suffix": "o10Y",
        "limit": "25",
        "granularity_sqla": "ds",
        "groupby": [],
        "metric": "sum__num",
        "metrics": [
            {
                "expressionType": "SIMPLE",
                "column": {"column_name": "num", "type": "BIGINT"},
                "aggregate": "SUM",
                "label": "Births",
                "optionName": "metric_11",
            }
        ],
        "row_limit": config.get("ROW_LIMIT"),
        "since": "100 years ago",
        "until": "now",
        "viz_type": "table",
        "where": "",
        "markup_type": "markdown",
    }

    admin = security_manager.find_user("admin")

    print("Creating some slices")
    slices = [
        Slice(
            slice_name="Girls",
            viz_type="table",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                groupby=["name"],
                filters=[{"col": "gender", "op": "in", "val": ["girl"]}],
                row_limit=50,
                timeseries_limit_metric="sum__num",
            ),
        ),
        Slice(
            slice_name="Boys",
            viz_type="table",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                groupby=["name"],
                filters=[{"col": "gender", "op": "in", "val": ["boy"]}],
                row_limit=50,
            ),
        ),
        Slice(
            slice_name="Participants",
            viz_type="big_number",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="big_number",
                granularity_sqla="ds",
                compare_lag="5",
                compare_suffix="over 5Y",
            ),
        ),
        Slice(
            slice_name="Genders",
            viz_type="pie",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(defaults, viz_type="pie", groupby=["gender"]),
        ),
        Slice(
            slice_name="Genders by State",
            viz_type="dist_bar",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                adhoc_filters=[
                    {
                        "clause": "WHERE",
                        "expressionType": "SIMPLE",
                        "filterOptionName": "2745eae5",
                        "comparator": ["other"],
                        "operator": "not in",
                        "subject": "state",
                    }
                ],
                viz_type="dist_bar",
                metrics=[
                    {
                        "expressionType": "SIMPLE",
                        "column": {"column_name": "sum_boys", "type": "BIGINT(20)"},
                        "aggregate": "SUM",
                        "label": "Boys",
                        "optionName": "metric_11",
                    },
                    {
                        "expressionType": "SIMPLE",
                        "column": {"column_name": "sum_girls", "type": "BIGINT(20)"},
                        "aggregate": "SUM",
                        "label": "Girls",
                        "optionName": "metric_12",
                    },
                ],
                groupby=["state"],
            ),
        ),
        Slice(
            slice_name="Trends",
            viz_type="line",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="line",
                groupby=["name"],
                granularity_sqla="ds",
                rich_tooltip=True,
                show_legend=True,
            ),
        ),
        Slice(
            slice_name="Average and Sum Trends",
            viz_type="dual_line",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="dual_line",
                metric={
                    "expressionType": "SIMPLE",
                    "column": {"column_name": "num", "type": "BIGINT(20)"},
                    "aggregate": "AVG",
                    "label": "AVG(num)",
                    "optionName": "metric_vgops097wej_g8uff99zhk7",
                },
                metric_2="sum__num",
                granularity_sqla="ds",
            ),
        ),
        Slice(
            slice_name="Title",
            viz_type="markup",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="markup",
                markup_type="html",
                code="""\
    <div style='text-align:center'>
        <h1>Birth Names Dashboard</h1>
        <p>
            The source dataset came from
            <a href='https://github.com/hadley/babynames' target='_blank'>[here]</a>
        </p>
        <img src="/static/assets/images/babies.png">
    </div>
    """,
            ),
        ),
        Slice(
            slice_name="Name Cloud",
            viz_type="word_cloud",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="word_cloud",
                size_from="10",
                series="name",
                size_to="70",
                rotation="square",
                limit="100",
            ),
        ),
        Slice(
            slice_name="Pivot Table",
            viz_type="pivot_table",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults, viz_type="pivot_table", groupby=["name"], columns=["state"]
            ),
        ),
        Slice(
            slice_name="Number of Girls",
            viz_type="big_number_total",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="big_number_total",
                granularity_sqla="ds",
                filters=[{"col": "gender", "op": "in", "val": ["girl"]}],
                subheader="total female participants",
            ),
        ),
        Slice(
            slice_name="Number of California Births",
            viz_type="big_number_total",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                metric={
                    "expressionType": "SIMPLE",
                    "column": {
                        "column_name": "num_california",
                        "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                    },
                    "aggregate": "SUM",
                    "label": "SUM(num_california)",
                },
                viz_type="big_number_total",
                granularity_sqla="ds",
            ),
        ),
        Slice(
            slice_name="Top 10 California Names Timeseries",
            viz_type="line",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                metrics=[
                    {
                        "expressionType": "SIMPLE",
                        "column": {
                            "column_name": "num_california",
                            "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                        },
                        "aggregate": "SUM",
                        "label": "SUM(num_california)",
                    }
                ],
                viz_type="line",
                granularity_sqla="ds",
                groupby=["name"],
                timeseries_limit_metric={
                    "expressionType": "SIMPLE",
                    "column": {
                        "column_name": "num_california",
                        "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                    },
                    "aggregate": "SUM",
                    "label": "SUM(num_california)",
                },
                limit="10",
            ),
        ),
        Slice(
            slice_name="Names Sorted by Num in California",
            viz_type="table",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                groupby=["name"],
                row_limit=50,
                timeseries_limit_metric={
                    "expressionType": "SIMPLE",
                    "column": {
                        "column_name": "num_california",
                        "expression": "CASE WHEN state = 'CA' THEN num ELSE 0 END",
                    },
                    "aggregate": "SUM",
                    "label": "SUM(num_california)",
                },
            ),
        ),
        Slice(
            slice_name="Num Births Trend",
            viz_type="line",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(defaults, viz_type="line"),
        ),
        Slice(
            slice_name="Daily Totals",
            viz_type="table",
            datasource_type="table",
            datasource_id=tbl.id,
            created_by=admin,
            params=get_slice_json(
                defaults,
                groupby=["ds"],
                since="40 years ago",
                until="now",
                viz_type="table",
            ),
        ),
    ]
    for slc in slices:
        merge_slice(slc)

    print("Creating a dashboard")
    dash = db.session.query(Dash).filter_by(slug="births").first()

    if not dash:
        dash = Dash()
        db.session.add(dash)
    dash.published = True
    js = textwrap.dedent(
        # pylint: disable=line-too-long
        """\
{
    "CHART-0dd270f0": {
        "meta": {
            "chartId": 51,
            "width": 2,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-0dd270f0",
        "children": []
    },
    "CHART-a3c21bcc": {
        "meta": {
            "chartId": 52,
            "width": 2,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-a3c21bcc",
        "children": []
    },
    "CHART-976960a5": {
        "meta": {
            "chartId": 53,
            "width": 2,
            "height": 25
        },
        "type": "CHART",
        "id": "CHART-976960a5",
        "children": []
    },
    "CHART-58575537": {
        "meta": {
            "chartId": 54,
            "width": 2,
            "height": 25
        },
        "type": "CHART",
        "id": "CHART-58575537",
        "children": []
    },
    "CHART-e9cd8f0b": {
        "meta": {
            "chartId": 55,
            "width": 8,
            "height": 38
        },
        "type": "CHART",
        "id": "CHART-e9cd8f0b",
        "children": []
    },
    "CHART-e440d205": {
        "meta": {
            "chartId": 56,
            "width": 8,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-e440d205",
        "children": []
    },
    "CHART-59444e0b": {
        "meta": {
            "chartId": 57,
            "width": 3,
            "height": 38
        },
        "type": "CHART",
        "id": "CHART-59444e0b",
        "children": []
    },
    "CHART-e2cb4997": {
        "meta": {
            "chartId": 59,
            "width": 4,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-e2cb4997",
        "children": []
    },
    "CHART-e8774b49": {
        "meta": {
            "chartId": 60,
            "width": 12,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-e8774b49",
        "children": []
    },
    "CHART-985bfd1e": {
        "meta": {
            "chartId": 61,
            "width": 4,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-985bfd1e",
        "children": []
    },
    "CHART-17f13246": {
        "meta": {
            "chartId": 62,
            "width": 4,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-17f13246",
        "children": []
    },
    "CHART-729324f6": {
        "meta": {
            "chartId": 63,
            "width": 4,
            "height": 50
        },
        "type": "CHART",
        "id": "CHART-729324f6",
        "children": []
    },
    "COLUMN-25a865d6": {
        "meta": {
            "width": 4,
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "COLUMN",
        "id": "COLUMN-25a865d6",
        "children": [
            "ROW-cc97c6ac",
            "CHART-e2cb4997"
        ]
    },
    "COLUMN-4557b6ba": {
        "meta": {
            "width": 8,
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "COLUMN",
        "id": "COLUMN-4557b6ba",
        "children": [
            "ROW-d2e78e59",
            "CHART-e9cd8f0b"
        ]
    },
    "GRID_ID": {
        "type": "GRID",
        "id": "GRID_ID",
        "children": [
            "ROW-8515ace3",
            "ROW-1890385f",
            "ROW-f0b64094",
            "ROW-be9526b8"
        ]
    },
    "HEADER_ID": {
        "meta": {
            "text": "Births"
        },
        "type": "HEADER",
        "id": "HEADER_ID"
    },
    "MARKDOWN-00178c27": {
        "meta": {
            "width": 5,
            "code": "<div style=\\"text-align:center\\">\\n <h1>Birth Names Dashboard</h1>\\n <p>\\n The source dataset came from\\n <a href=\\"https://github.com/hadley/babynames\\" target=\\"_blank\\">[here]</a>\\n </p>\\n <img src=\\"/static/assets/images/babies.png\\" style=\\"width:55%;\\">\\n</div>\\n",
            "height": 38
        },
        "type": "MARKDOWN",
        "id": "MARKDOWN-00178c27",
        "children": []
    },
    "ROOT_ID": {
        "type": "ROOT",
        "id": "ROOT_ID",
        "children": [
            "GRID_ID"
        ]
    },
    "ROW-1890385f": {
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW",
        "id": "ROW-1890385f",
        "children": [
            "CHART-e440d205",
            "CHART-0dd270f0",
            "CHART-a3c21bcc"
        ]
    },
    "ROW-8515ace3": {
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW",
        "id": "ROW-8515ace3",
        "children": [
            "COLUMN-25a865d6",
            "COLUMN-4557b6ba"
        ]
    },
    "ROW-be9526b8": {
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW",
        "id": "ROW-be9526b8",
        "children": [
            "CHART-985bfd1e",
            "CHART-17f13246",
            "CHART-729324f6"
        ]
    },
    "ROW-cc97c6ac": {
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW",
        "id": "ROW-cc97c6ac",
        "children": [
            "CHART-976960a5",
            "CHART-58575537"
        ]
    },
    "ROW-d2e78e59": {
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW",
        "id": "ROW-d2e78e59",
        "children": [
            "MARKDOWN-00178c27",
            "CHART-59444e0b"
        ]
    },
    "ROW-f0b64094": {
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW",
        "id": "ROW-f0b64094",
        "children": [
            "CHART-e8774b49"
        ]
    },
    "DASHBOARD_VERSION_KEY": "v2"
}
        """
        # pylint: enable=line-too-long
    )
    pos = json.loads(js)
    # dashboard v2 doesn't allow add markup slice
    dash.slices = [slc for slc in slices if slc.viz_type != "markup"]
    update_slice_ids(pos, dash.slices)
    dash.dashboard_title = "Births"
    dash.position_json = json.dumps(pos, indent=4)
    dash.slug = "births"
    db.session.commit()
