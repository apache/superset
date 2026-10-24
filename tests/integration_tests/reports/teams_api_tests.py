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
"""Teams destination discovery uses the existing Reports read permission."""

from unittest.mock import patch
from uuid import uuid4

from superset import security_manager
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.test_app import app


class TestTeamsDestinationsApi(SupersetTestCase):
    @with_feature_flags(ALERT_REPORTS=True)
    def test_reports_reader_can_list_destinations(self) -> None:
        """The established Reports read permission grants discovery, without writes."""
        role = security_manager.add_role("teams_destinations_reader")
        permission = security_manager.find_permission_view_menu(
            "can_read", "ReportSchedule"
        )
        security_manager.add_permission_role(role, permission)
        password = uuid4().hex
        user = security_manager.add_user(
            "teams_destinations_reader",
            "Teams",
            "Reader",
            "teams-reader@example.com",
            role,
            password=password,
        )
        try:
            self.login(user.username, password=password)
            with patch(
                "superset.reports.api.list_teams_destinations",
                return_value=[
                    {"key": "ops", "label": "Operations", "available": False},
                ],
            ) as discover:
                response = self.client.get("/api/v1/report/teams_destinations/")
            assert response.status_code == 200
            assert response.json == {
                "result": [
                    {"key": "ops", "label": "Operations", "available": False},
                ]
            }
            discover.assert_called_once_with()
        finally:
            security_manager.delete_user(user)
            security_manager.delete_role(role)

    @with_feature_flags(ALERT_REPORTS=True)
    def test_user_without_reports_read_is_denied(self) -> None:
        """Discovery is not available just because a user has a browser session."""
        role = security_manager.add_role("teams_destinations_denied")
        password = uuid4().hex
        user = security_manager.add_user(
            "teams_destinations_denied",
            "Teams",
            "Denied",
            "teams-denied@example.com",
            role,
            password=password,
        )
        try:
            self.login(user.username, password=password)
            with patch("superset.reports.api.list_teams_destinations") as discover:
                response = self.client.get("/api/v1/report/teams_destinations/")
            assert response.status_code == 403
            discover.assert_not_called()
        finally:
            security_manager.delete_user(user)
            security_manager.delete_role(role)

    @with_feature_flags(ALERT_REPORTS=True)
    def test_anonymous_user_cannot_list_destinations(self) -> None:
        self.logout()
        with patch("superset.reports.api.list_teams_destinations") as discover:
            response = self.client.get("/api/v1/report/teams_destinations/")
        assert response.status_code == 401
        discover.assert_not_called()

    @with_feature_flags(ALERT_REPORTS=False)
    def test_reports_disabled_hides_destination_discovery(self) -> None:
        self.login("admin")
        with patch("superset.reports.api.list_teams_destinations") as discover:
            response = self.client.get("/api/v1/report/teams_destinations/")
        assert response.status_code == 404
        discover.assert_not_called()

    @with_feature_flags(ALERT_REPORTS=True, ALERT_REPORT_TEAMS=True)
    def test_invalid_team_configuration_returns_empty_destinations(self) -> None:
        """The actual Reports endpoint handles parser failures without querying DB."""
        self.login("admin")
        for team_id in ("t" * 256, " team-1", "team-1 ", "\tteam-1\n"):
            with self.subTest(team_id=team_id):
                configuration = {
                    "tenant_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                    "application_id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                    "credential": "test-secret",
                    "destinations": [
                        {
                            "key": "ops",
                            "label": "Operations",
                            "team_id": team_id,
                            "channel_id": "channel-1",
                        }
                    ],
                }
                with (
                    patch.dict(app.config, {"ALERT_REPORTS_TEAMS": configuration}),
                    patch(
                        "superset.integrations.teams.destinations.Session",
                        side_effect=AssertionError("must not query installations"),
                    ) as session,
                ):
                    response = self.client.get("/api/v1/report/teams_destinations/")
                assert response.status_code == 200
                assert response.json == {"result": []}
                session.assert_not_called()
