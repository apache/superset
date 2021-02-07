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
import prison
from tests.base_tests import SupersetTestCase


class TestRolesApi(SupersetTestCase):

    def test_get_list_roles(self):
        """
        Roles Api: Test get list roles
        """
        self.login(username="admin")
        uri = f"api/v1/role/"
        rv = self.get_assert_metric(uri, "get_list")

        expected_fields = [
            "id",
            "name",
        ]
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] > 6  # the out of the box roles
        data_keys = sorted(list(data["result"][0].keys()))
        assert expected_fields == data_keys

    def test_get_list_role_filter_name(self):
        """
        ReportSchedule Api: Test filter name on get list roles
        """
        self.login(username="admin")
        # Test normal contains filter
        arguments = {
            "columns": ["name"],
            "filters": [{"col": "name", "opr": "by_name", "value": "alpha"}],
        }
        uri = f"api/v1/role/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")

        expected_result = {
            "name": "Alpha",
        }
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 1
        assert data["result"][0] == expected_result

