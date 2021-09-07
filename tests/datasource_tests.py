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
from copy import deepcopy
from unittest import mock

import pytest

from superset import app, ConnectorRegistry, db
from superset.connectors.sqla.models import SqlaTable
from superset.datasets.commands.exceptions import DatasetNotFoundError
from superset.exceptions import SupersetException, SupersetGenericDBErrorException
from superset.utils.core import get_example_database
from tests.fixtures.birth_names_dashboard import load_birth_names_dashboard_with_slices

from .base_tests import db_insert_temp_object, SupersetTestCase
from .fixtures.datasource import datasource_post


class TestDatasource(SupersetTestCase):
    def setUp(self):
        self.original_attrs = {}
        self.datasource = None

    def tearDown(self):
        if self.datasource:
            for key, value in self.original_attrs.items():
                setattr(self.datasource, key, value)

            db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_external_metadata_for_physical_table(self):
        self.login(username="admin")
        tbl = self.get_table_by_name("birth_names")
        url = f"/datasource/external_metadata/table/{tbl.id}/"
        resp = self.get_json_resp(url)
        col_names = {o.get("name") for o in resp}
        self.assertEqual(
            col_names, {"num_boys", "num", "gender", "name", "ds", "state", "num_girls"}
        )

    def test_external_metadata_for_virtual_table(self):
        self.login(username="admin")
        session = db.session
        table = SqlaTable(
            table_name="dummy_sql_table",
            database=get_example_database(),
            sql="select 123 as intcol, 'abc' as strcol",
        )
        session.add(table)
        session.commit()

        table = self.get_table_by_name("dummy_sql_table")
        url = f"/datasource/external_metadata/table/{table.id}/"
        resp = self.get_json_resp(url)
        assert {o.get("name") for o in resp} == {"intcol", "strcol"}
        session.delete(table)
        session.commit()

    def test_external_metadata_for_malicious_virtual_table(self):
        self.login(username="admin")
        table = SqlaTable(
            table_name="malicious_sql_table",
            database=get_example_database(),
            sql="delete table birth_names",
        )
        with db_insert_temp_object(table):
            url = f"/datasource/external_metadata/table/{table.id}/"
            resp = self.get_json_resp(url)
            self.assertEqual(resp["error"], "Only `SELECT` statements are allowed")

    def test_external_metadata_for_mutistatement_virtual_table(self):
        self.login(username="admin")
        table = SqlaTable(
            table_name="multistatement_sql_table",
            database=get_example_database(),
            sql="select 123 as intcol, 'abc' as strcol;"
            "select 123 as intcol, 'abc' as strcol",
        )
        with db_insert_temp_object(table):
            url = f"/datasource/external_metadata/table/{table.id}/"
            resp = self.get_json_resp(url)
            self.assertEqual(resp["error"], "Only single queries supported")

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch("superset.connectors.sqla.models.SqlaTable.external_metadata")
    def test_external_metadata_error_return_400(self, mock_get_datasource):
        self.login(username="admin")
        tbl = self.get_table_by_name("birth_names")
        url = f"/datasource/external_metadata/table/{tbl.id}/"

        mock_get_datasource.side_effect = SupersetGenericDBErrorException("oops")

        pytest.raises(
            SupersetGenericDBErrorException,
            lambda: ConnectorRegistry.get_datasource(
                "table", tbl.id, db.session
            ).external_metadata(),
        )

        resp = self.client.get(url)
        assert resp.status_code == 400

    def compare_lists(self, l1, l2, key):
        l2_lookup = {o.get(key): o for o in l2}
        for obj1 in l1:
            obj2 = l2_lookup.get(obj1.get(key))
            for k in obj1:
                if k not in "id" and obj1.get(k):
                    self.assertEqual(obj1.get(k), obj2.get(k))

    def test_save(self):
        self.login(username="admin")
        tbl_id = self.get_table_by_name("birth_names").id

        self.datasource = ConnectorRegistry.get_datasource("table", tbl_id, db.session)

        for key in self.datasource.export_fields:
            self.original_attrs[key] = getattr(self.datasource, key)

        datasource_post["id"] = tbl_id
        data = dict(data=json.dumps(datasource_post))
        resp = self.get_json_resp("/datasource/save/", data)
        for k in datasource_post:
            if k == "columns":
                self.compare_lists(datasource_post[k], resp[k], "column_name")
            elif k == "metrics":
                self.compare_lists(datasource_post[k], resp[k], "metric_name")
            elif k == "database":
                self.assertEqual(resp[k]["id"], datasource_post[k]["id"])
            else:
                self.assertEqual(resp[k], datasource_post[k])

    def save_datasource_from_dict(self, datasource_dict):
        data = dict(data=json.dumps(datasource_post))
        resp = self.get_json_resp("/datasource/save/", data)
        return resp

    def test_change_database(self):
        self.login(username="admin")
        tbl = self.get_table_by_name("birth_names")
        tbl_id = tbl.id
        db_id = tbl.database_id
        datasource_post["id"] = tbl_id

        self.datasource = ConnectorRegistry.get_datasource("table", tbl_id, db.session)

        for key in self.datasource.export_fields:
            self.original_attrs[key] = getattr(self.datasource, key)

        new_db = self.create_fake_db()

        datasource_post["database"]["id"] = new_db.id
        resp = self.save_datasource_from_dict(datasource_post)
        self.assertEqual(resp["database"]["id"], new_db.id)

        datasource_post["database"]["id"] = db_id
        resp = self.save_datasource_from_dict(datasource_post)
        self.assertEqual(resp["database"]["id"], db_id)

        self.delete_fake_db()

    def test_save_duplicate_key(self):
        self.login(username="admin")
        tbl_id = self.get_table_by_name("birth_names").id
        self.datasource = ConnectorRegistry.get_datasource("table", tbl_id, db.session)

        for key in self.datasource.export_fields:
            self.original_attrs[key] = getattr(self.datasource, key)

        datasource_post_copy = deepcopy(datasource_post)
        datasource_post_copy["id"] = tbl_id
        datasource_post_copy["columns"].extend(
            [
                {
                    "column_name": "<new column>",
                    "filterable": True,
                    "groupby": True,
                    "expression": "<enter SQL expression here>",
                    "id": "somerandomid",
                },
                {
                    "column_name": "<new column>",
                    "filterable": True,
                    "groupby": True,
                    "expression": "<enter SQL expression here>",
                    "id": "somerandomid2",
                },
            ]
        )
        data = dict(data=json.dumps(datasource_post_copy))
        resp = self.get_json_resp("/datasource/save/", data, raise_on_error=False)
        self.assertIn("Duplicate column name(s): <new column>", resp["error"])

    def test_get_datasource(self):
        self.login(username="admin")
        tbl = self.get_table_by_name("birth_names")
        self.datasource = ConnectorRegistry.get_datasource("table", tbl.id, db.session)

        for key in self.datasource.export_fields:
            self.original_attrs[key] = getattr(self.datasource, key)

        datasource_post["id"] = tbl.id
        data = dict(data=json.dumps(datasource_post))
        self.get_json_resp("/datasource/save/", data)
        url = f"/datasource/get/{tbl.type}/{tbl.id}/"
        resp = self.get_json_resp(url)
        self.assertEqual(resp.get("type"), "table")
        col_names = {o.get("column_name") for o in resp["columns"]}
        self.assertEqual(
            col_names,
            {
                "num_boys",
                "num",
                "gender",
                "name",
                "ds",
                "state",
                "num_girls",
                "num_california",
            },
        )

    def test_get_datasource_with_health_check(self):
        def my_check(datasource):
            return "Warning message!"

        app.config["DATASET_HEALTH_CHECK"] = my_check
        self.login(username="admin")
        tbl = self.get_table_by_name("birth_names")
        datasource = ConnectorRegistry.get_datasource("table", tbl.id, db.session)
        assert datasource.health_check_message == "Warning message!"
        app.config["DATASET_HEALTH_CHECK"] = None

    def test_get_datasource_failed(self):
        pytest.raises(
            DatasetNotFoundError,
            lambda: ConnectorRegistry.get_datasource("table", 9999999, db.session),
        )

        self.login(username="admin")
        resp = self.get_json_resp("/datasource/get/druid/500000/", raise_on_error=False)
        self.assertEqual(resp.get("error"), "Dataset does not exist")

        resp = self.get_json_resp(
            "/datasource/get/invalid-datasource-type/500000/", raise_on_error=False
        )
        self.assertEqual(resp.get("error"), "Dataset does not exist")
