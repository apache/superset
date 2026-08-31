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
"""Tests that emoji characters in position_json are persisted correctly via PUT."""

from superset import db
from superset.models.dashboard import Dashboard
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME

# position_json payload containing a 4-byte emoji in a MARKDOWN component,
# matching the real-world payload that triggered the truncation bug
POSITION_JSON_WITH_EMOJI = json.dumps(
    {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"type": "ROOT", "id": "ROOT_ID", "children": ["GRID_ID"]},
        "GRID_ID": {
            "type": "GRID",
            "id": "GRID_ID",
            "children": ["ROW-test"],
            "parents": ["ROOT_ID"],
        },
        "ROW-test": {
            "type": "ROW",
            "id": "ROW-test",
            "children": ["MARKDOWN-test"],
            "parents": ["ROOT_ID", "GRID_ID"],
            "meta": {"background": "BACKGROUND_TRANSPARENT"},
        },
        "MARKDOWN-test": {
            "type": "MARKDOWN",
            "id": "MARKDOWN-test",
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", "ROW-test"],
            "meta": {"code": "📈 See Tab\n\ntest\ntest2", "height": 50, "width": 4},
        },
    },
)


class TestDashboardUpdateEmoji(SupersetTestCase):
    """Verify that emoji in position_json survive a dashboard PUT round-trip."""

    def setUp(self) -> None:
        super().setUp()
        admin = self.get_user("admin")
        self.dashboard = self.insert_dashboard(
            "emoji test dashboard", "emoji-test-slug", [admin.id]
        )

    def tearDown(self) -> None:
        db.session.delete(self.dashboard)
        db.session.commit()
        super().tearDown()

    def test_position_json_emoji_survives_put(self) -> None:
        """Emoji in position_json must be stored and retrievable after PUT."""
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/dashboard/{self.dashboard.id}"

        rv = self.client.put(
            uri,
            json={"position_json": POSITION_JSON_WITH_EMOJI},
        )

        assert rv.status_code == 200, rv.json

        db.session.expire(self.dashboard)
        saved = db.session.get(Dashboard, self.dashboard.id)
        assert saved is not None

        parsed = json.loads(saved.position_json)
        code = parsed["MARKDOWN-test"]["meta"]["code"]

        # The emoji and the text after it must not be truncated
        assert code == "📈 See Tab\n\ntest\ntest2"

    def test_position_json_emoji_is_ascii_safe_in_db(self) -> None:
        """position_json stored in DB must be ASCII-safe (emoji escaped as \\uXXXX)
        so it is safe for MySQL utf8 (3-byte) charset columns."""
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/dashboard/{self.dashboard.id}"

        rv = self.client.put(
            uri,
            json={"position_json": POSITION_JSON_WITH_EMOJI},
        )

        assert rv.status_code == 200, rv.json

        db.session.expire(self.dashboard)
        saved = db.session.get(Dashboard, self.dashboard.id)
        assert saved is not None

        # Raw 4-byte emoji must not appear in the stored string
        assert "📈" not in saved.position_json
        assert all(ord(c) < 128 for c in saved.position_json)
