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
import json
import textwrap

from superset import db
from superset.models.dashboard import Dashboard

from .helpers import update_slice_ids


def load_tabbed_dashboard(_: bool = False) -> None:
    """Creating a tabbed dashboard"""

    print("Creating a dashboard with nested tabs")
    slug = "tabbed_dash"
    dash = db.session.query(Dashboard).filter_by(slug=slug).first()

    if not dash:
        dash = Dashboard()

    js = textwrap.dedent(
        """
{
    "CHART-06Kg-rUggO": {
      "children": [],
      "id": "CHART-06Kg-rUggO",
      "meta": {
        "chartId": 617,
        "height": 42,
        "sliceName": "Number of Girls",
        "width": 4
      },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "ROW-kHj58UJg5N",
        "COLUMN-_o23occSTg",
        "TABS-CslNeIC6x8",
        "TAB-SDz1jDqYZ2",
        "ROW-DnYkJgKQE"
      ],
      "type": "CHART"
    },
    "CHART-E4rQMdzY9-": {
      "children": [],
      "id": "CHART-E4rQMdzY9-",
      "meta": {
        "chartId": 616,
        "height": 41,
        "sliceName": "Names Sorted by Num in California",
        "width": 4
      },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "ROW-kHj58UJg5N",
        "COLUMN-_o23occSTg",
        "TABS-CslNeIC6x8",
        "TAB-SDz1jDqYZ2",
        "ROW-DnYkJgKQE"
      ],
      "type": "CHART"
    },
    "CHART-WO52N6b5de": {
      "children": [],
      "id": "CHART-WO52N6b5de",
      "meta": {
        "chartId": 615,
        "height": 41,
        "sliceName": "Top 10 California Names Timeseries",
        "width": 8
      },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "ROW-kHj58UJg5N",
        "COLUMN-_o23occSTg",
        "TABS-CslNeIC6x8",
        "TAB-t54frVKlx",
        "ROW-ghqEVzr2fA"
      ],
      "type": "CHART"
    },
    "CHART-c0EjR-OZ0n": {
      "children": [],
      "id": "CHART-c0EjR-OZ0n",
      "meta": {
        "chartId": 598,
        "height": 50,
        "sliceName": "Treemap",
        "width": 4
      },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "ROW-kHj58UJg5N",
        "COLUMN-RGd6kjW57J"
      ],
      "type": "CHART"
    },
    "CHART-dxV7Il74hH": {
      "children": [],
      "id": "CHART-dxV7Il74hH",
      "meta": {
        "chartId": 597,
        "height": 50,
        "sliceName": "Box plot",
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
        "chartId": 592,
        "height": 29,
        "sliceName": "Growth Rate",
        "width": 5
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
        "chartId": 589,
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
    "COLUMN-RGd6kjW57J": {
      "children": ["CHART-c0EjR-OZ0n"],
      "id": "COLUMN-RGd6kjW57J",
      "meta": { "background": "BACKGROUND_TRANSPARENT", "width": 4 },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "ROW-kHj58UJg5N"
      ],
      "type": "COLUMN"
    },
    "COLUMN-V6vsdWdOEJ": {
      "children": ["TABS-urzRuDRusW"],
      "id": "COLUMN-V6vsdWdOEJ",
      "meta": { "background": "BACKGROUND_TRANSPARENT", "width": 7 },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "TABS-CSjo6VfNrj",
        "TAB-z81Q87PD7",
        "ROW-G73z9PIHn"
      ],
      "type": "COLUMN"
    },
    "COLUMN-_o23occSTg": {
      "children": ["TABS-CslNeIC6x8"],
      "id": "COLUMN-_o23occSTg",
      "meta": { "background": "BACKGROUND_TRANSPARENT", "width": 8 },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "ROW-kHj58UJg5N"
      ],
      "type": "COLUMN"
    },
    "DASHBOARD_VERSION_KEY": "v2",
    "GRID_ID": { "children": [], "id": "GRID_ID", "type": "GRID" },
    "HEADER_ID": {
      "id": "HEADER_ID",
      "type": "HEADER",
      "meta": { "text": "Tabbed Dashboard" }
    },
    "ROOT_ID": {
      "children": ["TABS-lV0r00f4H1"],
      "id": "ROOT_ID",
      "type": "ROOT"
    },
    "ROW-7ygtDczaQ": {
      "children": ["CHART-dxV7Il74hH"],
      "id": "ROW-7ygtDczaQ",
      "meta": { "background": "BACKGROUND_TRANSPARENT" },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-gcQJxApOZS",
        "TABS-afnrUvdxYF",
        "TAB-jNNd4WWar1"
      ],
      "type": "ROW"
    },
    "ROW-DnYkJgKQE": {
      "children": ["CHART-06Kg-rUggO", "CHART-E4rQMdzY9-"],
      "id": "ROW-DnYkJgKQE",
      "meta": { "background": "BACKGROUND_TRANSPARENT" },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "ROW-kHj58UJg5N",
        "COLUMN-_o23occSTg",
        "TABS-CslNeIC6x8",
        "TAB-SDz1jDqYZ2"
      ],
      "type": "ROW"
    },
    "ROW-G73z9PIHn": {
      "children": ["CHART-jJ5Yj1Ptaz", "COLUMN-V6vsdWdOEJ"],
      "id": "ROW-G73z9PIHn",
      "meta": { "background": "BACKGROUND_TRANSPARENT" },
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
      "children": ["CHART-z4gmEuCqQ5"],
      "id": "ROW-LCjsdSetJ",
      "meta": { "background": "BACKGROUND_TRANSPARENT" },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "TABS-CSjo6VfNrj",
        "TAB-EcNm_wh922"
      ],
      "type": "ROW"
    },
    "ROW-ghqEVzr2fA": {
      "children": ["CHART-WO52N6b5de"],
      "id": "ROW-ghqEVzr2fA",
      "meta": { "background": "BACKGROUND_TRANSPARENT" },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "ROW-kHj58UJg5N",
        "COLUMN-_o23occSTg",
        "TABS-CslNeIC6x8",
        "TAB-t54frVKlx"
      ],
      "type": "ROW"
    },
    "ROW-kHj58UJg5N": {
      "children": ["COLUMN-RGd6kjW57J", "COLUMN-_o23occSTg"],
      "id": "ROW-kHj58UJg5N",
      "meta": { "background": "BACKGROUND_TRANSPARENT" },
      "parents": ["ROOT_ID", "TABS-lV0r00f4H1", "TAB-NF3dlrWGS"],
      "type": "ROW"
    },
    "TAB-0yhA2SgdPg": {
      "children": ["ROW-Gr9YPyQGwf"],
      "id": "TAB-0yhA2SgdPg",
      "meta": {
        "defaultText": "Tab title",
        "placeholder": "Tab title",
        "text": "Level 2 nested tab 1"
      },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "TABS-CSjo6VfNrj",
        "TAB-z81Q87PD7",
        "ROW-G73z9PIHn",
        "COLUMN-V6vsdWdOEJ",
        "TABS-urzRuDRusW"
      ],
      "type": "TAB"
    },
    "TAB-3a1Gvm-Ef": {
      "children": [],
      "id": "TAB-3a1Gvm-Ef",
      "meta": {
        "defaultText": "Tab title",
        "placeholder": "Tab title",
        "text": "Level 2 nested tab 2"
      },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "TABS-CSjo6VfNrj",
        "TAB-z81Q87PD7",
        "ROW-G73z9PIHn",
        "COLUMN-V6vsdWdOEJ",
        "TABS-urzRuDRusW"
      ],
      "type": "TAB"
    },
    "TAB-EcNm_wh922": {
      "children": ["ROW-LCjsdSetJ"],
      "id": "TAB-EcNm_wh922",
      "meta": { "text": "row tab 1" },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "TABS-CSjo6VfNrj"
      ],
      "type": "TAB"
    },
    "TAB-NF3dlrWGS": {
      "children": ["ROW-kHj58UJg5N", "TABS-CSjo6VfNrj"],
      "id": "TAB-NF3dlrWGS",
      "meta": { "text": "Tab A" },
      "parents": ["ROOT_ID", "TABS-lV0r00f4H1"],
      "type": "TAB"
    },
    "TAB-SDz1jDqYZ2": {
      "children": ["ROW-DnYkJgKQE"],
      "id": "TAB-SDz1jDqYZ2",
      "meta": {
        "defaultText": "Tab title",
        "placeholder": "Tab title",
        "text": "Nested tab 1"
      },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "ROW-kHj58UJg5N",
        "COLUMN-_o23occSTg",
        "TABS-CslNeIC6x8"
      ],
      "type": "TAB"
    },
    "TAB-gcQJxApOZS": {
      "children": ["TABS-afnrUvdxYF"],
      "id": "TAB-gcQJxApOZS",
      "meta": { "text": "Tab B" },
      "parents": ["ROOT_ID", "TABS-lV0r00f4H1"],
      "type": "TAB"
    },
    "TAB-jNNd4WWar1": {
      "children": ["ROW-7ygtDczaQ"],
      "id": "TAB-jNNd4WWar1",
      "meta": { "text": "New Tab" },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-gcQJxApOZS",
        "TABS-afnrUvdxYF"
      ],
      "type": "TAB"
    },
    "TAB-t54frVKlx": {
      "children": ["ROW-ghqEVzr2fA"],
      "id": "TAB-t54frVKlx",
      "meta": {
        "defaultText": "Tab title",
        "placeholder": "Tab title",
        "text": "Nested tab 2"
      },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "ROW-kHj58UJg5N",
        "COLUMN-_o23occSTg",
        "TABS-CslNeIC6x8"
      ],
      "type": "TAB"
    },
    "TAB-z81Q87PD7": {
      "children": ["ROW-G73z9PIHn"],
      "id": "TAB-z81Q87PD7",
      "meta": { "text": "row tab 2" },
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "TABS-CSjo6VfNrj"
      ],
      "type": "TAB"
    },
    "TABS-CSjo6VfNrj": {
      "children": ["TAB-EcNm_wh922", "TAB-z81Q87PD7"],
      "id": "TABS-CSjo6VfNrj",
      "meta": {},
      "parents": ["ROOT_ID", "TABS-lV0r00f4H1", "TAB-NF3dlrWGS"],
      "type": "TABS"
    },
    "TABS-CslNeIC6x8": {
      "children": ["TAB-SDz1jDqYZ2", "TAB-t54frVKlx"],
      "id": "TABS-CslNeIC6x8",
      "meta": {},
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "ROW-kHj58UJg5N",
        "COLUMN-_o23occSTg"
      ],
      "type": "TABS"
    },
    "TABS-afnrUvdxYF": {
      "children": ["TAB-jNNd4WWar1"],
      "id": "TABS-afnrUvdxYF",
      "meta": {},
      "parents": ["ROOT_ID", "TABS-lV0r00f4H1", "TAB-gcQJxApOZS"],
      "type": "TABS"
    },
    "TABS-lV0r00f4H1": {
      "children": ["TAB-NF3dlrWGS", "TAB-gcQJxApOZS"],
      "id": "TABS-lV0r00f4H1",
      "meta": {},
      "parents": ["ROOT_ID"],
      "type": "TABS"
    },
    "TABS-urzRuDRusW": {
      "children": ["TAB-0yhA2SgdPg", "TAB-3a1Gvm-Ef"],
      "id": "TABS-urzRuDRusW",
      "meta": {},
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "TABS-CSjo6VfNrj",
        "TAB-z81Q87PD7",
        "ROW-G73z9PIHn",
        "COLUMN-V6vsdWdOEJ"
      ],
      "type": "TABS"
    },
    "CHART-p4_VUp8w3w": {
      "type": "CHART",
      "id": "CHART-p4_VUp8w3w",
      "children": [],
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "TABS-CSjo6VfNrj",
        "TAB-z81Q87PD7",
        "ROW-G73z9PIHn",
        "COLUMN-V6vsdWdOEJ",
        "TABS-urzRuDRusW",
        "TAB-0yhA2SgdPg",
        "ROW-Gr9YPyQGwf"
      ],
      "meta": {
        "width": 4,
        "height": 20,
        "chartId": 614,
        "sliceName": "Number of California Births"
      }
    },
    "ROW-Gr9YPyQGwf": {
      "type": "ROW",
      "id": "ROW-Gr9YPyQGwf",
      "children": ["CHART-p4_VUp8w3w"],
      "parents": [
        "ROOT_ID",
        "TABS-lV0r00f4H1",
        "TAB-NF3dlrWGS",
        "TABS-CSjo6VfNrj",
        "TAB-z81Q87PD7",
        "ROW-G73z9PIHn",
        "COLUMN-V6vsdWdOEJ",
        "TABS-urzRuDRusW",
        "TAB-0yhA2SgdPg"
      ],
      "meta": { "background": "BACKGROUND_TRANSPARENT" }
    }
}"""
    )
    pos = json.loads(js)
    slices = update_slice_ids(pos)
    dash.position_json = json.dumps(pos, indent=4)
    dash.slices = slices
    dash.dashboard_title = "Tabbed Dashboard"
    dash.slug = slug

    db.session.merge(dash)
    db.session.commit()
