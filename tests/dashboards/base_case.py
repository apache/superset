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
from typing import Any, Dict, Union

import prison
from flask import Response

from superset import app, security_manager
from tests.base_tests import SupersetTestCase
from tests.dashboards.consts import *
from tests.dashboards.dashboard_test_utils import build_save_dash_parts
from tests.dashboards.superset_factory_util import delete_all_inserted_objects


class DashboardTestCase(SupersetTestCase):
    def get_dashboard_via_api_by_id(self, dashboard_id: int) -> Response:
        uri = DASHBOARD_API_URL_FORMAT.format(dashboard_id)
        return self.get_assert_metric(uri, "get")

    def get_dashboard_view_response(self, dashboard_to_access) -> Response:
        return self.client.get(dashboard_to_access.url)

    def get_dashboard_api_response(self, dashboard_to_access) -> Response:
        return self.client.get(DASHBOARD_API_URL_FORMAT.format(dashboard_to_access.id))

    def get_dashboards_list_response(self) -> Response:
        return self.client.get(GET_DASHBOARDS_LIST_VIEW)

    def get_dashboards_api_response(self) -> Response:
        return self.client.get(DASHBOARDS_API_URL)

    def save_dashboard_via_view(
        self, dashboard_id: Union[str, int], dashboard_data: Dict[str, Any]
    ) -> Response:
        save_dash_url = SAVE_DASHBOARD_URL_FORMAT.format(dashboard_id)
        return self.get_resp(save_dash_url, data=dict(data=json.dumps(dashboard_data)))

    def save_dashboard(
        self, dashboard_id: Union[str, int], dashboard_data: Dict[str, Any]
    ) -> Response:
        return self.save_dashboard_via_view(dashboard_id, dashboard_data)

    def delete_dashboard_via_view(self, dashboard_id: int) -> Response:
        delete_dashboard_url = DELETE_DASHBOARD_VIEW_URL_FORMAT.format(dashboard_id)
        return self.get_resp(delete_dashboard_url, {})

    def delete_dashboard_via_api(self, dashboard_id):
        uri = DASHBOARD_API_URL_FORMAT.format(dashboard_id)
        return self.delete_assert_metric(uri, "delete")

    def bulk_delete_dashboard_via_api(self, dashboard_ids):
        uri = DASHBOARDS_API_URL_WITH_QUERY_FORMAT.format(prison.dumps(dashboard_ids))
        return self.delete_assert_metric(uri, "bulk_delete")

    def delete_dashboard(self, dashboard_id: int) -> Response:
        return self.delete_dashboard_via_view(dashboard_id)

    def assert_permission_was_created(self, dashboard):
        view_menu = security_manager.find_view_menu(dashboard.view_name)
        self.assertIsNotNone(view_menu)
        self.assertEqual(len(security_manager.find_permissions_view_menu(view_menu)), 1)

    def assert_permission_kept_and_changed(self, updated_dashboard, excepted_view_id):
        view_menu_after_title_changed = security_manager.find_view_menu(
            updated_dashboard.view_name
        )
        self.assertIsNotNone(view_menu_after_title_changed)
        self.assertEqual(view_menu_after_title_changed.id, excepted_view_id)

    def assert_permissions_were_deleted(self, deleted_dashboard):
        view_menu = security_manager.find_view_menu(deleted_dashboard.view_name)
        self.assertIsNone(view_menu)

    def save_dash_basic_case(self, username=ADMIN_USERNAME):
        # arrange
        self.login(username=username)
        (
            dashboard_to_save,
            data_before_change,
            data_after_change,
        ) = build_save_dash_parts()

        # act
        save_dash_response = self.save_dashboard_via_view(
            dashboard_to_save.id, data_after_change
        )

        # assert
        self.assertIn("SUCCESS", save_dash_response)

        # post test
        self.save_dashboard(dashboard_to_save.id, data_before_change)

    def clean_created_objects(self):
        with app.test_request_context():
            self.logout()
            self.login("admin")
            delete_all_inserted_objects()
            self.logout()
