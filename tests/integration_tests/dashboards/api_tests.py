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
from io import BytesIO
from time import sleep
from unittest.mock import ANY, patch
from zipfile import is_zipfile, ZipFile

from tests.integration_tests.insert_chart_mixin import InsertChartMixin

import pytest
import prison
import yaml

from freezegun import freeze_time
from sqlalchemy import and_
from superset import app, db, security_manager
from superset.models.dashboard import Dashboard
from superset.models.core import FavStar, FavStarClassName
from superset.reports.models import ReportSchedule, ReportScheduleType
from superset.models.slice import Slice
from superset.utils.core import backend, override_user
from superset.views.base import generate_download_headers

from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.base_api_tests import ApiOwnersTestCaseMixin
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.importexport import (
    chart_config,
    database_config,
    dashboard_config,
    dashboard_export,
    dashboard_metadata_config,
    dataset_config,
    dataset_metadata_config,
)
from tests.integration_tests.utils.get_dashboards import get_dashboards_ids
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)

DASHBOARDS_FIXTURE_COUNT = 10


class TestDashboardApi(ApiOwnersTestCaseMixin, InsertChartMixin, SupersetTestCase):
    resource_name = "dashboard"

    dashboards: list[Dashboard] = []
    dashboard_data = {
        "dashboard_title": "title1_changed",
        "slug": "slug1_changed",
        "position_json": '{"b": "B"}',
        "css": "css_changed",
        "json_metadata": '{"refresh_frequency": 30, "timed_refresh_immune_slices": [], "expanded_slices": {}, "color_scheme": "", "label_colors": {}, "shared_label_colors": {}, "color_scheme_domain": [], "cross_filters_enabled": false}',
        "published": False,
    }

    @pytest.fixture()
    def create_dashboards(self):
        with self.create_app().app_context():
            dashboards = []
            admin = self.get_user("admin")
            charts = []
            half_dash_count = round(DASHBOARDS_FIXTURE_COUNT / 2)
            for cx in range(DASHBOARDS_FIXTURE_COUNT):
                dashboard = self.insert_dashboard(
                    f"title{cx}",
                    f"slug{cx}",
                    [admin.id],
                    slices=charts if cx < half_dash_count else [],
                    certified_by="John Doe",
                    certification_details="Sample certification",
                )
                if cx < half_dash_count:
                    chart = self.insert_chart(f"slice{cx}", [admin.id], 1, params="{}")
                    charts.append(chart)
                    dashboard.slices = [chart]
                    db.session.add(dashboard)
                dashboards.append(dashboard)
            fav_dashboards = []
            for cx in range(half_dash_count):
                fav_star = FavStar(
                    user_id=admin.id, class_name="Dashboard", obj_id=dashboards[cx].id
                )
                db.session.add(fav_star)
                db.session.commit()
                fav_dashboards.append(fav_star)
            self.dashboards = dashboards
            yield dashboards

            # rollback changes
            for chart in charts:
                db.session.delete(chart)
            for dashboard in dashboards:
                db.session.delete(dashboard)
            for fav_dashboard in fav_dashboards:
                db.session.delete(fav_dashboard)
            db.session.commit()

    @pytest.fixture()
    def create_created_by_gamma_dashboards(self):
        with self.create_app().app_context():
            dashboards = []
            gamma = self.get_user("gamma")
            for cx in range(2):
                dashboard = self.insert_dashboard(
                    f"create_title{cx}",
                    f"create_slug{cx}",
                    [gamma.id],
                    created_by=gamma,
                )
                sleep(1)
                dashboards.append(dashboard)

            yield dashboards

            for dashboard in dashboards:
                db.session.delete(dashboard)
            db.session.commit()

    @pytest.fixture()
    def create_dashboard_with_report(self):
        with self.create_app().app_context():
            admin = self.get_user("admin")
            dashboard = self.insert_dashboard(
                f"dashboard_report", "dashboard_report", [admin.id]
            )
            report_schedule = ReportSchedule(
                type=ReportScheduleType.REPORT,
                name="report_with_dashboard",
                crontab="* * * * *",
                dashboard=dashboard,
            )
            db.session.commit()

            yield dashboard

            # rollback changes
            db.session.delete(report_schedule)
            db.session.delete(dashboard)
            db.session.commit()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_get_dashboard_datasets(self):
        self.login(username="admin")
        uri = "api/v1/dashboard/world_health/datasets"
        response = self.get_assert_metric(uri, "get_datasets")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data.decode("utf-8"))
        dashboard = Dashboard.get("world_health")
        expected_dataset_ids = {s.datasource_id for s in dashboard.slices}
        result = data["result"]
        actual_dataset_ids = {dataset["id"] for dataset in result}
        self.assertEqual(actual_dataset_ids, expected_dataset_ids)
        expected_values = [0, 1] if backend() == "presto" else [0, 1, 2]
        self.assertEqual(result[0]["column_types"], expected_values)

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    @patch("superset.dashboards.schemas.security_manager.has_guest_access")
    @patch("superset.dashboards.schemas.security_manager.is_guest_user")
    def test_get_dashboard_datasets_as_guest(self, is_guest_user, has_guest_access):
        self.login(username="admin")
        uri = "api/v1/dashboard/world_health/datasets"
        is_guest_user = True
        has_guest_access = True
        response = self.get_assert_metric(uri, "get_datasets")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data.decode("utf-8"))
        dashboard = Dashboard.get("world_health")
        expected_dataset_ids = {s.datasource_id for s in dashboard.slices}
        result = data["result"]
        actual_dataset_ids = {dataset["id"] for dataset in result}
        self.assertEqual(actual_dataset_ids, expected_dataset_ids)
        for dataset in result:
            for excluded_key in ["database", "owners"]:
                assert excluded_key not in dataset

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_get_dashboard_datasets_not_found(self):
        self.login(username="alpha")
        uri = "api/v1/dashboard/not_found/datasets"
        response = self.get_assert_metric(uri, "get_datasets")
        self.assertEqual(response.status_code, 404)

    @pytest.mark.usefixtures("create_dashboards")
    def test_get_gamma_dashboard_datasets(self):
        """
        Check that a gamma user with data access can access dashboard/datasets
        """
        from superset.connectors.sqla.models import SqlaTable

        # Set correct role permissions
        gamma_role = security_manager.find_role("Gamma")
        fixture_dataset = db.session.query(SqlaTable).get(1)
        data_access_pvm = security_manager.add_permission_view_menu(
            "datasource_access", fixture_dataset.perm
        )
        gamma_role.permissions.append(data_access_pvm)
        db.session.commit()

        self.login(username="gamma")
        dashboard = self.dashboards[0]
        dashboard.published = True
        db.session.commit()

        uri = f"api/v1/dashboard/{dashboard.id}/datasets"
        response = self.get_assert_metric(uri, "get_datasets")
        assert response.status_code == 200

        # rollback permission change
        data_access_pvm = security_manager.find_permission_view_menu(
            "datasource_access", fixture_dataset.perm
        )
        security_manager.del_permission_role(gamma_role, data_access_pvm)

    @pytest.mark.usefixtures("create_dashboards")
    def get_dashboard_by_slug(self):
        self.login(username="admin")
        dashboard = self.dashboards[0]
        uri = f"api/v1/dashboard/{dashboard.slug}"
        response = self.get_assert_metric(uri, "get")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data.decode("utf-8"))
        self.assertEqual(data["id"], dashboard.id)

    @pytest.mark.usefixtures("create_dashboards")
    def get_dashboard_by_bad_slug(self):
        self.login(username="admin")
        dashboard = self.dashboards[0]
        uri = f"api/v1/dashboard/{dashboard.slug}-bad-slug"
        response = self.get_assert_metric(uri, "get")
        self.assertEqual(response.status_code, 404)

    @pytest.mark.usefixtures("create_dashboards")
    def get_draft_dashboard_by_slug(self):
        """
        All users should have access to dashboards without roles
        """
        self.login(username="gamma")
        dashboard = self.dashboards[0]
        uri = f"api/v1/dashboard/{dashboard.slug}"
        response = self.get_assert_metric(uri, "get")
        self.assertEqual(response.status_code, 200)

    @pytest.mark.usefixtures("create_dashboards")
    def test_get_dashboard_charts(self):
        """
        Dashboard API: Test getting charts belonging to a dashboard
        """
        self.login(username="admin")
        dashboard = self.dashboards[0]
        uri = f"api/v1/dashboard/{dashboard.id}/charts"
        response = self.get_assert_metric(uri, "get_charts")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data.decode("utf-8"))
        assert len(data["result"]) == 1
        result = data["result"][0]
        assert set(result.keys()) == {
            "cache_timeout",
            "certification_details",
            "certified_by",
            "changed_on",
            "description",
            "description_markeddown",
            "form_data",
            "id",
            "slice_name",
            "slice_url",
        }
        assert result["id"] == dashboard.slices[0].id
        assert result["slice_name"] == dashboard.slices[0].slice_name

    @pytest.mark.usefixtures("create_dashboards")
    def test_get_dashboard_charts_by_slug(self):
        """
        Dashboard API: Test getting charts belonging to a dashboard
        """
        self.login(username="admin")
        dashboard = self.dashboards[0]
        uri = f"api/v1/dashboard/{dashboard.slug}/charts"
        response = self.get_assert_metric(uri, "get_charts")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data.decode("utf-8"))
        self.assertEqual(len(data["result"]), 1)
        self.assertEqual(
            data["result"][0]["slice_name"], dashboard.slices[0].slice_name
        )

    @pytest.mark.usefixtures("create_dashboards")
    def test_get_dashboard_charts_not_found(self):
        """
        Dashboard API: Test getting charts belonging to a dashboard that does not exist
        """
        self.login(username="admin")
        bad_id = self.get_nonexistent_numeric_id(Dashboard)
        uri = f"api/v1/dashboard/{bad_id}/charts"
        response = self.get_assert_metric(uri, "get_charts")
        self.assertEqual(response.status_code, 404)

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_get_dashboard_datasets_not_allowed(self):
        self.login(username="gamma")
        uri = "api/v1/dashboard/world_health/datasets"
        response = self.get_assert_metric(uri, "get_datasets")
        self.assertEqual(response.status_code, 404)

    @pytest.mark.usefixtures("create_dashboards")
    def test_get_gamma_dashboard_charts(self):
        """
        Check that a gamma user with data access can access dashboard/charts
        """
        from superset.connectors.sqla.models import SqlaTable

        # Set correct role permissions
        gamma_role = security_manager.find_role("Gamma")
        fixture_dataset = db.session.query(SqlaTable).get(1)
        data_access_pvm = security_manager.add_permission_view_menu(
            "datasource_access", fixture_dataset.perm
        )
        gamma_role.permissions.append(data_access_pvm)
        db.session.commit()

        self.login(username="gamma")

        dashboard = self.dashboards[0]
        dashboard.published = True
        db.session.commit()

        uri = f"api/v1/dashboard/{dashboard.id}/charts"
        response = self.get_assert_metric(uri, "get_charts")
        assert response.status_code == 200

        # rollback permission change
        data_access_pvm = security_manager.find_permission_view_menu(
            "datasource_access", fixture_dataset.perm
        )
        security_manager.del_permission_role(gamma_role, data_access_pvm)

    @pytest.mark.usefixtures("create_dashboards")
    def test_get_dashboard_charts_empty(self):
        """
        Dashboard API: Test getting charts belonging to a dashboard without any charts
        """
        self.login(username="admin")
        # the fixture setup assigns no charts to the second half of dashboards
        uri = f"api/v1/dashboard/{self.dashboards[-1].id}/charts"
        response = self.get_assert_metric(uri, "get_charts")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data.decode("utf-8"))
        self.assertEqual(data["result"], [])

    def test_get_dashboard(self):
        """
        Dashboard API: Test get dashboard
        """
        admin = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "title", "slug1", [admin.id], created_by=admin
        )
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard.id}"
        rv = self.get_assert_metric(uri, "get")
        self.assertEqual(rv.status_code, 200)
        with override_user(admin):
            expected_result = {
                "certified_by": None,
                "certification_details": None,
                "changed_by": None,
                "changed_by_name": "",
                "charts": [],
                "created_by": {
                    "id": 1,
                    "first_name": "admin",
                    "last_name": "user",
                },
                "id": dashboard.id,
                "css": "",
                "dashboard_title": "title",
                "datasources": [],
                "json_metadata": "",
                "owners": [
                    {
                        "id": 1,
                        "first_name": "admin",
                        "last_name": "user",
                    }
                ],
                "roles": [],
                "position_json": "",
                "published": False,
                "url": "/superset/dashboard/slug1/",
                "slug": "slug1",
                "tags": [],
                "thumbnail_url": dashboard.thumbnail_url,
                "is_managed_externally": False,
            }
        data = json.loads(rv.data.decode("utf-8"))
        self.assertIn("changed_on", data["result"])
        self.assertIn("changed_on_delta_humanized", data["result"])
        for key, value in data["result"].items():
            # We can't assert timestamp values
            if key not in (
                "changed_on",
                "changed_on_delta_humanized",
            ):
                self.assertEqual(value, expected_result[key])
        # rollback changes
        db.session.delete(dashboard)
        db.session.commit()

    @patch("superset.dashboards.schemas.security_manager.has_guest_access")
    @patch("superset.dashboards.schemas.security_manager.is_guest_user")
    def test_get_dashboard_as_guest(self, is_guest_user, has_guest_access):
        """
        Dashboard API: Test get dashboard as guest
        """
        admin = self.get_user("admin")
        dashboard = self.insert_dashboard(
            "title", "slug1", [admin.id], created_by=admin
        )
        is_guest_user.return_value = True
        has_guest_access.return_value = True
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard.id}"
        rv = self.get_assert_metric(uri, "get")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        for excluded_key in ["changed_by", "changed_by_name", "owners"]:
            assert excluded_key not in data["result"]
        # rollback changes
        db.session.delete(dashboard)
        db.session.commit()

    def test_info_dashboard(self):
        """
        Dashboard API: Test info
        """
        self.login(username="admin")
        uri = "api/v1/dashboard/_info"
        rv = self.get_assert_metric(uri, "info")
        self.assertEqual(rv.status_code, 200)

    def test_info_security_database(self):
        """
        Dashboard API: Test info security
        """
        self.login(username="admin")
        params = {"keys": ["permissions"]}
        uri = f"api/v1/dashboard/_info?q={prison.dumps(params)}"
        rv = self.get_assert_metric(uri, "info")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert set(data["permissions"]) == {
            "can_read",
            "can_write",
            "can_export",
            "can_get_embedded",
            "can_delete_embedded",
            "can_set_embedded",
        }

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_get_dashboard_not_found(self):
        """
        Dashboard API: Test get dashboard not found
        """
        bad_id = self.get_nonexistent_numeric_id(Dashboard)
        self.login(username="admin")
        uri = f"api/v1/dashboard/{bad_id}"
        rv = self.get_assert_metric(uri, "get")
        self.assertEqual(rv.status_code, 404)

    def test_get_dashboard_no_data_access(self):
        """
        Dashboard API: Test get dashboard without data access
        """
        admin = self.get_user("admin")
        dashboard = self.insert_dashboard("title", "slug1", [admin.id])

        self.login(username="gamma")
        uri = f"api/v1/dashboard/{dashboard.id}"
        rv = self.client.get(uri)
        assert rv.status_code == 404
        # rollback changes
        db.session.delete(dashboard)
        db.session.commit()

    def test_get_dashboards_changed_on(self):
        """
        Dashboard API: Test get dashboards changed on
        """
        from datetime import datetime
        import humanize

        with freeze_time("2020-01-01T00:00:00Z"):
            admin = self.get_user("admin")
            dashboard = self.insert_dashboard("title", "slug1", [admin.id])

            self.login(username="admin")

            arguments = {
                "order_column": "changed_on_delta_humanized",
                "order_direction": "desc",
            }
            uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"

            rv = self.get_assert_metric(uri, "get_list")
            self.assertEqual(rv.status_code, 200)
            data = json.loads(rv.data.decode("utf-8"))
            self.assertEqual(
                data["result"][0]["changed_on_delta_humanized"],
                humanize.naturaltime(datetime.now()),
            )

            # rollback changes
            db.session.delete(dashboard)
            db.session.commit()

    def test_get_dashboards_filter(self):
        """
        Dashboard API: Test get dashboards filter
        """
        admin = self.get_user("admin")
        gamma = self.get_user("gamma")
        dashboard = self.insert_dashboard("title", "slug1", [admin.id, gamma.id])

        self.login(username="admin")

        arguments = {
            "filters": [{"col": "dashboard_title", "opr": "sw", "value": "ti"}]
        }
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"

        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 1)

        arguments = {
            "filters": [
                {"col": "owners", "opr": "rel_m_m", "value": [admin.id, gamma.id]}
            ]
        }
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 1)

        # rollback changes
        db.session.delete(dashboard)
        db.session.commit()

    @pytest.mark.usefixtures("create_dashboards")
    def test_get_dashboards_title_or_slug_filter(self):
        """
        Dashboard API: Test get dashboards title or slug filter
        """
        # Test title filter with ilike
        arguments = {
            "filters": [
                {"col": "dashboard_title", "opr": "title_or_slug", "value": "title1"}
            ],
            "order_column": "dashboard_title",
            "order_direction": "asc",
            "keys": ["none"],
            "columns": ["dashboard_title", "slug"],
        }
        self.login(username="admin")
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 1)

        expected_response = [
            {"slug": "slug1", "dashboard_title": "title1"},
        ]
        assert data["result"] == expected_response

        # Test slug filter with ilike
        arguments["filters"][0]["value"] = "slug2"
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 1)

        expected_response = [
            {"slug": "slug2", "dashboard_title": "title2"},
        ]
        assert data["result"] == expected_response

        self.logout()
        self.login(username="gamma")
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 0)

    @pytest.mark.usefixtures("create_dashboards")
    def test_get_dashboards_favorite_filter(self):
        """
        Dashboard API: Test get dashboards favorite filter
        """
        admin = self.get_user("admin")
        users_favorite_query = db.session.query(FavStar.obj_id).filter(
            and_(FavStar.user_id == admin.id, FavStar.class_name == "Dashboard")
        )
        expected_models = (
            db.session.query(Dashboard)
            .filter(and_(Dashboard.id.in_(users_favorite_query)))
            .order_by(Dashboard.dashboard_title.asc())
            .all()
        )

        arguments = {
            "filters": [{"col": "id", "opr": "dashboard_is_favorite", "value": True}],
            "order_column": "dashboard_title",
            "order_direction": "asc",
            "keys": ["none"],
            "columns": ["dashboard_title"],
        }
        self.login(username="admin")
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert len(expected_models) == data["count"]

        for i, expected_model in enumerate(expected_models):
            assert (
                expected_model.dashboard_title == data["result"][i]["dashboard_title"]
            )

    @pytest.mark.usefixtures("create_dashboards")
    def test_get_current_user_favorite_status(self):
        """
        Dataset API: Test get current user favorite stars
        """
        admin = self.get_user("admin")
        users_favorite_ids = [
            star.obj_id
            for star in db.session.query(FavStar.obj_id)
            .filter(
                and_(
                    FavStar.user_id == admin.id,
                    FavStar.class_name == FavStarClassName.DASHBOARD,
                )
            )
            .all()
        ]

        assert users_favorite_ids
        arguments = [dash.id for dash in db.session.query(Dashboard.id).all()]
        self.login(username="admin")
        uri = f"api/v1/dashboard/favorite_status/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        for res in data["result"]:
            if res["id"] in users_favorite_ids:
                assert res["value"]

    def test_add_favorite(self):
        """
        Dataset API: Test add dashboard to favorites
        """
        dashboard = Dashboard(
            id=100,
            dashboard_title="test_dashboard",
            slug="test_slug",
            slices=[],
            published=True,
        )
        db.session.add(dashboard)
        db.session.commit()

        self.login(username="admin")
        uri = f"api/v1/dashboard/favorite_status/?q={prison.dumps([dashboard.id])}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        for res in data["result"]:
            assert res["value"] is False

        uri = f"api/v1/dashboard/{dashboard.id}/favorites/"
        self.client.post(uri)

        uri = f"api/v1/dashboard/favorite_status/?q={prison.dumps([dashboard.id])}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        for res in data["result"]:
            assert res["value"] is True

        db.session.delete(dashboard)
        db.session.commit()

    def test_remove_favorite(self):
        """
        Dataset API: Test remove dashboard from favorites
        """
        dashboard = Dashboard(
            id=100,
            dashboard_title="test_dashboard",
            slug="test_slug",
            slices=[],
            published=True,
        )
        db.session.add(dashboard)
        db.session.commit()

        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard.id}/favorites/"
        self.client.post(uri)

        uri = f"api/v1/dashboard/favorite_status/?q={prison.dumps([dashboard.id])}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        for res in data["result"]:
            assert res["value"] is True

        uri = f"api/v1/dashboard/{dashboard.id}/favorites/"
        self.client.delete(uri)

        uri = f"api/v1/dashboard/favorite_status/?q={prison.dumps([dashboard.id])}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        for res in data["result"]:
            assert res["value"] is False

        db.session.delete(dashboard)
        db.session.commit()

    @pytest.mark.usefixtures("create_dashboards")
    def test_get_dashboards_not_favorite_filter(self):
        """
        Dashboard API: Test get dashboards not favorite filter
        """
        admin = self.get_user("admin")
        users_favorite_query = db.session.query(FavStar.obj_id).filter(
            and_(FavStar.user_id == admin.id, FavStar.class_name == "Dashboard")
        )
        expected_models = (
            db.session.query(Dashboard)
            .filter(and_(~Dashboard.id.in_(users_favorite_query)))
            .order_by(Dashboard.dashboard_title.asc())
            .all()
        )
        arguments = {
            "filters": [{"col": "id", "opr": "dashboard_is_favorite", "value": False}],
            "order_column": "dashboard_title",
            "order_direction": "asc",
            "keys": ["none"],
            "columns": ["dashboard_title"],
        }
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        self.login(username="admin")
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert len(expected_models) == data["count"]
        for i, expected_model in enumerate(expected_models):
            assert (
                expected_model.dashboard_title == data["result"][i]["dashboard_title"]
            )

    @pytest.mark.usefixtures("create_dashboards")
    def test_gets_certified_dashboards_filter(self):
        arguments = {
            "filters": [
                {
                    "col": "id",
                    "opr": "dashboard_is_certified",
                    "value": True,
                }
            ],
            "keys": ["none"],
            "columns": ["dashboard_title"],
        }
        self.login(username="admin")

        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], DASHBOARDS_FIXTURE_COUNT)

    @pytest.mark.usefixtures("create_dashboards")
    def test_gets_not_certified_dashboards_filter(self):
        arguments = {
            "filters": [
                {
                    "col": "id",
                    "opr": "dashboard_is_certified",
                    "value": False,
                }
            ],
            "keys": ["none"],
            "columns": ["dashboard_title"],
        }
        self.login(username="admin")

        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 0)

    @pytest.mark.usefixtures("create_created_by_gamma_dashboards")
    def test_get_dashboards_created_by_me(self):
        """
        Dashboard API: Test get dashboards created by current user
        """
        query = {
            "columns": ["created_on_delta_humanized", "dashboard_title", "url"],
            "filters": [
                {"col": "created_by", "opr": "dashboard_created_by_me", "value": "me"}
            ],
            "order_column": "changed_on",
            "order_direction": "desc",
            "page": 0,
            "page_size": 100,
        }
        uri = f"api/v1/dashboard/?q={prison.dumps(query)}"
        self.login(username="gamma")
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert len(data["result"]) == 2
        assert list(data["result"][0].keys()) == query["columns"]
        expected_results = [
            {
                "dashboard_title": "create_title1",
                "url": "/superset/dashboard/create_slug1/",
            },
            {
                "dashboard_title": "create_title0",
                "url": "/superset/dashboard/create_slug0/",
            },
        ]
        for idx, response_item in enumerate(data["result"]):
            for key, value in expected_results[idx].items():
                assert response_item[key] == value

    def create_dashboard_import(self):
        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open("dashboard_export/metadata.yaml", "w") as fp:
                fp.write(yaml.safe_dump(dashboard_metadata_config).encode())
            with bundle.open(
                "dashboard_export/databases/imported_database.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(database_config).encode())
            with bundle.open(
                "dashboard_export/datasets/imported_dataset.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(dataset_config).encode())
            with bundle.open("dashboard_export/charts/imported_chart.yaml", "w") as fp:
                fp.write(yaml.safe_dump(chart_config).encode())
            with bundle.open(
                "dashboard_export/dashboards/imported_dashboard.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(dashboard_config).encode())
        buf.seek(0)
        return buf

    def create_invalid_dashboard_import(self):
        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open("sql/dump.sql", "w") as fp:
                fp.write(b"CREATE TABLE foo (bar INT)")
        buf.seek(0)
        return buf

    def test_delete_dashboard(self):
        """
        Dashboard API: Test delete
        """
        admin_id = self.get_user("admin").id
        dashboard_id = self.insert_dashboard("title", "slug1", [admin_id]).id
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.delete_assert_metric(uri, "delete")
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Dashboard).get(dashboard_id)
        self.assertEqual(model, None)

    def test_delete_bulk_dashboards(self):
        """
        Dashboard API: Test delete bulk
        """
        admin_id = self.get_user("admin").id
        dashboard_count = 4
        dashboard_ids = list()
        for dashboard_name_index in range(dashboard_count):
            dashboard_ids.append(
                self.insert_dashboard(
                    f"title{dashboard_name_index}",
                    f"slug{dashboard_name_index}",
                    [admin_id],
                ).id
            )
        self.login(username="admin")
        argument = dashboard_ids
        uri = f"api/v1/dashboard/?q={prison.dumps(argument)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": f"Deleted {dashboard_count} dashboards"}
        self.assertEqual(response, expected_response)
        for dashboard_id in dashboard_ids:
            model = db.session.query(Dashboard).get(dashboard_id)
            self.assertEqual(model, None)

    def test_delete_bulk_embedded_dashboards(self):
        """
        Dashboard API: Test delete bulk embedded
        """
        user = self.get_user("admin")
        dashboard_count = 4
        dashboard_ids = list()
        for dashboard_name_index in range(dashboard_count):
            dashboard_ids.append(
                self.insert_dashboard(
                    f"title{dashboard_name_index}",
                    None,
                    [user.id],
                ).id
            )
        self.login(username=user.username)
        for dashboard_id in dashboard_ids:
            # post succeeds and returns value
            allowed_domains = ["test.example", "embedded.example"]
            resp = self.post_assert_metric(
                f"api/v1/dashboard/{dashboard_id}/embedded",
                {"allowed_domains": allowed_domains},
                "set_embedded",
            )
            self.assertEqual(resp.status_code, 200)
            result = json.loads(resp.data.decode("utf-8"))["result"]
            self.assertIsNotNone(result["uuid"])
            self.assertNotEqual(result["uuid"], "")
            self.assertEqual(result["allowed_domains"], allowed_domains)
        argument = dashboard_ids
        uri = f"api/v1/dashboard/?q={prison.dumps(argument)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": f"Deleted {dashboard_count} dashboards"}
        self.assertEqual(response, expected_response)
        for dashboard_id in dashboard_ids:
            model = db.session.query(Dashboard).get(dashboard_id)
            self.assertEqual(model, None)

    def test_delete_bulk_dashboards_bad_request(self):
        """
        Dashboard API: Test delete bulk bad request
        """
        dashboard_ids = [1, "a"]
        self.login(username="admin")
        argument = dashboard_ids
        uri = f"api/v1/dashboard/?q={prison.dumps(argument)}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 400)

    def test_delete_not_found_dashboard(self):
        """
        Dashboard API: Test not found delete
        """
        self.login(username="admin")
        dashboard_id = 1000
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 404)

    @pytest.mark.usefixtures("create_dashboard_with_report")
    def test_delete_dashboard_with_report(self):
        """
        Dashboard API: Test delete with associated report
        """
        self.login(username="admin")
        dashboard = (
            db.session.query(Dashboard.id)
            .filter(Dashboard.dashboard_title == "dashboard_report")
            .one_or_none()
        )
        uri = f"api/v1/dashboard/{dashboard.id}"
        rv = self.client.delete(uri)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 422)
        expected_response = {
            "message": "There are associated alerts or reports: report_with_dashboard"
        }
        self.assertEqual(response, expected_response)

    def test_delete_bulk_dashboards_not_found(self):
        """
        Dashboard API: Test delete bulk not found
        """
        dashboard_ids = [1001, 1002]
        self.login(username="admin")
        argument = dashboard_ids
        uri = f"api/v1/dashboard/?q={prison.dumps(argument)}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 404)

    @pytest.mark.usefixtures("create_dashboard_with_report", "create_dashboards")
    def test_delete_bulk_dashboard_with_report(self):
        """
        Dashboard API: Test bulk delete with associated report
        """
        self.login(username="admin")
        dashboard_with_report = (
            db.session.query(Dashboard.id)
            .filter(Dashboard.dashboard_title == "dashboard_report")
            .one_or_none()
        )
        dashboards = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title.like("title%"))
            .all()
        )

        dashboard_ids = [dashboard.id for dashboard in dashboards]
        dashboard_ids.append(dashboard_with_report.id)
        uri = f"api/v1/dashboard/?q={prison.dumps(dashboard_ids)}"
        rv = self.client.delete(uri)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 422)
        expected_response = {
            "message": "There are associated alerts or reports: report_with_dashboard"
        }
        self.assertEqual(response, expected_response)

    def test_delete_dashboard_admin_not_owned(self):
        """
        Dashboard API: Test admin delete not owned
        """
        gamma_id = self.get_user("gamma").id
        dashboard_id = self.insert_dashboard("title", "slug1", [gamma_id]).id

        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Dashboard).get(dashboard_id)
        self.assertEqual(model, None)

    def test_delete_bulk_dashboard_admin_not_owned(self):
        """
        Dashboard API: Test admin delete bulk not owned
        """
        gamma_id = self.get_user("gamma").id
        dashboard_count = 4
        dashboard_ids = list()
        for dashboard_name_index in range(dashboard_count):
            dashboard_ids.append(
                self.insert_dashboard(
                    f"title{dashboard_name_index}",
                    f"slug{dashboard_name_index}",
                    [gamma_id],
                ).id
            )

        self.login(username="admin")
        argument = dashboard_ids
        uri = f"api/v1/dashboard/?q={prison.dumps(argument)}"
        rv = self.client.delete(uri)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 200)
        expected_response = {"message": f"Deleted {dashboard_count} dashboards"}
        self.assertEqual(response, expected_response)

        for dashboard_id in dashboard_ids:
            model = db.session.query(Dashboard).get(dashboard_id)
            self.assertEqual(model, None)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_delete_dashboard_not_owned(self):
        """
        Dashboard API: Test delete try not owned
        """
        user_alpha1 = self.create_user(
            "alpha1", "password", "Alpha", email="alpha1@superset.org"
        )
        user_alpha2 = self.create_user(
            "alpha2", "password", "Alpha", email="alpha2@superset.org"
        )
        existing_slice = (
            db.session.query(Slice).filter_by(slice_name="Girl Name Cloud").first()
        )
        dashboard = self.insert_dashboard(
            "title", "slug1", [user_alpha1.id], slices=[existing_slice], published=True
        )
        self.login(username="alpha2", password="password")
        uri = f"api/v1/dashboard/{dashboard.id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 403)
        db.session.delete(dashboard)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_delete_bulk_dashboard_not_owned(self):
        """
        Dashboard API: Test delete bulk try not owned
        """
        user_alpha1 = self.create_user(
            "alpha1", "password", "Alpha", email="alpha1@superset.org"
        )
        user_alpha2 = self.create_user(
            "alpha2", "password", "Alpha", email="alpha2@superset.org"
        )
        existing_slice = (
            db.session.query(Slice).filter_by(slice_name="Girl Name Cloud").first()
        )

        dashboard_count = 4
        dashboards = list()
        for dashboard_name_index in range(dashboard_count):
            dashboards.append(
                self.insert_dashboard(
                    f"title{dashboard_name_index}",
                    f"slug{dashboard_name_index}",
                    [user_alpha1.id],
                    slices=[existing_slice],
                    published=True,
                )
            )

        owned_dashboard = self.insert_dashboard(
            "title_owned",
            "slug_owned",
            [user_alpha2.id],
            slices=[existing_slice],
            published=True,
        )

        self.login(username="alpha2", password="password")

        # verify we can't delete not owned dashboards
        arguments = [dashboard.id for dashboard in dashboards]
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 403)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": "Forbidden"}
        self.assertEqual(response, expected_response)

        # nothing is deleted in bulk with a list of owned and not owned dashboards
        arguments = [dashboard.id for dashboard in dashboards] + [owned_dashboard.id]
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 403)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": "Forbidden"}
        self.assertEqual(response, expected_response)

        for dashboard in dashboards:
            db.session.delete(dashboard)
        db.session.delete(owned_dashboard)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
        db.session.commit()

    def test_create_dashboard(self):
        """
        Dashboard API: Test create dashboard
        """
        admin_id = self.get_user("admin").id
        dashboard_data = {
            "dashboard_title": "title1",
            "slug": "slug1",
            "owners": [admin_id],
            "position_json": '{"a": "A"}',
            "css": "css",
            "json_metadata": '{"refresh_frequency": 30}',
            "published": True,
        }
        self.login(username="admin")
        uri = "api/v1/dashboard/"
        rv = self.post_assert_metric(uri, dashboard_data, "post")
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(Dashboard).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

    def test_create_simple_dashboard(self):
        """
        Dashboard API: Test create simple dashboard
        """
        dashboard_data = {"dashboard_title": "title1"}
        self.login(username="admin")
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(Dashboard).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

    def test_create_dashboard_empty(self):
        """
        Dashboard API: Test create empty
        """
        dashboard_data = {}
        self.login(username="admin")
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(Dashboard).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

        dashboard_data = {"dashboard_title": ""}
        self.login(username="admin")
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(Dashboard).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

    def test_create_dashboard_validate_title(self):
        """
        Dashboard API: Test create dashboard validate title
        """
        dashboard_data = {"dashboard_title": "a" * 600}
        self.login(username="admin")
        uri = "api/v1/dashboard/"
        rv = self.post_assert_metric(uri, dashboard_data, "post")
        self.assertEqual(rv.status_code, 400)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": {"dashboard_title": ["Length must be between 0 and 500."]}
        }
        self.assertEqual(response, expected_response)

    def test_create_dashboard_validate_slug(self):
        """
        Dashboard API: Test create validate slug
        """
        admin_id = self.get_user("admin").id
        dashboard = self.insert_dashboard("title1", "slug1", [admin_id])
        self.login(username="admin")

        # Check for slug uniqueness
        dashboard_data = {"dashboard_title": "title2", "slug": "slug1"}
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"slug": ["Must be unique"]}}
        self.assertEqual(response, expected_response)

        # Check for slug max size
        dashboard_data = {"dashboard_title": "title2", "slug": "a" * 256}
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 400)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"slug": ["Length must be between 1 and 255."]}}
        self.assertEqual(response, expected_response)

        db.session.delete(dashboard)
        db.session.commit()

    def test_create_dashboard_validate_owners(self):
        """
        Dashboard API: Test create validate owners
        """
        dashboard_data = {"dashboard_title": "title1", "owners": [1000]}
        self.login(username="admin")
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"owners": ["Owners are invalid"]}}
        self.assertEqual(response, expected_response)

    def test_create_dashboard_validate_roles(self):
        """
        Dashboard API: Test create validate roles
        """
        dashboard_data = {"dashboard_title": "title1", "roles": [1000]}
        self.login(username="admin")
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"roles": ["Some roles do not exist"]}}
        self.assertEqual(response, expected_response)

    def test_create_dashboard_validate_json(self):
        """
        Dashboard API: Test create validate json
        """
        dashboard_data = {"dashboard_title": "title1", "position_json": '{"A:"a"}'}
        self.login(username="admin")
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 400)

        dashboard_data = {"dashboard_title": "title1", "json_metadata": '{"A:"a"}'}
        self.login(username="admin")
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 400)

        dashboard_data = {
            "dashboard_title": "title1",
            "json_metadata": '{"refresh_frequency": "A"}',
        }
        self.login(username="admin")
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 400)

    def test_update_dashboard(self):
        """
        Dashboard API: Test update
        """
        admin = self.get_user("admin")
        admin_role = self.get_role("Admin")
        dashboard_id = self.insert_dashboard(
            "title1", "slug1", [admin.id], roles=[admin_role.id]
        ).id
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.put_assert_metric(uri, self.dashboard_data, "put")
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Dashboard).get(dashboard_id)
        self.assertEqual(model.dashboard_title, self.dashboard_data["dashboard_title"])
        self.assertEqual(model.slug, self.dashboard_data["slug"])
        self.assertEqual(model.position_json, self.dashboard_data["position_json"])
        self.assertEqual(model.css, self.dashboard_data["css"])
        self.assertEqual(model.json_metadata, self.dashboard_data["json_metadata"])
        self.assertEqual(model.published, self.dashboard_data["published"])
        self.assertEqual(model.owners, [admin])
        self.assertEqual(model.roles, [admin_role])

        db.session.delete(model)
        db.session.commit()

    def test_dashboard_get_list_no_username(self):
        """
        Dashboard API: Tests that no username is returned
        """
        admin = self.get_user("admin")
        admin_role = self.get_role("Admin")
        dashboard_id = self.insert_dashboard(
            "title1", "slug1", [admin.id], roles=[admin_role.id]
        ).id
        model = db.session.query(Dashboard).get(dashboard_id)
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        dashboard_data = {"dashboard_title": "title2"}
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 200)

        response = self.get_assert_metric("api/v1/dashboard/", "get_list")
        res = json.loads(response.data.decode("utf-8"))["result"]

        current_dash = [d for d in res if d["id"] == dashboard_id][0]
        self.assertEqual(current_dash["dashboard_title"], "title2")
        self.assertNotIn("username", current_dash["changed_by"].keys())
        self.assertNotIn("username", current_dash["owners"][0].keys())

        db.session.delete(model)
        db.session.commit()

    def test_dashboard_get_no_username(self):
        """
        Dashboard API: Tests that no username is returned
        """
        admin = self.get_user("admin")
        admin_role = self.get_role("Admin")
        dashboard_id = self.insert_dashboard(
            "title1", "slug1", [admin.id], roles=[admin_role.id]
        ).id
        model = db.session.query(Dashboard).get(dashboard_id)
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        dashboard_data = {"dashboard_title": "title2"}
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 200)

        response = self.get_assert_metric(uri, "get")
        res = json.loads(response.data.decode("utf-8"))["result"]

        self.assertEqual(res["dashboard_title"], "title2")
        self.assertNotIn("username", res["changed_by"].keys())
        self.assertNotIn("username", res["owners"][0].keys())

        db.session.delete(model)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_update_dashboard_chart_owners_propagation(self):
        """
        Dashboard API: Test update chart owners propagation
        """
        user_alpha1 = self.create_user(
            "alpha1",
            "password",
            "Alpha",
            email="alpha1@superset.org",
            first_name="alpha1",
        )
        admin = self.get_user("admin")
        slices = []
        slices.append(db.session.query(Slice).filter_by(slice_name="Trends").one())
        slices.append(db.session.query(Slice).filter_by(slice_name="Boys").one())

        # Insert dashboard with admin as owner
        dashboard = self.insert_dashboard(
            "title1",
            "slug1",
            [admin.id],
            slices=slices,
        )

        # Updates dashboard without Boys in json_metadata positions
        # and user_alpha1 as owner
        dashboard_data = {
            "owners": [user_alpha1.id],
            "json_metadata": json.dumps(
                {
                    "positions": {
                        f"{slices[0].id}": {
                            "type": "CHART",
                            "meta": {"chartId": slices[0].id},
                        },
                    }
                }
            ),
        }
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard.id}"
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 200)

        # Check that chart named Boys does not contain alpha 1 in its owners
        boys = db.session.query(Slice).filter_by(slice_name="Boys").one()
        self.assertNotIn(user_alpha1, boys.owners)

        # Revert owners on slice
        for slice in slices:
            slice.owners = []
            db.session.commit()

        # Rollback changes
        db.session.delete(dashboard)
        db.session.delete(user_alpha1)
        db.session.commit()

    def test_update_partial_dashboard(self):
        """
        Dashboard API: Test update partial
        """
        admin_id = self.get_user("admin").id
        dashboard_id = self.insert_dashboard("title1", "slug1", [admin_id]).id
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.client.put(
            uri, json={"json_metadata": self.dashboard_data["json_metadata"]}
        )
        self.assertEqual(rv.status_code, 200)

        rv = self.client.put(
            uri, json={"dashboard_title": self.dashboard_data["dashboard_title"]}
        )
        self.assertEqual(rv.status_code, 200)

        rv = self.client.put(uri, json={"slug": self.dashboard_data["slug"]})
        self.assertEqual(rv.status_code, 200)

        model = db.session.query(Dashboard).get(dashboard_id)
        self.assertEqual(model.json_metadata, self.dashboard_data["json_metadata"])
        self.assertEqual(model.dashboard_title, self.dashboard_data["dashboard_title"])
        self.assertEqual(model.slug, self.dashboard_data["slug"])

        db.session.delete(model)
        db.session.commit()

    def test_update_dashboard_new_owner_not_admin(self):
        """
        Dashboard API: Test update set new owner implicitly adds logged in owner
        """
        gamma = self.get_user("gamma")
        alpha = self.get_user("alpha")
        dashboard_id = self.insert_dashboard("title1", "slug1", [alpha.id]).id
        dashboard_data = {"dashboard_title": "title1_changed", "owners": [gamma.id]}
        self.login(username="alpha")
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Dashboard).get(dashboard_id)
        self.assertIn(gamma, model.owners)
        self.assertIn(alpha, model.owners)
        for slc in model.slices:
            self.assertIn(gamma, slc.owners)
            self.assertIn(alpha, slc.owners)
        db.session.delete(model)
        db.session.commit()

    def test_update_dashboard_new_owner_admin(self):
        """
        Dashboard API: Test update set new owner as admin to other than current user
        """
        gamma = self.get_user("gamma")
        admin = self.get_user("admin")
        dashboard_id = self.insert_dashboard("title1", "slug1", [admin.id]).id
        dashboard_data = {"dashboard_title": "title1_changed", "owners": [gamma.id]}
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Dashboard).get(dashboard_id)
        self.assertIn(gamma, model.owners)
        self.assertNotIn(admin, model.owners)
        for slc in model.slices:
            self.assertIn(gamma, slc.owners)
            self.assertNotIn(admin, slc.owners)
        db.session.delete(model)
        db.session.commit()

    def test_update_dashboard_slug_formatting(self):
        """
        Dashboard API: Test update slug formatting
        """
        admin_id = self.get_user("admin").id
        dashboard_id = self.insert_dashboard("title1", "slug1", [admin_id]).id
        dashboard_data = {"dashboard_title": "title1_changed", "slug": "slug1 changed"}
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Dashboard).get(dashboard_id)
        self.assertEqual(model.dashboard_title, "title1_changed")
        self.assertEqual(model.slug, "slug1-changed")
        db.session.delete(model)
        db.session.commit()

    def test_update_dashboard_validate_slug(self):
        """
        Dashboard API: Test update validate slug
        """
        admin_id = self.get_user("admin").id
        dashboard1 = self.insert_dashboard("title1", "slug-1", [admin_id])
        dashboard2 = self.insert_dashboard("title2", "slug-2", [admin_id])

        self.login(username="admin")
        # Check for slug uniqueness
        dashboard_data = {"dashboard_title": "title2", "slug": "slug 1"}
        uri = f"api/v1/dashboard/{dashboard2.id}"
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"slug": ["Must be unique"]}}
        self.assertEqual(response, expected_response)

        db.session.delete(dashboard1)
        db.session.delete(dashboard2)
        db.session.commit()

        dashboard1 = self.insert_dashboard("title1", None, [admin_id])
        dashboard2 = self.insert_dashboard("title2", None, [admin_id])
        self.login(username="admin")
        # Accept empty slugs and don't validate them has unique
        dashboard_data = {"dashboard_title": "title2_changed", "slug": ""}
        uri = f"api/v1/dashboard/{dashboard2.id}"
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 200)

        db.session.delete(dashboard1)
        db.session.delete(dashboard2)
        db.session.commit()

    def test_update_published(self):
        """
        Dashboard API: Test update published patch
        """
        admin = self.get_user("admin")
        gamma = self.get_user("gamma")

        dashboard = self.insert_dashboard("title1", "slug1", [admin.id, gamma.id])
        dashboard_data = {"published": True}
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard.id}"
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 200)

        model = db.session.query(Dashboard).get(dashboard.id)
        self.assertEqual(model.published, True)
        self.assertEqual(model.slug, "slug1")
        self.assertIn(admin, model.owners)
        self.assertIn(gamma, model.owners)
        db.session.delete(model)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_update_dashboard_not_owned(self):
        """
        Dashboard API: Test update dashboard not owned
        """
        user_alpha1 = self.create_user(
            "alpha1", "password", "Alpha", email="alpha1@superset.org"
        )
        user_alpha2 = self.create_user(
            "alpha2", "password", "Alpha", email="alpha2@superset.org"
        )
        existing_slice = (
            db.session.query(Slice).filter_by(slice_name="Girl Name Cloud").first()
        )
        dashboard = self.insert_dashboard(
            "title", "slug1", [user_alpha1.id], slices=[existing_slice], published=True
        )
        self.login(username="alpha2", password="password")
        dashboard_data = {"dashboard_title": "title1_changed", "slug": "slug1 changed"}
        uri = f"api/v1/dashboard/{dashboard.id}"
        rv = self.put_assert_metric(uri, dashboard_data, "put")
        self.assertEqual(rv.status_code, 403)
        db.session.delete(dashboard)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
        db.session.commit()

    @patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"VERSIONED_EXPORT": False},
        clear=True,
    )
    @pytest.mark.usefixtures(
        "load_world_bank_dashboard_with_slices",
        "load_birth_names_dashboard_with_slices",
    )
    @freeze_time("2022-01-01")
    def test_export(self):
        """
        Dashboard API: Test dashboard export
        """
        self.login(username="admin")
        dashboards_ids = get_dashboards_ids(db, ["world_health", "births"])
        uri = f"api/v1/dashboard/export/?q={prison.dumps(dashboards_ids)}"

        rv = self.get_assert_metric(uri, "export")
        headers = generate_download_headers("json")["Content-Disposition"]

        assert rv.status_code == 200
        assert rv.headers["Content-Disposition"] == headers

    def test_export_not_found(self):
        """
        Dashboard API: Test dashboard export not found
        """
        self.login(username="admin")
        argument = [1000]
        uri = f"api/v1/dashboard/export/?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_export_not_allowed(self):
        """
        Dashboard API: Test dashboard export not allowed
        """
        admin_id = self.get_user("admin").id
        dashboard = self.insert_dashboard("title", "slug1", [admin_id], published=False)

        self.login(username="gamma")
        argument = [dashboard.id]
        uri = f"api/v1/dashboard/export/?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)
        db.session.delete(dashboard)
        db.session.commit()

    def test_export_bundle(self):
        """
        Dashboard API: Test dashboard export
        """
        dashboards_ids = get_dashboards_ids(db, ["world_health", "births"])
        uri = f"api/v1/dashboard/export/?q={prison.dumps(dashboards_ids)}"

        self.login(username="admin")
        rv = self.client.get(uri)

        assert rv.status_code == 200

        buf = BytesIO(rv.data)
        assert is_zipfile(buf)

    def test_export_bundle_not_found(self):
        """
        Dashboard API: Test dashboard export not found
        """
        self.login(username="admin")
        argument = [1000]
        uri = f"api/v1/dashboard/export/?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    def test_export_bundle_not_allowed(self):
        """
        Dashboard API: Test dashboard export not allowed
        """
        admin_id = self.get_user("admin").id
        dashboard = self.insert_dashboard("title", "slug1", [admin_id], published=False)

        self.login(username="gamma")
        argument = [dashboard.id]
        uri = f"api/v1/dashboard/export/?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        assert rv.status_code == 404

        db.session.delete(dashboard)
        db.session.commit()

    def test_import_dashboard(self):
        """
        Dashboard API: Test import dashboard
        """
        self.login(username="admin")
        uri = "api/v1/dashboard/import/"

        buf = self.create_dashboard_import()
        form_data = {
            "formData": (buf, "dashboard_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

        dashboard = (
            db.session.query(Dashboard).filter_by(uuid=dashboard_config["uuid"]).one()
        )
        assert dashboard.dashboard_title == "Test dash"

        assert len(dashboard.slices) == 1
        chart = dashboard.slices[0]
        assert str(chart.uuid) == chart_config["uuid"]

        dataset = chart.table
        assert str(dataset.uuid) == dataset_config["uuid"]

        database = dataset.database
        assert str(database.uuid) == database_config["uuid"]

        db.session.delete(dashboard)
        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_dashboard_invalid_file(self):
        """
        Dashboard API: Test import invalid dashboard file
        """
        self.login(username="admin")
        uri = "api/v1/dashboard/import/"

        buf = self.create_invalid_dashboard_import()
        form_data = {
            "formData": (buf, "dashboard_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 400
        assert response == {
            "errors": [
                {
                    "message": "No valid import files were found",
                    "error_type": "GENERIC_COMMAND_ERROR",
                    "level": "warning",
                    "extra": {
                        "issue_codes": [
                            {
                                "code": 1010,
                                "message": (
                                    "Issue 1010 - Superset encountered an "
                                    "error while running a command."
                                ),
                            }
                        ]
                    },
                }
            ]
        }

    def test_import_dashboard_v0_export(self):
        num_dashboards = db.session.query(Dashboard).count()

        self.login(username="admin")
        uri = "api/v1/dashboard/import/"

        buf = BytesIO()
        buf.write(json.dumps(dashboard_export).encode())
        buf.seek(0)
        form_data = {
            "formData": (buf, "20201119_181105.json"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}
        assert db.session.query(Dashboard).count() == num_dashboards + 1

        dashboard = (
            db.session.query(Dashboard).filter_by(dashboard_title="Births 2").one()
        )
        chart = dashboard.slices[0]
        dataset = chart.table

        db.session.delete(dashboard)
        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.commit()

    def test_import_dashboard_overwrite(self):
        """
        Dashboard API: Test import existing dashboard
        """
        self.login(username="admin")
        uri = "api/v1/dashboard/import/"

        buf = self.create_dashboard_import()
        form_data = {
            "formData": (buf, "dashboard_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

        # import again without overwrite flag
        buf = self.create_dashboard_import()
        form_data = {
            "formData": (buf, "dashboard_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "Error importing dashboard",
                    "error_type": "GENERIC_COMMAND_ERROR",
                    "level": "warning",
                    "extra": {
                        "dashboards/imported_dashboard.yaml": "Dashboard already exists and `overwrite=true` was not passed",
                        "issue_codes": [
                            {
                                "code": 1010,
                                "message": (
                                    "Issue 1010 - Superset encountered an "
                                    "error while running a command."
                                ),
                            }
                        ],
                    },
                }
            ]
        }

        # import with overwrite flag
        buf = self.create_dashboard_import()
        form_data = {
            "formData": (buf, "dashboard_export.zip"),
            "overwrite": "true",
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

        # cleanup
        dashboard = (
            db.session.query(Dashboard).filter_by(uuid=dashboard_config["uuid"]).one()
        )
        chart = dashboard.slices[0]
        dataset = chart.table
        database = dataset.database

        db.session.delete(dashboard)
        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_dashboard_invalid(self):
        """
        Dashboard API: Test import invalid dashboard
        """
        self.login(username="admin")
        uri = "api/v1/dashboard/import/"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open("dashboard_export/metadata.yaml", "w") as fp:
                fp.write(yaml.safe_dump(dataset_metadata_config).encode())
            with bundle.open(
                "dashboard_export/databases/imported_database.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(database_config).encode())
            with bundle.open(
                "dashboard_export/datasets/imported_dataset.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(dataset_config).encode())
            with bundle.open("dashboard_export/charts/imported_chart.yaml", "w") as fp:
                fp.write(yaml.safe_dump(chart_config).encode())
            with bundle.open(
                "dashboard_export/dashboards/imported_dashboard.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(dashboard_config).encode())
        buf.seek(0)

        form_data = {
            "formData": (buf, "dashboard_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "Error importing dashboard",
                    "error_type": "GENERIC_COMMAND_ERROR",
                    "level": "warning",
                    "extra": {
                        "metadata.yaml": {"type": ["Must be equal to Dashboard."]},
                        "issue_codes": [
                            {
                                "code": 1010,
                                "message": (
                                    "Issue 1010 - Superset encountered "
                                    "an error while running a command."
                                ),
                            }
                        ],
                    },
                }
            ]
        }

    def test_get_all_related_roles(self):
        """
        API: Test get filter related roles
        """
        self.login(username="admin")
        uri = f"api/v1/dashboard/related/roles"

        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        roles = db.session.query(security_manager.role_model).all()
        expected_roles = [str(role) for role in roles]
        assert response["count"] == len(roles)

        response_roles = [result["text"] for result in response["result"]]
        for expected_role in expected_roles:
            assert expected_role in response_roles

    def test_get_filter_related_roles(self):
        """
        API: Test get filter related roles
        """
        self.login(username="admin")
        argument = {"filter": "alpha"}
        uri = f"api/v1/dashboard/related/roles?q={prison.dumps(argument)}"

        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] == 1

        response_roles = [result["text"] for result in response["result"]]
        assert "Alpha" in response_roles

    def test_get_all_related_roles_with_with_extra_filters(self):
        """
        API: Test get filter related roles with extra related query filters
        """
        self.login(username="admin")

        def _base_filter(query):
            return query.filter_by(name="Alpha")

        with patch.dict(
            "superset.views.filters.current_app.config",
            {"EXTRA_RELATED_QUERY_FILTERS": {"role": _base_filter}},
        ):
            uri = f"api/v1/dashboard/related/roles"
            rv = self.client.get(uri)
            assert rv.status_code == 200
            response = json.loads(rv.data.decode("utf-8"))
            response_roles = [result["text"] for result in response["result"]]
            assert response_roles == ["Alpha"]

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_embedded_dashboards(self):
        self.login(username="admin")
        uri = "api/v1/dashboard/world_health/embedded"

        # initial get should return 404
        resp = self.get_assert_metric(uri, "get_embedded")
        self.assertEqual(resp.status_code, 404)

        # post succeeds and returns value
        allowed_domains = ["test.example", "embedded.example"]
        resp = self.post_assert_metric(
            uri,
            {"allowed_domains": allowed_domains},
            "set_embedded",
        )
        self.assertEqual(resp.status_code, 200)
        result = json.loads(resp.data.decode("utf-8"))["result"]
        self.assertIsNotNone(result["uuid"])
        self.assertNotEqual(result["uuid"], "")
        self.assertEqual(result["allowed_domains"], allowed_domains)

        db.session.expire_all()

        # get returns value
        resp = self.get_assert_metric(uri, "get_embedded")
        self.assertEqual(resp.status_code, 200)
        result = json.loads(resp.data.decode("utf-8"))["result"]
        self.assertIsNotNone(result["uuid"])
        self.assertNotEqual(result["uuid"], "")
        self.assertEqual(result["allowed_domains"], allowed_domains)

        # save uuid for later
        original_uuid = result["uuid"]

        # put succeeds and returns value
        resp = self.post_assert_metric(uri, {"allowed_domains": []}, "set_embedded")
        self.assertEqual(resp.status_code, 200)
        result = json.loads(resp.data.decode("utf-8"))["result"]
        self.assertEqual(resp.status_code, 200)
        self.assertIsNotNone(result["uuid"])
        self.assertNotEqual(result["uuid"], "")
        self.assertEqual(result["allowed_domains"], [])

        db.session.expire_all()

        # get returns changed value
        resp = self.get_assert_metric(uri, "get_embedded")
        self.assertEqual(resp.status_code, 200)
        result = json.loads(resp.data.decode("utf-8"))["result"]
        self.assertEqual(result["uuid"], original_uuid)
        self.assertEqual(result["allowed_domains"], [])

        # delete succeeds
        resp = self.delete_assert_metric(uri, "delete_embedded")
        self.assertEqual(resp.status_code, 200)

        db.session.expire_all()

        # get returns 404
        resp = self.get_assert_metric(uri, "get_embedded")
        self.assertEqual(resp.status_code, 404)

    @pytest.mark.usefixtures("create_created_by_gamma_dashboards")
    def test_gets_created_by_user_dashboards_filter(self):
        expected_models = (
            db.session.query(Dashboard)
            .filter(Dashboard.created_by_fk.isnot(None))
            .all()
        )

        arguments = {
            "filters": [
                {"col": "created_by", "opr": "dashboard_has_created_by", "value": True}
            ],
            "keys": ["none"],
            "columns": ["dashboard_title"],
        }
        self.login(username="admin")

        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], len(expected_models))

    def test_gets_not_created_by_user_dashboards_filter(self):
        dashboard = self.insert_dashboard(f"title", f"slug", [])
        expected_models = (
            db.session.query(Dashboard).filter(Dashboard.created_by_fk.is_(None)).all()
        )

        arguments = {
            "filters": [
                {"col": "created_by", "opr": "dashboard_has_created_by", "value": False}
            ],
            "keys": ["none"],
            "columns": ["dashboard_title"],
        }
        self.login(username="admin")

        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], len(expected_models))
        db.session.delete(dashboard)
        db.session.commit()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_copy_dashboard(self):
        self.login(username="admin")
        original_dash = (
            db.session.query(Dashboard).filter_by(slug="world_health").first()
        )

        data = {
            "dashboard_title": "copied dash",
            "css": "<css>",
            "duplicate_slices": False,
            "json_metadata": json.dumps(
                {
                    "positions": original_dash.position,
                    "color_namespace": "Color Namespace Test",
                    "color_scheme": "Color Scheme Test",
                }
            ),
        }
        pk = original_dash.id
        uri = f"api/v1/dashboard/{pk}/copy/"
        rv = self.client.post(uri, json=data)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response, {"result": {"id": ANY, "last_modified_time": ANY}})

        dash = (
            db.session.query(Dashboard)
            .filter(Dashboard.id == response["result"]["id"])
            .one()
        )
        self.assertNotEqual(dash.id, original_dash.id)
        self.assertEqual(len(dash.position), len(original_dash.position))
        self.assertEqual(dash.dashboard_title, "copied dash")
        self.assertEqual(dash.css, "<css>")
        self.assertEqual(dash.owners, [security_manager.find_user("admin")])
        self.assertCountEqual(dash.slices, original_dash.slices)
        self.assertEqual(dash.params_dict["color_namespace"], "Color Namespace Test")
        self.assertEqual(dash.params_dict["color_scheme"], "Color Scheme Test")

        db.session.delete(dash)
        db.session.commit()

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_copy_dashboard_duplicate_slices(self):
        self.login(username="admin")
        original_dash = (
            db.session.query(Dashboard).filter_by(slug="world_health").first()
        )

        data = {
            "dashboard_title": "copied dash",
            "css": "<css>",
            "duplicate_slices": True,
            "json_metadata": json.dumps(
                {
                    "positions": original_dash.position,
                    "color_namespace": "Color Namespace Test",
                    "color_scheme": "Color Scheme Test",
                }
            ),
        }
        pk = original_dash.id
        uri = f"api/v1/dashboard/{pk}/copy/"
        rv = self.client.post(uri, json=data)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response, {"result": {"id": ANY, "last_modified_time": ANY}})

        dash = (
            db.session.query(Dashboard)
            .filter(Dashboard.id == response["result"]["id"])
            .one()
        )
        self.assertNotEqual(dash.id, original_dash.id)
        self.assertEqual(len(dash.position), len(original_dash.position))
        self.assertEqual(dash.dashboard_title, "copied dash")
        self.assertEqual(dash.css, "<css>")
        self.assertEqual(dash.owners, [security_manager.find_user("admin")])
        self.assertEqual(dash.params_dict["color_namespace"], "Color Namespace Test")
        self.assertEqual(dash.params_dict["color_scheme"], "Color Scheme Test")
        self.assertEqual(len(dash.slices), len(original_dash.slices))
        for original_slc in original_dash.slices:
            for slc in dash.slices:
                self.assertNotEqual(slc.id, original_slc.id)

        for slc in dash.slices:
            db.session.delete(slc)

        db.session.delete(dash)
        db.session.commit()
