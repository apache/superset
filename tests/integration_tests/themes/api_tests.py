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

import pytest
import prison
from datetime import datetime
from freezegun import freeze_time
from sqlalchemy.sql import func

import tests.integration_tests.test_app  # noqa: F401
from superset import db
from superset.models.core import Theme
from superset.utils.database import get_example_database  # noqa: F401
from superset.utils import json

from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME

THEMES_FIXTURE_COUNT = 3


class TestThemeApi(SupersetTestCase):
    def insert_theme(
        self,
        theme_name: str,
        json_data: str,
        created_by_username: str = "admin",
    ) -> Theme:
        admin = self.get_user(created_by_username)
        theme = Theme(
            theme_name=theme_name,
            json_data=json_data,
            created_by=admin,
            changed_by=admin,
        )
        db.session.add(theme)
        db.session.commit()
        return theme

    @pytest.fixture
    def create_themes(self):
        with self.create_app().app_context():
            themes = []
            for cx in range(THEMES_FIXTURE_COUNT):
                themes.append(
                    self.insert_theme(
                        theme_name=f"theme_name{cx}",
                        json_data=f'{{"color": "theme{cx}"}}',
                    )
                )
            yield themes

            # rollback changes
            for theme in themes:
                db.session.delete(theme)
            db.session.commit()

    @pytest.mark.usefixtures("create_themes")
    def test_get_list_theme(self):
        """
        Theme API: Test get list themes
        """
        themes = db.session.query(Theme).all()

        self.login(ADMIN_USERNAME)
        uri = "api/v1/theme/"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(themes)
        expected_columns = [
            "changed_by",
            "changed_by_name",
            "changed_on_delta_humanized",
            "created_by",
            "created_on",
            "id",
            "json_data",
            "theme_name",
        ]
        result_columns = list(data["result"][0].keys())
        result_columns.sort()
        assert expected_columns == result_columns

    @pytest.mark.usefixtures("create_themes")
    def test_get_list_sort_theme(self):
        """
        Theme API: Test get list and sort themes
        """
        themes = db.session.query(Theme).order_by(Theme.theme_name.asc()).all()
        self.login(ADMIN_USERNAME)
        query_string = {"order_column": "theme_name", "order_direction": "asc"}
        uri = f"api/v1/theme/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(themes)
        for i, theme in enumerate(themes):
            assert theme.theme_name == data["result"][i]["theme_name"]

    @pytest.mark.usefixtures("create_themes")
    def test_get_list_custom_filter_theme(self):
        """
        Theme API: Test get list and custom filter
        """
        self.login(ADMIN_USERNAME)

        # Test filtering by JSON data
        all_themes = (
            db.session.query(Theme).filter(Theme.json_data.ilike("%theme1%")).all()
        )
        query_string = {
            "filters": [
                {
                    "col": "theme_name",
                    "opr": "theme_all_text",
                    "value": "theme1",
                }
            ],
        }
        uri = f"api/v1/theme/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(all_themes)

        # Test filtering by theme name
        all_themes = (
            db.session.query(Theme)
            .filter(Theme.theme_name.ilike("%theme_name2%"))
            .all()
        )
        query_string = {
            "filters": [
                {
                    "col": "theme_name",
                    "opr": "theme_all_text",
                    "value": "theme_name2",
                }
            ],
        }
        uri = f"api/v1/theme/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(all_themes)

    def test_info_theme(self):
        """
        Theme API: Test info
        """
        self.login(ADMIN_USERNAME)
        uri = "api/v1/theme/_info"
        rv = self.get_assert_metric(uri, "info")
        assert rv.status_code == 200

    def test_info_security_theme(self):
        """
        Theme API: Test info security
        """
        self.login(ADMIN_USERNAME)
        params = {"keys": ["permissions"]}
        uri = f"api/v1/theme/_info?q={prison.dumps(params)}"
        rv = self.get_assert_metric(uri, "info")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert "can_read" in data["permissions"]
        assert "can_write" in data["permissions"]
        assert len(data["permissions"]) == 3

    @pytest.mark.usefixtures("create_themes")
    def test_get_theme(self):
        """
        Theme API: Test get theme
        """
        with freeze_time(datetime.now()):
            theme = (
                db.session.query(Theme)
                .filter(Theme.theme_name == "theme_name1")
                .one_or_none()
            )
            self.login(ADMIN_USERNAME)
            uri = f"api/v1/theme/{theme.id}"
            rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 200

        expected_result = {
            "id": theme.id,
            "theme_name": "theme_name1",
            "json_data": '{"color": "theme1"}',
            "changed_by": {
                "first_name": theme.created_by.first_name,
                "id": theme.created_by.id,
                "last_name": theme.created_by.last_name,
            },
            "changed_on_delta_humanized": "now",
            "created_by": {
                "first_name": theme.created_by.first_name,
                "id": theme.created_by.id,
                "last_name": theme.created_by.last_name,
            },
        }
        data = json.loads(rv.data.decode("utf-8"))
        for key, value in data["result"].items():
            assert value == expected_result[key]

    @pytest.mark.usefixtures("create_themes")
    def test_get_theme_not_found(self):
        """
        Theme API: Test get theme not found
        """
        max_id = db.session.query(func.max(Theme.id)).scalar()
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/theme/{max_id + 1}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 404

    def test_create_theme(self):
        """
        Theme API: Test create
        """
        post_data = {
            "theme_name": "test_theme",
            "json_data": '{"primary": "#007bff", "secondary": "#6c757d"}',
        }

        self.login(ADMIN_USERNAME)
        uri = "api/v1/theme/"
        rv = self.post_assert_metric(uri, post_data, "post")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 201

        theme_id = data.get("id")
        model = db.session.query(Theme).get(theme_id)
        for key in post_data:
            assert getattr(model, key) == data["result"][key]

        # Rollback changes
        db.session.delete(model)
        db.session.commit()

    @pytest.mark.usefixtures("create_themes")
    def test_update_theme(self):
        """
        Theme API: Test update
        """
        theme = (
            db.session.query(Theme).filter(Theme.theme_name == "theme_name1").all()[0]
        )

        put_data = {
            "theme_name": "updated_theme_name",
            "json_data": '{"primary": "#28a745", "secondary": "#ffc107"}',
        }

        self.login(ADMIN_USERNAME)
        uri = f"api/v1/theme/{theme.id}"
        rv = self.put_assert_metric(uri, put_data, "put")
        assert rv.status_code == 200

        model = db.session.query(Theme).get(theme.id)
        assert model.theme_name == "updated_theme_name"
        assert model.json_data == '{"primary": "#28a745", "secondary": "#ffc107"}'

    @pytest.mark.usefixtures("create_themes")
    def test_update_theme_not_found(self):
        """
        Theme API: Test update not found
        """
        max_id = db.session.query(func.max(Theme.id)).scalar()
        self.login(ADMIN_USERNAME)

        put_data = {
            "theme_name": "updated_theme_name",
            "json_data": '{"primary": "#28a745"}',
        }

        uri = f"api/v1/theme/{max_id + 1}"
        rv = self.put_assert_metric(uri, put_data, "put")
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_themes")
    def test_delete_theme(self):
        """
        Theme API: Test delete
        """
        theme = (
            db.session.query(Theme)
            .filter(Theme.theme_name == "theme_name1")
            .one_or_none()
        )

        self.login(ADMIN_USERNAME)
        uri = f"api/v1/theme/{theme.id}"
        rv = self.delete_assert_metric(uri, "delete")
        assert rv.status_code == 200

        model = db.session.query(Theme).get(theme.id)
        assert model is None

    @pytest.mark.usefixtures("create_themes")
    def test_delete_theme_not_found(self):
        """
        Theme API: Test delete not found
        """
        max_id = db.session.query(func.max(Theme.id)).scalar()
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/theme/{max_id + 1}"
        rv = self.delete_assert_metric(uri, "delete")
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_themes")
    def test_delete_bulk_themes(self):
        """
        Theme API: Test delete bulk
        """
        themes = db.session.query(Theme).all()
        theme_ids = [theme.id for theme in themes]

        self.login(ADMIN_USERNAME)
        uri = f"api/v1/theme/?q={prison.dumps(theme_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": f"Deleted {len(theme_ids)} themes"}
        assert response == expected_response
        themes = db.session.query(Theme).all()
        assert themes == []

    @pytest.mark.usefixtures("create_themes")
    def test_delete_one_bulk_themes(self):
        """
        Theme API: Test delete one in bulk
        """
        theme = db.session.query(Theme).first()
        theme_ids = [theme.id]

        self.login(ADMIN_USERNAME)
        uri = f"api/v1/theme/?q={prison.dumps(theme_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": f"Deleted {len(theme_ids)} theme"}
        assert response == expected_response
        theme_ = db.session.query(Theme).get(theme_ids[0])
        assert theme_ is None

    def test_delete_bulk_theme_bad_request(self):
        """
        Theme API: Test delete bulk bad request
        """
        theme_ids = [1, "a"]
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/theme/?q={prison.dumps(theme_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 400

    @pytest.mark.usefixtures("create_themes")
    def test_delete_bulk_theme_not_found(self):
        """
        Theme API: Test delete bulk not found
        """
        max_id = db.session.query(func.max(Theme.id)).scalar()

        theme_ids = [max_id + 1, max_id + 2]
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/theme/?q={prison.dumps(theme_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 404
