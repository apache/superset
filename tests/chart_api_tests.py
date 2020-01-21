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
from typing import List, Optional

import prison

from superset import db, security_manager
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice

from .base_api_tests import ApiOwnersTestCaseMixin
from .base_tests import SupersetTestCase


class ChartApiTests(SupersetTestCase, ApiOwnersTestCaseMixin):
    resource_name = "chart"

    def __init__(self, *args, **kwargs):
        super(ChartApiTests, self).__init__(*args, **kwargs)

    def insert_chart(
        self,
        slice_name: str,
        owners: List[int],
        datasource_id: int,
        datasource_type: str = "table",
        description: str = None,
        viz_type: str = None,
        params: str = None,
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
            slice_name=slice_name,
            datasource_id=datasource.id,
            datasource_name=datasource.name,
            datasource_type=datasource.type,
            owners=obj_owners,
            description=description,
            viz_type=viz_type,
            params=params,
            cache_timeout=cache_timeout,
        )
        db.session.add(slice)
        db.session.commit()
        return slice

    def test_delete_chart(self):
        """
            Chart API: Test delete
        """
        admin_id = self.get_user("admin").id
        chart_id = self.insert_chart("name", [admin_id], 1).id
        self.login(username="admin")
        uri = f"api/v1/chart/{chart_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Slice).get(chart_id)
        self.assertEqual(model, None)

    def test_delete_not_found_chart(self):
        """
            Chart API: Test not found delete
        """
        self.login(username="admin")
        chart_id = 1000
        uri = f"api/v1/chart/{chart_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 404)

    def test_delete_chart_admin_not_owned(self):
        """
            Chart API: Test admin delete not owned
        """
        gamma_id = self.get_user("gamma").id
        chart_id = self.insert_chart("title", [gamma_id], 1).id

        self.login(username="admin")
        uri = f"api/v1/chart/{chart_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 200)
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
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 403)
        db.session.delete(chart)
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
        rv = self.client.post(uri, json=chart_data)
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
        rv = self.client.post(uri, json=chart_data)
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
        rv = self.client.post(uri, json=chart_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"owners": {"0": ["User 1000 does not exist"]}}}
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
        rv = self.client.post(uri, json=chart_data)
        self.assertEqual(rv.status_code, 422)

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
        rv = self.client.post(uri, json=chart_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            response,
            {"message": {"_schema": ["Datasource [unknown].1 does not exist"]}},
        )
        chart_data = {
            "slice_name": "title1",
            "datasource_id": 0,
            "datasource_type": "table",
        }
        uri = f"api/v1/chart/"
        rv = self.client.post(uri, json=chart_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            response, {"message": {"_schema": ["Datasource [table].0 does not exist"]}}
        )

    def test_update_chart(self):
        """
            Chart API: Test update
        """
        admin = self.get_user("admin")
        gamma = self.get_user("gamma")

        chart_id = self.insert_chart("title", [admin.id], 1).id
        chart_data = {
            "slice_name": "title1_changed",
            "description": "description1",
            "owners": [gamma.id],
            "viz_type": "viz_type1",
            "params": "{'a': 1}",
            "cache_timeout": 1000,
            "datasource_id": 1,
            "datasource_type": "table",
            "dashboards": [1],
        }
        self.login(username="admin")
        uri = f"api/v1/chart/{chart_id}"
        rv = self.client.put(uri, json=chart_data)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Slice).get(chart_id)
        related_dashboard = db.session.query(Dashboard).get(1)
        self.assertEqual(model.slice_name, "title1_changed")
        self.assertEqual(model.description, "description1")
        self.assertIn(admin, model.owners)
        self.assertIn(gamma, model.owners)
        self.assertEqual(model.viz_type, "viz_type1")
        self.assertEqual(model.params, "{'a': 1}")
        self.assertEqual(model.cache_timeout, 1000)
        self.assertEqual(model.datasource_id, 1)
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
        rv = self.client.put(uri, json=chart_data)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Slice).get(chart_id)
        self.assertIn(admin, model.owners)
        db.session.delete(model)
        db.session.commit()

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
        rv = self.client.put(uri, json=chart_data)
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
        rv = self.client.put(uri, json=chart_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            response,
            {"message": {"_schema": ["Datasource [unknown].1 does not exist"]}},
        )
        chart_data = {"datasource_id": 0, "datasource_type": "table"}
        uri = f"api/v1/chart/{chart.id}"
        rv = self.client.put(uri, json=chart_data)
        self.assertEqual(rv.status_code, 422)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            response, {"message": {"_schema": ["Datasource [table].0 does not exist"]}}
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
        expected_response = {"message": {"owners": {"0": ["User 1000 does not exist"]}}}
        self.assertEqual(response, expected_response)

    def test_get_chart(self):
        """
            Chart API: Test get chart
        """
        admin = self.get_user("admin")
        chart = self.insert_chart("title", [admin.id], 1)
        self.login(username="admin")
        uri = f"api/v1/chart/{chart.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        expected_result = {
            "cache_timeout": None,
            "dashboards": [],
            "description": None,
            "owners": [{"id": 1, "username": "admin"}],
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
        rv = self.client.get(uri)
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

    def test_get_charts(self):
        """
            Chart API: Test get charts
        """
        self.login(username="admin")
        uri = f"api/v1/chart/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 33)

    def test_get_charts_filter(self):
        """
            Chart API: Test get charts filter
        """
        self.login(username="admin")
        arguments = {"filters": [{"col": "slice_name", "opr": "sw", "value": "G"}]}
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 5)

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
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(len(data["result"]), 3)

    def test_get_charts_no_data_access(self):
        """
            Chart API: Test get charts no data access
        """
        self.login(username="gamma")
        uri = f"api/v1/chart/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 0)
