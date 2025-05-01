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
# pylint: disable=too-many-lines
import logging
import textwrap

from sqlalchemy import inspect

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.sql_parse import Table
from superset.utils import json
from superset.utils.core import DatasourceType

from ..utils.database import get_example_database
from .helpers import (
    get_slice_json,
    get_table_connector_registry,
    merge_slice,
    update_slice_ids,
)

DASH_SLUG = "supported_charts_dash"
logger = logging.getLogger(__name__)


def create_slices(tbl: SqlaTable) -> list[Slice]:
    slice_kwargs = {
        "datasource_id": tbl.id,
        "datasource_type": DatasourceType.TABLE,
        "owners": [],
    }

    defaults = {
        "limit": "25",
        "time_range": "100 years ago : now",
        "granularity_sqla": "ds",
        "row_limit": "50000",
        "viz_type": "echarts_timeseries_bar",
    }

    slices = [
        # ---------------------
        # TIER 1
        # ---------------------
        Slice(
            **slice_kwargs,
            slice_name="Big Number",
            viz_type="big_number_total",
            params=get_slice_json(
                defaults,
                viz_type="big_number_total",
                metric="sum__num",
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Big Number with Trendline",
            viz_type="big_number",
            params=get_slice_json(
                defaults,
                viz_type="big_number",
                metric="sum__num",
            ),
        ),
        Slice(
            **slice_kwargs,
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
            **slice_kwargs,
            slice_name="Pivot Table",
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
            **slice_kwargs,
            slice_name="Line Chart",
            viz_type="echarts_timeseries_line",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_line",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Area Chart",
            viz_type="echarts_area",
            params=get_slice_json(
                defaults,
                viz_type="echarts_area",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Bar Chart",
            viz_type="echarts_timeseries_bar",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_bar",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Scatter Chart",
            viz_type="echarts_timeseries_scatter",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_scatter",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_kwargs,
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
        # ---------------------
        # TIER 2
        # ---------------------
        Slice(
            **slice_kwargs,
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
            **slice_kwargs,
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
            **slice_kwargs,
            slice_name="Calendar Heatmap",
            viz_type="cal_heatmap",
            params=get_slice_json(
                defaults,
                viz_type="cal_heatmap",
                metrics=["sum__num"],
                time_range="2008-01-01 : 2008-02-01",
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Chord Chart",
            viz_type="chord",
            params=get_slice_json(
                defaults,
                viz_type="chord",
                metric="sum__num",
                groupby="gender",
                columns="state",
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Percent Change Chart",
            viz_type="compare",
            params=get_slice_json(
                defaults,
                viz_type="compare",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Generic Chart",
            viz_type="echarts_timeseries",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Smooth Line Chart",
            viz_type="echarts_timeseries_smooth",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_smooth",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Step Line Chart",
            viz_type="echarts_timeseries_step",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_step",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_kwargs,
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
            **slice_kwargs,
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
            **slice_kwargs,
            slice_name="Heatmap Chart",
            viz_type="heatmap_v2",
            params=get_slice_json(
                defaults,
                viz_type="heatmap_v2",
                metric="sum__num",
                x_axis="gender",
                groupby="state",
                sort_x_axis="value_asc",
                sort_y_axis="value_asc",
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Line Chart",
            viz_type="echarts_timeseries_line",
            params=get_slice_json(
                defaults,
                viz_type="echarts_timeseries_line",
                metrics=["sum__num"],
                groupby=["gender"],
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Mixed Chart",
            viz_type="mixed_timeseries",
            params=get_slice_json(
                defaults,
                viz_type="mixed_timeseries",
                metrics=["sum__num"],
                groupby=["gender"],
                metrics_b=["sum__num"],
                groupby_b=["state"],
            ),
        ),
        Slice(
            **slice_kwargs,
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
            **slice_kwargs,
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
            **slice_kwargs,
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
            **slice_kwargs,
            slice_name="Sankey Chart",
            viz_type="sankey_v2",
            params=get_slice_json(
                defaults,
                viz_type="sankey_v2",
                metric="sum__num",
                source="gender",
                target="state",
            ),
        ),
        Slice(
            **slice_kwargs,
            slice_name="Sunburst Chart",
            viz_type="sunburst_v2",
            params=get_slice_json(
                defaults,
                viz_type="sunburst_v2",
                metric="sum__num",
                columns=["gender", "state"],
            ),
        ),
        Slice(
            **slice_kwargs,
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
            **slice_kwargs,
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


def load_supported_charts_dashboard() -> None:
    """Loading a dashboard featuring supported charts"""

    database = get_example_database()
    with database.get_sqla_engine() as engine:
        schema = inspect(engine).default_schema_name

        tbl_name = "birth_names"
        table_exists = database.has_table(Table(tbl_name, schema))

    if table_exists:
        table = get_table_connector_registry()
        obj = (
            db.session.query(table)
            .filter_by(table_name=tbl_name, schema=schema)
            .first()
        )
        create_slices(obj)

    logger.debug("Creating the dashboard")

    db.session.expunge_all()
    dash = db.session.query(Dashboard).filter_by(slug=DASH_SLUG).first()

    if not dash:
        dash = Dashboard()

    js = textwrap.dedent(
        """
{
  "CHART-1": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1",
      "ROW-1"
    ],
    "id": "CHART-1",
    "meta": {
      "chartId": 1,
      "height": 50,
      "sliceName": "Big Number",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-2": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1",
      "ROW-1"
    ],
    "id": "CHART-2",
    "meta": {
      "chartId": 2,
      "height": 50,
      "sliceName": "Big Number with Trendline",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-3": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1",
      "ROW-1"
    ],
    "id": "CHART-3",
    "meta":{
      "chartId": 3,
      "height": 50,
      "sliceName": "Table",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-4": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1",
      "ROW-2"
    ],
    "id": "CHART-4",
    "meta": {
      "chartId": 4,
      "height": 50,
      "sliceName": "Pivot Table",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-5": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1",
      "ROW-2"
    ],
    "id": "CHART-5",
    "meta": {
      "chartId": 5,
      "height": 50,
      "sliceName": "Line Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-6": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1",
      "ROW-2"
    ],
    "id": "CHART-6",
    "meta": {
      "chartId": 6,
      "height": 50,
      "sliceName": "Bar Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-7": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1",
      "ROW-3"
    ],
    "id": "CHART-7",
    "meta": {
      "chartId": 7,
      "height": 50,
      "sliceName": "Area Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-8": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1",
      "ROW-3"
    ],
    "id": "CHART-8",
    "meta": {
      "chartId": 8,
      "height": 50,
      "sliceName": "Scatter Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-9": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1",
      "ROW-3"
    ],
    "id": "CHART-9",
    "meta": {
      "chartId": 9,
      "height": 50,
      "sliceName": "Pie Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-11": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1",
      "ROW-4"
    ],
    "id": "CHART-11",
    "meta": {
      "chartId": 11,
      "height": 50,
      "sliceName": "% Rural",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-12": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-5"
    ],
    "id": "CHART-12",
    "meta": {
      "chartId": 12,
      "height": 50,
      "sliceName": "Box Plot Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-13": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-5"
    ],
    "id": "CHART-13",
    "meta": {
      "chartId": 13,
      "height": 50,
      "sliceName": "Bubble Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-14": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-5"
    ],
    "id": "CHART-14",
    "meta": {
      "chartId": 14,
      "height": 50,
      "sliceName": "Calendar Heatmap",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-15": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-6"
    ],
    "id": "CHART-15",
    "meta": {
      "chartId": 15,
      "height": 50,
      "sliceName": "Chord Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-16": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-6"
    ],
    "id": "CHART-16",
    "meta": {
      "chartId": 16,
      "height": 50,
      "sliceName": "Percent Change Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-17": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-6"
    ],
    "id": "CHART-17",
    "meta": {
      "chartId": 17,
      "height": 50,
      "sliceName": "Generic Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-18": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-7"
    ],
    "id": "CHART-18",
    "meta": {
      "chartId": 18,
      "height": 50,
      "sliceName": "Smooth Line Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-19": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-7"
    ],
    "id": "CHART-19",
    "meta": {
      "chartId": 19,
      "height": 50,
      "sliceName": "Step Line Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-20": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-7"
    ],
    "id": "CHART-20",
    "meta": {
      "chartId": 20,
      "height": 50,
      "sliceName": "Funnel Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-21": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-8"
    ],
    "id": "CHART-21",
    "meta": {
      "chartId": 21,
      "height": 50,
      "sliceName": "Gauge Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-22": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-8"
    ],
    "id": "CHART-22",
    "meta": {
      "chartId": 22,
      "height": 50,
      "sliceName": "Heatmap Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-23": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-8"
    ],
    "id": "CHART-23",
    "meta": {
      "chartId": 23,
      "height": 50,
      "sliceName": "Line Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-24": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-9"
    ],
    "id": "CHART-24",
    "meta": {
      "chartId": 24,
      "height": 50,
      "sliceName": "Mixed Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-25": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-9"
    ],
    "id": "CHART-25",
    "meta": {
      "chartId": 25,
      "height": 50,
      "sliceName": "Partition Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-26": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-9"
    ],
    "id": "CHART-26",
    "meta": {
      "chartId": 26,
      "height": 50,
      "sliceName": "Radar Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-27": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-10"
    ],
    "id": "CHART-27",
    "meta": {
      "chartId": 27,
      "height": 50,
      "sliceName": "Nightingale Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-28": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-10"
    ],
    "id": "CHART-28",
    "meta": {
      "chartId": 28,
      "height": 50,
      "sliceName": "Sankey Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-29": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-10"
    ],
    "id": "CHART-29",
    "meta": {
      "chartId": 29,
      "height": 50,
      "sliceName": "Sunburst Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-30": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-11"
    ],
    "id": "CHART-30",
    "meta": {
      "chartId": 30,
      "height": 50,
      "sliceName": "Treemap Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-31": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-11"
    ],
    "id": "CHART-31",
    "meta": {
      "chartId": 31,
      "height": 50,
      "sliceName": "Treemap V2 Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "CHART-32": {
    "children": [],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2",
      "ROW-11"
    ],
    "id": "CHART-32",
    "meta": {
      "chartId": 32,
      "height": 50,
      "sliceName": "Word Cloud Chart",
      "width": 4
    },
    "type": "CHART"
  },
  "GRID_ID": {
    "children": [],
    "id": "GRID_ID",
    "type": "GRID"
  },
  "HEADER_ID": {
    "id": "HEADER_ID",
    "meta": {
      "text": "Supported Charts"
    },
    "type": "HEADER"
  },
  "TABS-TOP": {
    "children": [
      "TAB-TOP-1",
      "TAB-TOP-2"
    ],
    "id": "TABS-TOP",
    "type": "TABS"
  },
  "TAB-TOP-1": {
    "id": "TAB_TOP-1",
    "type": "TAB",
    "meta": {
      "text": "Tier 1",
      "defaultText": "Tab title",
      "placeholder": "Tab title"
    },
    "parents": [
      "ROOT_ID",
      "TABS-TOP"
    ],
    "children": [
      "ROW-1",
      "ROW-2",
      "ROW-3",
      "ROW-4"
    ]
  },
  "TAB-TOP-2": {
    "id": "TAB_TOP-2",
    "type": "TAB",
    "meta": {
      "text": "Tier 2",
      "defaultText": "Tab title",
      "placeholder": "Tab title"
    },
    "parents": [
      "ROOT_ID",
      "TABS-TOP"
    ],
    "children": [
      "ROW-5",
      "ROW-6",
      "ROW-7",
      "ROW-8",
      "ROW-9",
      "ROW-10",
      "ROW-11"
    ]
  },
  "ROOT_ID": {
    "children": [
      "TABS-TOP"
    ],
    "id": "ROOT_ID",
    "type": "ROOT"
  },
  "ROW-1": {
    "children": [
      "CHART-1",
      "CHART-2",
      "CHART-3"
    ],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1"
    ],
    "id": "ROW-1",
    "meta": {
      "background": "BACKGROUND_TRANSPARENT"
    },
    "type": "ROW"
  },
  "ROW-2": {
    "children": [
      "CHART-4",
      "CHART-5",
      "CHART-6"
    ],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1"
    ],
    "id": "ROW-2",
    "meta": {
      "background": "BACKGROUND_TRANSPARENT"
    },
    "type": "ROW"
  },
  "ROW-3": {
    "children": [
      "CHART-7",
      "CHART-8",
      "CHART-9"
    ],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1"
    ],
    "id": "ROW-3",
    "meta": {
      "background": "BACKGROUND_TRANSPARENT"
    },
    "type": "ROW"
  },
  "ROW-4": {
    "children": [
      "CHART-10",
      "CHART-11"
    ],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-1"
    ],
    "id": "ROW-4",
    "meta": {
      "background": "BACKGROUND_TRANSPARENT"
    },
    "type": "ROW"
  },
  "ROW-5": {
    "children": [
      "CHART-12",
      "CHART-13",
      "CHART-14"
    ],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2"
    ],
    "id": "ROW-5",
    "meta": {
      "background": "BACKGROUND_TRANSPARENT"
    },
    "type": "ROW"
  },
  "ROW-6": {
    "children": [
      "CHART-15",
      "CHART-16",
      "CHART-17"
    ],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2"
    ],
    "id": "ROW-6",
    "meta": {
      "background": "BACKGROUND_TRANSPARENT"
    },
    "type": "ROW"
  },
  "ROW-7": {
    "children": [
      "CHART-18",
      "CHART-19",
      "CHART-20"
    ],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2"
    ],
    "id": "ROW-7",
    "meta": {
      "background": "BACKGROUND_TRANSPARENT"
    },
    "type": "ROW"
  },
  "ROW-8": {
    "children": [
      "CHART-21",
      "CHART-22",
      "CHART-23"
    ],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2"
    ],
    "id": "ROW-8",
    "meta": {
      "background": "BACKGROUND_TRANSPARENT"
    },
    "type": "ROW"
  },
  "ROW-9": {
    "children": [
      "CHART-24",
      "CHART-25",
      "CHART-26"
    ],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2"
    ],
    "id": "ROW-9",
    "meta": {
      "background": "BACKGROUND_TRANSPARENT"
    },
    "type": "ROW"
  },
  "ROW-10": {
    "children": [
      "CHART-27",
      "CHART-28",
      "CHART-29"
    ],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2"
    ],
    "id": "ROW-10",
    "meta": {
      "background": "BACKGROUND_TRANSPARENT"
    },
    "type": "ROW"
  },
  "ROW-11": {
    "children": [
      "CHART-30",
      "CHART-31",
      "CHART-32"
    ],
    "parents": [
      "ROOT_ID",
      "TABS-TOP",
      "TAB-TOP-2"
    ],
    "id": "ROW-11",
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
    dash.dashboard_title = "Supported Charts Dashboard"
    dash.position_json = json.dumps(pos, indent=2)
    dash.slug = DASH_SLUG
