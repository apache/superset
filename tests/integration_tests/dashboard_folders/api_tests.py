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
"""Dashboard folder REST API integration tests."""

from uuid import uuid4

import tests.integration_tests.test_app  # noqa: F401
from superset import db
from superset.models.dashboard import Dashboard
from superset.models.dashboard_folder import DashboardFolder
from superset.utils import json
from tests.integration_tests.base_tests import subjects_from_users, SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME


class TestDashboardFolderApi(SupersetTestCase):
    """Verify dashboard folder API workflows and error responses."""

    def test_folder_crud_and_dashboard_move(self) -> None:
        admin = self.get_user(ADMIN_USERNAME)
        dashboard = Dashboard(
            dashboard_title="Dashboard folder API test",
            editors=subjects_from_users([admin]),
            created_by=admin,
            changed_by=admin,
        )
        db.session.add(dashboard)
        db.session.commit()
        self.login(ADMIN_USERNAME)

        try:
            root_response = self.post_assert_metric(
                "api/v1/dashboard_folder/",
                {"name": " Finance "},
                "post",
            )
            assert root_response.status_code == 201
            root_id = json.loads(root_response.data)["id"]

            child_response = self.post_assert_metric(
                "api/v1/dashboard_folder/",
                {"name": "Operations", "parent_id": root_id},
                "post",
            )
            assert child_response.status_code == 201
            child_id = json.loads(child_response.data)["id"]

            list_response = self.get_assert_metric(
                "api/v1/dashboard_folder/", "get_list"
            )
            assert list_response.status_code == 200
            folders = {
                item["id"]: item for item in json.loads(list_response.data)["result"]
            }
            assert folders[root_id]["name"] == "Finance"
            assert folders[child_id]["parent_id"] == root_id

            update_response = self.put_assert_metric(
                f"api/v1/dashboard_folder/{child_id}",
                {"name": "Operations 2026"},
                "put",
            )
            assert update_response.status_code == 200

            move_response = self.put_assert_metric(
                f"api/v1/dashboard_folder/dashboard/{dashboard.id}",
                {"folder_id": child_id},
                "move_dashboard",
            )
            assert move_response.status_code == 200
            db.session.refresh(dashboard)
            assert str(dashboard.folder_id) == child_id

            delete_response = self.delete_assert_metric(
                f"api/v1/dashboard_folder/{root_id}", "delete"
            )
            assert delete_response.status_code == 200
            db.session.refresh(dashboard)
            assert dashboard.folder_id is None
            assert db.session.get(DashboardFolder, root_id) is None
            assert db.session.get(DashboardFolder, child_id) is None
        finally:
            db.session.query(DashboardFolder).filter(
                DashboardFolder.name.in_(["Finance", "Operations", "Operations 2026"])
            ).delete(synchronize_session=False)
            db.session.delete(dashboard)
            db.session.commit()

    def test_folder_api_validation_errors(self) -> None:
        self.login(ADMIN_USERNAME)
        missing_id = uuid4()

        invalid_post = self.post_assert_metric("api/v1/dashboard_folder/", {}, "post")
        assert invalid_post.status_code == 400

        invalid_parent = self.post_assert_metric(
            "api/v1/dashboard_folder/",
            {"name": "Missing parent", "parent_id": str(missing_id)},
            "post",
        )
        assert invalid_parent.status_code == 422

        missing_update = self.put_assert_metric(
            f"api/v1/dashboard_folder/{missing_id}",
            {"name": "Missing"},
            "put",
        )
        assert missing_update.status_code == 404

        missing_delete = self.delete_assert_metric(
            f"api/v1/dashboard_folder/{missing_id}", "delete"
        )
        assert missing_delete.status_code == 404

        missing_dashboard = self.put_assert_metric(
            "api/v1/dashboard_folder/dashboard/2147483647",
            {"folder_id": None},
            "move_dashboard",
        )
        assert missing_dashboard.status_code == 404
