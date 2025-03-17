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
# isort:skip_file
"""Unit tests for Superset"""

from datetime import datetime, timedelta
from typing import Optional
from unittest.mock import ANY

from flask_appbuilder.security.sqla.models import User
import prison
from unittest.mock import patch

from superset import db
from superset.models.core import Log
from superset.views.log.api import LogRestApi
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags  # noqa: F401
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.dashboard_utils import create_dashboard
from tests.integration_tests.test_app import app  # noqa: F401

EXPECTED_COLUMNS = [
    "action",
    "dashboard_id",
    "dttm",
    "duration_ms",
    "json",
    "referrer",
    "slice_id",
    "user",
    "user_id",
]


class TestLogApi(SupersetTestCase):
    def insert_log(
        self,
        action: str,
        user: "User",
        dashboard_id: Optional[int] = 0,
        slice_id: Optional[int] = 0,
        json: Optional[str] = "",
        duration_ms: Optional[int] = 0,
    ):
        log = Log(
            action=action,
            user=user,
            dashboard_id=dashboard_id,
            slice_id=slice_id,
            json=json,
            duration_ms=duration_ms,
        )
        db.session.add(log)
        db.session.commit()
        return log

    def test_not_enabled(self):
        with patch.object(LogRestApi, "is_enabled", return_value=False):
            admin_user = self.get_user("admin")
            self.insert_log("some_action", admin_user)
            self.login(ADMIN_USERNAME)
            arguments = {"filters": [{"col": "action", "opr": "sw", "value": "some_"}]}
            uri = f"api/v1/log/?q={prison.dumps(arguments)}"
            rv = self.client.get(uri)
            self.assertEqual(rv.status_code, 404)

    def test_get_list(self):
        """
        Log API: Test get list
        """
        admin_user = self.get_user("admin")
        log = self.insert_log("some_action", admin_user)
        self.login(ADMIN_USERNAME)
        arguments = {"filters": [{"col": "action", "opr": "sw", "value": "some_"}]}
        uri = f"api/v1/log/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(list(response["result"][0].keys()), EXPECTED_COLUMNS)
        self.assertEqual(response["result"][0]["action"], "some_action")
        self.assertEqual(response["result"][0]["user"], {"username": "admin"})
        db.session.delete(log)
        db.session.commit()

    def test_get_list_not_allowed(self):
        """
        Log API: Test get list
        """
        admin_user = self.get_user("admin")
        log = self.insert_log("action", admin_user)
        self.login(GAMMA_USERNAME)
        uri = "api/v1/log/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 403)
        self.login(ALPHA_USERNAME)
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 403)
        db.session.delete(log)
        db.session.commit()

    def test_get_item(self):
        """
        Log API: Test get item
        """
        admin_user = self.get_user("admin")
        log = self.insert_log("some_action", admin_user)
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/log/{log.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))

        self.assertEqual(list(response["result"].keys()), EXPECTED_COLUMNS)
        self.assertEqual(response["result"]["action"], "some_action")
        self.assertEqual(response["result"]["user"], {"username": "admin"})
        db.session.delete(log)
        db.session.commit()

    def test_delete_log(self):
        """
        Log API: Test delete (does not exist)
        """
        admin_user = self.get_user("admin")
        log = self.insert_log("action", admin_user)
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/log/{log.id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 405)
        db.session.delete(log)
        db.session.commit()

    def test_update_log(self):
        """
        Log API: Test update (does not exist)
        """
        admin_user = self.get_user("admin")
        log = self.insert_log("action", admin_user)
        self.login(ADMIN_USERNAME)

        log_data = {"action": "some_action"}
        uri = f"api/v1/log/{log.id}"
        rv = self.client.put(uri, json=log_data)
        self.assertEqual(rv.status_code, 405)
        db.session.delete(log)
        db.session.commit()

    def test_get_recent_activity(self):
        """
        Log API: Test recent activity endpoint
        """
        admin_user = self.get_user("admin")
        self.login(ADMIN_USERNAME)
        dash = create_dashboard("dash_slug", "dash_title", "{}", [])
        log1 = self.insert_log(
            "log",
            admin_user,
            dashboard_id=dash.id,
            json='{"event_name": "mount_dashboard"}',
        )
        log2 = self.insert_log(
            "log",
            admin_user,
            dashboard_id=dash.id,
            json='{"event_name": "mount_dashboard"}',
        )

        uri = f"api/v1/log/recent_activity/"  # noqa: F541
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))

        db.session.delete(log1)
        db.session.delete(log2)
        db.session.delete(dash)
        db.session.commit()

        assert response == {
            "result": [
                {
                    "action": "log",
                    "item_type": "dashboard",
                    "item_url": "/superset/dashboard/dash_slug/",
                    "item_title": "dash_title",
                    "time": ANY,
                    "time_delta_humanized": ANY,
                }
            ]
        }

    def test_get_recent_activity_actions_filter(self):
        """
        Log API: Test recent activity actions argument
        """
        admin_user = self.get_user("admin")
        self.login(ADMIN_USERNAME)
        dash = create_dashboard("dash_slug", "dash_title", "{}", [])
        log = self.insert_log(
            "log",
            admin_user,
            dashboard_id=dash.id,
            json='{"event_name": "mount_dashboard"}',
        )
        log2 = self.insert_log(
            "log",
            admin_user,
            dashboard_id=dash.id,
            json='{"event_name": "mount_explorer"}',
        )

        arguments = {"actions": ["mount_dashboard"]}
        uri = f"api/v1/log/recent_activity/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)

        db.session.delete(log)
        db.session.delete(log2)
        db.session.delete(dash)
        db.session.commit()

        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(len(response["result"]), 1)

    def test_get_recent_activity_distinct_false(self):
        """
        Log API: Test recent activity when distinct is false
        """
        db.session.query(Log).delete(synchronize_session=False)
        db.session.commit()
        admin_user = self.get_user("admin")
        self.login(ADMIN_USERNAME)
        dash = create_dashboard("dash_slug", "dash_title", "{}", [])
        log = self.insert_log(
            "log",
            admin_user,
            dashboard_id=dash.id,
            json='{"event_name": "mount_dashboard"}',
        )
        log2 = self.insert_log(
            "log",
            admin_user,
            dashboard_id=dash.id,
            json='{"event_name": "mount_dashboard"}',
        )

        arguments = {"distinct": False}
        uri = f"api/v1/log/recent_activity/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)

        db.session.delete(log)
        db.session.delete(log2)
        db.session.delete(dash)
        db.session.commit()
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(len(response["result"]), 2)

    def test_get_recent_activity_pagination(self):
        """
        Log API: Test recent activity pagination arguments
        """
        admin_user = self.get_user("admin")
        self.login(ADMIN_USERNAME)
        dash = create_dashboard("dash_slug", "dash_title", "{}", [])
        dash2 = create_dashboard("dash2_slug", "dash2_title", "{}", [])
        dash3 = create_dashboard("dash3_slug", "dash3_title", "{}", [])
        log = self.insert_log(
            "log",
            admin_user,
            dashboard_id=dash.id,
            json='{"event_name": "mount_dashboard"}',
        )
        log2 = self.insert_log(
            "log",
            admin_user,
            dashboard_id=dash2.id,
            json='{"event_name": "mount_dashboard"}',
        )
        log3 = self.insert_log(
            "log",
            admin_user,
            dashboard_id=dash3.id,
            json='{"event_name": "mount_dashboard"}',
        )

        now = datetime.now()
        log3.dttm = now
        log2.dttm = now - timedelta(days=1)
        log.dttm = now - timedelta(days=2)

        arguments = {"page": 0, "page_size": 2}
        uri = f"api/v1/log/recent_activity/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)

        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        assert response == {
            "result": [
                {
                    "action": "log",
                    "item_type": "dashboard",
                    "item_url": "/superset/dashboard/dash3_slug/",
                    "item_title": "dash3_title",
                    "time": ANY,
                    "time_delta_humanized": ANY,
                },
                {
                    "action": "log",
                    "item_type": "dashboard",
                    "item_url": "/superset/dashboard/dash2_slug/",
                    "item_title": "dash2_title",
                    "time": ANY,
                    "time_delta_humanized": ANY,
                },
            ]
        }

        arguments = {"page": 1, "page_size": 2}
        uri = f"api/v1/log/recent_activity/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)

        db.session.delete(log)
        db.session.delete(log2)
        db.session.delete(log3)
        db.session.delete(dash)
        db.session.delete(dash2)
        db.session.delete(dash3)
        db.session.commit()

        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        assert response == {
            "result": [
                {
                    "action": "log",
                    "item_type": "dashboard",
                    "item_url": "/superset/dashboard/dash_slug/",
                    "item_title": "dash_title",
                    "time": ANY,
                    "time_delta_humanized": ANY,
                }
            ]
        }
