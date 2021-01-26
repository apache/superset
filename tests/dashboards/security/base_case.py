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
from typing import List, Optional

from flask import Response

from superset import app
from superset.models.dashboard import Dashboard
from tests.base_tests import SupersetTestCase
from tests.dashboards.consts import DASHBOARDS_API_URL, GET_DASHBOARDS_LIST_VIEW
from tests.dashboards.superset_factory_util import delete_all_inserted_objects

DASHBOARD_COUNT_IN_DASHBOARDS_LIST_VIEW_FORMAT = "Record Count:</strong> {count}"


class BaseTestDashboardSecurity(SupersetTestCase):
    def tearDown(self) -> None:
        self.clean_created_objects()

    def assert_dashboards_list_view_response(
        self,
        response: Response,
        expected_counts: int,
        expected_dashboards: Optional[List[Dashboard]] = None,
        not_expected_dashboards: Optional[List[Dashboard]] = None,
    ) -> None:
        self.assert200(response)
        response_html = response.data.decode("utf-8")
        if expected_counts == 0:
            assert "No records found" in response_html
        else:
            assert (
                DASHBOARD_COUNT_IN_DASHBOARDS_LIST_VIEW_FORMAT.format(
                    count=str(expected_counts)
                )
                in response_html
            )
        expected_dashboards = expected_dashboards or []
        for dashboard in expected_dashboards:
            assert dashboard.url in response_html
        not_expected_dashboards = not_expected_dashboards or []
        for dashboard in not_expected_dashboards:
            assert dashboard.url not in response_html

    def assert_dashboards_api_response(
        self,
        response: Response,
        expected_counts: int,
        expected_dashboards: Optional[List[Dashboard]] = None,
        not_expected_dashboards: Optional[List[Dashboard]] = None,
    ) -> None:
        self.assert200(response)
        response_data = response.json
        self.assertEqual(response_data["count"], expected_counts)
        response_dashboards_url = set(
            map(lambda dash: dash["url"], response_data["result"])
        )
        expected_dashboards = expected_dashboards or []
        for dashboard in expected_dashboards:
            self.assertIn(dashboard.url, response_dashboards_url)
        not_expected_dashboards = not_expected_dashboards or []
        for dashboard in not_expected_dashboards:
            self.assertNotIn(dashboard.url, response_dashboards_url)

    def get_dashboards_list_response(self) -> Response:
        return self.client.get(GET_DASHBOARDS_LIST_VIEW)

    def get_dashboards_api_response(self) -> Response:
        return self.client.get(DASHBOARDS_API_URL)

    def clean_created_objects(self):
        with app.test_request_context():
            self.logout()
            self.login("admin")
            delete_all_inserted_objects()
            self.logout()
