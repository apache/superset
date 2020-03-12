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

import prison

import tests.test_app
from superset import db, security_manager
from superset.models import core as models
from superset.models.slice import Slice
from superset.views.base import generate_download_headers

from .base_api_tests import ApiOwnersTestCaseMixin
from .base_tests import SupersetTestCase


class DashboardApiTests(SupersetTestCase, ApiOwnersTestCaseMixin):
    resource_name = "dashboard"

    def __init__(self, *args, **kwargs):
        super(DashboardApiTests, self).__init__(*args, **kwargs)

    def insert_dashboard(
        self,
        dashboard_title: str,
        slug: str,
        owners: List[int],
        slices: Optional[List[Slice]] = None,
        position_json: str = "",
        css: str = "",
        json_metadata: str = "",
        published: bool = False,
    ) -> models.Dashboard:
        obj_owners = list()
        slices = slices or []
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
            slices=slices,
            published=published,
        )
        db.session.add(dashboard)
        db.session.commit()
        return dashboard

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
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": f"Deleted {dashboard_count} dashboards"}
        self.assertEqual(response, expected_response)
        for dashboard_id in dashboard_ids:
            model = db.session.query(models.Dashboard).get(dashboard_id)
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
        expected_response = {"message": "No dashboards deleted"}
        self.assertEqual(response, expected_response)

        # nothing is delete in bulk with a list of owned and not owned dashboards
        arguments = [dashboard.id for dashboard in dashboards] + [owned_dashboard.id]
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 403)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": "No dashboards deleted"}
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
            "json_metadata": '{"b": "B"}',
            "published": True,
        }
        self.login(username="admin")
        uri = "api/v1/dashboard/"
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
        uri = "api/v1/dashboard/"
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
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(models.Dashboard).get(data.get("id"))
        db.session.delete(model)
        db.session.commit()

        dashboard_data = {"dashboard_title": ""}
        self.login(username="admin")
        uri = "api/v1/dashboard/"
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
        uri = "api/v1/dashboard/"
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
        uri = "api/v1/dashboard/"
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
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)

        dashboard_data = {"dashboard_title": "title1", "json_metadata": '{"A:"a"}'}
        self.login(username="admin")
        uri = "api/v1/dashboard/"
        rv = self.client.post(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 422)

        dashboard_data = {
            "dashboard_title": "title1",
            "json_metadata": '{"refresh_frequency": "A"}',
        }
        self.login(username="admin")
        uri = "api/v1/dashboard/"
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

        model = db.session.query(models.Dashboard).get(dashboard.id)
        self.assertEqual(model.published, True)
        self.assertEqual(model.slug, "slug1")
        self.assertIn(admin, model.owners)
        self.assertIn(gamma, model.owners)
        db.session.delete(model)
        db.session.commit()

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
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 403)
        db.session.delete(dashboard)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
        db.session.commit()

    def test_export(self):
        """
            Dashboard API: Test dashboard export
        """
        self.login(username="admin")
        argument = [1, 2]
        uri = f"api/v1/dashboard/export/?q={prison.dumps(argument)}"

        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        self.assertEqual(
            rv.headers["Content-Disposition"],
            generate_download_headers("json")["Content-Disposition"],
        )

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
            Dashboard API: Test dashboard export not not allowed
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
