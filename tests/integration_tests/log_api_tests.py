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
import json
from typing import Optional

import prison
from flask_appbuilder.security.sqla.models import User
from unittest.mock import patch

from superset import db
from superset.models.core import Log
from superset.views.log.api import LogRestApi

from .base_tests import SupersetTestCase


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
            self.login(username="admin")
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
        self.login(username="admin")
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
        self.login(username="gamma")
        uri = "api/v1/log/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 403)
        self.login(username="alpha")
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 403)

    def test_get_item(self):
        """
            Log API: Test get item
        """
        admin_user = self.get_user("admin")
        log = self.insert_log("some_action", admin_user)
        self.login(username="admin")
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
        self.login(username="admin")
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
        self.login(username="admin")

        log_data = {"action": "some_action"}
        uri = f"api/v1/log/{log.id}"
        rv = self.client.put(uri, json=log_data)
        self.assertEqual(rv.status_code, 405)
        db.session.delete(log)
        db.session.commit()
