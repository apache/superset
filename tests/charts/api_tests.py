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
from unittest import mock

import humanize
import prison
import pytest
from sqlalchemy.sql import func

from superset.utils.core import get_example_database
from tests.test_app import app
from superset.connectors.connector_registry import ConnectorRegistry
from superset.extensions import db, security_manager
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import core as utils
from tests.base_api_tests import ApiOwnersTestCaseMixin
from tests.base_tests import SupersetTestCase
from tests.fixtures.query_context import get_query_context

CHART_DATA_URI = "api/v1/chart/data"


class TestChartApi(SupersetTestCase, ApiOwnersTestCaseMixin):
    resource_name = "chart"

    def insert_chart(
        self,
        slice_name: str,
        owners: List[int],
        datasource_id: int,
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
        rv = self.delete_assert_metric(uri, "delete")
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Slice).get(chart_id)
        self.assertEqual(model, None)

    def test_delete_bulk_charts(self):
        """
        Chart API: Test delete bulk
        """
        admin_id = self.get_user("admin").id
        chart_count = 4
        chart_ids = list()
        for chart_name_index in range(chart_count):
            chart_ids.append(
                self.insert_chart(f"title{chart_name_index}", [admin_id], 1).id
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

    def test_delete_bulk_charts_not_found(self):
        """
        Chart API: Test delete bulk not found
        """
        max_id = db.session.query(func.max(Slice.id)).scalar()
        chart_ids = [max_id + 1, max_id + 2]
        self.login(username="admin")
        argument = chart_ids
        uri = f"api/v1/chart/?q={prison.dumps(argument)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        self.assertEqual(rv.status_code, 404)

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

        chart_id = self.insert_chart("title", [admin.id], 1).id
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

    def test_get_charts_custom_filter(self):
        """
        Chart API: Test get charts custom filter
        """
        admin = self.get_user("admin")
        chart1 = self.insert_chart("foo_a", [admin.id], 1, description="ZY_bar")
        chart2 = self.insert_chart("zy_foo", [admin.id], 1, description="desc1")
        chart3 = self.insert_chart("foo_b", [admin.id], 1, description="desc1zy_")
        chart4 = self.insert_chart("bar", [admin.id], 1, description="foo")

        arguments = {
            "filters": [
                {"col": "slice_name", "opr": "name_or_description", "value": "zy_"}
            ],
            "order_column": "slice_name",
            "order_direction": "asc",
            "keys": ["none"],
            "columns": ["slice_name", "description"],
        }
        self.login(username="admin")
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 3)

        expected_response = [
            {"description": "ZY_bar", "slice_name": "foo_a",},
            {"description": "desc1zy_", "slice_name": "foo_b",},
            {"description": "desc1", "slice_name": "zy_foo",},
        ]
        for index, item in enumerate(data["result"]):
            self.assertEqual(
                item["description"], expected_response[index]["description"]
            )
            self.assertEqual(item["slice_name"], expected_response[index]["slice_name"])

        self.logout()
        self.login(username="gamma")
        uri = f"api/v1/chart/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 0)

        # rollback changes
        db.session.delete(chart1)
        db.session.delete(chart2)
        db.session.delete(chart3)
        db.session.delete(chart4)
        db.session.commit()

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
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["result"][0]["rowcount"], 45)

    def test_chart_data_limit_offset(self):
        """
        Chart data API: Test chart data query with limit and offset
        """
        self.login(username="admin")
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
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
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
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
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
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
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
        request_payload["result_type"] = "qwerty"
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 400)

    def test_chart_data_incorrect_result_format(self):
        """
        Chart data API: Test chart data with unsupported result format
        """
        self.login(username="admin")
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
        request_payload["result_format"] = "qwerty"
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 400)

    def test_chart_data_query_result_type(self):
        """
        Chart data API: Test chart data with query result format
        """
        self.login(username="admin")
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
        request_payload["result_type"] = "query"
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)

    def test_chart_data_csv_result_format(self):
        """
        Chart data API: Test chart data with CSV result format
        """
        self.login(username="admin")
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
        request_payload["result_format"] = "csv"
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 200)

    def test_chart_data_mixed_case_filter_op(self):
        """
        Chart data API: Ensure mixed case filter operator generates valid result
        """
        self.login(username="admin")
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
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
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
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
        print(rv.data)
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

    def test_chart_data_no_data(self):
        """
        Chart data API: Test chart data with empty result
        """
        self.login(username="admin")
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
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
        table = self.get_table_by_name("birth_names")
        request_payload = get_query_context(table.name, table.id, table.type)
        request_payload["queries"][0]["filters"] = []
        # erroneus WHERE-clause
        request_payload["queries"][0]["extras"]["where"] = "(gender abc def)"
        rv = self.post_assert_metric(CHART_DATA_URI, request_payload, "data")
        self.assertEqual(rv.status_code, 400)

    def test_chart_data_with_invalid_datasource(self):
        """Chart data API: Test chart data query with invalid schema
        """
        self.login(username="admin")
        table = self.get_table_by_name("birth_names")
        payload = get_query_context(table.name, table.id, table.type)
        payload["datasource"] = "abc"
        rv = self.post_assert_metric(CHART_DATA_URI, payload, "data")
        self.assertEqual(rv.status_code, 400)

    def test_chart_data_with_invalid_enum_value(self):
        """Chart data API: Test chart data query with invalid enum value
        """
        self.login(username="admin")
        table = self.get_table_by_name("birth_names")
        payload = get_query_context(table.name, table.id, table.type)
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
        table = self.get_table_by_name("birth_names")
        payload = get_query_context(table.name, table.id, table.type)
        rv = self.post_assert_metric(CHART_DATA_URI, payload, "data")
        self.assertEqual(rv.status_code, 401)
