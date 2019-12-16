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
import json
from typing import List

from flask_appbuilder.security.sqla import models as ab_models

from superset import db, security_manager
from superset.models import core as models

from .base_tests import SupersetTestCase


class DashboardApiTests(SupersetTestCase):
    def __init__(self, *args, **kwargs):
        super(DashboardApiTests, self).__init__(*args, **kwargs)

    def insert_dashboard(
        self,
        dashboard_title: str,
        slug: str,
        owners: List[int],
        position_json: str = "",
        css: str = "",
        json_metadata: str = "",
        published: bool = False,
    ) -> models.Dashboard:
        obj_owners = list()
        for owner in owners:
            user = db.session.query(security_manager.user_model).get(owner)
            obj_owners.append(user)
        dashboard = models.Dashboard(
            dashboard_title=dashboard_title,
            slug=slug,
            owners=obj_owners,
            position_json=position_json,
            css=css,
            json_metadata=json_metadata,
            published=published,
        )
        db.session.add(dashboard)
        db.session.commit()
        return dashboard

    def get_user(self, username: str) -> ab_models.User:
        user = (
            db.session.query(security_manager.user_model)
            .filter_by(username=username)
            .one_or_none()
        )
        return user

    def test_delete_dashboard(self):
        """
            Dashboard API: Test delete
        """
        admin_id = self.get_user("admin").id
        dashboard_id = self.insert_dashboard("title", "slug1", [admin_id]).id
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(models.Dashboard).get(dashboard_id)
        self.assertEqual(model, None)

    def test_delete_not_found_dashboard(self):
        """
            Dashboard API: Test not found delete
        """
        self.login(username="admin")
        dashboard_id = 1000
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 404)

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
        model = db.session.query(models.Dashboard).get(dashboard_id)
        self.assertEqual(model, None)

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
        dashboard = self.insert_dashboard("title", "slug1", [user_alpha1.id])
        self.login(username="alpha2", password="password")
        uri = f"api/v1/dashboard/{dashboard.id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 404)
        db.session.delete(dashboard)
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
            "json_metadata": '{"b": "B"}',
            "published": True,
        }
        self.login(username="admin")
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(models.Dashboard).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

    def test_create_simple_dashboard(self):
        """
            Dashboard API: Test create simple dashboard
        """
        dashboard_data = {"dashboard_title": "title1"}
        self.login(username="admin")
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(models.Dashboard).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

    def test_create_dashboard_empty(self):
        """
            Dashboard API: Test create empty
        """
        dashboard_data = {}
        self.login(username="admin")
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(models.Dashboard).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

        dashboard_data = {"dashboard_title": ""}
        self.login(username="admin")
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(models.Dashboard).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

    def test_create_dashboard_validate_title(self):
        """
            Dashboard API: Test create dashboard validate title
        """
        dashboard_data = {"dashboard_title": "a" * 600}
        self.login(username="admin")
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)
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
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"slug": ["Must be unique"]}}
        self.assertEqual(response, expected_response)

        # Check for slug max size
        dashboard_data = {"dashboard_title": "title2", "slug": "a" * 256}
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)
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
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"owners": {"0": ["User 1000 does not exist"]}}}
        self.assertEqual(response, expected_response)

    def test_create_dashboard_validate_json(self):
        """
            Dashboard API: Test create validate json
        """
        dashboard_data = {"dashboard_title": "title1", "position_json": '{"A:"a"}'}
        self.login(username="admin")
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)

        dashboard_data = {"dashboard_title": "title1", "json_metadata": '{"A:"a"}'}
        self.login(username="admin")
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)

        dashboard_data = {
            "dashboard_title": "title1",
            "json_metadata": '{"refresh_frequency": "A"}',
        }
        self.login(username="admin")
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)

    def test_update_dashboard(self):
        """
            Dashboard API: Test update
        """
        admin_id = self.get_user("admin").id
        dashboard_id = self.insert_dashboard("title1", "slug1", [admin_id]).id
        dashboard_data = {
            "dashboard_title": "title1_changed",
            "slug": "slug1_changed",
            "owners": [admin_id],
            "position_json": '{"b": "B"}',
            "css": "css_changed",
            "json_metadata": '{"a": "A"}',
            "published": False,
        }
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(models.Dashboard).get(dashboard_id)
        self.assertEqual(model.dashboard_title, "title1_changed")
        self.assertEqual(model.slug, "slug1_changed")
        self.assertEqual(model.position_json, '{"b": "B"}')
        self.assertEqual(model.css, "css_changed")
        self.assertEqual(model.json_metadata, '{"a": "A"}')
        self.assertEqual(model.published, False)
        db.session.delete(model)
        db.session.commit()

    def test_update_dashboard_new_owner(self):
        """
            Dashboard API: Test update set new owner to current user
        """
        gamma_id = self.get_user("gamma").id
        admin = self.get_user("admin")
        dashboard_id = self.insert_dashboard("title1", "slug1", [gamma_id]).id
        dashboard_data = {"dashboard_title": "title1_changed"}
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(models.Dashboard).get(dashboard_id)
        self.assertIn(admin, model.owners)
        for slc in model.slices:
            self.assertIn(admin, slc.owners)
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
        model = db.session.query(models.Dashboard).get(dashboard_id)
        self.assertEqual(model.dashboard_title, "title1_changed")
        self.assertEqual(model.slug, "slug1-changed")
        db.session.delete(model)
        db.session.commit()

    def test_update_dashboard_not_owned(self):
        """
            Dashboard API: Test update slug formatting
        """
        """
            Dashboard API: Test delete try not owned
        """
        user_alpha1 = self.create_user(
            "alpha1", "password", "Alpha", email="alpha1@superset.org"
        )
        user_alpha2 = self.create_user(
            "alpha2", "password", "Alpha", email="alpha2@superset.org"
        )
        dashboard = self.insert_dashboard("title", "slug1", [user_alpha1.id])
        self.login(username="alpha2", password="password")
        dashboard_data = {"dashboard_title": "title1_changed", "slug": "slug1 changed"}
        uri = f"api/v1/dashboard/{dashboard.id}"
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 404)
        db.session.delete(dashboard)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
        db.session.commit()
