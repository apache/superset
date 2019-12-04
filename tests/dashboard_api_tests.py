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

    def get_user_id(self, username: str) -> int:
        user = db.session.query(
            security_manager.user_model
        ).filter_by(username=username).one_or_none()
        return user.id

    def test_delete_dashboard(self):
        """
            Dashboard API: Test delete
        """
        admin_id = self.get_user_id("admin")
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
        gamma_id = self.get_user_id("gamma")
        dashboard_id = self.insert_dashboard("title", "slug1", [gamma_id]).id

        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(models.Dashboard).get(dashboard_id)
        self.assertEqual(model, None)

    def test_delete_dashboard_not_owned(self):
        """
            Dashboard API: Test delete not owned
        """
        #TODO
        # Create 2 alpha users
        # Create dashboard with alpha_1
        # alpha_2 tries to delete that dashboard

    def test_create_dashboard(self):
        """
            Dashboard API: Test create dashboard
        """
        admin_id = self.get_user_id("admin")
        dashboard_data = {
            "dashboard_title": "title1",
            "slug": "slug1",
            "owners": [admin_id],
            "position_json": "{\"a\": \"A\"}",
            "css": "css",
            "json_metadata": "{\"b\": \"B\"}",
            "published": True
        }
        self.login(username="admin")
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(models.Dashboard).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

    def test_create_dashboard_validations(self):
        """
            Dashboard API: Test create validations
        """
        admin_id = self.get_user_id("admin")
        dashboard_data = {
            "dashboard_title": "",
            "slug": "slug1",
            "owners": [admin_id],
            "position_json": "{\"a\": \"A\"}",
            "css": "css",
            "json_metadata": "{\"b\": \"B\"}",
            "published": True
        }
        self.login(username="admin")
        uri = f"api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)
