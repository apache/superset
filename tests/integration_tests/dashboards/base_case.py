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

import prison
from flask import Response

from superset import app, security_manager
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.dashboards.consts import *  # noqa: F403
from tests.integration_tests.dashboards.dashboard_test_utils import (
    build_save_dash_parts,  # noqa: F401
)
from tests.integration_tests.dashboards.superset_factory_util import (
    delete_all_inserted_objects,
)


class DashboardTestCase(SupersetTestCase):
    def get_dashboard_via_api_by_id(self, dashboard_id: int) -> Response:
        uri = DASHBOARD_API_URL_FORMAT.format(dashboard_id)  # noqa: F405
        return self.get_assert_metric(uri, "get")

    def get_dashboard_view_response(self, dashboard_to_access) -> Response:
        return self.client.get(dashboard_to_access.url)

    def get_dashboard_api_response(self, dashboard_to_access) -> Response:
        return self.client.get(DASHBOARD_API_URL_FORMAT.format(dashboard_to_access.id))  # noqa: F405

    def get_dashboards_list_response(self) -> Response:
        return self.client.get(GET_DASHBOARDS_LIST_VIEW)  # noqa: F405

    def get_dashboards_api_response(self) -> Response:
        return self.client.get(DASHBOARDS_API_URL)  # noqa: F405

    def delete_dashboard_via_view(self, dashboard_id: int) -> Response:
        delete_dashboard_url = DELETE_DASHBOARD_VIEW_URL_FORMAT.format(dashboard_id)  # noqa: F405
        return self.get_resp(delete_dashboard_url, {})

    def delete_dashboard_via_api(self, dashboard_id):
        uri = DASHBOARD_API_URL_FORMAT.format(dashboard_id)  # noqa: F405
        return self.delete_assert_metric(uri, "delete")

    def bulk_delete_dashboard_via_api(self, dashboard_ids):
        uri = DASHBOARDS_API_URL_WITH_QUERY_FORMAT.format(prison.dumps(dashboard_ids))  # noqa: F405
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

    def clean_created_objects(self):
        with app.test_request_context():
            delete_all_inserted_objects()
