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

from superset import db
from superset.models.dashboard import Dashboard

from .helpers import update_slice_ids

DASH_SLUG = "echarts_dash"


def load_echarts_dashboard() -> None:
    """Loading a dashboard featuring EChart charts"""

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
            "text": "ECharts Charts"
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
            "CHART--wEhS-MDSg"
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
    slices = update_slice_ids(pos)
    dash.dashboard_title = "ECharts Dashboard"
    dash.position_json = json.dumps(pos, indent=4)
    dash.slug = DASH_SLUG
    dash.slices = slices
    db.session.merge(dash)
    db.session.commit()
