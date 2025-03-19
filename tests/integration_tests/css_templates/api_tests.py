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
from superset.models.core import CssTemplate
from superset.utils.database import get_example_database  # noqa: F401
from superset.utils import json

from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME

CSS_TEMPLATES_FIXTURE_COUNT = 5


class TestCssTemplateApi(SupersetTestCase):
    def insert_css_template(
        self,
        template_name: str,
        css: str,
        created_by_username: str = "admin",
    ) -> CssTemplate:
        admin = self.get_user(created_by_username)
        css_template = CssTemplate(
            template_name=template_name, css=css, created_by=admin, changed_by=admin
        )
        db.session.add(css_template)
        db.session.commit()
        return css_template

    @pytest.fixture()
    def create_css_templates(self):
        with self.create_app().app_context():
            css_templates = []
            for cx in range(CSS_TEMPLATES_FIXTURE_COUNT):
                css_templates.append(
                    self.insert_css_template(
                        template_name=f"template_name{cx}", css=f"css{cx}"
                    )
                )
            yield css_templates

            # rollback changes
            for css_template in css_templates:
                db.session.delete(css_template)
            db.session.commit()

    @pytest.mark.usefixtures("create_css_templates")
    def test_get_list_css_template(self):
        """
        CSS Template API: Test get list css template
        """
        css_templates = db.session.query(CssTemplate).all()

        self.login(ADMIN_USERNAME)
        uri = "api/v1/css_template/"  # noqa: F541
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(css_templates)
        expected_columns = [
            "changed_by",
            "changed_on_delta_humanized",
            "created_by",
            "created_on",
            "css",
            "id",
            "template_name",
        ]
        result_columns = list(data["result"][0].keys())
        result_columns.sort()
        assert expected_columns == result_columns
        created_by_columns = list(data["result"][0]["created_by"].keys())
        created_by_columns.sort()
        assert ["first_name", "id", "last_name"] == created_by_columns
        changed_by_columns = list(data["result"][0]["changed_by"].keys())
        changed_by_columns.sort()
        assert ["first_name", "id", "last_name"] == changed_by_columns

    @pytest.mark.usefixtures("create_css_templates")
    def test_get_list_sort_css_template(self):
        """
        CSS Template API: Test get list and sort CSS Template
        """
        css_templates = (
            db.session.query(CssTemplate)
            .order_by(CssTemplate.template_name.asc())
            .all()
        )
        self.login(ADMIN_USERNAME)
        query_string = {"order_column": "template_name", "order_direction": "asc"}
        uri = f"api/v1/css_template/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(css_templates)
        for i, query in enumerate(css_templates):
            assert query.template_name == data["result"][i]["template_name"]

    @pytest.mark.usefixtures("create_css_templates")
    def test_get_list_custom_filter_css_template(self):
        """
        CSS Template API: Test get list and custom filter
        """
        self.login(ADMIN_USERNAME)

        all_css_templates = (
            db.session.query(CssTemplate).filter(CssTemplate.css.ilike("%css2%")).all()
        )
        query_string = {
            "filters": [
                {
                    "col": "template_name",
                    "opr": "css_template_all_text",
                    "value": "css2",
                }
            ],
        }
        uri = f"api/v1/css_template/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(all_css_templates)

        all_css_templates = (
            db.session.query(CssTemplate)
            .filter(CssTemplate.template_name.ilike("%template_name3%"))
            .all()
        )
        query_string = {
            "filters": [
                {
                    "col": "template_name",
                    "opr": "css_template_all_text",
                    "value": "template_name3",
                }
            ],
        }
        uri = f"api/v1/css_template/?q={prison.dumps(query_string)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert data["count"] == len(all_css_templates)

    def test_info_css_template(self):
        """
        CssTemplate API: Test info
        """
        self.login(ADMIN_USERNAME)
        uri = "api/v1/css_template/_info"  # noqa: F541
        rv = self.get_assert_metric(uri, "info")
        assert rv.status_code == 200

    def test_info_security_css_template(self):
        """
        CssTemplate API: Test info security
        """
        self.login(ADMIN_USERNAME)
        params = {"keys": ["permissions"]}
        uri = f"api/v1/css_template/_info?q={prison.dumps(params)}"
        rv = self.get_assert_metric(uri, "info")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert "can_read" in data["permissions"]
        assert "can_write" in data["permissions"]
        assert len(data["permissions"]) == 2

    @pytest.mark.usefixtures("create_css_templates")
    def test_get_css_template(self):
        """
        CSS Template API: Test get CSS Template
        """
        with freeze_time(datetime.now()):
            css_template = (
                db.session.query(CssTemplate)
                .filter(CssTemplate.template_name == "template_name1")
                .one_or_none()
            )
            self.login(ADMIN_USERNAME)
            uri = f"api/v1/css_template/{css_template.id}"
            rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 200

        expected_result = {
            "id": css_template.id,
            "template_name": "template_name1",
            "css": "css1",
            "changed_by": {
                "first_name": css_template.created_by.first_name,
                "id": css_template.created_by.id,
                "last_name": css_template.created_by.last_name,
            },
            "changed_on_delta_humanized": "now",
            "created_by": {
                "first_name": css_template.created_by.first_name,
                "id": css_template.created_by.id,
                "last_name": css_template.created_by.last_name,
            },
        }
        data = json.loads(rv.data.decode("utf-8"))
        for key, value in data["result"].items():
            assert value == expected_result[key]

    @pytest.mark.usefixtures("create_css_templates")
    def test_get_css_template_not_found(self):
        """
        CSS Template API: Test get CSS Template not found
        """
        max_id = db.session.query(func.max(CssTemplate.id)).scalar()
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/css_template/{max_id + 1}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 404

    def test_create_css_template(self):
        """
        CSS Template API: Test create
        """
        post_data = {
            "template_name": "template_name_create",
            "css": "css_create",
        }

        self.login(ADMIN_USERNAME)
        uri = "api/v1/css_template/"  # noqa: F541
        rv = self.post_assert_metric(uri, post_data, "post")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 201

        css_template_id = data.get("id")
        model = db.session.query(CssTemplate).get(css_template_id)
        for key in post_data:
            assert getattr(model, key) == data["result"][key]

        # Rollback changes
        db.session.delete(model)
        db.session.commit()

    @pytest.mark.usefixtures("create_css_templates")
    def test_update_css_template(self):
        """
        CSS Template API: Test update
        """
        css_template = (
            db.session.query(CssTemplate)
            .filter(CssTemplate.template_name == "template_name1")
            .all()[0]
        )

        put_data = {
            "template_name": "template_name_changed",
            "css": "css_changed",
        }

        self.login(ADMIN_USERNAME)
        uri = f"api/v1/css_template/{css_template.id}"
        rv = self.put_assert_metric(uri, put_data, "put")
        assert rv.status_code == 200

        model = db.session.query(CssTemplate).get(css_template.id)
        assert model.template_name == "template_name_changed"
        assert model.css == "css_changed"

    @pytest.mark.usefixtures("create_css_templates")
    def test_update_css_template_not_found(self):
        """
        CSS Template API: Test update not found
        """
        max_id = db.session.query(func.max(CssTemplate.id)).scalar()
        self.login(ADMIN_USERNAME)

        put_data = {
            "template_name": "template_name_changed",
            "css": "css_changed",
        }

        uri = f"api/v1/css_template/{max_id + 1}"
        rv = self.put_assert_metric(uri, put_data, "put")
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_css_templates")
    def test_delete_css_template(self):
        """
        CSS Template API: Test delete
        """
        css_template = (
            db.session.query(CssTemplate)
            .filter(CssTemplate.template_name == "template_name1")
            .one_or_none()
        )

        self.login(ADMIN_USERNAME)
        uri = f"api/v1/css_template/{css_template.id}"
        rv = self.delete_assert_metric(uri, "delete")
        assert rv.status_code == 200

        model = db.session.query(CssTemplate).get(css_template.id)
        assert model is None

    @pytest.mark.usefixtures("create_css_templates")
    def test_delete_css_template_not_found(self):
        """
        CSS Template API: Test delete not found
        """
        max_id = db.session.query(func.max(CssTemplate.id)).scalar()
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/css_template/{max_id + 1}"
        rv = self.delete_assert_metric(uri, "delete")
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_css_templates")
    def test_delete_bulk_css_templates(self):
        """
        CSS Template API: Test delete bulk
        """
        css_templates = db.session.query(CssTemplate).all()
        css_template_ids = [css_template.id for css_template in css_templates]

        self.login(ADMIN_USERNAME)
        uri = f"api/v1/css_template/?q={prison.dumps(css_template_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": f"Deleted {len(css_template_ids)} css templates"
        }
        assert response == expected_response
        css_templates = db.session.query(CssTemplate).all()
        assert css_templates == []

    @pytest.mark.usefixtures("create_css_templates")
    def test_delete_one_bulk_css_templates(self):
        """
        CSS Template API: Test delete one in bulk
        """
        css_template = db.session.query(CssTemplate).first()
        css_template_ids = [css_template.id]

        self.login(ADMIN_USERNAME)
        uri = f"api/v1/css_template/?q={prison.dumps(css_template_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": f"Deleted {len(css_template_ids)} css template"}
        assert response == expected_response
        css_template_ = db.session.query(CssTemplate).get(css_template_ids[0])
        assert css_template_ is None

    def test_delete_bulk_css_template_bad_request(self):
        """
        CSS Template API: Test delete bulk bad request
        """
        css_template_ids = [1, "a"]
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/css_template/?q={prison.dumps(css_template_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 400

    @pytest.mark.usefixtures("create_css_templates")
    def test_delete_bulk_css_template_not_found(self):
        """
        CSS Template API: Test delete bulk not found
        """
        max_id = db.session.query(func.max(CssTemplate.id)).scalar()

        css_template_ids = [max_id + 1, max_id + 2]
        self.login(ADMIN_USERNAME)
        uri = f"api/v1/css_template/?q={prison.dumps(css_template_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 404
