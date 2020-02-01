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
from superset.models.slice import Slice

from .helpers import misc_dash_slices, update_slice_ids

DASH_SLUG = "misc_charts"


def load_misc_dashboard():
    """Loading a dashboard featuring misc charts"""

    print("Creating the dashboard")
    db.session.expunge_all()
    dash = db.session.query(Dashboard).filter_by(slug=DASH_SLUG).first()

    if not dash:
        dash = Dashboard()
    js = textwrap.dedent(
        """\
{
    "CHART-BkeVbh8ANQ": {
        "children": [],
        "id": "CHART-BkeVbh8ANQ",
        "meta": {
            "chartId": 4004,
            "height": 34,
            "sliceName": "Multi Line",
            "width": 8
        },
        "type": "CHART"
    },
    "CHART-H1HYNzEANX": {
        "children": [],
        "id": "CHART-H1HYNzEANX",
        "meta": {
            "chartId": 3940,
            "height": 50,
            "sliceName": "Energy Sankey",
            "width": 6
        },
        "type": "CHART"
    },
    "CHART-HJOYVMV0E7": {
        "children": [],
        "id": "CHART-HJOYVMV0E7",
        "meta": {
            "chartId": 3969,
            "height": 63,
            "sliceName": "Mapbox Long/Lat",
            "width": 6
        },
        "type": "CHART"
    },
    "CHART-S1WYNz4AVX": {
        "children": [],
        "id": "CHART-S1WYNz4AVX",
        "meta": {
            "chartId": 3989,
            "height": 25,
            "sliceName": "Parallel Coordinates",
            "width": 4
        },
        "type": "CHART"
    },
    "CHART-r19KVMNCE7": {
        "children": [],
        "id": "CHART-r19KVMNCE7",
        "meta": {
            "chartId": 3971,
            "height": 34,
            "sliceName": "Calendar Heatmap multiformat 0",
            "width": 4
        },
        "type": "CHART"
    },
    "CHART-rJ4K4GV04Q": {
        "children": [],
        "id": "CHART-rJ4K4GV04Q",
        "meta": {
            "chartId": 3941,
            "height": 63,
            "sliceName": "Energy Force Layout",
            "width": 6
        },
        "type": "CHART"
    },
    "CHART-rkgF4G4A4X": {
        "children": [],
        "id": "CHART-rkgF4G4A4X",
        "meta": {
            "chartId": 3970,
            "height": 25,
            "sliceName": "Birth in France by department in 2016",
            "width": 8
        },
        "type": "CHART"
    },
    "CHART-rywK4GVR4X": {
        "children": [],
        "id": "CHART-rywK4GVR4X",
        "meta": {
            "chartId": 3942,
            "height": 50,
            "sliceName": "Heatmap",
            "width": 6
        },
        "type": "CHART"
    },
    "COLUMN-ByUFVf40EQ": {
        "children": [
            "CHART-rywK4GVR4X",
            "CHART-HJOYVMV0E7"
        ],
        "id": "COLUMN-ByUFVf40EQ",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT",
            "width": 6
        },
        "type": "COLUMN"
    },
    "COLUMN-rkmYVGN04Q": {
        "children": [
            "CHART-rJ4K4GV04Q",
            "CHART-H1HYNzEANX"
        ],
        "id": "COLUMN-rkmYVGN04Q",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT",
            "width": 6
        },
        "type": "COLUMN"
    },
    "GRID_ID": {
        "children": [
            "ROW-SytNzNA4X",
            "ROW-S1MK4M4A4X",
            "ROW-HkFFEzVRVm"
        ],
        "id": "GRID_ID",
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
    "ROW-HkFFEzVRVm": {
        "children": [
            "CHART-r19KVMNCE7",
            "CHART-BkeVbh8ANQ"
        ],
        "id": "ROW-HkFFEzVRVm",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW"
    },
    "ROW-S1MK4M4A4X": {
        "children": [
            "COLUMN-rkmYVGN04Q",
            "COLUMN-ByUFVf40EQ"
        ],
        "id": "ROW-S1MK4M4A4X",
        "meta": {
            "background": "BACKGROUND_TRANSPARENT"
        },
        "type": "ROW"
    },
    "ROW-SytNzNA4X": {
        "children": [
            "CHART-rkgF4G4A4X",
            "CHART-S1WYNz4AVX"
        ],
        "id": "ROW-SytNzNA4X",
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
    slices = (
        db.session.query(Slice).filter(Slice.slice_name.in_(misc_dash_slices)).all()
    )
    slices = sorted(slices, key=lambda x: x.id)
    update_slice_ids(pos, slices)
    dash.dashboard_title = "Misc Charts"
    dash.position_json = json.dumps(pos, indent=4)
    dash.slug = DASH_SLUG
    dash.slices = slices
    db.session.merge(dash)
    db.session.commit()
