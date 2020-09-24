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

import prison
import humanize
from sqlalchemy.sql import func

import tests.test_app
from superset import db, security_manager
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.views.base import generate_download_headers

from tests.base_api_tests import ApiOwnersTestCaseMixin
from tests.base_tests import SupersetTestCase


class TestDashboardApi(SupersetTestCase, ApiOwnersTestCaseMixin):
    resource_name = "dashboard"

    dashboard_data = {
        "dashboard_title": "title1_changed",
        "slug": "slug1_changed",
        "position_json": '{"b": "B"}',
        "css": "css_changed",
        "json_metadata": '{"refresh_frequency": 30}',
        "published": False,
    }

    def insert_dashboard(
        self,
        dashboard_title: str,
        slug: Optional[str],
        owners: List[int],
        created_by=None,
        slices: Optional[List[Slice]] = None,
        position_json: str = "",
        css: str = "",
        json_metadata: str = "",
        published: bool = False,
    ) -> Dashboard:
        obj_owners = list()
        slices = slices or []
        for owner in owners:
            user = db.session.query(security_manager.user_model).get(owner)
            obj_owners.append(user)
        dashboard = Dashboard(
            dashboard_title=dashboard_title,
            slug=slug,
            owners=obj_owners,
            position_json=position_json,
            css=css,
            json_metadata=json_metadata,
            slices=slices,
            published=published,
            created_by=created_by,
        )
        db.session.add(dashboard)
        db.session.commit()
        return dashboard

    def test_get_dashboard(self):
        """
        Dashboard API: Test get dashboard
        """
        admin = self.get_user("admin")
        dashboard = self.insert_dashboard("title", "slug1", [admin.id], admin)
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard.id}"
        rv = self.get_assert_metric(uri, "get")
        self.assertEqual(rv.status_code, 200)
        expected_result = {
            "changed_by": None,
            "changed_by_name": "",
            "changed_by_url": "",
            "charts": [],
            "created_by": {"id": 1, "first_name": "admin", "last_name": "user",},
            "id": dashboard.id,
            "css": "",
            "dashboard_title": "title",
            "json_metadata": "",
            "owners": [
                {
                    "id": 1,
                    "username": "admin",
                    "first_name": "admin",
                    "last_name": "user",
                }
            ],
            "position_json": "",
            "published": False,
            "url": f"/superset/dashboard/slug1/",
            "slug": "slug1",
            "table_names": "",
            "thumbnail_url": dashboard.thumbnail_url,
        }
        data = json.loads(rv.data.decode("utf-8"))
        self.assertIn("changed_on", data["result"])
        for key, value in data["result"].items():
            # We can't assert timestamp values
            if key != "changed_on":
                self.assertEqual(value, expected_result[key])
        # rollback changes
        db.session.delete(dashboard)
        db.session.commit()

    def test_info_dashboard(self):
        """
        Dashboard API: Test info
        """
        self.login(username="admin")
        uri = f"api/v1/dashboard/_info"
        rv = self.get_assert_metric(uri, "info")
        self.assertEqual(rv.status_code, 200)

    def test_get_dashboard_not_found(self):
        """
        Dashboard API: Test get dashboard not found
        """
        max_id = db.session.query(func.max(Dashboard.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/dashboard/{max_id + 1}"
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
        self.assertEqual(rv.status_code, 404)
        # rollback changes
        db.session.delete(dashboard)
        db.session.commit()

    def test_get_dashboards_changed_on(self):
        """
        Dashboard API: Test get dashboards changed on
        """
        from datetime import datetime
        import humanize

        admin = self.get_user("admin")
        start_changed_on = datetime.now()
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
            humanize.naturaltime(datetime.now() - start_changed_on),
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

    def test_get_dashboards_custom_filter(self):
        """
        Dashboard API: Test get dashboards custom filter
        """
        admin = self.get_user("admin")
        dashboard1 = self.insert_dashboard("foo_a", "ZY_bar", [admin.id])
        dashboard2 = self.insert_dashboard("zy_foo", "slug1", [admin.id])
        dashboard3 = self.insert_dashboard("foo_b", "slug1zy_", [admin.id])
        dashboard4 = self.insert_dashboard("bar", "foo", [admin.id])

        arguments = {
            "filters": [
                {"col": "dashboard_title", "opr": "title_or_slug", "value": "zy_"}
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
        self.assertEqual(data["count"], 3)

        expected_response = [
            {"slug": "ZY_bar", "dashboard_title": "foo_a"},
            {"slug": "slug1zy_", "dashboard_title": "foo_b"},
            {"slug": "slug1", "dashboard_title": "zy_foo"},
        ]
        for index, item in enumerate(data["result"]):
            self.assertEqual(item["slug"], expected_response[index]["slug"])
            self.assertEqual(
                item["dashboard_title"], expected_response[index]["dashboard_title"]
            )

        self.logout()
        self.login(username="gamma")
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 0)

        # rollback changes
        db.session.delete(dashboard1)
        db.session.delete(dashboard2)
        db.session.delete(dashboard3)
        db.session.delete(dashboard4)
        db.session.commit()

    def test_get_dashboards_no_data_access(self):
        """
        Dashboard API: Test get dashboards no data access
        """
        admin = self.get_user("admin")
        dashboard = self.insert_dashboard("title", "slug1", [admin.id])

        self.login(username="gamma")
        arguments = {
            "filters": [{"col": "dashboard_title", "opr": "sw", "value": "ti"}]
        }
        uri = f"api/v1/dashboard/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 0)

        # rollback changes
        db.session.delete(dashboard)
        db.session.commit()

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
        dashboard_id = self.insert_dashboard("title1", "slug1", [admin.id]).id
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

        db.session.delete(model)
        db.session.commit()

    def test_update_dashboard_chart_owners(self):
        """
        Dashboard API: Test update chart owners
        """
        user_alpha1 = self.create_user(
            "alpha1", "password", "Alpha", email="alpha1@superset.org"
        )
        user_alpha2 = self.create_user(
            "alpha2", "password", "Alpha", email="alpha2@superset.org"
        )
        admin = self.get_user("admin")
        slices = []
        slices.append(
            db.session.query(Slice).filter_by(slice_name="Girl Name Cloud").first()
        )
        slices.append(db.session.query(Slice).filter_by(slice_name="Trends").first())
        slices.append(db.session.query(Slice).filter_by(slice_name="Boys").first())

        dashboard = self.insert_dashboard("title1", "slug1", [admin.id], slices=slices,)
        self.login(username="admin")
        uri = f"api/v1/dashboard/{dashboard.id}"
        dashboard_data = {"owners": [user_alpha1.id, user_alpha2.id]}
        rv = self.client.put(uri, json=dashboard_data)
        self.assertEqual(rv.status_code, 200)

        # verify slices owners include alpha1 and alpha2 users
        slices_ids = [slice.id for slice in slices]
        # Refetch Slices
        slices = db.session.query(Slice).filter(Slice.id.in_(slices_ids)).all()
        for slice in slices:
            self.assertIn(user_alpha1, slice.owners)
            self.assertIn(user_alpha2, slice.owners)
            self.assertIn(admin, slice.owners)
            # Revert owners on slice
            slice.owners = []
            db.session.commit()

        # Rollback changes
        db.session.delete(dashboard)
        db.session.delete(user_alpha1)
        db.session.delete(user_alpha2)
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
        model = db.session.query(Dashboard).get(dashboard_id)
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

    def test_export(self):
        """
        Dashboard API: Test dashboard export
        """
        self.login(username="admin")
        argument = [1, 2]
        uri = f"api/v1/dashboard/export/?q={prison.dumps(argument)}"
        rv = self.get_assert_metric(uri, "export")
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
