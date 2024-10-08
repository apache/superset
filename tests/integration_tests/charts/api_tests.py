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
"""Unit tests for Superset"""

from io import BytesIO
from unittest import mock
from unittest.mock import patch
from zipfile import is_zipfile, ZipFile

import prison
import pytest
import yaml
from flask_babel import lazy_gettext as _
from parameterized import parameterized
from sqlalchemy import and_
from sqlalchemy.sql import func

from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.commands.chart.exceptions import ChartDataQueryFailedError
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import cache_manager, db, security_manager
from superset.models.core import Database, FavStar, FavStarClassName
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.models import ReportSchedule, ReportScheduleType
from superset.tags.models import ObjectType, Tag, TaggedObject, TagType
from superset.utils import json
from superset.utils.core import get_example_default_schema
from tests.integration_tests.base_api_tests import ApiOwnersTestCaseMixin
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_data,  # noqa: F401
    load_energy_table_with_slice,  # noqa: F401
)
from tests.integration_tests.fixtures.importexport import (
    chart_config,
    chart_metadata_config,
    database_config,
    dataset_config,
    dataset_metadata_config,
)
from tests.integration_tests.fixtures.tags import (
    create_custom_tags,  # noqa: F401
    get_filter_params,
)
from tests.integration_tests.fixtures.unicode_dashboard import (
    load_unicode_dashboard_with_slice,  # noqa: F401
    load_unicode_data,  # noqa: F401
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)
from tests.integration_tests.insert_chart_mixin import InsertChartMixin
from tests.integration_tests.test_app import app
from tests.integration_tests.utils.get_dashboards import get_dashboards_ids

CHART_DATA_URI = "api/v1/chart/data"
CHARTS_FIXTURE_COUNT = 10


class TestChartApi(ApiOwnersTestCaseMixin, InsertChartMixin, SupersetTestCase):
    resource_name = "chart"

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
    def create_charts_created_by_gamma(self):
        with self.create_app().app_context():
            charts = []
            user = self.get_user("gamma")
            for cx in range(CHARTS_FIXTURE_COUNT - 1):
                charts.append(self.insert_chart(f"gamma{cx}", [user.id], 1))
            yield charts
            # rollback changes
            for chart in charts:
                db.session.delete(chart)
            db.session.commit()

    @pytest.fixture()
    def create_certified_charts(self):
        with self.create_app().app_context():
            certified_charts = []
            admin = self.get_user("admin")
            for cx in range(CHARTS_FIXTURE_COUNT):
                certified_charts.append(
                    self.insert_chart(
                        f"certified{cx}",
                        [admin.id],
                        1,
                        certified_by="John Doe",
                        certification_details="Sample certification",
                    )
                )

            yield certified_charts

            # rollback changes
            for chart in certified_charts:
                db.session.delete(chart)
            db.session.commit()

    @pytest.fixture()
    def create_chart_with_report(self):
        with self.create_app().app_context():
            admin = self.get_user("admin")
            chart = self.insert_chart("chart_report", [admin.id], 1)  # noqa: F541
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
            self.new_dashboard.published = False
            db.session.add(self.new_dashboard)

            db.session.commit()

            yield self.chart

            db.session.delete(self.original_dashboard)
            db.session.delete(self.new_dashboard)
            db.session.delete(self.chart)
            db.session.commit()

    @pytest.fixture
    def create_chart_with_tag(self, create_custom_tags):  # noqa: F811
        with self.create_app().app_context():
            alpha_user = self.get_user(ALPHA_USERNAME)

            chart = self.insert_chart(
                "chart with tag",
                [alpha_user.id],
                1,
            )

            tag = db.session.query(Tag).filter(Tag.name == "first_tag").first()
            tag_association = TaggedObject(
                object_id=chart.id,
                object_type=ObjectType.chart,
                tag=tag,
            )

            db.session.add(tag_association)
            db.session.commit()

            yield chart

            # rollback changes
            db.session.delete(tag_association)
            db.session.delete(chart)
            db.session.commit()

    @pytest.fixture
    def create_charts_some_with_tags(self, create_custom_tags):  # noqa: F811
        """
        Fixture that creates 4 charts:
            - ``first_chart`` is associated with ``first_tag``
            - ``second_chart`` is associated with ``second_tag``
            - ``third_chart`` is associated with both ``first_tag`` and ``second_tag``
            - ``fourth_chart`` is not associated with any tag

        Relies on the ``create_custom_tags`` fixture for the tag creation.
        """
        with self.create_app().app_context():
            admin_user = self.get_user(ADMIN_USERNAME)

            tags = {
                "first_tag": db.session.query(Tag)
                .filter(Tag.name == "first_tag")
                .first(),
                "second_tag": db.session.query(Tag)
                .filter(Tag.name == "second_tag")
                .first(),
            }

            chart_names = ["first_chart", "second_chart", "third_chart", "fourth_chart"]
            charts = [
                self.insert_chart(name, [admin_user.id], 1) for name in chart_names
            ]

            tag_associations = [
                TaggedObject(
                    object_id=charts[0].id,
                    object_type=ObjectType.chart,
                    tag=tags["first_tag"],
                ),
                TaggedObject(
                    object_id=charts[1].id,
                    object_type=ObjectType.chart,
                    tag=tags["second_tag"],
                ),
                TaggedObject(
                    object_id=charts[2].id,
                    object_type=ObjectType.chart,
                    tag=tags["first_tag"],
                ),
                TaggedObject(
                    object_id=charts[2].id,
                    object_type=ObjectType.chart,
                    tag=tags["second_tag"],
                ),
            ]

            for association in tag_associations:
                db.session.add(association)
            db.session.commit()

            yield charts

            # rollback changes
            for association in tag_associations:
                db.session.delete(association)
            for chart in charts:
                db.session.delete(chart)
            db.session.commit()

    def test_info_security_chart(self):
        """
        Chart API: Test info security
        """
        self.login(ADMIN_USERNAME)
        params = {"keys": ["permissions"]}
        uri = f"api/v1/chart/_info?q={prison.dumps(params)}"
        rv = self.get_assert_metric(uri, "info")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert set(data["permissions"]) == {
            "can_read",
            "can_write",
            "can_export",
            "can_warm_up_cache",
        }

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
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{chart_id}"
        rv = self.delete_assert_metric(uri, "delete")
        assert rv.status_code == 200
        model = db.session.query(Slice).get(chart_id)
        assert model is None

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
        self.login(ADMIN_USERNAME)
        argument = chart_ids
        uri = f"api/v1/chart/?q={prison.dumps(argument)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": f"Deleted {chart_count} charts"}
        assert response == expected_response
        for chart_id in chart_ids:
            model = db.session.query(Slice).get(chart_id)
            assert model is None

    def test_delete_bulk_chart_bad_request(self):
        """
        Chart API: Test delete bulk bad request
        """
        chart_ids = [1, "a"]
        self.login(ADMIN_USERNAME)
        argument = chart_ids
        uri = f"api/v1/chart/?q={prison.dumps(argument)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 400

    def test_delete_not_found_chart(self):
        """
        Chart API: Test not found delete
        """
        self.login(ADMIN_USERNAME)
        chart_id = 1000
        uri = f"api/v1/chart/{chart_id}"
        rv = self.delete_assert_metric(uri, "delete")
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_chart_with_report")
    def test_delete_chart_with_report(self):
        """
        Chart API: Test delete with associated report
        """
        self.login(ADMIN_USERNAME)
        chart = (
            db.session.query(Slice)
            .filter(Slice.slice_name == "chart_report")
            .one_or_none()
        )
        uri = f"api/v1/chart/{chart.id}"
        rv = self.client.delete(uri)
        response = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 422
        expected_response = {
            "message": "There are associated alerts or reports: report_with_chart"
        }
        assert response == expected_response

    def test_delete_bulk_charts_not_found(self):
        """
        Chart API: Test delete bulk not found
        """
        max_id = db.session.query(func.max(Slice.id)).scalar()
        chart_ids = [max_id + 1, max_id + 2]
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/?q={prison.dumps(chart_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_chart_with_report", "create_charts")
    def test_bulk_delete_chart_with_report(self):
        """
        Chart API: Test bulk delete with associated report
        """
        self.login(ADMIN_USERNAME)
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
        assert rv.status_code == 422
        expected_response = {
            "message": "There are associated alerts or reports: report_with_chart"
        }
        assert response == expected_response

    def test_delete_chart_admin_not_owned(self):
        """
        Chart API: Test admin delete not owned
        """
        gamma_id = self.get_user("gamma").id
        chart_id = self.insert_chart("title", [gamma_id], 1).id

        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{chart_id}"
        rv = self.delete_assert_metric(uri, "delete")
        assert rv.status_code == 200
        model = db.session.query(Slice).get(chart_id)
        assert model is None

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

        self.login(ADMIN_USERNAME)
        argument = chart_ids
        uri = f"api/v1/chart/?q={prison.dumps(argument)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        response = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        expected_response = {"message": f"Deleted {chart_count} charts"}
        assert response == expected_response

        for chart_id in chart_ids:
            model = db.session.query(Slice).get(chart_id)
            assert model is None

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
        assert rv.status_code == 403
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
        assert rv.status_code == 403
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": "Forbidden"}
        assert response == expected_response

        # # nothing is deleted in bulk with a list of owned and not owned charts
        arguments = [chart.id for chart in charts] + [owned_chart.id]
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 403
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": "Forbidden"}
        assert response == expected_response

        for chart in charts:
            db.session.delete(chart)
        db.session.delete(owned_chart)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
        db.session.commit()

    @pytest.mark.usefixtures(
        "load_world_bank_dashboard_with_slices",
        "load_birth_names_dashboard_with_slices",
    )
    def test_create_chart(self):
        """
        Chart API: Test create chart
        """
        dashboards_ids = get_dashboards_ids(["world_health", "births"])
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
            "dashboards": dashboards_ids,
            "certified_by": "John Doe",
            "certification_details": "Sample certification",
        }
        self.login(ADMIN_USERNAME)
        uri = "api/v1/chart/"
        rv = self.post_assert_metric(uri, chart_data, "post")
        assert rv.status_code == 201
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
        self.login(ADMIN_USERNAME)
        uri = "api/v1/chart/"
        rv = self.post_assert_metric(uri, chart_data, "post")
        assert rv.status_code == 201
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
        self.login(ADMIN_USERNAME)
        uri = "api/v1/chart/"
        rv = self.post_assert_metric(uri, chart_data, "post")
        assert rv.status_code == 422
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"owners": ["Owners are invalid"]}}
        assert response == expected_response

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
        self.login(ADMIN_USERNAME)
        uri = "api/v1/chart/"
        rv = self.post_assert_metric(uri, chart_data, "post")
        assert rv.status_code == 400

    def test_create_chart_validate_datasource(self):
        """
        Chart API: Test create validate datasource
        """
        self.login(ADMIN_USERNAME)
        chart_data = {
            "slice_name": "title1",
            "datasource_id": 1,
            "datasource_type": "unknown",
        }
        rv = self.post_assert_metric("/api/v1/chart/", chart_data, "post")
        assert rv.status_code == 400
        response = json.loads(rv.data.decode("utf-8"))
        assert response == {
            "message": {
                "datasource_type": [
                    "Must be one of: table, dataset, query, saved_query, view."
                ]
            }
        }
        chart_data = {
            "slice_name": "title1",
            "datasource_id": 0,
            "datasource_type": "table",
        }
        rv = self.post_assert_metric("/api/v1/chart/", chart_data, "post")
        assert rv.status_code == 422
        response = json.loads(rv.data.decode("utf-8"))
        assert response == {"message": {"datasource_id": ["Datasource does not exist"]}}

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_create_chart_validate_user_is_dashboard_owner(self):
        """
        Chart API: Test create validate user is dashboard owner
        """
        dash = db.session.query(Dashboard).filter_by(slug="world_health").first()
        # Must be published so that alpha user has read access to dash
        dash.published = True
        db.session.commit()
        chart_data = {
            "slice_name": "title1",
            "datasource_id": 1,
            "datasource_type": "table",
            "dashboards": [dash.id],
        }
        self.login(ALPHA_USERNAME)
        uri = "api/v1/chart/"
        rv = self.post_assert_metric(uri, chart_data, "post")
        assert rv.status_code == 403
        response = json.loads(rv.data.decode("utf-8"))
        assert response == {
            "message": "Changing one or more of these dashboards is forbidden"
        }

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_update_chart(self):
        """
        Chart API: Test update
        """
        schema = get_example_default_schema()
        full_table_name = f"{schema}.birth_names" if schema else "birth_names"

        admin = self.get_user("admin")
        gamma = self.get_user("gamma")
        birth_names_table_id = SupersetTestCase.get_table(name="birth_names").id
        chart_id = self.insert_chart(
            "title", [admin.id], birth_names_table_id, admin
        ).id
        dash_id = db.session.query(Dashboard.id).filter_by(slug="births").first()[0]
        chart_data = {
            "slice_name": "title1_changed",
            "description": "description1",
            "owners": [gamma.id],
            "viz_type": "viz_type1",
            "params": """{"a": 1}""",
            "cache_timeout": 1000,
            "datasource_id": birth_names_table_id,
            "datasource_type": "table",
            "dashboards": [dash_id],
            "certified_by": "Mario Rossi",
            "certification_details": "Edited certification",
        }
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{chart_id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        assert rv.status_code == 200
        model = db.session.query(Slice).get(chart_id)
        related_dashboard = db.session.query(Dashboard).filter_by(slug="births").first()
        assert model.created_by == admin
        assert model.slice_name == "title1_changed"
        assert model.description == "description1"
        assert admin not in model.owners
        assert gamma in model.owners
        assert model.viz_type == "viz_type1"
        assert model.params == '{"a": 1}'
        assert model.cache_timeout == 1000
        assert model.datasource_id == birth_names_table_id
        assert model.datasource_type == "table"
        assert model.datasource_name == full_table_name
        assert model.certified_by == "Mario Rossi"
        assert model.certification_details == "Edited certification"
        assert model.id in [slice.id for slice in related_dashboard.slices]
        db.session.delete(model)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_get_list_no_username(self):
        """
        Chart API: Tests that no username is returned
        """
        admin = self.get_user("admin")
        birth_names_table_id = SupersetTestCase.get_table(name="birth_names").id
        chart_id = self.insert_chart("title", [admin.id], birth_names_table_id).id
        chart_data = {
            "slice_name": (new_name := "title1_changed"),
            "owners": [admin.id],
        }
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{chart_id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        assert rv.status_code == 200
        model = db.session.query(Slice).get(chart_id)

        response = self.get_assert_metric("api/v1/chart/", "get_list")
        res = json.loads(response.data.decode("utf-8"))["result"]

        current_chart = [d for d in res if d["id"] == chart_id][0]
        assert current_chart["slice_name"] == new_name
        assert "username" not in current_chart["changed_by"].keys()
        assert "username" not in current_chart["owners"][0].keys()

        db.session.delete(model)
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_chart_get_no_username(self):
        """
        Chart API: Tests that no username is returned
        """
        admin = self.get_user("admin")
        birth_names_table_id = SupersetTestCase.get_table(name="birth_names").id
        chart_id = self.insert_chart("title", [admin.id], birth_names_table_id).id
        chart_data = {
            "slice_name": (new_name := "title1_changed"),
            "owners": [admin.id],
        }
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{chart_id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        assert rv.status_code == 200
        model = db.session.query(Slice).get(chart_id)

        response = self.get_assert_metric(uri, "get")
        res = json.loads(response.data.decode("utf-8"))["result"]

        assert res["slice_name"] == new_name
        assert "username" not in res["owners"][0].keys()

        db.session.delete(model)
        db.session.commit()

    def test_update_chart_new_owner_not_admin(self):
        """
        Chart API: Test update set new owner implicitly adds logged in owner
        """
        gamma = self.get_user("gamma_no_csv")
        alpha = self.get_user("alpha")
        chart_id = self.insert_chart("title", [gamma.id], 1).id
        chart_data = {
            "slice_name": (new_name := "title1_changed"),
            "owners": [alpha.id],
        }
        self.login(gamma.username)
        uri = f"api/v1/chart/{chart_id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        assert rv.status_code == 200
        model = db.session.query(Slice).get(chart_id)
        assert model.slice_name == new_name
        assert alpha in model.owners
        assert gamma in model.owners
        db.session.delete(model)
        db.session.commit()

    def test_update_chart_new_owner_admin(self):
        """
        Chart API: Test update set new owner as admin to other than current user
        """
        gamma = self.get_user("gamma")
        admin = self.get_user("admin")
        chart_id = self.insert_chart("title", [admin.id], 1).id
        chart_data = {"slice_name": "title1_changed", "owners": [gamma.id]}
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{chart_id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        assert rv.status_code == 200
        model = db.session.query(Slice).get(chart_id)
        assert admin not in model.owners
        assert gamma in model.owners
        db.session.delete(model)
        db.session.commit()

    @pytest.mark.usefixtures("add_dashboard_to_chart")
    def test_update_chart_preserve_ownership(self):
        """
        Chart API: Test update chart preserves owner list (if un-changed)
        """
        chart_data = {
            "slice_name": "title1_changed",
        }
        admin = self.get_user("admin")
        self.login(username="admin")
        uri = f"api/v1/chart/{self.chart.id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        assert rv.status_code == 200
        assert [admin] == self.chart.owners

    @pytest.mark.usefixtures("add_dashboard_to_chart")
    def test_update_chart_clear_owner_list(self):
        """
        Chart API: Test update chart admin can clear owner list
        """
        chart_data = {"slice_name": "title1_changed", "owners": []}
        self.get_user("admin")  # noqa: F841
        self.login(username="admin")
        uri = f"api/v1/chart/{self.chart.id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        assert rv.status_code == 200
        assert [] == self.chart.owners

    def test_update_chart_populate_owner(self):
        """
        Chart API: Test update admin can update chart with
        no owners to a different owner
        """
        gamma = self.get_user("gamma")
        admin = self.get_user("admin")
        chart_id = self.insert_chart("title", [], 1).id
        model = db.session.query(Slice).get(chart_id)
        assert model.owners == []
        chart_data = {"owners": [gamma.id]}
        self.login(username="admin")
        uri = f"api/v1/chart/{chart_id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        assert rv.status_code == 200
        model_updated = db.session.query(Slice).get(chart_id)
        assert admin not in model_updated.owners
        assert gamma in model_updated.owners
        db.session.delete(model_updated)
        db.session.commit()

    @pytest.mark.usefixtures("add_dashboard_to_chart")
    def test_update_chart_new_dashboards(self):
        """
        Chart API: Test update chart associating it with new dashboard
        """
        chart_data = {
            "slice_name": "title1_changed",
            "dashboards": [self.new_dashboard.id],
        }
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{self.chart.id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        assert rv.status_code == 200
        assert self.new_dashboard in self.chart.dashboards
        assert self.original_dashboard not in self.chart.dashboards

    @pytest.mark.usefixtures("add_dashboard_to_chart")
    def test_not_update_chart_none_dashboards(self):
        """
        Chart API: Test update chart without changing dashboards configuration
        """
        chart_data = {"slice_name": "title1_changed_again"}
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{self.chart.id}"
        rv = self.put_assert_metric(uri, chart_data, "put")
        assert rv.status_code == 200
        assert self.original_dashboard in self.chart.dashboards
        assert len(self.chart.dashboards) == 1

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
        assert rv.status_code == 403
        db.session.delete(chart)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
        db.session.commit()

    def test_update_chart_linked_with_not_owned_dashboard(self):
        """
        Chart API: Test update chart which is linked to not owned dashboard
        """
        user_alpha1 = self.create_user(
            "alpha1", "password", "Alpha", email="alpha1@superset.org"
        )
        user_alpha2 = self.create_user(
            "alpha2", "password", "Alpha", email="alpha2@superset.org"
        )
        chart = self.insert_chart("title", [user_alpha1.id], 1)

        original_dashboard = Dashboard()
        original_dashboard.dashboard_title = "Original Dashboard"
        original_dashboard.slug = "slug"
        original_dashboard.owners = [user_alpha1]
        original_dashboard.slices = [chart]
        original_dashboard.published = False
        db.session.add(original_dashboard)

        new_dashboard = Dashboard()
        new_dashboard.dashboard_title = "Cloned Dashboard"
        new_dashboard.slug = "new_slug"
        new_dashboard.owners = [user_alpha2]
        new_dashboard.slices = [chart]
        new_dashboard.published = False
        db.session.add(new_dashboard)

        self.login(username="alpha1", password="password")
        chart_data_with_invalid_dashboard = {
            "slice_name": "title1_changed",
            "dashboards": [original_dashboard.id, 0],
        }
        chart_data = {
            "slice_name": "title1_changed",
            "dashboards": [original_dashboard.id, new_dashboard.id],
        }
        uri = f"api/v1/chart/{chart.id}"

        rv = self.put_assert_metric(uri, chart_data_with_invalid_dashboard, "put")
        assert rv.status_code == 422
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"dashboards": ["Dashboards do not exist"]}}
        assert response == expected_response

        rv = self.put_assert_metric(uri, chart_data, "put")
        assert rv.status_code == 200

        db.session.delete(chart)
        db.session.delete(original_dashboard)
        db.session.delete(new_dashboard)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
        db.session.commit()

    def test_update_chart_validate_datasource(self):
        """
        Chart API: Test update validate datasource
        """
        admin = self.get_user("admin")
        chart = self.insert_chart("title", owners=[admin.id], datasource_id=1)
        self.login(ADMIN_USERNAME)

        chart_data = {"datasource_id": 1, "datasource_type": "unknown"}
        rv = self.put_assert_metric(f"/api/v1/chart/{chart.id}", chart_data, "put")
        assert rv.status_code == 400
        response = json.loads(rv.data.decode("utf-8"))
        assert response == {
            "message": {
                "datasource_type": [
                    "Must be one of: table, dataset, query, saved_query, view."
                ]
            }
        }

        chart_data = {"datasource_id": 0, "datasource_type": "table"}
        rv = self.put_assert_metric(f"/api/v1/chart/{chart.id}", chart_data, "put")
        assert rv.status_code == 422
        response = json.loads(rv.data.decode("utf-8"))
        assert response == {"message": {"datasource_id": ["Datasource does not exist"]}}

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
        self.login(ADMIN_USERNAME)
        uri = "api/v1/chart/"  # noqa: F541
        rv = self.client.post(uri, json=chart_data)
        assert rv.status_code == 422
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"owners": ["Owners are invalid"]}}
        assert response == expected_response

    @pytest.mark.usefixtures("load_world_bank_dashboard_with_slices")
    def test_get_chart(self):
        """
        Chart API: Test get chart
        """
        admin = self.get_user("admin")
        chart = self.insert_chart("title", [admin.id], 1)
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{chart.id}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 200
        expected_result = {
            "cache_timeout": None,
            "certified_by": None,
            "certification_details": None,
            "dashboards": [],
            "description": None,
            "owners": [
                {
                    "id": 1,
                    "first_name": "admin",
                    "last_name": "user",
                }
            ],
            "params": None,
            "slice_name": "title",
            "tags": [],
            "viz_type": None,
            "query_context": None,
            "is_managed_externally": False,
        }
        data = json.loads(rv.data.decode("utf-8"))
        assert "changed_on_delta_humanized" in data["result"]
        assert "id" in data["result"]
        assert "thumbnail_url" in data["result"]
        assert "url" in data["result"]
        for key, value in data["result"].items():
            # We can't assert timestamp values or id/urls
            if key not in (
                "changed_on_delta_humanized",
                "id",
                "thumbnail_url",
                "url",
            ):
                assert value == expected_result[key]
        db.session.delete(chart)
        db.session.commit()

    def test_get_chart_not_found(self):
        """
        Chart API: Test get chart not found
        """
        chart_id = 1000
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{chart_id}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 404

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_chart_no_data_access(self):
        """
        Chart API: Test get chart without data access
        """
        self.login(GAMMA_USERNAME)
        chart_no_access = (
            db.session.query(Slice)
            .filter_by(slice_name="Girl Name Cloud")
            .one_or_none()
        )
        uri = f"api/v1/chart/{chart_no_access.id}"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures(
        "load_energy_table_with_slice",
        "load_birth_names_dashboard_with_slices",
        "load_unicode_dashboard_with_slice",
        "load_world_bank_dashboard_with_slices",
    )
    def test_get_charts(self):
        """
        Chart API: Test get charts
        """
        self.login(ADMIN_USERNAME)
        uri = "api/v1/chart/"  # noqa: F541
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 33

    @pytest.mark.usefixtures("load_energy_table_with_slice", "add_dashboard_to_chart")
    def test_get_charts_dashboards(self):
        """
        Chart API: Test get charts with related dashboards
        """
        self.login(ADMIN_USERNAME)
        arguments = {
            "filters": [
                {"col": "slice_name", "opr": "eq", "value": self.chart.slice_name}
            ]
        }
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"][0]["dashboards"] == [
            {
                "id": self.original_dashboard.id,
                "dashboard_title": self.original_dashboard.dashboard_title,
            }
        ]

    @pytest.mark.usefixtures("load_energy_table_with_slice", "add_dashboard_to_chart")
    def test_get_charts_dashboard_filter(self):
        """
        Chart API: Test get charts with dashboard filter
        """
        self.login(ADMIN_USERNAME)
        arguments = {
            "filters": [
                {
                    "col": "dashboards",
                    "opr": "rel_m_m",
                    "value": self.original_dashboard.id,
                }
            ]
        }
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        result = data["result"]
        assert len(result) == 1
        assert result[0]["slice_name"] == self.chart.slice_name

    @pytest.mark.usefixtures("create_charts_some_with_tags")
    def test_get_charts_tag_filters(self):
        """
        Chart API: Test get charts with tag filters
        """
        # Get custom tags relationship
        tags = {
            "first_tag": db.session.query(Tag).filter(Tag.name == "first_tag").first(),
            "second_tag": db.session.query(Tag)
            .filter(Tag.name == "second_tag")
            .first(),
            "third_tag": db.session.query(Tag).filter(Tag.name == "third_tag").first(),
        }
        chart_tag_relationship = {
            tag.name: db.session.query(Slice.id)
            .join(Slice.tags)
            .filter(Tag.id == tag.id)
            .all()
            for tag in tags.values()
        }

        # Validate API results for each tag
        for tag_name, tag in tags.items():
            expected_charts = chart_tag_relationship[tag_name]

            # Filter by tag ID
            filter_params = get_filter_params("chart_tag_id", tag.id)
            response_by_id = self.get_list("chart", filter_params)
            assert response_by_id.status_code == 200
            data_by_id = json.loads(response_by_id.data.decode("utf-8"))

            # Filter by tag name
            filter_params = get_filter_params("chart_tags", tag.name)
            response_by_name = self.get_list("chart", filter_params)
            assert response_by_name.status_code == 200
            data_by_name = json.loads(response_by_name.data.decode("utf-8"))

            # Compare results
            assert data_by_id["count"] == data_by_name["count"], len(expected_charts)
            assert set(chart["id"] for chart in data_by_id["result"]) == set(
                chart["id"] for chart in data_by_name["result"]
            ), set(chart.id for chart in expected_charts)

    def test_get_charts_changed_on(self):
        """
        Dashboard API: Test get charts changed on
        """
        admin = self.get_user("admin")
        chart = self.insert_chart("foo_a", [admin.id], 1, description="ZY_bar")

        self.login(ADMIN_USERNAME)

        arguments = {
            "order_column": "changed_on_delta_humanized",
            "order_direction": "desc",
        }
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"

        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"][0]["changed_on_delta_humanized"] in (
            "now",
            "a second ago",
        )

        # rollback changes
        db.session.delete(chart)
        db.session.commit()

    @pytest.mark.usefixtures(
        "load_world_bank_dashboard_with_slices",
        "load_birth_names_dashboard_with_slices",
    )
    def test_get_charts_filter(self):
        """
        Chart API: Test get charts filter
        """
        self.login(ADMIN_USERNAME)
        arguments = {"filters": [{"col": "slice_name", "opr": "sw", "value": "G"}]}
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 5

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
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 4

        expected_response = [
            {"description": "ZY_bar", "slice_name": "foo_a", "viz_type": None},
            {"description": "desc1zy_", "slice_name": "foo_b", "viz_type": None},
            {"description": None, "slice_name": "foo_c", "viz_type": "viz_zy_"},
            {"description": "desc1", "slice_name": "zy_foo", "viz_type": None},
        ]
        for index, item in enumerate(data["result"]):
            assert item["description"] == expected_response[index]["description"]
            assert item["slice_name"] == expected_response[index]["slice_name"]
            assert item["viz_type"] == expected_response[index]["viz_type"]

    @pytest.mark.usefixtures("load_energy_table_with_slice", "load_energy_charts")
    def test_admin_gets_filtered_energy_slices(self):
        # test filtering on datasource_name
        arguments = {
            "filters": [
                {
                    "col": "slice_name",
                    "opr": "chart_all_text",
                    "value": "energy",
                }
            ],
            "keys": ["none"],
            "columns": ["slice_name", "description", "table.table_name"],
        }
        self.login(ADMIN_USERNAME)

        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        data = rv.json
        assert rv.status_code == 200
        assert data["count"] > 0
        for chart in data["result"]:
            assert (
                "energy"
                in " ".join(
                    [
                        chart["slice_name"] or "",
                        chart["description"] or "",
                        chart["table"]["table_name"] or "",
                    ]
                ).lower()
            )

    @pytest.mark.usefixtures("create_certified_charts")
    def test_gets_certified_charts_filter(self):
        arguments = {
            "filters": [
                {
                    "col": "id",
                    "opr": "chart_is_certified",
                    "value": True,
                }
            ],
            "keys": ["none"],
            "columns": ["slice_name"],
        }
        self.login(ADMIN_USERNAME)

        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == CHARTS_FIXTURE_COUNT

    @pytest.mark.usefixtures("create_charts")
    def test_gets_not_certified_charts_filter(self):
        arguments = {
            "filters": [
                {
                    "col": "id",
                    "opr": "chart_is_certified",
                    "value": False,
                }
            ],
            "keys": ["none"],
            "columns": ["slice_name"],
        }
        self.login(ADMIN_USERNAME)

        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 17

    @pytest.mark.usefixtures("load_energy_charts")
    def test_user_gets_none_filtered_energy_slices(self):
        # test filtering on datasource_name
        arguments = {
            "filters": [
                {
                    "col": "slice_name",
                    "opr": "chart_all_text",
                    "value": "energy",
                }
            ],
            "keys": ["none"],
            "columns": ["slice_name"],
        }

        self.login(GAMMA_USERNAME)
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 0

    @pytest.mark.usefixtures("load_energy_charts")
    def test_user_gets_all_charts(self):
        # test filtering on datasource_name
        gamma_user = security_manager.find_user(username="gamma")

        def count_charts():
            uri = "api/v1/chart/"
            rv = self.client.get(uri, "get_list")
            assert rv.status_code == 200
            data = rv.get_json()
            return data["count"]

        with self.temporary_user(gamma_user, login=True):
            assert count_charts() == 0

        perm = ("all_database_access", "all_database_access")
        with self.temporary_user(gamma_user, extra_pvms=[perm], login=True):
            assert count_charts() > 0

        perm = ("all_datasource_access", "all_datasource_access")
        with self.temporary_user(gamma_user, extra_pvms=[perm], login=True):
            assert count_charts() > 0

        # Back to normal
        with self.temporary_user(gamma_user, login=True):
            assert count_charts() == 0

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
        self.login(ADMIN_USERNAME)
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

    @pytest.mark.usefixtures("create_charts_created_by_gamma")
    def test_get_charts_created_by_me_filter(self):
        """
        Chart API: Test get charts with created by me special filter
        """
        gamma_user = self.get_user("gamma")
        expected_models = (
            db.session.query(Slice).filter(Slice.created_by_fk == gamma_user.id).all()
        )
        arguments = {
            "filters": [
                {"col": "created_by", "opr": "chart_created_by_me", "value": "me"}
            ],
            "order_column": "slice_name",
            "order_direction": "asc",
            "keys": ["none"],
            "columns": ["slice_name"],
        }
        self.login(gamma_user.username)
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert len(expected_models) == data["count"]
        for i, expected_model in enumerate(expected_models):
            assert expected_model.slice_name == data["result"][i]["slice_name"]

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
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/favorite_status/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        for res in data["result"]:
            if res["id"] in users_favorite_ids:
                assert res["value"]

    def test_add_favorite(self):
        """
        Dataset API: Test add chart to favorites
        """
        chart = Slice(
            id=100,
            datasource_id=1,
            datasource_type="table",
            datasource_name="tmp_perm_table",
            slice_name="slice_name",
        )
        db.session.add(chart)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/favorite_status/?q={prison.dumps([chart.id])}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        for res in data["result"]:
            assert res["value"] is False

        uri = f"api/v1/chart/{chart.id}/favorites/"
        self.client.post(uri)

        uri = f"api/v1/chart/favorite_status/?q={prison.dumps([chart.id])}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        for res in data["result"]:
            assert res["value"] is True

        db.session.delete(chart)
        db.session.commit()

    def test_remove_favorite(self):
        """
        Dataset API: Test remove chart from favorites
        """
        chart = Slice(
            id=100,
            datasource_id=1,
            datasource_type="table",
            datasource_name="tmp_perm_table",
            slice_name="slice_name",
        )
        db.session.add(chart)
        db.session.commit()

        self.login(ADMIN_USERNAME)
        uri = f"api/v1/chart/{chart.id}/favorites/"
        self.client.post(uri)

        uri = f"api/v1/chart/favorite_status/?q={prison.dumps([chart.id])}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        for res in data["result"]:
            assert res["value"] is True

        uri = f"api/v1/chart/{chart.id}/favorites/"
        self.client.delete(uri)

        uri = f"api/v1/chart/favorite_status/?q={prison.dumps([chart.id])}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        for res in data["result"]:
            assert res["value"] is False

        db.session.delete(chart)
        db.session.commit()

    def test_get_time_range(self):
        """
        Chart API: Test get actually time range from human readable string
        """
        self.login(ADMIN_USERNAME)
        humanize_time_range = "100 years ago : now"
        uri = f"api/v1/time_range/?q={prison.dumps(humanize_time_range)}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert "since" in data["result"][0]
        assert "until" in data["result"][0]
        assert "timeRange" in data["result"][0]

        humanize_time_range = [
            {"timeRange": "2021-01-01 : 2022-02-01"},
            {"timeRange": "2022-01-01 : 2023-02-01"},
        ]
        uri = f"api/v1/time_range/?q={prison.dumps(humanize_time_range)}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert len(data["result"]) == 2
        assert "since" in data["result"][0]
        assert "until" in data["result"][0]
        assert "timeRange" in data["result"][0]

        humanize_time_range = [
            {"timeRange": "2021-01-01 : 2022-02-01", "shift": "1 year ago"},
            {"timeRange": "2022-01-01 : 2023-02-01", "shift": "2 year ago"},
        ]
        uri = f"api/v1/time_range/?q={prison.dumps(humanize_time_range)}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert len(data["result"]) == 2
        assert "since" in data["result"][0]
        assert "until" in data["result"][0]
        assert "timeRange" in data["result"][0]
        assert "shift" in data["result"][0]

    def test_query_form_data(self):
        """
        Chart API: Test query form data
        """
        self.login(ADMIN_USERNAME)
        slice = db.session.query(Slice).first()
        uri = f"api/v1/form_data/?slice_id={slice.id if slice else None}"
        rv = self.client.get(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert rv.content_type == "application/json"
        if slice:
            assert data["slice_id"] == slice.id

    @pytest.mark.usefixtures(
        "load_unicode_dashboard_with_slice",
        "load_energy_table_with_slice",
        "load_world_bank_dashboard_with_slices",
        "load_birth_names_dashboard_with_slices",
    )
    def test_get_charts_page(self):
        """
        Chart API: Test get charts filter
        """
        # Assuming we have 33 sample charts
        self.login(ADMIN_USERNAME)
        arguments = {"page_size": 10, "page": 0}
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert len(data["result"]) == 10

        arguments = {"page_size": 10, "page": 3}
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert len(data["result"]) == 3

    def test_get_charts_no_data_access(self):
        """
        Chart API: Test get charts no data access
        """
        self.login(GAMMA_USERNAME)
        uri = "api/v1/chart/"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 0

    def test_export_chart(self):
        """
        Chart API: Test export chart
        """
        example_chart = db.session.query(Slice).all()[0]
        argument = [example_chart.id]
        uri = f"api/v1/chart/export/?q={prison.dumps(argument)}"

        self.login(ADMIN_USERNAME)
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
        self.login(ADMIN_USERNAME)
        rv = self.get_assert_metric(uri, "export")

        assert rv.status_code == 404

    def test_export_chart_gamma(self):
        """
        Chart API: Test export chart has gamma
        """
        example_chart = db.session.query(Slice).all()[0]
        argument = [example_chart.id]
        uri = f"api/v1/chart/export/?q={prison.dumps(argument)}"

        self.login(GAMMA_USERNAME)
        rv = self.client.get(uri)

        assert rv.status_code == 404

    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_chart(self, mock_add_permissions):
        """
        Chart API: Test import chart
        """
        self.login(ADMIN_USERNAME)
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
        db.session.commit()
        db.session.delete(dataset)
        db.session.commit()
        db.session.delete(database)
        db.session.commit()

    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_chart_overwrite(self, mock_add_permissions):
        """
        Chart API: Test import existing chart
        """
        self.login(ADMIN_USERNAME)
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
            "errors": [
                {
                    "message": "Error importing chart",
                    "error_type": "GENERIC_COMMAND_ERROR",
                    "level": "warning",
                    "extra": {
                        "charts/imported_chart.yaml": "Chart already exists and `overwrite=true` was not passed",
                        "issue_codes": [
                            {
                                "code": 1010,
                                "message": "Issue 1010 - Superset encountered an error while running a command.",
                            }
                        ],
                    },
                }
            ]
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
        db.session.commit()
        db.session.delete(dataset)
        db.session.commit()
        db.session.delete(database)
        db.session.commit()

    @patch("superset.commands.database.importers.v1.utils.add_permissions")
    def test_import_chart_invalid(self, mock_add_permissions):
        """
        Chart API: Test import invalid chart
        """
        self.login(ADMIN_USERNAME)
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
            "errors": [
                {
                    "message": "Error importing chart",
                    "error_type": "GENERIC_COMMAND_ERROR",
                    "level": "warning",
                    "extra": {
                        "metadata.yaml": {"type": ["Must be equal to Slice."]},
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

    def test_gets_created_by_user_charts_filter(self):
        arguments = {
            "filters": [{"col": "id", "opr": "chart_has_created_by", "value": True}],
            "keys": ["none"],
            "columns": ["slice_name"],
        }
        self.login(ADMIN_USERNAME)

        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 8

    def test_gets_not_created_by_user_charts_filter(self):
        arguments = {
            "filters": [{"col": "id", "opr": "chart_has_created_by", "value": False}],
            "keys": ["none"],
            "columns": ["slice_name"],
        }
        self.login(ADMIN_USERNAME)

        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == 8

    @pytest.mark.usefixtures("create_charts")
    def test_gets_owned_created_favorited_by_me_filter(self):
        """
        Chart API: Test ChartOwnedCreatedFavoredByMeFilter
        """
        self.login(ADMIN_USERNAME)
        arguments = {
            "filters": [
                {
                    "col": "id",
                    "opr": "chart_owned_created_favored_by_me",
                    "value": True,
                }
            ],
            "order_column": "slice_name",
            "order_direction": "asc",
            "page": 0,
            "page_size": 25,
        }
        rv = self.client.get(f"api/v1/chart/?q={prison.dumps(arguments)}")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))

        assert data["result"][0]["slice_name"] == "name0"
        assert data["result"][0]["datasource_id"] == 1

    @parameterized.expand(
        [
            "Top 10 Girl Name Share",  # Legacy chart
            "Pivot Table v2",  # Non-legacy chart
        ],
    )
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_warm_up_cache(self, slice_name):
        self.login(ADMIN_USERNAME)
        slc = self.get_slice(slice_name)
        rv = self.client.put("/api/v1/chart/warm_up_cache", json={"chart_id": slc.id})
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))

        assert data["result"] == [
            {"chart_id": slc.id, "viz_error": None, "viz_status": "success"}
        ]

        dashboard = self.get_dash_by_slug("births")

        rv = self.client.put(
            "/api/v1/chart/warm_up_cache",
            json={"chart_id": slc.id, "dashboard_id": dashboard.id},
        )
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"] == [
            {"chart_id": slc.id, "viz_error": None, "viz_status": "success"}
        ]

        rv = self.client.put(
            "/api/v1/chart/warm_up_cache",
            json={
                "chart_id": slc.id,
                "dashboard_id": dashboard.id,
                "extra_filters": json.dumps(
                    [{"col": "name", "op": "in", "val": ["Jennifer"]}]
                ),
            },
        )
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["result"] == [
            {"chart_id": slc.id, "viz_error": None, "viz_status": "success"}
        ]

    def test_warm_up_cache_chart_id_required(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.put("/api/v1/chart/warm_up_cache", json={"dashboard_id": 1})
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"chart_id": ["Missing data for required field."]}}

    def test_warm_up_cache_chart_not_found(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.put("/api/v1/chart/warm_up_cache", json={"chart_id": 99999})
        assert rv.status_code == 404
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": "Chart not found"}

    def test_warm_up_cache_payload_validation(self):
        self.login(ADMIN_USERNAME)
        rv = self.client.put(
            "/api/v1/chart/warm_up_cache",
            json={"chart_id": "id", "dashboard_id": "id", "extra_filters": 4},
        )
        assert rv.status_code == 400
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {
            "message": {
                "chart_id": ["Not a valid integer."],
                "dashboard_id": ["Not a valid integer."],
                "extra_filters": ["Not a valid string."],
            }
        }

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_warm_up_cache_error(self) -> None:
        self.login(ADMIN_USERNAME)
        slc = self.get_slice("Pivot Table v2")

        with mock.patch.object(ChartDataCommand, "run") as mock_run:
            mock_run.side_effect = ChartDataQueryFailedError(
                _(
                    "Error: %(error)s",
                    error=_("Empty query?"),
                )
            )

            assert json.loads(
                self.client.put(
                    "/api/v1/chart/warm_up_cache",
                    json={"chart_id": slc.id},
                ).data
            ) == {
                "result": [
                    {
                        "chart_id": slc.id,
                        "viz_error": "Error: Empty query?",
                        "viz_status": None,
                    },
                ],
            }

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_warm_up_cache_no_query_context(self) -> None:
        self.login(ADMIN_USERNAME)
        slc = self.get_slice("Pivot Table v2")

        with mock.patch.object(Slice, "get_query_context") as mock_get_query_context:
            mock_get_query_context.return_value = None

            assert json.loads(
                self.client.put(
                    "/api/v1/chart/warm_up_cache",  # noqa: F541
                    json={"chart_id": slc.id},
                ).data
            ) == {
                "result": [
                    {
                        "chart_id": slc.id,
                        "viz_error": "Chart's query context does not exist",
                        "viz_status": None,
                    },
                ],
            }

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_warm_up_cache_no_datasource(self) -> None:
        self.login(ADMIN_USERNAME)
        slc = self.get_slice("Top 10 Girl Name Share")

        with mock.patch.object(
            Slice,
            "datasource",
            new_callable=mock.PropertyMock,
        ) as mock_datasource:
            mock_datasource.return_value = None

            assert json.loads(
                self.client.put(
                    "/api/v1/chart/warm_up_cache",  # noqa: F541
                    json={"chart_id": slc.id},
                ).data
            ) == {
                "result": [
                    {
                        "chart_id": slc.id,
                        "viz_error": "Chart's datasource does not exist",
                        "viz_status": None,
                    },
                ],
            }

    @pytest.mark.usefixtures("create_chart_with_tag")
    def test_update_chart_add_tags_can_write_on_tag(self):
        """
        Validates a user with can write on tag permission can
        add tags while updating a chart
        """
        self.login(ADMIN_USERNAME)

        chart = (
            db.session.query(Slice).filter(Slice.slice_name == "chart with tag").first()
        )
        new_tag = db.session.query(Tag).filter(Tag.name == "second_tag").one()

        # get existing tag and add a new one
        new_tags = [tag.id for tag in chart.tags if tag.type == TagType.custom]
        new_tags.append(new_tag.id)
        update_payload = {"tags": new_tags}

        uri = f"api/v1/chart/{chart.id}"
        rv = self.put_assert_metric(uri, update_payload, "put")
        assert rv.status_code == 200
        model = db.session.query(Slice).get(chart.id)

        # Clean up system tags
        tag_list = [tag.id for tag in model.tags if tag.type == TagType.custom]
        assert tag_list == new_tags

    @pytest.mark.usefixtures("create_chart_with_tag")
    def test_update_chart_remove_tags_can_write_on_tag(self):
        """
        Validates a user with can write on tag permission can
        remove tags while updating a chart
        """
        self.login(ADMIN_USERNAME)

        chart = (
            db.session.query(Slice).filter(Slice.slice_name == "chart with tag").first()
        )

        # get existing tag and add a new one
        new_tags = [tag.id for tag in chart.tags if tag.type == TagType.custom]
        new_tags.pop()

        update_payload = {"tags": new_tags}

        uri = f"api/v1/chart/{chart.id}"
        rv = self.put_assert_metric(uri, update_payload, "put")
        assert rv.status_code == 200
        model = db.session.query(Slice).get(chart.id)

        # Clean up system tags
        tag_list = [tag.id for tag in model.tags if tag.type == TagType.custom]
        assert tag_list == new_tags

    @pytest.mark.usefixtures("create_chart_with_tag")
    def test_update_chart_add_tags_can_tag_on_chart(self):
        """
        Validates an owner with can tag on chart permission can
        add tags while updating a chart
        """
        self.login(ALPHA_USERNAME)

        alpha_role = security_manager.find_role("Alpha")
        write_tags_perm = security_manager.add_permission_view_menu("can_write", "Tag")
        security_manager.del_permission_role(alpha_role, write_tags_perm)
        assert "can tag on Chart" in str(alpha_role.permissions)

        chart = (
            db.session.query(Slice).filter(Slice.slice_name == "chart with tag").first()
        )
        new_tag = db.session.query(Tag).filter(Tag.name == "second_tag").one()

        # get existing tag and add a new one
        new_tags = [tag.id for tag in chart.tags if tag.type == TagType.custom]
        new_tags.append(new_tag.id)
        update_payload = {"tags": new_tags}

        uri = f"api/v1/chart/{chart.id}"
        rv = self.put_assert_metric(uri, update_payload, "put")
        assert rv.status_code == 200
        model = db.session.query(Slice).get(chart.id)

        # Clean up system tags
        tag_list = [tag.id for tag in model.tags if tag.type == TagType.custom]
        assert tag_list == new_tags

        security_manager.add_permission_role(alpha_role, write_tags_perm)

    @pytest.mark.usefixtures("create_chart_with_tag")
    def test_update_chart_remove_tags_can_tag_on_chart(self):
        """
        Validates an owner with can tag on chart permission can
        remove tags from a chart
        """
        self.login(ALPHA_USERNAME)

        alpha_role = security_manager.find_role("Alpha")
        write_tags_perm = security_manager.add_permission_view_menu("can_write", "Tag")
        security_manager.del_permission_role(alpha_role, write_tags_perm)
        assert "can tag on Chart" in str(alpha_role.permissions)

        chart = (
            db.session.query(Slice).filter(Slice.slice_name == "chart with tag").first()
        )

        update_payload = {"tags": []}

        uri = f"api/v1/chart/{chart.id}"
        rv = self.put_assert_metric(uri, update_payload, "put")
        assert rv.status_code == 200
        model = db.session.query(Slice).get(chart.id)

        # Clean up system tags
        tag_list = [tag.id for tag in model.tags if tag.type == TagType.custom]
        assert tag_list == []

        security_manager.add_permission_role(alpha_role, write_tags_perm)

    @pytest.mark.usefixtures("create_chart_with_tag")
    def test_update_chart_add_tags_missing_permission(self):
        """
        Validates an owner can't add tags to a chart if they don't
        have permission to it
        """
        self.login(ALPHA_USERNAME)

        alpha_role = security_manager.find_role("Alpha")
        write_tags_perm = security_manager.add_permission_view_menu("can_write", "Tag")
        tag_charts_perm = security_manager.add_permission_view_menu("can_tag", "Chart")
        security_manager.del_permission_role(alpha_role, write_tags_perm)
        security_manager.del_permission_role(alpha_role, tag_charts_perm)

        chart = (
            db.session.query(Slice).filter(Slice.slice_name == "chart with tag").first()
        )
        new_tag = db.session.query(Tag).filter(Tag.name == "second_tag").one()

        # get existing tag and add a new one
        new_tags = [tag.id for tag in chart.tags if tag.type == TagType.custom]
        new_tags.append(new_tag.id)
        update_payload = {"tags": new_tags}

        uri = f"api/v1/chart/{chart.id}"
        rv = self.put_assert_metric(uri, update_payload, "put")
        assert rv.status_code == 403
        assert (
            rv.json["message"] == "You do not have permission to manage tags on charts"
        )

        security_manager.add_permission_role(alpha_role, write_tags_perm)
        security_manager.add_permission_role(alpha_role, tag_charts_perm)

    @pytest.mark.usefixtures("create_chart_with_tag")
    def test_update_chart_remove_tags_missing_permission(self):
        """
        Validates an owner can't remove tags from a chart if they don't
        have permission to it
        """
        self.login(ALPHA_USERNAME)

        alpha_role = security_manager.find_role("Alpha")
        write_tags_perm = security_manager.add_permission_view_menu("can_write", "Tag")
        tag_charts_perm = security_manager.add_permission_view_menu("can_tag", "Chart")
        security_manager.del_permission_role(alpha_role, write_tags_perm)
        security_manager.del_permission_role(alpha_role, tag_charts_perm)

        chart = (
            db.session.query(Slice).filter(Slice.slice_name == "chart with tag").first()
        )

        update_payload = {"tags": []}

        uri = f"api/v1/chart/{chart.id}"
        rv = self.put_assert_metric(uri, update_payload, "put")
        assert rv.status_code == 403
        assert (
            rv.json["message"] == "You do not have permission to manage tags on charts"
        )

        security_manager.add_permission_role(alpha_role, write_tags_perm)
        security_manager.add_permission_role(alpha_role, tag_charts_perm)

    @pytest.mark.usefixtures("create_chart_with_tag")
    def test_update_chart_no_tag_changes(self):
        """
        Validates an owner without permission to change tags is able to
        update a chart when tags haven't changed
        """
        self.login(ALPHA_USERNAME)

        alpha_role = security_manager.find_role("Alpha")
        write_tags_perm = security_manager.add_permission_view_menu("can_write", "Tag")
        tag_charts_perm = security_manager.add_permission_view_menu("can_tag", "Chart")
        security_manager.del_permission_role(alpha_role, write_tags_perm)
        security_manager.del_permission_role(alpha_role, tag_charts_perm)

        chart = (
            db.session.query(Slice).filter(Slice.slice_name == "chart with tag").first()
        )
        existing_tags = [tag.id for tag in chart.tags if tag.type == TagType.custom]
        update_payload = {"tags": existing_tags}

        uri = f"api/v1/chart/{chart.id}"
        rv = self.put_assert_metric(uri, update_payload, "put")
        assert rv.status_code == 200

        security_manager.add_permission_role(alpha_role, write_tags_perm)
        security_manager.add_permission_role(alpha_role, tag_charts_perm)
