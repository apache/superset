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
"""Loads datasets, dashboards and slices in a new superset instance"""
# pylint: disable=C,R,W
import json
import os
import textwrap

import pandas as pd
from sqlalchemy import DateTime, String
from sqlalchemy.sql import column

from superset import db
from superset.connectors.sqla.models import SqlMetric
from superset.utils import core as utils

from .helpers import (
    config,
    Dash,
    EXAMPLES_FOLDER,
    get_example_data,
    get_slice_json,
    merge_slice,
    misc_dash_slices,
    Slice,
    TBL,
    update_slice_ids,
)


def load_world_bank_health_n_pop(only_metadata=False, force=False):
    """Loads the world bank health dataset, slices and a dashboard"""
    tbl_name = "wb_health_population"
    database = utils.get_example_database()
    table_exists = database.has_table_by_name(tbl_name)

    if not only_metadata and (not table_exists or force):
        data = get_example_data("countries.json.gz")
        pdf = pd.read_json(data)
        pdf.columns = [col.replace(".", "_") for col in pdf.columns]
        pdf.year = pd.to_datetime(pdf.year)
        pdf.to_sql(
            tbl_name,
            database.get_sqla_engine(),
            if_exists="replace",
            chunksize=50,
            dtype={
                "year": DateTime(),
                "country_code": String(3),
                "country_name": String(255),
                "region": String(255),
            },
            index=False,
        )

    print("Creating table [wb_health_population] reference")
    tbl = db.session.query(TBL).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = TBL(table_name=tbl_name)
    tbl.description = utils.readfile(os.path.join(EXAMPLES_FOLDER, "countries.md"))
    tbl.main_dttm_col = "year"
    tbl.database = database
    tbl.filter_select_enabled = True

    metrics = [
        "sum__SP_POP_TOTL",
        "sum__SH_DYN_AIDS",
        "sum__SH_DYN_AIDS",
        "sum__SP_RUR_TOTL_ZS",
        "sum__SP_DYN_LE00_IN",
        "sum__SP_RUR_TOTL",
    ]
    for m in metrics:
        if not any(col.metric_name == m for col in tbl.metrics):
            aggr_func = m[:3]
            col = str(column(m[5:]).compile(db.engine))
            tbl.metrics.append(
                SqlMetric(metric_name=m, expression=f"{aggr_func}({col})")
            )

    db.session.merge(tbl)
    db.session.commit()
    tbl.fetch_metadata()

    defaults = {
        "compare_lag": "10",
        "compare_suffix": "o10Y",
        "limit": "25",
        "granularity_sqla": "year",
        "groupby": [],
        "metric": "sum__SP_POP_TOTL",
        "metrics": ["sum__SP_POP_TOTL"],
        "row_limit": config["ROW_LIMIT"],
        "since": "2014-01-01",
        "until": "2014-01-02",
        "time_range": "2014-01-01 : 2014-01-02",
        "where": "",
        "markup_type": "markdown",
        "country_fieldtype": "cca3",
        "secondary_metric": {
            "aggregate": "SUM",
            "column": {
                "column_name": "SP_RUR_TOTL",
                "optionName": "_col_SP_RUR_TOTL",
                "type": "DOUBLE",
            },
            "expressionType": "SIMPLE",
            "hasCustomLabel": True,
            "label": "Rural Population",
        },
        "entity": "country_code",
        "show_bubbles": True,
    }

    print("Creating slices")
    slices = [
        Slice(
            slice_name="Region Filter",
            viz_type="filter_box",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="filter_box",
                date_filter=False,
                filter_configs=[
                    {
                        "asc": False,
                        "clearable": True,
                        "column": "region",
                        "key": "2s98dfu",
                        "metric": "sum__SP_POP_TOTL",
                        "multiple": True,
                    },
                    {
                        "asc": False,
                        "clearable": True,
                        "key": "li3j2lk",
                        "column": "country_name",
                        "metric": "sum__SP_POP_TOTL",
                        "multiple": True,
                    },
                ],
            ),
        ),
        Slice(
            slice_name="World's Population",
            viz_type="big_number",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                since="2000",
                viz_type="big_number",
                compare_lag="10",
                metric="sum__SP_POP_TOTL",
                compare_suffix="over 10Y",
            ),
        ),
        Slice(
            slice_name="Most Populated Countries",
            viz_type="table",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="table",
                metrics=["sum__SP_POP_TOTL"],
                groupby=["country_name"],
            ),
        ),
        Slice(
            slice_name="Growth Rate",
            viz_type="line",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="line",
                since="1960-01-01",
                metrics=["sum__SP_POP_TOTL"],
                num_period_compare="10",
                groupby=["country_name"],
            ),
        ),
        Slice(
            slice_name="% Rural",
            viz_type="world_map",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="world_map",
                metric="sum__SP_RUR_TOTL_ZS",
                num_period_compare="10",
            ),
        ),
        Slice(
            slice_name="Life Expectancy VS Rural %",
            viz_type="bubble",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="bubble",
                since="2011-01-01",
                until="2011-01-02",
                series="region",
                limit=0,
                entity="country_name",
                x="sum__SP_RUR_TOTL_ZS",
                y="sum__SP_DYN_LE00_IN",
                size="sum__SP_POP_TOTL",
                max_bubble_size="50",
                filters=[
                    {
                        "col": "country_code",
                        "val": [
                            "TCA",
                            "MNP",
                            "DMA",
                            "MHL",
                            "MCO",
                            "SXM",
                            "CYM",
                            "TUV",
                            "IMY",
                            "KNA",
                            "ASM",
                            "ADO",
                            "AMA",
                            "PLW",
                        ],
                        "op": "not in",
                    }
                ],
            ),
        ),
        Slice(
            slice_name="Rural Breakdown",
            viz_type="sunburst",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                viz_type="sunburst",
                groupby=["region", "country_name"],
                since="2011-01-01",
                until="2011-01-01",
            ),
        ),
        Slice(
            slice_name="World's Pop Growth",
            viz_type="area",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                since="1960-01-01",
                until="now",
                viz_type="area",
                groupby=["region"],
            ),
        ),
        Slice(
            slice_name="Box plot",
            viz_type="box_plot",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                since="1960-01-01",
                until="now",
                whisker_options="Min/max (no outliers)",
                x_ticks_layout="staggered",
                viz_type="box_plot",
                groupby=["region"],
            ),
        ),
        Slice(
            slice_name="Treemap",
            viz_type="treemap",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                since="1960-01-01",
                until="now",
                viz_type="treemap",
                metrics=["sum__SP_POP_TOTL"],
                groupby=["region", "country_code"],
            ),
        ),
        Slice(
            slice_name="Parallel Coordinates",
            viz_type="para",
            datasource_type="table",
            datasource_id=tbl.id,
            params=get_slice_json(
                defaults,
                since="2011-01-01",
                until="2011-01-01",
                viz_type="para",
                limit=100,
                metrics=["sum__SP_POP_TOTL", "sum__SP_RUR_TOTL_ZS", "sum__SH_DYN_AIDS"],
                secondary_metric="sum__SP_POP_TOTL",
                series="country_name",
            ),
        ),
    ]
    misc_dash_slices.add(slices[-1].slice_name)
    for slc in slices:
        merge_slice(slc)

    print("Creating a World's Health Bank dashboard")
    dash_name = "World Bank's Data"
    slug = "world_health"
    dash = db.session.query(Dash).filter_by(slug=slug).first()

    if not dash:
        dash = Dash()
    dash.published = True
    js = textwrap.dedent(
        """\
{
    "CHART-36bfc934": {
        "children": [],
        "id": "CHART-36bfc934",
        "meta": {
            "chartId": 40,
            "height": 25,
            "sliceName": "Region Filter",
            "width": 2
        },
        "type": "CHART"
    },
    "CHART-37982887": {
        "children": [],
        "id": "CHART-37982887",
        "meta": {
            "chartId": 41,
            "height": 25,
            "sliceName": "World's Population",
            "width": 2
        },
        "type": "CHART"
    },
    "CHART-17e0f8d8": {
        "children": [],
        "id": "CHART-17e0f8d8",
        "meta": {
            "chartId": 42,
            "height": 92,
            "sliceName": "Most Populated Countries",
            "width": 3
        },
        "type": "CHART"
    },
    "CHART-2ee52f30": {
        "children": [],
        "id": "CHART-2ee52f30",
        "meta": {
            "chartId": 43,
            "height": 38,
            "sliceName": "Growth Rate",
            "width": 6
        },
        "type": "CHART"
    },
    "CHART-2d5b6871": {
        "children": [],
        "id": "CHART-2d5b6871",
        "meta": {
            "chartId": 44,
            "height": 52,
            "sliceName": "% Rural",
            "width": 7
        },
        "type": "CHART"
    },
    "CHART-0fd0d252": {
        "children": [],
        "id": "CHART-0fd0d252",
        "meta": {
            "chartId": 45,
            "height": 50,
            "sliceName": "Life Expectancy VS Rural %",
            "width": 8
        },
        "type": "CHART"
    },
    "CHART-97f4cb48": {
        "children": [],
        "id": "CHART-97f4cb48",
        "meta": {
            "chartId": 46,
            "height": 38,
            "sliceName": "Rural Breakdown",
            "width": 3
        },
        "type": "CHART"
    },
    "CHART-b5e05d6f": {
        "children": [],
        "id": "CHART-b5e05d6f",
        "meta": {
            "chartId": 47,
            "height": 50,
            "sliceName": "World's Pop Growth",
            "width": 4
        },
        "type": "CHART"
    },
    "CHART-e76e9f5f": {
        "children": [],
        "id": "CHART-e76e9f5f",
        "meta": {
            "chartId": 48,
            "height": 50,
            "sliceName": "Box plot",
            "width": 4
        },
        "type": "CHART"
    },
    "CHART-a4808bba": {
        "children": [],
        "id": "CHART-a4808bba",
        "meta": {
            "chartId": 49,
            "height": 50,
            "sliceName": "Treemap",
            "width": 8
        },
        "type": "CHART"
    },
    "COLUMN-071bbbad": {
        "children": [
            "ROW-1e064e3c",
            "ROW-afdefba9"
        ],
        "id": "COLUMN-071bbbad",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT",
            "width": 9
        },
        "type": "COLUMN"
    },
    "COLUMN-fe3914b8": {
        "children": [
            "CHART-36bfc934",
            "CHART-37982887"
        ],
        "id": "COLUMN-fe3914b8",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT",
            "width": 2
        },
        "type": "COLUMN"
    },
    "GRID_ID": {
        "children": [
            "ROW-46632bc2",
            "ROW-3fa26c5d",
            "ROW-812b3f13"
        ],
        "id": "GRID_ID",
        "type": "GRID"
    },
    "HEADER_ID": {
        "id": "HEADER_ID",
        "meta": {
            "text": "World's Bank Data"
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
    "ROW-1e064e3c": {
        "children": [
            "COLUMN-fe3914b8",
            "CHART-2d5b6871"
        ],
        "id": "ROW-1e064e3c",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW"
    },
    "ROW-3fa26c5d": {
        "children": [
            "CHART-b5e05d6f",
            "CHART-0fd0d252"
        ],
        "id": "ROW-3fa26c5d",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW"
    },
    "ROW-46632bc2": {
        "children": [
            "COLUMN-071bbbad",
            "CHART-17e0f8d8"
        ],
        "id": "ROW-46632bc2",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW"
    },
    "ROW-812b3f13": {
        "children": [
            "CHART-a4808bba",
            "CHART-e76e9f5f"
        ],
        "id": "ROW-812b3f13",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW"
    },
    "ROW-afdefba9": {
        "children": [
            "CHART-2ee52f30",
            "CHART-97f4cb48"
        ],
        "id": "ROW-afdefba9",
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
    update_slice_ids(pos, slices)

    dash.dashboard_title = dash_name
    dash.position_json = json.dumps(pos, indent=4)
    dash.slug = slug

    dash.slices = slices[:-1]
    db.session.merge(dash)
    db.session.commit()
