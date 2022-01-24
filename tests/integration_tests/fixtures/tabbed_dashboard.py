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

import pytest

from superset import db
from superset.models.dashboard import Dashboard
from tests.integration_tests.dashboard_utils import create_dashboard
from tests.integration_tests.test_app import app


@pytest.fixture(scope="session")
def tabbed_dashboard():
    position_json = {
        "DASHBOARD_VERSION_KEY": "v2",
        "GRID_ID": {
            "children": ["TABS-IpViLohnyP"],
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
        "TAB-j53G4gtKGF": {
            "children": [],
            "id": "TAB-j53G4gtKGF",
            "meta": {
                "defaultText": "Tab title",
                "placeholder": "Tab title",
                "text": "Tab 1",
            },
            "parents": ["ROOT_ID", "GRID_ID", "TABS-IpViLohnyP"],
            "type": "TAB",
        },
        "TAB-nerWR09Ju": {
            "children": [],
            "id": "TAB-nerWR09Ju",
            "meta": {
                "defaultText": "Tab title",
                "placeholder": "Tab title",
                "text": "Tab 2",
            },
            "parents": ["ROOT_ID", "GRID_ID", "TABS-IpViLohnyP"],
            "type": "TAB",
        },
        "TABS-IpViLohnyP": {
            "children": ["TAB-j53G4gtKGF", "TAB-nerWR09Ju"],
            "id": "TABS-IpViLohnyP",
            "meta": {},
            "parents": ["ROOT_ID", "GRID_ID"],
            "type": "TABS",
        },
    }
    with app.app_context():
        dash = create_dashboard(
            "tabbed-dash-test", "Tabbed Dash Test", json.dumps(position_json), []
        )
    yield dash
