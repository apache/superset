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
from datetime import datetime, timedelta

from flask_appbuilder.security.sqla.models import User

from superset import db
from superset.models.core import Log
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import ADMIN_USERNAME


class TestDashboardActivityApi(SupersetTestCase):
    def insert_log(
        self,
        *,
        action: str,
        user: User,
        dashboard_id: int | None = None,
        dttm: datetime | None = None,
        payload: str | None = None,
    ) -> Log:
        log = Log(
            action=action,
            user=user,
            dashboard_id=dashboard_id,
            json=payload or '{"slice_name": "Sales by Country", "viz_type": "line"}',
            dttm=dttm or datetime.utcnow(),
        )
        db.session.add(log)
        db.session.commit()
        return log

    @with_feature_flags(DASHBOARD_ACTIVITY_FEED=False)
    def test_activity_requires_feature_flag(self) -> None:
        self.login(ADMIN_USERNAME)
        admin_user = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "activity-flag",
            "activity-flag",
            [admin_user.id],
        )

        response = self.client.get(f"/api/v1/dashboard/{dashboard.id}/activity/")
        assert response.status_code == 404

        db.session.delete(dashboard)
        db.session.commit()

    @with_feature_flags(DASHBOARD_ACTIVITY_FEED=True)
    def test_get_activity(self) -> None:
        self.login(ADMIN_USERNAME)
        admin_user = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "activity-main",
            "activity-main",
            [admin_user.id],
        )

        view_log = self.insert_log(
            action="dashboard",
            user=admin_user,
            dashboard_id=dashboard.id,
        )
        chart_log = self.insert_log(
            action="explore_json",
            user=admin_user,
            dashboard_id=dashboard.id,
            dttm=datetime.utcnow() - timedelta(minutes=2),
        )

        response = self.get_assert_metric(
            f"/api/v1/dashboard/{dashboard.id}/activity/"
            "?action_type=view&page=0&page_size=10&days=30",
            "activity",
        )
        assert response.status_code == 200
        payload = json.loads(response.data.decode("utf-8"))["result"]
        assert payload["count"] == 1
        assert payload["activities"][0]["id"] == view_log.id
        assert payload["activities"][0]["action_category"] == "view"

        db.session.delete(view_log)
        db.session.delete(chart_log)
        db.session.delete(dashboard)
        db.session.commit()

    @with_feature_flags(DASHBOARD_ACTIVITY_FEED=True)
    def test_get_activity_normalizes_log_event_name(self) -> None:
        self.login(ADMIN_USERNAME)
        admin_user = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "activity-normalization",
            "activity-normalization",
            [admin_user.id],
        )

        log_event = self.insert_log(
            action="log",
            user=admin_user,
            dashboard_id=dashboard.id,
            payload='{"event_name": "mount_dashboard"}',
        )

        response = self.get_assert_metric(
            f"/api/v1/dashboard/{dashboard.id}/activity/?action_type=view&page=0&page_size=10&days=30",
            "activity",
        )
        assert response.status_code == 200
        activity = json.loads(response.data.decode("utf-8"))["result"]["activities"][0]
        assert activity["id"] == log_event.id
        assert activity["action"] == "mount_dashboard"
        assert activity["action_display"] == "Viewed dashboard"

        db.session.delete(log_event)
        db.session.delete(dashboard)
        db.session.commit()

    @with_feature_flags(DASHBOARD_ACTIVITY_FEED=True)
    def test_get_activity_empty(self) -> None:
        self.login(ADMIN_USERNAME)
        admin_user = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "activity-empty",
            "activity-empty",
            [admin_user.id],
        )

        response = self.get_assert_metric(
            f"/api/v1/dashboard/{dashboard.id}/activity/"
            "?action_type=all&page=0&page_size=10&days=30",
            "activity",
        )
        assert response.status_code == 200
        payload = json.loads(response.data.decode("utf-8"))["result"]
        assert payload["count"] == 0
        assert payload["activities"] == []

        db.session.delete(dashboard)
        db.session.commit()

    @with_feature_flags(DASHBOARD_ACTIVITY_FEED=True)
    def test_get_activity_pagination(self) -> None:
        self.login(ADMIN_USERNAME)
        admin_user = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "activity-pagination",
            "activity-pagination",
            [admin_user.id],
        )

        first_log = self.insert_log(
            action="dashboard",
            user=admin_user,
            dashboard_id=dashboard.id,
            dttm=datetime.utcnow() - timedelta(minutes=12),
        )
        second_log = self.insert_log(
            action="dashboard",
            user=admin_user,
            dashboard_id=dashboard.id,
            dttm=datetime.utcnow() - timedelta(minutes=1),
        )

        response_page_0 = self.get_assert_metric(
            f"/api/v1/dashboard/{dashboard.id}/activity/"
            "?action_type=view&page=0&page_size=1&days=30",
            "activity",
        )
        assert response_page_0.status_code == 200
        payload_page_0 = json.loads(response_page_0.data.decode("utf-8"))["result"]
        assert payload_page_0["count"] == 2
        assert payload_page_0["activities"][0]["id"] == second_log.id

        response_page_1 = self.get_assert_metric(
            f"/api/v1/dashboard/{dashboard.id}/activity/"
            "?action_type=view&page=1&page_size=1&days=30",
            "activity",
        )
        assert response_page_1.status_code == 200
        payload_page_1 = json.loads(response_page_1.data.decode("utf-8"))["result"]
        assert payload_page_1["count"] == 2
        assert payload_page_1["activities"][0]["id"] == first_log.id

        db.session.delete(first_log)
        db.session.delete(second_log)
        db.session.delete(dashboard)
        db.session.commit()

    @with_feature_flags(DASHBOARD_ACTIVITY_FEED=True)
    def test_get_activity_coalesces_bursts(self) -> None:
        self.login(ADMIN_USERNAME)
        admin_user = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "activity-coalesce",
            "activity-coalesce",
            [admin_user.id],
        )

        first_log = self.insert_log(
            action="dashboard",
            user=admin_user,
            dashboard_id=dashboard.id,
            dttm=datetime.utcnow() - timedelta(minutes=3),
        )
        second_log = self.insert_log(
            action="dashboard",
            user=admin_user,
            dashboard_id=dashboard.id,
            dttm=datetime.utcnow() - timedelta(minutes=2),
        )

        response = self.get_assert_metric(
            f"/api/v1/dashboard/{dashboard.id}/activity/?action_type=view&page=0&page_size=10&days=30",
            "activity",
        )
        assert response.status_code == 200
        payload = json.loads(response.data.decode("utf-8"))["result"]
        assert payload["count"] == 1
        assert payload["activities"][0]["event_count"] == 2
        assert payload["activities"][0]["id"] == second_log.id

        db.session.delete(first_log)
        db.session.delete(second_log)
        db.session.delete(dashboard)
        db.session.commit()

    @with_feature_flags(DASHBOARD_ACTIVITY_FEED=True)
    def test_get_activity_filters_chart_pipeline_in_chart_interaction(self) -> None:
        self.login(ADMIN_USERNAME)
        admin_user = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "activity-chart-filter",
            "activity-chart-filter",
            [admin_user.id],
        )

        chart_log = self.insert_log(
            action="load_chart",
            user=admin_user,
            dashboard_id=dashboard.id,
        )
        view_log = self.insert_log(
            action="dashboard",
            user=admin_user,
            dashboard_id=dashboard.id,
            dttm=datetime.utcnow() - timedelta(minutes=1),
        )

        response_view = self.get_assert_metric(
            f"/api/v1/dashboard/{dashboard.id}/activity/?action_type=view&page=0&page_size=10&days=30",
            "activity",
        )
        assert response_view.status_code == 200
        payload_view = json.loads(response_view.data.decode("utf-8"))["result"]
        assert payload_view["count"] == 1
        assert payload_view["activities"][0]["id"] == view_log.id

        response_chart = self.get_assert_metric(
            f"/api/v1/dashboard/{dashboard.id}/activity/?action_type=chart_interaction&page=0&page_size=10&days=30",
            "activity",
        )
        assert response_chart.status_code == 200
        payload_chart = json.loads(response_chart.data.decode("utf-8"))["result"]
        assert payload_chart["count"] == 1
        assert payload_chart["activities"][0]["id"] == chart_log.id
        assert payload_chart["activities"][0]["action_category"] == "chart_interaction"

        db.session.delete(chart_log)
        db.session.delete(view_log)
        db.session.delete(dashboard)
        db.session.commit()

    @with_feature_flags(DASHBOARD_ACTIVITY_FEED=True)
    def test_get_activity_filters_by_days(self) -> None:
        self.login(ADMIN_USERNAME)
        admin_user = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "activity-days-filter",
            "activity-days-filter",
            [admin_user.id],
        )

        recent_log = self.insert_log(
            action="dashboard",
            user=admin_user,
            dashboard_id=dashboard.id,
            dttm=datetime.utcnow() - timedelta(days=2),
        )
        old_log = self.insert_log(
            action="dashboard",
            user=admin_user,
            dashboard_id=dashboard.id,
            dttm=datetime.utcnow() - timedelta(days=10),
        )

        response = self.get_assert_metric(
            f"/api/v1/dashboard/{dashboard.id}/activity/?action_type=view&page=0&page_size=10&days=7",
            "activity",
        )
        assert response.status_code == 200
        payload = json.loads(response.data.decode("utf-8"))["result"]
        assert payload["count"] == 1
        assert payload["activities"][0]["id"] == recent_log.id

        db.session.delete(recent_log)
        db.session.delete(old_log)
        db.session.delete(dashboard)
        db.session.commit()

    @with_feature_flags(DASHBOARD_ACTIVITY_FEED=True)
    def test_get_activity_includes_export_rows_without_dashboard_id(self) -> None:
        self.login(ADMIN_USERNAME)
        admin_user = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "activity-export",
            "activity-export",
            [admin_user.id],
        )

        dashboard_export = self.insert_log(
            action="DashboardRestApi.export",
            user=admin_user,
            dashboard_id=None,
            payload=f'{{"path": "/api/v1/dashboard/export/", "q": "!({dashboard.id})", "rison": [{dashboard.id}]}}',  # noqa: E501
            dttm=datetime.utcnow(),
        )
        chart_export = self.insert_log(
            action="log",
            user=admin_user,
            dashboard_id=dashboard.id,
            payload='{"event_name": "export_csv_dashboard_chart"}',
            dttm=datetime.utcnow() - timedelta(minutes=1),
        )

        response = self.get_assert_metric(
            f"/api/v1/dashboard/{dashboard.id}/activity/?action_type=export&page=0&page_size=10&days=30",
            "activity",
        )
        assert response.status_code == 200
        payload = json.loads(response.data.decode("utf-8"))["result"]
        assert payload["count"] == 2
        assert payload["activities"][0]["id"] == dashboard_export.id
        assert payload["activities"][0]["action_category"] == "export"
        assert payload["activities"][1]["id"] == chart_export.id
        assert payload["activities"][1]["action"] == "export_csv_dashboard_chart"
        assert payload["activities"][1]["action_category"] == "export"

        db.session.delete(dashboard_export)
        db.session.delete(chart_export)
        db.session.delete(dashboard)
        db.session.commit()

    @with_feature_flags(DASHBOARD_ACTIVITY_FEED=True)
    def test_get_activity_summary(self) -> None:
        self.login(ADMIN_USERNAME)
        admin_user = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "activity-summary",
            "activity-summary",
            [admin_user.id],
        )

        view_log_1 = self.insert_log(
            action="dashboard",
            user=admin_user,
            dashboard_id=dashboard.id,
        )
        view_log_2 = self.insert_log(
            action="DashboardRestApi.get",
            user=admin_user,
            dashboard_id=dashboard.id,
        )
        edit_log = self.insert_log(
            action="DashboardRestApi.put",
            user=admin_user,
            dashboard_id=dashboard.id,
        )

        response = self.get_assert_metric(
            f"/api/v1/dashboard/{dashboard.id}/activity/summary/?days=30",
            "activity_summary",
        )
        assert response.status_code == 200
        summary = json.loads(response.data.decode("utf-8"))["result"]
        assert summary["total_views"] == 2
        assert summary["unique_viewers"] == 1
        assert ADMIN_USERNAME in summary["recent_editors"]
        assert summary["period_days"] == 30

        db.session.delete(view_log_1)
        db.session.delete(view_log_2)
        db.session.delete(edit_log)
        db.session.delete(dashboard)
        db.session.commit()
