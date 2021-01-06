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
from typing import List, Optional
from datetime import datetime
from io import BytesIO
from unittest import mock
from zipfile import is_zipfile, ZipFile

import humanize
import prison
import pytest
import yaml
from sqlalchemy import and_
from sqlalchemy.sql import func

from tests.test_app import app
from superset.charts.commands.data import ChartDataCommand
from superset.connectors.connector_registry import ConnectorRegistry
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import async_query_manager, cache_manager, db, security_manager
from superset.models.annotations import AnnotationLayer
from superset.models.core import Database, FavStar, FavStarClassName
from superset.models.dashboard import Dashboard
from superset.models.reports import ReportSchedule, ReportScheduleType
from superset.models.slice import Slice
from superset.utils import core as utils
from superset.utils.core import AnnotationType, get_example_database

from tests.base_api_tests import ApiOwnersTestCaseMixin
from tests.base_tests import SupersetTestCase, post_assert_metric, test_client

from tests.fixtures.importexport import (
    chart_config,
    chart_metadata_config,
    database_config,
    dataset_config,
    dataset_metadata_config,
)
from tests.fixtures.energy_dashboard import load_energy_table_with_slice
from tests.fixtures.query_context import get_query_context, ANNOTATION_LAYERS
from tests.fixtures.unicode_dashboard import load_unicode_dashboard_with_slice
from tests.annotation_layers.fixtures import create_annotation_layers

CHART_DATA_URI = "api/v1/chart/data"
CHARTS_FIXTURE_COUNT = 10


class TestChartApi(SupersetTestCase, ApiOwnersTestCaseMixin):
    resource_name = "chart"

    def insert_chart(
        self,
        slice_name: str,
        owners: List[int],
        datasource_id: int,
        created_by=None,
        datasource_type: str = "table",
        description: Optional[str] = None,
        viz_type: Optional[str] = None,
        params: Optional[str] = None,
        cache_timeout: Optional[int] = None,
    ) -> Slice:
        obj_owners = list()
        for owner in owners:
            user = db.session.query(security_manager.user_model).get(owner)
            obj_owners.append(user)
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session
        )
        slice = Slice(
            cache_timeout=cache_timeout,
            created_by=created_by,
            datasource_id=datasource.id,
            datasource_name=datasource.name,
            datasource_type=datasource.type,
            description=description,
            owners=obj_owners,
            params=params,
            slice_name=slice_name,
            viz_type=viz_type,
        )
        db.session.add(slice)
        db.session.commit()
        return slice

    @pytest.fixture(autouse=True)
    def clear_data_cache(self):
        with app.app_context():
            cache_manager.data_cache.clear()
            yield

    @pytest.fixture()
    def create_charts(self):
        with self.create_app().app_context():
            charts = []
            admin = self.get_user("admin")
            for cx in range(CHARTS_FIXTURE_COUNT - 1):
                charts.append(self.insert_chart(f"name{cx}", [admin.id], 1))
            fav_charts = []
            for cx in range(round(CHARTS_FIXTURE_COUNT / 2)):
                fav_star = FavStar(
                    user_id=admin.id, class_name="slice", obj_id=charts[cx].id
                )
                db.session.add(fav_star)
                db.session.commit()
                fav_charts.append(fav_star)
            yield charts

            # rollback changes
            for chart in charts:
                db.session.delete(chart)
            for fav_chart in fav_charts:
                db.session.delete(fav_chart)
            db.session.commit()

    @pytest.fixture()
    def create_chart_with_report(self):
        with self.create_app().app_context():
            admin = self.get_user("admin")
            chart = self.insert_chart(f"chart_report", [admin.id], 1)
            report_schedule = ReportSchedule(
                type=ReportScheduleType.REPORT,
                name="report_with_chart",
                crontab="* * * * *",
                chart=chart,
            )
            db.session.commit()

            yield chart

            # rollback changes
            db.session.delete(report_schedule)
            db.session.delete(chart)
            db.session.commit()

    @pytest.fixture()
    def add_dashboard_to_chart(self):
        with self.create_app().app_context():
            admin = self.get_user("admin")

            self.chart = self.insert_chart("My chart", [admin.id], 1)

            self.original_dashboard = Dashboard()
            self.original_dashboard.dashboard_title = "Original Dashboard"
            self.original_dashboard.slug = "slug"
            self.original_dashboard.owners = [admin]
            self.original_dashboard.slices = [self.chart]
            self.original_dashboard.published = False
            db.session.add(self.original_dashboard)

            self.new_dashboard = Dashboard()
            self.new_dashboard.dashboard_title = "New Dashboard"
            self.new_dashboard.slug = "new_slug"
            self.new_dashboard.owners = [admin]
            self.new_dashboard.slices = []
            self.new_dashboard.published = False
            db.session.add(self.new_dashboard)

            db.session.commit()

            yield self.chart

            db.session.delete(self.original_dashboard)
            db.session.delete(self.new_dashboard)
            db.session.delete(self.chart)
            db.session.commit()

    def test_info_security_chart(self):
        """
        Chart API: Test info security
        """
        self.login(username="admin")
        params = {"keys": ["permissions"]}
        uri = f"api/v1/chart/_info?q={prison.dumps(params)}"
        rv = self.get_assert_metric(uri, "info")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert "can_read" in data["permissions"]
        assert "can_write" in data["permissions"]
        assert len(data["permissions"]) == 2

    def create_chart_import(self):
        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open("chart_export/metadata.yaml", "w") as fp:
                fp.write(yaml.safe_dump(chart_metadata_config).encode())
            with bundle.open(
                "chart_export/databases/imported_database.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(database_config).encode())
            with bundle.open("chart_export/datasets/imported_dataset.yaml", "w") as fp:
                fp.write(yaml.safe_dump(dataset_config).encode())
            with bundle.open("chart_export/charts/imported_chart.yaml", "w") as fp:
                fp.write(yaml.safe_dump(chart_config).encode())
        buf.seek(0)
        return buf

    def test_delete_chart(self):
        """
        Chart API: Test delete
        """
        admin_id = self.get_user("admin").id
        chart_id = self.insert_chart("name", [admin_id], 1).id
        self.login(username="admin")
        uri = f"api/v1/chart/{chart_id}"
        rv = self.delete_assert_metric(uri, "delete")
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Slice).get(chart_id)
        self.assertEqual(model, None)

    def test_delete_bulk_charts(self):
        """
        Chart API: Test delete bulk
        """
        admin = self.get_user("admin")
        chart_count = 4
        chart_ids = list()
        for chart_name_index in range(chart_count):
            chart_ids.append(
                self.insert_chart(f"title{chart_name_index}", [admin.id], 1, admin).id
            )
        self.login(username="admin")
        argument = chart_ids
        uri = f"api/v1/chart/?q={prison.dumps(argument)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": f"Deleted {chart_count} charts"}
        self.assertEqual(response, expected_response)
        for chart_id in chart_ids:
            model = db.session.query(Slice).get(chart_id)
            self.assertEqual(model, None)

    def test_delete_bulk_chart_bad_request(self):
        """
        Chart API: Test delete bulk bad request
        """
        chart_ids = [1, "a"]
        self.login(username="admin")
        argument = chart_ids
        uri = f"api/v1/chart/?q={prison.dumps(argument)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        self.assertEqual(rv.status_code, 400)

    def test_delete_not_found_chart(self):
        """
        Chart API: Test not found delete
        """
        self.login(username="admin")
        chart_id = 1000
        uri = f"api/v1/chart/{chart_id}"
        rv = self.delete_assert_metric(uri, "delete")
        self.assertEqual(rv.status_code, 404)

    @pytest.mark.usefixtures("create_chart_with_report")
    def test_delete_chart_with_report(self):
        """
        Chart API: Test delete with associated report
        """
        self.login(username="admin")
        chart = (
            db.session.query(Slice)
            .filter(Slice.slice_name == "chart_report")
            .one_or_none()
        )
        uri = f"api/v1/chart/{chart.id}"
        rv = self.client.delete(uri)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 422)
        expected_response = {
            "message": "There are associated alerts or reports: report_with_chart"
        }
        self.assertEqual(response, expected_response)

    def test_delete_bulk_charts_not_found(self):
        """
        Chart API: Test delete bulk not found
        """
        max_id = db.session.query(func.max(Slice.id)).scalar()
        chart_ids = [max_id + 1, max_id + 2]
        self.login(username="admin")
        uri = f"api/v1/chart/?q={prison.dumps(chart_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        self.assertEqual(rv.status_code, 404)

    @pytest.mark.usefixtures("create_chart_with_report", "create_charts")
    def test_bulk_delete_chart_with_report(self):
        """
        Chart API: Test bulk delete with associated report
        """
        self.login(username="admin")
        chart_with_report = (
            db.session.query(Slice.id)
            .filter(Slice.slice_name == "chart_report")
            .one_or_none()
        )

        charts = db.session.query(Slice.id).filter(Slice.slice_name.like("name%")).all()
        chart_ids = [chart.id for chart in charts]
        chart_ids.append(chart_with_report.id)

        uri = f"api/v1/chart/?q={prison.dumps(chart_ids)}"
        rv = self.client.delete(uri)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 422)
        expected_response = {
            "message": "There are associated alerts or reports: report_with_chart"
        }
        self.assertEqual(response, expected_response)

    def test_delete_chart_admin_not_owned(self):
        """
        Chart API: Test admin delete not owned
        """
        gamma_id = self.get_user("gamma").id
        chart_id = self.insert_chart("title", [gamma_id], 1).id

        self.login(username="admin")
        uri = f"api/v1/chart/{chart_id}"
        rv = self.delete_assert_metric(uri, "delete")
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Slice).get(chart_id)
        self.assertEqual(model, None)

    def test_delete_bulk_chart_admin_not_owned(self):
        """
        Chart API: Test admin delete bulk not owned
        """
        gamma_id = self.get_user("gamma").id
        chart_count = 4
        chart_ids = list()
        for chart_name_index in range(chart_count):
            chart_ids.append(
                self.insert_chart(f"title{chart_name_index}", [gamma_id], 1).id
            )

        self.login(username="admin")
        argument = chart_ids
        uri = f"api/v1/chart/?q={prison.dumps(argument)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 200)
        expected_response = {"message": f"Deleted {chart_count} charts"}
        self.assertEqual(response, expected_response)

        for chart_id in chart_ids:
            model = db.session.query(Slice).get(chart_id)
            self.assertEqual(model, None)

    def test_delete_chart_not_owned(self):
        """
        Chart API: Test delete try not owned
        """
        user_alpha1 = self.create_user(
            "alpha1", "password", "Alpha", email="alpha1@superset.org"
        )
        user_alpha2 = self.create_user(
            "alpha2", "password", "Alpha", email="alpha2@superset.org"
        )
        chart = self.insert_chart("title", [user_alpha1.id], 1)
        self.login(username="alpha2", password="password")
        uri = f"api/v1/chart/{chart.id}"
        rv = self.delete_assert_metric(uri, "delete")
        self.assertEqual(rv.status_code, 403)
        db.session.delete(chart)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
        db.session.commit()

    def test_delete_bulk_chart_not_owned(self):
        """
        Chart API: Test delete bulk try not owned
        """
        user_alpha1 = self.create_user(
            "alpha1", "password", "Alpha", email="alpha1@superset.org"
        )
        user_alpha2 = self.create_user(
            "alpha2", "password", "Alpha", email="alpha2@superset.org"
        )

        chart_count = 4
        charts = list()
        for chart_name_index in range(chart_count):
            charts.append(
                self.insert_chart(f"title{chart_name_index}", [user_alpha1.id], 1)
            )

        owned_chart = self.insert_chart("title_owned", [user_alpha2.id], 1)

        self.login(username="alpha2", password="password")

        # verify we can't delete not owned charts
        arguments = [chart.id for chart in charts]
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        self.assertEqual(rv.status_code, 403)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": "Forbidden"}
        self.assertEqual(response, expected_response)

        # # nothing is deleted in bulk with a list of owned and not owned charts
        arguments = [chart.id for chart in charts] + [owned_chart.id]
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        self.assertEqual(rv.status_code, 403)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": "Forbidden"}
        self.assertEqual(response, expected_response)

        for chart in charts:
            db.session.delete(chart)
        db.session.delete(owned_chart)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
        db.session.commit()

    def test_create_chart(self):
        """
        Chart API: Test create chart
        """
        admin_id = self.get_user("admin").id
        chart_data = {
            "slice_name": "name1",
            "description": "description1",
            "owners": [admin_id],
            "viz_type": "viz_type1",
            "params": "1234",
            "cache_timeout": 1000,
            "datasource_id": 1,
            "datasource_type": "table",
            "dashboards": [1, 2],
        }
        self.login(username="admin")
        uri = f"api/v1/chart/"
        rv = self.post_assert_metric(uri, chart_data, "post")
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(Slice).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

    def test_create_simple_chart(self):
        """
        Chart API: Test create simple chart
        """
        chart_data = {
            "slice_name": "title1",
            "datasource_id": 1,
            "datasource_type": "table",
        }
        self.login(username="admin")
        uri = f"api/v1/chart/"
        rv = self.post_assert_metric(uri, chart_data, "post")
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(Slice).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

    def test_create_chart_validate_owners(self):
        """
        Chart API: Test create validate owners
        """
        chart_data = {
            "slice_name": "title1",
            "datasource_id": 1,
            "datasource_type": "table",
            "owners": [1000],
        }
        self.login(username="admin")
        uri = f"api/v1/chart/"
        rv = self.post_assert_metric(uri, chart_data, "post")
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"owners": ["Owners are invalid"]}}
        self.assertEqual(response, expected_response)

    def test_create_chart_validate_params(self):
        """
        Chart API: Test create validate params json
        """
        chart_data = {
            "slice_name": "title1",
            "datasource_id": 1,
            "datasource_type": "table",
            "params": '{"A:"a"}',
        }
        self.login(username="admin")
        uri = f"api/v1/chart/"
        rv = self.post_assert_metric(uri, chart_data, "post")
        self.assertEqual(rv.status_code, 400)

    def test_create_chart_validate_datasource(self):
        """
        Chart API: Test create validate datasource
        """
        self.login(username="admin")
        chart_data = {
            "slice_name": "title1",
            "datasource_id": 1,
            "datasource_type": "unknown",
        }
        uri = f"api/v1/chart/"
        rv = self.post_assert_metric(uri, chart_data, "post")
        self.assertEqual(rv.status_code, 400)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            response,
            {"message": {"datasource_type": ["Must be one of: druid, table, view."]}},
        )
        chart_data = {
            "slice_name": "title1",
            "datasource_id": 0,
            "datasource_type": "table",
        }
        uri = f"api/v1/chart/"
        rv = self.post_assert_metric(uri, chart_data, "post")
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            response, {"message": {"datasource_id": ["Datasource does not exist"]}}
        )

    def test_update_chart(self):
        """
        Chart API: Test update
        """
        admin = self.get_user("admin")
        gamma = self.get_user("gamma")

        chart_id = self.insert_chart("title", [admin.id], 1, admin).id
        birth_names_table_id = SupersetTestCase.get_table_by_name("birth_names").id
        chart_data = {
            "slice_name": "title1_changed",
            "description": "description1",
            "owners": [gamma.id],
            "viz_type": "viz_type1",
            "params": """{"a": 1}""",
            "cache_timeout": 1000,
            "datasource_id": birth_names_table_id,
            "datasource_type": "table",
            "dashboards": [1],
        }
        self.login(username="admin")
        uri = f"api/v1/chart/{chart_id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Slice).get(chart_id)
        related_dashboard = db.session.query(Dashboard).get(1)
        self.assertEqual(model.created_by, admin)
        self.assertEqual(model.slice_name, "title1_changed")
        self.assertEqual(model.description, "description1")
        self.assertIn(admin, model.owners)
        self.assertIn(gamma, model.owners)
        self.assertEqual(model.viz_type, "viz_type1")
        self.assertEqual(model.params, """{"a": 1}""")
        self.assertEqual(model.cache_timeout, 1000)
        self.assertEqual(model.datasource_id, birth_names_table_id)
        self.assertEqual(model.datasource_type, "table")
        self.assertEqual(model.datasource_name, "birth_names")
        self.assertIn(related_dashboard, model.dashboards)
        db.session.delete(model)
        db.session.commit()

    def test_update_chart_new_owner(self):
        """
        Chart API: Test update set new owner to current user
        """
        gamma = self.get_user("gamma")
        admin = self.get_user("admin")
        chart_id = self.insert_chart("title", [gamma.id], 1).id
        chart_data = {"slice_name": "title1_changed"}
        self.login(username="admin")
        uri = f"api/v1/chart/{chart_id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Slice).get(chart_id)
        self.assertIn(admin, model.owners)
        db.session.delete(model)
        db.session.commit()

    @pytest.mark.usefixtures("add_dashboard_to_chart")
    def test_update_chart_new_dashboards(self):
        """
        Chart API: Test update set new owner to current user
        """
        chart_data = {
            "slice_name": "title1_changed",
            "dashboards": [self.new_dashboard.id],
        }
        self.login(username="admin")
        uri = f"api/v1/chart/{self.chart.id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        self.assertEqual(rv.status_code, 200)
        self.assertIn(self.new_dashboard, self.chart.dashboards)
        self.assertNotIn(self.original_dashboard, self.chart.dashboards)

    @pytest.mark.usefixtures("add_dashboard_to_chart")
    def test_not_update_chart_none_dashboards(self):
        """
        Chart API: Test update set new owner to current user
        """
        chart_data = {"slice_name": "title1_changed_again"}
        self.login(username="admin")
        uri = f"api/v1/chart/{self.chart.id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        self.assertEqual(rv.status_code, 200)
        self.assertIn(self.original_dashboard, self.chart.dashboards)
        self.assertEqual(len(self.chart.dashboards), 1)

    def test_update_chart_not_owned(self):
        """
        Chart API: Test update not owned
        """
        user_alpha1 = self.create_user(
            "alpha1", "password", "Alpha", email="alpha1@superset.org"
        )
        user_alpha2 = self.create_user(
            "alpha2", "password", "Alpha", email="alpha2@superset.org"
        )
        chart = self.insert_chart("title", [user_alpha1.id], 1)

        self.login(username="alpha2", password="password")
        chart_data = {"slice_name": "title1_changed"}
        uri = f"api/v1/chart/{chart.id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        self.assertEqual(rv.status_code, 403)
        db.session.delete(chart)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
        db.session.commit()

    def test_update_chart_validate_datasource(self):
        """
        Chart API: Test update validate datasource
        """
        admin = self.get_user("admin")
        chart = self.insert_chart("title", [admin.id], 1)
        self.login(username="admin")
        chart_data = {"datasource_id": 1, "datasource_type": "unknown"}
        uri = f"api/v1/chart/{chart.id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        self.assertEqual(rv.status_code, 400)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            response,
            {"message": {"datasource_type": ["Must be one of: druid, table, view."]}},
        )
        chart_data = {"datasource_id": 0, "datasource_type": "table"}
        uri = f"api/v1/chart/{chart.id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            response, {"message": {"datasource_id": ["Datasource does not exist"]}}
        )
        db.session.delete(chart)
        db.session.commit()

    def test_update_chart_validate_owners(self):
        """
        Chart API: Test update validate owners
        """
        chart_data = {
            "slice_name": "title1",
            "datasource_id": 1,
            "datasource_type": "table",
            "owners": [1000],
        }
        self.login(username="admin")
        uri = f"api/v1/chart/"
        rv = self.client.post(uri, json=chart_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"owners": ["Owners are invalid"]}}
        self.assertEqual(response, expected_response)

    def test_get_chart(self):
        """
        Chart API: Test get chart
        """
        admin = self.get_user("admin")
        chart = self.insert_chart("title", [admin.id], 1)
        self.login(username="admin")
        uri = f"api/v1/chart/{chart.id}"
        rv = self.get_assert_metric(uri, "get")
        self.assertEqual(rv.status_code, 200)
        expected_result = {
            "cache_timeout": None,
            "dashboards": [],
            "description": None,
            "owners": [
                {
                    "id": 1,
                    "username": "admin",
                    "first_name": "admin",
                    "last_name": "user",
                }
            ],
            "params": None,
            "slice_name": "title",
            "viz_type": None,
        }
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["result"], expected_result)
        db.session.delete(chart)
        db.session.commit()

    def test_get_chart_not_found(self):
        """
        Chart API: Test get chart not found
        """
        chart_id = 1000
        self.login(username="admin")
        uri = f"api/v1/chart/{chart_id}"
        rv = self.get_assert_metric(uri, "get")
        self.assertEqual(rv.status_code, 404)

    def test_get_chart_no_data_access(self):
        """
        Chart API: Test get chart without data access
        """
        self.login(username="gamma")
        chart_no_access = (
            db.session.query(Slice)
            .filter_by(slice_name="Girl Name Cloud")
            .one_or_none()
        )
        uri = f"api/v1/chart/{chart_no_access.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    @pytest.mark.usefixtures("load_unicode_dashboard_with_slice")
    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_get_charts(self):
        """
        Chart API: Test get charts
        """
        self.login(username="admin")
        uri = f"api/v1/chart/"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 33)

    def test_get_charts_changed_on(self):
        """
        Dashboard API: Test get charts changed on
        """
        admin = self.get_user("admin")
        start_changed_on = datetime.now()
        chart = self.insert_chart("foo_a", [admin.id], 1, description="ZY_bar")

        self.login(username="admin")

        arguments = {
            "order_column": "changed_on_delta_humanized",
            "order_direction": "desc",
        }
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"

        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            data["result"][0]["changed_on_delta_humanized"],
            humanize.naturaltime(datetime.now() - start_changed_on),
        )

        # rollback changes
        db.session.delete(chart)
        db.session.commit()

    def test_get_charts_filter(self):
        """
        Chart API: Test get charts filter
        """
        self.login(username="admin")
        arguments = {"filters": [{"col": "slice_name", "opr": "sw", "value": "G"}]}
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 5)

    @pytest.fixture()
    def load_energy_charts(self):
        with app.app_context():
            admin = self.get_user("admin")
            energy_table = (
                db.session.query(SqlaTable)
                .filter_by(table_name="energy_usage")
                .one_or_none()
            )
            energy_table_id = 1
            if energy_table:
                energy_table_id = energy_table.id
            chart1 = self.insert_chart(
                "foo_a", [admin.id], energy_table_id, description="ZY_bar"
            )
            chart2 = self.insert_chart(
                "zy_foo", [admin.id], energy_table_id, description="desc1"
            )
            chart3 = self.insert_chart(
                "foo_b", [admin.id], energy_table_id, description="desc1zy_"
            )
            chart4 = self.insert_chart(
                "foo_c", [admin.id], energy_table_id, viz_type="viz_zy_"
            )
            chart5 = self.insert_chart(
                "bar", [admin.id], energy_table_id, description="foo"
            )

            yield
            # rollback changes
            db.session.delete(chart1)
            db.session.delete(chart2)
            db.session.delete(chart3)
            db.session.delete(chart4)
            db.session.delete(chart5)
            db.session.commit()

    @pytest.mark.usefixtures("load_energy_charts")
    def test_get_charts_custom_filter(self):
        """
        Chart API: Test get charts custom filter
        """

        arguments = {
            "filters": [{"col": "slice_name", "opr": "chart_all_text", "value": "zy_"}],
            "order_column": "slice_name",
            "order_direction": "asc",
            "keys": ["none"],
            "columns": ["slice_name", "description", "viz_type"],
        }
        self.login(username="admin")
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 4)

        expected_response = [
            {"description": "ZY_bar", "slice_name": "foo_a", "viz_type": None},
            {"description": "desc1zy_", "slice_name": "foo_b", "viz_type": None},
            {"description": None, "slice_name": "foo_c", "viz_type": "viz_zy_"},
            {"description": "desc1", "slice_name": "zy_foo", "viz_type": None},
        ]
        for index, item in enumerate(data["result"]):
            self.assertEqual(
                item["description"], expected_response[index]["description"]
            )
            self.assertEqual(item["slice_name"], expected_response[index]["slice_name"])
            self.assertEqual(item["viz_type"], expected_response[index]["viz_type"])

    @pytest.mark.usefixtures("load_energy_table_with_slice", "load_energy_charts")
    def test_admin_gets_filtered_energy_slices(self):
        # test filtering on datasource_name
        arguments = {
            "filters": [
                {"col": "slice_name", "opr": "chart_all_text", "value": "energy",}
            ],
            "keys": ["none"],
            "columns": ["slice_name"],
        }
        self.login(username="admin")

        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 8)

    @pytest.mark.usefixtures("load_energy_charts")
    def test_user_gets_none_filtered_energy_slices(self):
        # test filtering on datasource_name
        arguments = {
            "filters": [
                {"col": "slice_name", "opr": "chart_all_text", "value": "energy",}
            ],
            "keys": ["none"],
            "columns": ["slice_name"],
        }

        self.login(username="gamma")
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 0)

    @pytest.mark.usefixtures("create_charts")
    def test_get_charts_favorite_filter(self):
        """
        Chart API: Test get charts favorite filter
        """
        admin = self.get_user("admin")
        users_favorite_query = db.session.query(FavStar.obj_id).filter(
            and_(FavStar.user_id == admin.id, FavStar.class_name == "slice")
        )
        expected_models = (
            db.session.query(Slice)
            .filter(and_(Slice.id.in_(users_favorite_query)))
            .order_by(Slice.slice_name.asc())
            .all()
        )

        arguments = {
            "filters": [{"col": "id", "opr": "chart_is_favorite", "value": True}],
            "order_column": "slice_name",
            "order_direction": "asc",
            "keys": ["none"],
            "columns": ["slice_name"],
        }
        self.login(username="admin")
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert len(expected_models) == data["count"]

        for i, expected_model in enumerate(expected_models):
            assert expected_model.slice_name == data["result"][i]["slice_name"]

        # Test not favorite charts
        expected_models = (
            db.session.query(Slice)
            .filter(and_(~Slice.id.in_(users_favorite_query)))
            .order_by(Slice.slice_name.asc())
            .all()
        )
        arguments["filters"][0]["value"] = False
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert len(expected_models) == data["count"]

    @pytest.mark.usefixtures("create_charts")
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
                    FavStar.class_name == FavStarClassName.CHART,
                )
            )
            .all()
        ]

        assert users_favorite_ids
        arguments = [s.id for s in db.session.query(Slice.id).all()]
        self.login(username="admin")
        uri = f"api/v1/chart/favorite_status/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        for res in data["result"]:
            if res["id"] in users_favorite_ids:
                assert res["value"]

    def test_get_time_range(self):
        """
        Chart API: Test get actually time range from human readable string
        """
        self.login(username="admin")
        humanize_time_range = "100 years ago : now"
        uri = f"api/v1/time_range/?q={prison.dumps(humanize_time_range)}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 200)
        self.assertEqual(len(data["result"]), 3)

    @pytest.mark.usefixtures(
        "load_unicode_dashboard_with_slice", "load_energy_table_with_slice"
    )
    def test_get_charts_page(self):
        """
        Chart API: Test get charts filter
        """
        # Assuming we have 33 sample charts
        self.login(username="admin")
        arguments = {"page_size": 10, "page": 0}
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(len(data["result"]), 10)

        arguments = {"page_size": 10, "page": 3}
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(len(data["result"]), 3)

    def test_get_charts_no_data_access(self):
        """
        Chart API: Test get charts no data access
        """
        self.login(username="gamma")
        uri = f"api/v1/chart/"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 0)

    def test_chart_data_simple(self):
        """
        Chart data API: Test chart data query
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["result"][0]["rowcount"], 45)

    def test_chart_data_applied_time_extras(self):
        """
        Chart data API: Test chart data query with applied time extras
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["queries"][0]["applied_time_extras"] = {
            "__time_range": "100 years ago : now",
            "__time_origin": "now",
        }
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            data["result"][0]["applied_filters"],
            [{"column": "gender"}, {"column": "__time_range"},],
        )
        self.assertEqual(
            data["result"][0]["rejected_filters"],
            [{"column": "__time_origin", "reason": "not_druid_datasource"},],
        )
        self.assertEqual(data["result"][0]["rowcount"], 45)

    def test_chart_data_limit_offset(self):
        """
        Chart data API: Test chart data query with limit and offset
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["queries"][0]["row_limit"] = 5
        request_payload["queries"][0]["row_offset"] = 0
        request_payload["queries"][0]["orderby"] = [["name", True]]
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]
        self.assertEqual(result["rowcount"], 5)

        # TODO: fix offset for presto DB
        if get_example_database().backend == "presto":
            return

        # ensure that offset works properly
        offset = 2
        expected_name = result["data"][offset]["name"]
        request_payload["queries"][0]["row_offset"] = offset
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]
        self.assertEqual(result["rowcount"], 5)
        self.assertEqual(result["data"][0]["name"], expected_name)

    @mock.patch(
        "superset.common.query_object.config", {**app.config, "ROW_LIMIT": 7},
    )
    def test_chart_data_default_row_limit(self):
        """
        Chart data API: Ensure row count doesn't exceed default limit
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        del request_payload["queries"][0]["row_limit"]
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]
        self.assertEqual(result["rowcount"], 7)

    @mock.patch(
        "superset.common.query_context.config", {**app.config, "SAMPLES_ROW_LIMIT": 5},
    )
    def test_chart_data_default_sample_limit(self):
        """
        Chart data API: Ensure sample response row count doesn't exceed default limit
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["result_type"] = utils.ChartDataResultType.SAMPLES
        request_payload["queries"][0]["row_limit"] = 10
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]
        self.assertEqual(result["rowcount"], 5)

    def test_chart_data_incorrect_result_type(self):
        """
        Chart data API: Test chart data with unsupported result type
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["result_type"] = "qwerty"
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 400)

    def test_chart_data_incorrect_result_format(self):
        """
        Chart data API: Test chart data with unsupported result format
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["result_format"] = "qwerty"
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 400)

    def test_chart_data_query_result_type(self):
        """
        Chart data API: Test chart data with query result format
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["result_type"] = utils.ChartDataResultType.QUERY
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)

    def test_chart_data_csv_result_format(self):
        """
        Chart data API: Test chart data with CSV result format
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["result_format"] = "csv"
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)

    def test_chart_data_mixed_case_filter_op(self):
        """
        Chart data API: Ensure mixed case filter operator generates valid result
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["queries"][0]["filters"][0]["op"] = "In"
        request_payload["queries"][0]["row_limit"] = 10
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]
        self.assertEqual(result["rowcount"], 10)

    def test_chart_data_prophet(self):
        """
        Chart data API: Ensure prophet post transformation works
        """
        pytest.importorskip("fbprophet")
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        time_grain = "P1Y"
        request_payload["queries"][0]["is_timeseries"] = True
        request_payload["queries"][0]["groupby"] = []
        request_payload["queries"][0]["extras"] = {"time_grain_sqla": time_grain}
        request_payload["queries"][0]["granularity"] = "ds"
        request_payload["queries"][0]["post_processing"] = [
            {
                "operation": "prophet",
                "options": {
                    "time_grain": time_grain,
                    "periods": 3,
                    "confidence_interval": 0.9,
                },
            }
        ]
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]
        row = result["data"][0]
        self.assertIn("__timestamp", row)
        self.assertIn("sum__num", row)
        self.assertIn("sum__num__yhat", row)
        self.assertIn("sum__num__yhat_upper", row)
        self.assertIn("sum__num__yhat_lower", row)
        self.assertEqual(result["rowcount"], 47)

    def test_chart_data_query_missing_filter(self):
        """
        Chart data API: Ensure filter referencing missing column is ignored
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["queries"][0]["filters"] = [
            {"col": "non_existent_filter", "op": "==", "val": "foo"},
        ]
        request_payload["result_type"] = utils.ChartDataResultType.QUERY
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)
        response_payload = json.loads(rv.data.decode("utf-8"))
        assert "non_existent_filter" not in response_payload["result"][0]["query"]

    def test_chart_data_no_data(self):
        """
        Chart data API: Test chart data with empty result
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["queries"][0]["filters"] = [
            {"col": "gender", "op": "==", "val": "foo"}
        ]
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]
        self.assertEqual(result["rowcount"], 0)
        self.assertEqual(result["data"], [])

    def test_chart_data_incorrect_request(self):
        """
        Chart data API: Test chart data with invalid SQL
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["queries"][0]["filters"] = []
        # erroneus WHERE-clause
        request_payload["queries"][0]["extras"]["where"] = "(gender abc def)"
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 400)

    def test_chart_data_with_invalid_datasource(self):
        """
        Chart data API: Test chart data query with invalid schema
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        payload["datasource"] = "abc"
        rv = self.post_assert_metric(CHART_DATA_URI, payload, "data")
        self.assertEqual(rv.status_code, 400)

    def test_chart_data_with_invalid_enum_value(self):
        """
        Chart data API: Test chart data query with invalid enum value
        """
        self.login(username="admin")
        payload = get_query_context("birth_names")
        payload["queries"][0]["extras"]["time_range_endpoints"] = [
            "abc",
            "EXCLUSIVE",
        ]
        rv = self.client.post(CHART_DATA_URI, json=payload)
        self.assertEqual(rv.status_code, 400)

    def test_query_exec_not_allowed(self):
        """
        Chart data API: Test chart data query not allowed
        """
        self.login(username="gamma")
        payload = get_query_context("birth_names")
        rv = self.post_assert_metric(CHART_DATA_URI, payload, "data")
        self.assertEqual(rv.status_code, 401)

    def test_chart_data_jinja_filter_request(self):
        """
        Chart data API: Ensure request referencing filters via jinja renders a correct query
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["result_type"] = utils.ChartDataResultType.QUERY
        request_payload["queries"][0]["filters"] = [
            {"col": "gender", "op": "==", "val": "boy"}
        ]
        request_payload["queries"][0]["extras"][
            "where"
        ] = "('boy' = '{{ filter_values('gender', 'xyz' )[0] }}')"
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        response_payload = json.loads(rv.data.decode("utf-8"))
        result = response_payload["result"][0]["query"]
        if get_example_database().backend != "presto":
            assert "('boy' = 'boy')" in result

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        GLOBAL_ASYNC_QUERIES=True,
    )
    def test_chart_data_async(self):
        """
        Chart data API: Test chart data query (async)
        """
        async_query_manager.init_app(app)
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 202)
        data = json.loads(rv.data.decode("utf-8"))
        keys = list(data.keys())
        self.assertCountEqual(
            keys, ["channel_id", "job_id", "user_id", "status", "errors", "result_url"]
        )

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        GLOBAL_ASYNC_QUERIES=True,
    )
    def test_chart_data_async_results_type(self):
        """
        Chart data API: Test chart data query non-JSON format (async)
        """
        async_query_manager.init_app(app)
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        request_payload["result_type"] = "results"
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        GLOBAL_ASYNC_QUERIES=True,
    )
    def test_chart_data_async_invalid_token(self):
        """
        Chart data API: Test chart data query (async)
        """
        async_query_manager.init_app(app)
        self.login(username="admin")
        request_payload = get_query_context("birth_names")
        test_client.set_cookie(
            "localhost", app.config["GLOBAL_ASYNC_QUERIES_JWT_COOKIE_NAME"], "foo"
        )
        rv = post_assert_metric(test_client, CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 401)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        GLOBAL_ASYNC_QUERIES=True,
    )
    @mock.patch.object(ChartDataCommand, "load_query_context_from_cache")
    def test_chart_data_cache(self, load_qc_mock):
        """
        Chart data cache API: Test chart data async cache request
        """
        async_query_manager.init_app(app)
        self.login(username="admin")
        query_context = get_query_context("birth_names")
        load_qc_mock.return_value = query_context
        orig_run = ChartDataCommand.run

        def mock_run(self, **kwargs):
            assert kwargs["force_cached"] == True
            # override force_cached to get result from DB
            return orig_run(self, force_cached=False)

        with mock.patch.object(ChartDataCommand, "run", new=mock_run):
            rv = self.get_assert_metric(
                f"{CHART_DATA_URI}/test-cache-key", "data_from_cache"
            )
            data = json.loads(rv.data.decode("utf-8"))

        self.assertEqual(rv.status_code, 200)
        self.assertEqual(data["result"][0]["rowcount"], 45)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        GLOBAL_ASYNC_QUERIES=True,
    )
    @mock.patch.object(ChartDataCommand, "load_query_context_from_cache")
    def test_chart_data_cache_run_failed(self, load_qc_mock):
        """
        Chart data cache API: Test chart data async cache request with run failure
        """
        async_query_manager.init_app(app)
        self.login(username="admin")
        query_context = get_query_context("birth_names")
        load_qc_mock.return_value = query_context
        rv = self.get_assert_metric(
            f"{CHART_DATA_URI}/test-cache-key", "data_from_cache"
        )
        data = json.loads(rv.data.decode("utf-8"))

        self.assertEqual(rv.status_code, 422)
        self.assertEqual(data["message"], "Error loading data from cache")

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        GLOBAL_ASYNC_QUERIES=True,
    )
    @mock.patch.object(ChartDataCommand, "load_query_context_from_cache")
    def test_chart_data_cache_no_login(self, load_qc_mock):
        """
        Chart data cache API: Test chart data async cache request (no login)
        """
        async_query_manager.init_app(app)
        query_context = get_query_context("birth_names")
        load_qc_mock.return_value = query_context
        orig_run = ChartDataCommand.run

        def mock_run(self, **kwargs):
            assert kwargs["force_cached"] == True
            # override force_cached to get result from DB
            return orig_run(self, force_cached=False)

        with mock.patch.object(ChartDataCommand, "run", new=mock_run):
            rv = self.get_assert_metric(
                f"{CHART_DATA_URI}/test-cache-key", "data_from_cache"
            )

        self.assertEqual(rv.status_code, 401)

    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        GLOBAL_ASYNC_QUERIES=True,
    )
    def test_chart_data_cache_key_error(self):
        """
        Chart data cache API: Test chart data async cache request with invalid cache key
        """
        async_query_manager.init_app(app)
        self.login(username="admin")
        rv = self.get_assert_metric(
            f"{CHART_DATA_URI}/test-cache-key", "data_from_cache"
        )

        self.assertEqual(rv.status_code, 404)

    def test_export_chart(self):
        """
        Chart API: Test export chart
        """
        example_chart = db.session.query(Slice).all()[0]
        argument = [example_chart.id]
        uri = f"api/v1/chart/export/?q={prison.dumps(argument)}"

        self.login(username="admin")
        rv = self.get_assert_metric(uri, "export")

        assert rv.status_code == 200

        buf = BytesIO(rv.data)
        assert is_zipfile(buf)

    def test_export_chart_not_found(self):
        """
        Chart API: Test export chart not found
        """
        # Just one does not exist and we get 404
        argument = [-1, 1]
        uri = f"api/v1/chart/export/?q={prison.dumps(argument)}"
        self.login(username="admin")
        rv = self.get_assert_metric(uri, "export")

        assert rv.status_code == 404

    def test_export_chart_gamma(self):
        """
        Chart API: Test export chart has gamma
        """
        example_chart = db.session.query(Slice).all()[0]
        argument = [example_chart.id]
        uri = f"api/v1/chart/export/?q={prison.dumps(argument)}"

        self.login(username="gamma")
        rv = self.client.get(uri)

        assert rv.status_code == 404

    def test_import_chart(self):
        """
        Chart API: Test import chart
        """
        self.login(username="admin")
        uri = "api/v1/chart/import/"

        buf = self.create_chart_import()
        form_data = {
            "formData": (buf, "chart_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert database.database_name == "imported_database"

        assert len(database.tables) == 1
        dataset = database.tables[0]
        assert dataset.table_name == "imported_dataset"
        assert str(dataset.uuid) == dataset_config["uuid"]

        chart = db.session.query(Slice).filter_by(uuid=chart_config["uuid"]).one()
        assert chart.table == dataset

        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_chart_overwrite(self):
        """
        Chart API: Test import existing chart
        """
        self.login(username="admin")
        uri = "api/v1/chart/import/"

        buf = self.create_chart_import()
        form_data = {
            "formData": (buf, "chart_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

        # import again without overwrite flag
        buf = self.create_chart_import()
        form_data = {
            "formData": (buf, "chart_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "message": {
                "charts/imported_chart.yaml": "Chart already exists and `overwrite=true` was not passed",
            }
        }

        # import with overwrite flag
        buf = self.create_chart_import()
        form_data = {
            "formData": (buf, "chart_export.zip"),
            "overwrite": "true",
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

        # clean up
        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        dataset = database.tables[0]
        chart = db.session.query(Slice).filter_by(uuid=chart_config["uuid"]).one()

        db.session.delete(chart)
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_chart_invalid(self):
        """
        Chart API: Test import invalid chart
        """
        self.login(username="admin")
        uri = "api/v1/chart/import/"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open("chart_export/metadata.yaml", "w") as fp:
                fp.write(yaml.safe_dump(dataset_metadata_config).encode())
            with bundle.open(
                "chart_export/databases/imported_database.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(database_config).encode())
            with bundle.open("chart_export/datasets/imported_dataset.yaml", "w") as fp:
                fp.write(yaml.safe_dump(dataset_config).encode())
            with bundle.open("chart_export/charts/imported_chart.yaml", "w") as fp:
                fp.write(yaml.safe_dump(chart_config).encode())
        buf.seek(0)

        form_data = {
            "formData": (buf, "chart_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "message": {"metadata.yaml": {"type": ["Must be equal to Slice."]}}
        }

    @pytest.mark.usefixtures("create_annotation_layers")
    def test_chart_data_annotations(self):
        """
        Chart data API: Test chart data query
        """
        self.login(username="admin")
        request_payload = get_query_context("birth_names")

        annotation_layers = []
        request_payload["queries"][0]["annotation_layers"] = annotation_layers

        # formula
        annotation_layers.append(ANNOTATION_LAYERS[AnnotationType.FORMULA])

        # interval
        interval_layer = (
            db.session.query(AnnotationLayer)
            .filter(AnnotationLayer.name == "name1")
            .one()
        )
        interval = ANNOTATION_LAYERS[AnnotationType.INTERVAL]
        interval["value"] = interval_layer.id
        annotation_layers.append(interval)

        # event
        event_layer = (
            db.session.query(AnnotationLayer)
            .filter(AnnotationLayer.name == "name2")
            .one()
        )
        event = ANNOTATION_LAYERS[AnnotationType.EVENT]
        event["value"] = event_layer.id
        annotation_layers.append(event)

        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        # response should only contain interval and event data, not formula
        self.assertEqual(len(data["result"][0]["annotation_data"]), 2)
