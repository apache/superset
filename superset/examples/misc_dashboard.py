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
import textwrap

from superset import db
from superset.models.dashboard import Dashboard
from superset.utils import json

from .helpers import update_slice_ids

DASH_SLUG = "misc_charts"


def load_misc_dashboard() -> None:
    """Loading a dashboard featuring misc charts"""

    print("Creating the dashboard")
    db.session.expunge_all()
    dash = db.session.query(Dashboard).filter_by(slug=DASH_SLUG).first()

    if not dash:
        dash = Dashboard()
        db.session.add(dash)
    js = textwrap.dedent(
        """\
{
    "CHART-HJOYVMV0E7": {
        "children": [],
        "id": "CHART-HJOYVMV0E7",
        "meta": {
            "chartId": 3969,
            "height": 69,
            "sliceName": "Mapbox Long/Lat",
            "uuid": "164efe31-295b-4408-aaa6-2f4bfb58a212",
            "width": 4
        },
        "parents": [
            "ROOT_ID",
            "GRID_ID",
            "ROW-S1MK4M4A4X",
            "COLUMN-ByUFVf40EQ"
        ],
        "type": "CHART"
    },
    "CHART-S1WYNz4AVX": {
        "children": [],
        "id": "CHART-S1WYNz4AVX",
        "meta": {
            "chartId": 3989,
            "height": 69,
            "sliceName": "Parallel Coordinates",
            "uuid": "e84f7e74-031a-47bb-9f80-ae0694dcca48",
            "width": 4
        },
        "parents": [
            "ROOT_ID",
            "GRID_ID",
            "ROW-SytNzNA4X"
        ],
        "type": "CHART"
    },
    "CHART-rkgF4G4A4X": {
        "children": [],
        "id": "CHART-rkgF4G4A4X",
        "meta": {
            "chartId": 3970,
            "height": 69,
            "sliceName": "Birth in France by department in 2016",
            "uuid": "54583ae9-c99a-42b5-a906-7ee2adfe1fb1",
            "width": 4
        },
        "parents": [
            "ROOT_ID",
            "GRID_ID",
            "ROW-SytNzNA4X"
        ],
        "type": "CHART"
    },
    "DASHBOARD_VERSION_KEY": "v2",
    "GRID_ID": {
        "children": [
            "ROW-SytNzNA4X"
        ],
        "id": "GRID_ID",
        "parents": [
            "ROOT_ID"
        ],
        "type": "GRID"
    },
    "HEADER_ID": {
        "id": "HEADER_ID",
        "meta": {
            "text": "Misc Charts"
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
    "ROW-SytNzNA4X": {
        "children": [
            "CHART-rkgF4G4A4X",
            "CHART-S1WYNz4AVX",
            "CHART-HJOYVMV0E7"
        ],
        "id": "ROW-SytNzNA4X",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "parents": [
            "ROOT_ID",
            "GRID_ID"
        ],
        "type": "ROW"
    }
}
    """
    )
    pos = json.loads(js)
    slices = update_slice_ids(pos)
    dash.dashboard_title = "Misc Charts"
    dash.position_json = json.dumps(pos, indent=4)
    dash.slug = DASH_SLUG
    dash.slices = slices
