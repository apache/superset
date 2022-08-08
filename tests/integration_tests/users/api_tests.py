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
#  type: ignore
"""Unit tests for Superset"""
import json
from unittest.mock import patch

from superset import security_manager
from tests.integration_tests.base_tests import SupersetTestCase

meUri = "/api/v1/me/"


class TestCurrentUserApi(SupersetTestCase):
    def test_get_me_logged_in(self):
        self.login(username="admin")

        rv = self.client.get(meUri)

        self.assertEqual(200, rv.status_code)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual("admin", response["result"]["username"])
        self.assertEqual(True, response["result"]["is_active"])
        self.assertEqual(False, response["result"]["is_anonymous"])

    def test_get_me_unauthorized(self):
        self.logout()
        rv = self.client.get(meUri)
        self.assertEqual(401, rv.status_code)

    @patch("superset.security.manager.g")
    def test_get_me_anonymous(self, mock_g):
        mock_g.user = security_manager.get_anonymous_user
        rv = self.client.get(meUri)
        self.assertEqual(401, rv.status_code)
