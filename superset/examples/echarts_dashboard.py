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
from typing import List

from sqlalchemy import inspect

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils.core import DatasourceType

from ..utils.database import get_example_database
from .helpers import (
    get_slice_json,
    get_table_connector_registry,
    merge_slice,
    update_slice_ids,
)

DASH_SLUG = "echarts_dash"


def create_slices(tbl: SqlaTable) -> List[Slice]:
    admin = security_manager.find_user("admin")
    slice_props = dict(
        datasource_id=tbl.id,
        datasource_type=DatasourceType.TABLE,
        owners=[admin],
        created_by=admin,
    )

    defaults = {
        "limit": "25",
        "time_range": "100 years ago : now",
        "granularity_sqla": "ds",
        "row_limit": "50000",
        "viz_type": "echarts_timeseries_bar",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "expressionType": "SIMPLE",
                "filterOptionName": "filter_i7pmq9ob0vg_lvnj4s14yt",
                "comparator": "10000",
                "operator": ">",
                "subject": "num_boys",
            }
        ],
    }

    slices = [
        # ---------------------
        # TIER 1
        # ---------------------
        Slice(
            **slice_props,
            slice_name="Big Number",
            viz_type="big_number_total",
            params=get_slice_json(
                defaults,
                viz_type="big_number_total",
                metric="sum__num",
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Big Number with Trendline",
            viz_type="big_number",
            params=get_slice_json(
                defaults,
                viz_type="big_number",
                metric="sum__num",
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Table",
            viz_type="table",
            params=get_slice_json(
                defaults,
                viz_type="table",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Table",
            viz_type="pivot_table_v2",
            params=get_slice_json(
                defaults,
                viz_type="pivot_table_v2",
                metrics=["sum__num"],
                groupbyColumns=["gender"],
                groupbyRows=["state"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Time-Series Line Chart",
            viz_type="echarts_timeseries_line",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_line",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Time-Series Area Chart",
            viz_type="echarts_area",
            params=get_slice_json(
                defaults,
                viz_type="echarts_area",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Time-Series Bar Chart V2",
            viz_type="echarts_timeseries_bar",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_bar",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Time-Series Scatter Chart",
            viz_type="echarts_timeseries_scatter",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_scatter",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Pie Chart",
            viz_type="pie",
            params=get_slice_json(
                defaults,
                viz_type="pie",
                metric="sum__num",
                groupby=["gender"],
                adhoc_filters=[],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Bar Chart",
            viz_type="dist_bar",
            params=get_slice_json(
                defaults,
                viz_type="dist_bar",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        # TODO: use a different dataset for world map
        Slice(
            **slice_props,
            slice_name="World Map",
            viz_type="world_map",
            params=get_slice_json(
                defaults,
                viz_type="world_map",
                metric="sum__num",
                entity="gender",
            ),
        ),
        # ---------------------
        # TIER 2
        # ---------------------
        Slice(
            **slice_props,
            slice_name="Box Plot Chart",
            viz_type="box_plot",
            params=get_slice_json(
                defaults,
                viz_type="box_plot",
                metrics=["sum__num"],
                groupby=["gender"],
                columns=["name"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Bubble Chart",
            viz_type="bubble",
            params=get_slice_json(
                defaults,
                viz_type="bubble",
                size="count",
                series="state",
                entity="gender",
                x={
                    "expressionType": "SIMPLE",
                    "column": {
                        "column_name": "num_boys",
                    },
                    "aggregate": "SUM",
                    "label": "SUM(num_boys)",
                    "optionName": "metric_353e7rjj84m_cirsi2o2s1",
                },
                y={
                    "expressionType": "SIMPLE",
                    "column": {
                        "column_name": "num_girls",
                    },
                    "aggregate": "SUM",
                    "label": "SUM(num_girls)",
                    "optionName": "metric_n8rvsr2ysmr_cb3eybtoe5f",
                },
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Calendar heatmap",
            viz_type="cal_heatmap",
            params=get_slice_json(
                defaults,
                viz_type="cal_heatmap",
                metrics=["sum__num"],
                time_range="2008-01-01 : 2008-02-01",
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Chord Chart",
            viz_type="chord",
            params=get_slice_json(
                defaults,
                viz_type="chord",
                metric="sum__num",
                groupby="gender",
                column="state",
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Time-Series Percent Change Chart",
            viz_type="compare",
            params=get_slice_json(
                defaults,
                viz_type="compare",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Time-Series Generic Chart",
            viz_type="echarts_timeseries",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Time-Series Smooth Line Chart",
            viz_type="echarts_timeseries_smooth",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_smooth",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Time-Series Step Line Chart",
            viz_type="echarts_timeseries_step",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_step",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Funnel Chart",
            viz_type="funnel",
            params=get_slice_json(
                defaults,
                viz_type="funnel",
                metric="sum__num",
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Gauge Chart",
            viz_type="gauge_chart",
            params=get_slice_json(
                defaults,
                viz_type="gauge_chart",
                metric="sum__num",
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Heatmap Chart",
            viz_type="heatmap",
            params=get_slice_json(
                defaults,
                viz_type="funnel",
                metric="sum__num",
                all_columns_x="gender",
                all_columns_y="state",
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Line Chart",
            viz_type="line",
            params=get_slice_json(
                defaults,
                viz_type="line",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Mixed Chart",
            viz_type="mixed_timeseries",
            params=get_slice_json(
                defaults,
                viz_type="mixed_timeseries",
                metrics=["sum__num"],
                groupby=["gender"],
                metrics_b=["count"],
                groupby_b=["state"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Partition Chart",
            viz_type="partition",
            params=get_slice_json(
                defaults,
                viz_type="partition",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Radar Chart",
            viz_type="radar",
            params=get_slice_json(
                defaults,
                viz_type="radar",
                metrics=[
                    "sum__num",
                    "count",
                    {
                        "expressionType": "SIMPLE",
                        "column": {
                            "column_name": "num_boys",
                        },
                        "aggregate": "SUM",
                        "label": "SUM(num_boys)",
                        "optionName": "metric_353e7rjj84m_cirsi2o2s1",
                    },
                ],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Nightingale Chart",
            viz_type="rose",
            params=get_slice_json(
                defaults,
                viz_type="rose",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Sankey Chart",
            viz_type="sankey",
            params=get_slice_json(
                defaults,
                viz_type="sankey",
                metric="sum__num",
                groupby=["gender", "state"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Sunburst Chart",
            viz_type="sunburst",
            params=get_slice_json(
                defaults,
                viz_type="sunburst",
                metric="sum__num",
                groupby=["gender", "state"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Treemap Chart",
            viz_type="treemap",
            params=get_slice_json(
                defaults,
                viz_type="treemap",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Treemap V2 Chart",
            viz_type="treemap_v2",
            params=get_slice_json(
                defaults,
                viz_type="treemap_v2",
                metric="sum__num",
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_props,
            slice_name="Word Cloud Chart",
            viz_type="word_cloud",
            params=get_slice_json(
                defaults,
                viz_type="word_cloud",
                metric="sum__num",
                series="state",
            ),
        ),
    ]

    for slc in slices:
        merge_slice(slc)

    return slices


def load_echarts_dashboard() -> None:
    """Loading a dashboard featuring EChart charts"""

    database = get_example_database()
    engine = database.get_sqla_engine()
    schema = inspect(engine).default_schema_name

    tbl_name = "birth_names"
    table_exists = database.has_table_by_name(tbl_name, schema=schema)

    if table_exists:
        table = get_table_connector_registry()
        obj = (
            db.session.query(table)
            .filter_by(table_name=tbl_name, schema=schema)
            .first()
        )
        create_slices(obj)

    print("Creating the dashboard")

    db.session.expunge_all()
    dash = db.session.query(Dashboard).filter_by(slug=DASH_SLUG).first()

    if not dash:
        dash = Dashboard()

    js = textwrap.dedent(
        """\
{
    "CHART-dxV7Il74hH": {
      "children": [],
      "id": "CHART-dxV7Il74hH",
      "meta": {
        "chartId": 597,
        "height": 50,
        "sliceName": "Box plot",
        "width": 6
      },
      "type": "CHART"
    },
    "CHART-YyHWQacdcj": {
      "children": [],
      "id": "CHART-YyHWQacdcj",
      "meta": {
          "chartId": 15,
          "height": 50,
          "sliceName": "Participants",
          "width": 6
      },
      "type": "CHART"
    },
    "CHART-oWKBOJ6Ydh": {
      "children": [],
      "id": "CHART-oWKBOJ6Ydh",
      "meta":{
          "chartId": 16,
          "height": 50,
          "sliceName": "Genders",
          "width": 6
        },
      "type": "CHART"
    },
    "CHART-06Kg-rUggO": {
      "children": [],
      "id": "CHART-06Kg-rUggO",
      "meta": {
        "chartId": 617,
        "height": 50,
        "sliceName": "Number of Girls",
        "width": 6
      },
      "type": "CHART"
    },
    "CHART--wEhS-MDSg": {
      "children": [],
      "id": "CHART--wEhS-MDS",
      "meta": {
        "chartId": 2,
        "height": 50,
        "sliceName": "Energy Force Layout",
        "width": 6
      },
      "type": "CHART"
    },
    "CHART--LXvS-RDSu": {
      "children": [],
      "id": "CHART--LXvS-RDSu",
      "meta": {
        "chartId": 398,
        "height": 50,
        "sliceName": "Time-Series Bar Chart V2",
        "width": 6
      },
      "type": "CHART"
    },
    "GRID_ID": {
        "children": [
            "ROW-SytNzNA4X",
            "ROW-HkFFEzVRVm",
            "ROW-BytNzNA4Y"
        ],
        "id": "GRID_ID",
        "type": "GRID"
    },
    "HEADER_ID": {
        "id": "HEADER_ID",
        "meta": {
            "text": "ECharts Dashboard"
        },
        "type": "HEADER"
    },
    "ROOT_ID": {
        "children": [
            "GRID_ID"
        ],
        "id": "ROOT_ID",
        "type": "ROOT"
    },
    "ROW-HkFFEzVRVm": {
        "children": [
            "CHART-dxV7Il74hH",
            "CHART-oWKBOJ6Ydh"
        ],
        "id": "ROW-HkFFEzVRVm",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW"
    },
    "ROW-SytNzNA4X": {
        "children": [
            "CHART-06Kg-rUggO",
            "CHART-YyHWQacdcj"
        ],
        "id": "ROW-SytNzNA4X",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW"
    },
    "ROW-BytNzNA4Y": {
        "children": [
            "CHART--wEhS-MDSg",
            "CHART--LXvS-RDSu"
        ],
        "id": "ROW-BytNzNA4Y",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW"
    },
    "DASHBOARD_VERSION_KEY": "v2"
}
    """
    )

    pos = json.loads(js)
    dash.slices = update_slice_ids(pos)
    dash.dashboard_title = "ECharts Dashboard"
    dash.position_json = json.dumps(pos, indent=4)
    dash.slug = DASH_SLUG
    db.session.commit()
