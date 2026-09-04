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

import pytest

from superset import db
from superset.models.dashboard import Dashboard
from superset.utils import json
from superset.utils.core import shortid
from tests.integration_tests.dashboards.superset_factory_util import create_dashboard


@pytest.fixture
def tabbed_dashboard(app_context):
    position_json = {
        "DASHBOARD_VERSION_KEY": "v2",
        "GRID_ID": {
            "children": ["TABS-L1A", "TABS-L1B"],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {
            "id": "HEADER_ID",
            "meta": {"text": "tabbed dashboard"},
            "type": "HEADER",
        },
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "TAB-L1AA": {
            "children": [],
            "id": "TAB-L1AA",
            "meta": {
                "defaultText": "Tab title",
                "placeholder": "Tab title",
                "text": "Tab L1AA",
            },
            "parents": ["ROOT_ID", "GRID_ID", "TABS-L1A"],
            "type": "TAB",
        },
        "TAB-L1AB": {
            "children": [],
            "id": "TAB-L1AB",
            "meta": {
                "defaultText": "Tab title",
                "placeholder": "Tab title",
                "text": "Tab L1AB",
            },
            "parents": ["ROOT_ID", "GRID_ID", "TABS-L1A"],
            "type": "TAB",
        },
        "TABS-L1A": {
            "children": ["TAB-L1AA", "TAB-L1AB"],
            "id": "TABS-L1A",
            "meta": {},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "TABS",
        },
        "TAB-L1BA": {
            "children": [],
            "id": "TAB-L1BA",
            "meta": {
                "defaultText": "Tab title",
                "placeholder": "Tab title",
                "text": "Tab L1B",
            },
            "parents": ["ROOT_ID", "GRID_ID", "TABS-L1B"],
            "type": "TAB",
        },
        "TAB-L1BB": {
            "children": ["TABS-L2A"],
            "id": "TAB-L1BB",
            "meta": {
                "defaultText": "Tab title",
                "placeholder": "Tab title",
                "text": "Tab 2",
            },
            "parents": ["ROOT_ID", "GRID_ID", "TABS-L1B"],
            "type": "TAB",
        },
        "TABS-L1B": {
            "children": ["TAB-L1BA", "TAB-L1BB"],
            "id": "TABS-L1B",
            "meta": {},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "TABS",
        },
        "TAB-L2AA": {
            "children": [],
            "id": "TAB-L2AA",
            "meta": {
                "defaultText": "Tab title",
                "placeholder": "Tab title",
                "text": "Tab L2AA",
            },
            "parents": ["ROOT_ID", "GRID_ID", "TABS-L2A"],
            "type": "TAB",
        },
        "TAB-L2AB": {
            "children": [],
            "id": "TAB-L2AB",
            "meta": {
                "defaultText": "Tab title",
                "placeholder": "Tab title",
                "text": "Tab L2AB",
            },
            "parents": ["ROOT_ID", "GRID_ID", "TABS-L2A"],
            "type": "TAB",
        },
        "TABS-L2A": {
            "children": ["TAB-L2AA", "TAB-L2AB"],
            "id": "TABS-L2A",
            "meta": {},
            "parents": ["ROOT_ID", "GRID_ID", "TABS-L1BB"],
            "type": "TABS",
        },
    }
    dash = create_dashboard(
        slug=f"tabbed-dash-{shortid()}",
        dashboard_title="Test tabbed dash",
        position_json=json.dumps(position_json),
        slices=[],
    )
    db.session.add(dash)
    db.session.commit()
    yield dash
    db.session.query(Dashboard).filter_by(id=dash.id).delete()
    db.session.commit()
