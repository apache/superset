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
import textwrap

from superset import db

from .helpers import Dash, Slice, update_slice_ids


def load_tabbed_dashboard(only_metadata=False):
    """Creating a tabbed dashboard"""

    print("Creating a dashboard with nested tabs")
    slug = "tabbed_dash"
    dash = db.session.query(Dash).filter_by(slug=slug).first()

    if not dash:
        dash = Dash()

    # reuse charts in "World's Bank Data and create
    # new dashboard with nested tabs
    tabbed_dash_slices = set()
    tabbed_dash_slices.add("Region Filter")
    tabbed_dash_slices.add("Growth Rate")
    tabbed_dash_slices.add("Treemap")
    tabbed_dash_slices.add("Box plot")

    js = textwrap.dedent(
        """\
    {
      "CHART-c0EjR-OZ0n": {
        "children": [],
        "id": "CHART-c0EjR-OZ0n",
        "meta": {
          "chartId": 870,
          "height": 50,
          "sliceName": "Box plot",
          "width": 4
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-NF3dlrWGS",
          "ROW-7G2o5uDvfo"
        ],
        "type": "CHART"
      },
      "CHART-dxV7Il74hH": {
        "children": [],
        "id": "CHART-dxV7Il74hH",
        "meta": {
          "chartId": 797,
          "height": 50,
          "sliceName": "Treemap",
          "width": 4
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-gcQJxApOZS",
          "TABS-afnrUvdxYF",
          "TAB-jNNd4WWar1",
          "ROW-7ygtDczaQ"
        ],
        "type": "CHART"
      },
      "CHART-jJ5Yj1Ptaz": {
        "children": [],
        "id": "CHART-jJ5Yj1Ptaz",
        "meta": {
          "chartId": 789,
          "height": 50,
          "sliceName": "World's Population",
          "width": 4
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-NF3dlrWGS",
          "TABS-CSjo6VfNrj",
          "TAB-z81Q87PD7",
          "ROW-G73z9PIHn"
        ],
        "type": "CHART"
      },
      "CHART-z4gmEuCqQ5": {
        "children": [],
        "id": "CHART-z4gmEuCqQ5",
        "meta": {
          "chartId": 788,
          "height": 50,
          "sliceName": "Region Filter",
          "width": 4
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-NF3dlrWGS",
          "TABS-CSjo6VfNrj",
          "TAB-EcNm_wh922",
          "ROW-LCjsdSetJ"
        ],
        "type": "CHART"
      },
      "DASHBOARD_VERSION_KEY": "v2",
      "GRID_ID": {
        "children": [],
        "id": "GRID_ID",
        "type": "GRID"
      },
      "HEADER_ID": {
        "id": "HEADER_ID",
        "meta": {
          "text": "Tabbed Dashboard"
        },
        "type": "HEADER"
      },
      "ROOT_ID": {
        "children": [
          "TABS-lV0r00f4H1"
        ],
        "id": "ROOT_ID",
        "type": "ROOT"
      },
      "ROW-7G2o5uDvfo": {
        "children": [
          "CHART-c0EjR-OZ0n"
        ],
        "id": "ROW-7G2o5uDvfo",
        "meta": {
          "background": "BACKGROUND_TRANSPARENT"
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-NF3dlrWGS"
        ],
        "type": "ROW"
      },
      "ROW-7ygtDczaQ": {
        "children": [
          "CHART-dxV7Il74hH"
        ],
        "id": "ROW-7ygtDczaQ",
        "meta": {
          "background": "BACKGROUND_TRANSPARENT"
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-gcQJxApOZS",
          "TABS-afnrUvdxYF",
          "TAB-jNNd4WWar1"
        ],
        "type": "ROW"
      },
      "ROW-G73z9PIHn": {
        "children": [
          "CHART-jJ5Yj1Ptaz"
        ],
        "id": "ROW-G73z9PIHn",
        "meta": {
          "background": "BACKGROUND_TRANSPARENT"
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-NF3dlrWGS",
          "TABS-CSjo6VfNrj",
          "TAB-z81Q87PD7"
        ],
        "type": "ROW"
      },
      "ROW-LCjsdSetJ": {
        "children": [
          "CHART-z4gmEuCqQ5"
        ],
        "id": "ROW-LCjsdSetJ",
        "meta": {
          "background": "BACKGROUND_TRANSPARENT"
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-NF3dlrWGS",
          "TABS-CSjo6VfNrj",
          "TAB-EcNm_wh922"
        ],
        "type": "ROW"
      },
      "TAB-EcNm_wh922": {
        "children": [
          "ROW-LCjsdSetJ"
        ],
        "id": "TAB-EcNm_wh922",
        "meta": {
          "text": "row tab 1"
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-NF3dlrWGS",
          "TABS-CSjo6VfNrj"
        ],
        "type": "TAB"
      },
      "TAB-NF3dlrWGS": {
        "children": [
          "ROW-7G2o5uDvfo",
          "TABS-CSjo6VfNrj"
        ],
        "id": "TAB-NF3dlrWGS",
        "meta": {
          "text": "Tab A"
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1"
        ],
        "type": "TAB"
      },
      "TAB-gcQJxApOZS": {
        "children": [
          "TABS-afnrUvdxYF"
        ],
        "id": "TAB-gcQJxApOZS",
        "meta": {
          "text": "Tab B"
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1"
        ],
        "type": "TAB"
      },
      "TAB-jNNd4WWar1": {
        "children": [
          "ROW-7ygtDczaQ"
        ],
        "id": "TAB-jNNd4WWar1",
        "meta": {
          "text": "New Tab"
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-gcQJxApOZS",
          "TABS-afnrUvdxYF"
        ],
        "type": "TAB"
      },
      "TAB-z81Q87PD7": {
        "children": [
          "ROW-G73z9PIHn"
        ],
        "id": "TAB-z81Q87PD7",
        "meta": {
          "text": "row tab 2"
        },
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-NF3dlrWGS",
          "TABS-CSjo6VfNrj"
        ],
        "type": "TAB"
      },
      "TABS-CSjo6VfNrj": {
        "children": [
          "TAB-EcNm_wh922",
          "TAB-z81Q87PD7"
        ],
        "id": "TABS-CSjo6VfNrj",
        "meta": {},
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-NF3dlrWGS"
        ],
        "type": "TABS"
      },
      "TABS-afnrUvdxYF": {
        "children": [
          "TAB-jNNd4WWar1"
        ],
        "id": "TABS-afnrUvdxYF",
        "meta": {},
        "parents": [
          "ROOT_ID",
          "TABS-lV0r00f4H1",
          "TAB-gcQJxApOZS"
        ],
        "type": "TABS"
      },
      "TABS-lV0r00f4H1": {
        "children": [
          "TAB-NF3dlrWGS",
          "TAB-gcQJxApOZS"
        ],
        "id": "TABS-lV0r00f4H1",
        "meta": {},
        "parents": [
          "ROOT_ID"
        ],
        "type": "TABS"
      }
    }
        """
    )
    pos = json.loads(js)
    slices = [
        db.session.query(Slice).filter_by(slice_name=name).first()
        for name in tabbed_dash_slices
    ]

    slices = sorted(slices, key=lambda x: x.id)
    update_slice_ids(pos, slices)
    dash.position_json = json.dumps(pos, indent=4)
    dash.slices = slices
    dash.dashboard_title = "Tabbed Dashboard"
    dash.slug = slug

    db.session.merge(dash)
    db.session.commit()
