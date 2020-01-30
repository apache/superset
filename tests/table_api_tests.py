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
"""Unit tests for TableRestApi."""
import json
from typing import Dict, Text

from flask import Response

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.utils.core import get_example_database

from .base_tests import SupersetTestCase


class TableApiTests(SupersetTestCase):
    resource_name = "table"

    def __init__(self, *args, **kwargs):
        super(TableApiTests, self).__init__(*args, **kwargs)

    def _get_table(self, user: Text) -> Response:
        """Helper function to send GET /table​/ request and return resp."""
        self.login(username=user)
        uri = f"api/v1/table/"
        rv = self.client.get(uri)
        return rv

    def _create_table(self, user: Text, tbl_name: Text) -> Response:
        """Helper function to send POST /table/ request and return resp."""
        self.login(username=user)
        table_data = {"database": 1, "table_name": tbl_name}
        uri = f"api/v1/table/"
        rv = self.client.post(uri, json=table_data)
        return rv

    def _delete_table(self, user: Text) -> Response:
        """Helper function to create a temp table, send DELETE /table/{pk} and return resp."""
        # Create a temp table.
        tbl_name = "bart_lines"
        database = get_example_database()
        tbl = SqlaTable(table_name=tbl_name)
        tbl.database = database
        db.session.merge(tbl)
        db.session.commit()

        # Send DELETE /table​/{pk} request.
        tbl_obj = self.get_table_by_name(tbl_name)
        self.login(username=user)
        uri = f"api/v1/table/{tbl_obj.id}"
        rv = self.client.delete(uri)
        return rv

    def _update_table(
        self, user: Text, tbl_name: Text, tbl_data: Dict[Text, Text]
    ) -> Response:
        """Helper function to send PUT /table/{pk} request and return resp."""
        # Send PUT /table​/{pk} request, verify it succeeds with 200.
        model = db.session.query(SqlaTable).filter_by(table_name=tbl_name).one()
        table_id = model.id
        self.login(username=user)
        uri = f"api/v1/table/{table_id}"
        rv = self.client.put(uri, json=tbl_data)
        return rv

    def test_get_table_admin(self) -> None:
        """Table API: Test get table with admin."""
        rv = self._get_table(user="admin")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 6)

    def test_get_table_alpha(self) -> None:
        """Table API: Test get table with alpha."""
        rv = self._get_table(user="alpha")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 6)

    def test_get_table_gamma(self) -> None:
        """Table API: Test get table with gamma."""
        rv = self._get_table(user="gamma")
        self.assertEqual(rv.status_code, 200)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data["count"], 6)

    def test_get_table_pk(self) -> None:
        """Table API: Test get table on pk."""
        # Send GET /table​/{pk} request.
        tbl_name = "birth_names"
        tbl_obj = db.session.query(SqlaTable).filter_by(table_name=tbl_name).one()
        table_id = tbl_obj.id
        self.login(username="admin")
        uri = f"api/v1/chart/{table_id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)

    def test_get_table_pk_not_found(self) -> None:
        """Table API: Test get table on pk not found."""
        # Send GET /table​/{pk} request on a non-existent pk.
        table_id = 1000
        self.login(username="admin")
        uri = f"api/v1/chart/{table_id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_create_table_admin(self) -> None:
        """Table API: Test create table with admin."""
        tbl_name = "bart_lines"
        rv = self._create_table(user="admin", tbl_name=tbl_name)
        self.assertEqual(rv.status_code, 201)

        # Verify the table is created.
        tbl_obj = self.get_table_by_name(tbl_name)
        self.assertEqual(tbl_obj.table_name, tbl_name)

        # Clean up.
        db.session.delete(tbl_obj)
        db.session.commit()

    def test_create_table_alpha(self) -> None:
        """Table API: Test create table with alpha."""
        tbl_name = "bart_lines"
        rv = self._create_table(user="alpha", tbl_name=tbl_name)
        self.assertEqual(rv.status_code, 201)

        # Verify the table is created.
        tbl_obj = self.get_table_by_name(tbl_name)
        self.assertEqual(tbl_obj.table_name, tbl_name)

        # Clean up.
        db.session.delete(tbl_obj)
        db.session.commit()

    def test_create_table_gamma_no_perm(self) -> None:
        """Table API: Test create table with gamma."""
        # Verify gamma user has no permission to create.
        tbl_name = "bart_lines"
        rv = self._create_table(user="gamma", tbl_name=tbl_name)
        self.assertEqual(rv.status_code, 401)

    def test_create_table_existed(self) -> None:
        """Table API: Test create table already existed."""
        main_db = get_example_database()
        # Only run the test when backend db is mysql.
        # TODO(dandanhub): Fix test failure when backend db is postgres.
        if main_db.backend == "mysql":
            # Try to create a able already existed, verify it fails.
            tbl_name = "birth_names"
            self.login(username="admin")
            table_data = {"database": 1, "table_name": tbl_name}
            uri = f"api/v1/table/"
            rv = self.client.post(uri, json=table_data)
            self.assertEqual(rv.status_code, 422)
            tbl_obj = self.get_table_by_name(tbl_name)
            self.assertEqual(tbl_obj.table_name, tbl_name)

    def test_delete_table_admin(self) -> None:
        """Table API: Test delete with admin."""
        rv = self._delete_table(user="admin")
        self.assertEqual(rv.status_code, 200)

    def test_delete_table_alpha(self):
        """Table API: Test delete with alpha."""
        rv = self._delete_table(user="alpha")
        self.assertEqual(rv.status_code, 200)

    def test_delete_table_gamma_no_perm(self) -> None:
        """Table API: Test delete with gamma no permission."""
        # Send DELETE /table/{pk}, verify it returns 401 for gamma user.
        tbl_name = "birth_names"
        tbl_obj = db.session.query(SqlaTable).filter_by(table_name=tbl_name).one()
        table_id = tbl_obj.id
        self.login(username="gamma")
        uri = f"api/v1/table/{table_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 401)

    def test_delete_table_not_existed(self):
        """Table API: Test delete table not existed."""
        # Try to delete a non-existent table, verify it fails.
        table_id = 1000
        self.login(username="admin")
        uri = f"api/v1/table/{table_id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 404)

    def test_update_table_admin(self) -> None:
        """Table API: Test update table with admin."""
        tbl_name = "birth_names"
        tbl_data = {"description": ""}
        rv = self._update_table(user="admin", tbl_name=tbl_name, tbl_data=tbl_data)
        self.assertEqual(rv.status_code, 200)

        # Verify the table is updated.
        model = self.get_table_by_name(tbl_name)
        self.assertEqual(model.description, "")

    def test_update_table_alpha(self) -> None:
        """Table API: Test update table with alpha."""
        tbl_name = "birth_names"
        tbl_data = {"description": ""}
        rv = self._update_table(user="alpha", tbl_name=tbl_name, tbl_data=tbl_data)
        self.assertEqual(rv.status_code, 200)

        # Verify the table is updated.
        model = self.get_table_by_name(tbl_name)
        self.assertEqual(model.description, "")

    def test_update_table_gamma_no_perm(self) -> None:
        """Table API: Test update table with gamma no permission."""
        # Verify gamma user has no permission to update.
        tbl_name = "birth_names"
        tbl_data = {"description": ""}
        rv = self._update_table(user="gamma", tbl_name=tbl_name, tbl_data=tbl_data)
        self.assertEqual(rv.status_code, 401)

    def test_update_table_not_existed(self) -> None:
        """Table API: Test update table not existed."""
        # Try to update a non-existent table, verify it fails.
        table_id = 1000
        self.login(username="admin")
        uri = f"api/v1/table/{table_id}"
        rv = self.client.put(uri, json={})
        self.assertEqual(rv.status_code, 404)
