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

import prison

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database
from superset.utils.core import get_example_database

from .base_tests import SupersetTestCase


class DatasetApiTests(SupersetTestCase):

    example_create_column_data = {
        "column_name": "col_exp",
        "verbose_name": "col verbose name",
        "description": "col description",
        "type": "VARCHAR",
        "groupby": False,
        "filterable": True,
        "expression": "col expression",
        "is_dttm": False,
        "python_date_format": "epoch_s",
    }

    @staticmethod
    def insert_dataset(
            table_name: str, schema: str, owners: List[int], database: Database
    ) -> SqlaTable:
        obj_owners = list()
        for owner in owners:
            user = db.session.query(security_manager.user_model).get(owner)
            obj_owners.append(user)
        table = SqlaTable(
            table_name=table_name, schema=schema, owners=obj_owners, database=database
        )
        db.session.add(table)
        db.session.commit()
        return table

    @staticmethod
    def insert_dataset_column(
            table_id: int,
            column_name: str,
            verbose_name: str = "",
            description: str = "",
            type: str = "",
            groupby: bool = True,
            filterable: bool = True,
            is_dttm: bool = True,
            expression: str = "",
            python_date_format: str = "",
    ) -> TableColumn:
        table = db.session.query(SqlaTable).get(table_id)
        column = TableColumn(
            table=table,
            column_name=column_name,
            verbose_name=verbose_name,
            description=description,
            type=type,
            groupby=groupby,
            filterable=filterable,
            is_dttm=is_dttm,
            expression=expression,
            python_date_format=python_date_format,
        )
        db.session.add(column)
        db.session.commit()
        return column

    def get_example_db_table(self, table_name: str = "birth_names"):
        example_db = get_example_database()
        return (
            db.session.query(SqlaTable)
                .filter_by(database=example_db, table_name=table_name)
                .one()
        )

    def test_get_dataset_list(self):
        """
            Dataset API: Test get dataset list
        """
        example_db = get_example_database()
        self.login(username="admin")
        arguments = {
            "filters": [
                {"col": "database", "opr": "rel_o_m", "value": f"{example_db.id}"},
                {"col": "table_name", "opr": "eq", "value": f"birth_names"},
            ]
        }
        uri = f"api/v1/dataset/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["count"], 1)
        expected_columns = [
            "changed_by",
            "changed_on",
            "database_name",
            "schema",
            "table_name",
        ]
        self.assertEqual(sorted(list(response["result"][0].keys())), expected_columns)

    def test_get_dataset_list_gamma(self):
        """
            Dataset API: Test get dataset list gamma
        """
        example_db = get_example_database()
        self.login(username="gamma")
        uri = "api/v1/dataset/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["result"], [])

    def test_get_dataset_item(self):
        """
            Dataset API: Test get dataset item
        """
        example_db = get_example_database()
        table = (
            db.session.query(SqlaTable)
                .filter_by(database=example_db, table_name="birth_names")
                .one()
        )
        self.login(username="admin")
        uri = f"api/v1/dataset/{table.id}"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_result = {
            "cache_timeout": None,
            "database": {"database_name": "examples", "id": 1},
            "default_endpoint": None,
            "description": None,
            "fetch_values_predicate": None,
            "filter_select_enabled": True,
            "is_sqllab_view": False,
            "main_dttm_col": "ds",
            "offset": 0,
            "owners": [],
            "schema": None,
            "sql": None,
            "table_name": "birth_names",
            "template_params": None,
        }
        self.assertEqual(response["result"], expected_result)

    def test_get_dataset_info(self):
        """
            Dataset API: Test get dataset info
        """
        self.login(username="admin")
        uri = "api/v1/dataset/_info"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)

    def test_create_dataset_item(self):
        """
            Dataset API: Test create dataset item
        """
        example_db = get_example_database()
        self.login(username="admin")
        table_data = {
            "database": example_db.id,
            "schema": "",
            "table_name": "ab_permission",
        }
        uri = "api/v1/dataset/"
        rv = self.client.post(uri, json=table_data)
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(SqlaTable).get(data.get("id"))
        self.assertEqual(model.table_name, table_data["table_name"])
        self.assertEqual(model.database_id, table_data["database"])
        db.session.delete(model)
        db.session.commit()

    def test_create_dataset_item_gamma(self):
        """
            Dataset API: Test create dataset item gamma
        """
        self.login(username="gamma")
        example_db = get_example_database()
        table_data = {
            "database": example_db.id,
            "schema": "",
            "table_name": "ab_permission",
        }
        uri = "api/v1/dataset/"
        rv = self.client.post(uri, json=table_data)
        self.assertEqual(rv.status_code, 401)

    def test_create_dataset_item_owner(self):
        """
            Dataset API: Test create item owner
        """
        example_db = get_example_database()
        self.login(username="alpha")
        admin = self.get_user("admin")
        alpha = self.get_user("alpha")

        table_data = {
            "database": example_db.id,
            "schema": "",
            "table_name": "ab_permission",
            "owners": [admin.id],
        }
        uri = "api/v1/dataset/"
        rv = self.client.post(uri, json=table_data)
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(SqlaTable).get(data.get("id"))
        self.assertIn(admin, model.owners)
        self.assertIn(alpha, model.owners)
        db.session.delete(model)
        db.session.commit()

    def test_create_dataset_validate_uniqueness(self):
        """
            Dataset API: Test create dataset validate table uniqueness
        """
        example_db = get_example_database()
        self.login(username="admin")
        table_data = {
            "database": example_db.id,
            "schema": "",
            "table_name": "birth_names",
        }
        uri = "api/v1/dataset/"
        rv = self.client.post(uri, json=table_data)
        self.assertEqual(rv.status_code, 422)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(
            data, {"message": {"table_name": ["Datasource birth_names already exists"]}}
        )

    def test_create_dataset_validate_database(self):
        """
            Dataset API: Test create dataset validate database exists
        """
        self.login(username="admin")
        table_data = {"database": 1000, "schema": "", "table_name": "birth_names"}
        uri = "api/v1/dataset/"
        rv = self.client.post(uri, json=table_data)
        self.assertEqual(rv.status_code, 422)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(data, {"message": {"database": ["Database does not exist"]}})

    def test_create_dataset_validate_tables_exists(self):
        """
            Dataset API: Test create dataset validate table exists
        """
        example_db = get_example_database()
        self.login(username="admin")
        table_data = {
            "database": example_db.id,
            "schema": "",
            "table_name": "does_not_exist",
        }
        uri = "api/v1/dataset/"
        rv = self.client.post(uri, json=table_data)
        self.assertEqual(rv.status_code, 422)

    def test_update_dataset_item(self):
        """
            Dataset API: Test update dataset item
        """
        table = self.insert_dataset("ab_permission", "", [], get_example_database())
        self.login(username="admin")
        table_data = {
            "description": "changed_description",
            "main_dttm_col": "col",
            "offset": 10,
            "default_endpoint": "change_endpoint",
            "cache_timeout": 100,
            "is_sqllab_view": True,
            "template_params": "changed_params",
        }
        uri = f"api/v1/dataset/{table.id}"
        rv = self.client.put(uri, json=table_data)
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(SqlaTable).get(table.id)
        self.assertEqual(model.description, table_data["description"])
        self.assertEqual(model.main_dttm_col, table_data["main_dttm_col"])
        self.assertEqual(model.offset, table_data["offset"])
        self.assertEqual(model.default_endpoint, table_data["default_endpoint"])
        self.assertEqual(model.cache_timeout, table_data["cache_timeout"])
        self.assertEqual(model.is_sqllab_view, table_data["is_sqllab_view"])
        self.assertEqual(model.template_params, table_data["template_params"])
        db.session.delete(model)
        db.session.commit()

    def test_update_dataset_item_gamma(self):
        """
            Dataset API: Test update dataset item gamma
        """
        table = self.insert_dataset("ab_permission", "", [], get_example_database())
        self.login(username="gamma")
        table_data = {"description": "changed_description"}
        uri = f"api/v1/dataset/{table.id}"
        rv = self.client.put(uri, json=table_data)
        self.assertEqual(rv.status_code, 401)
        db.session.delete(table)
        db.session.commit()

    def test_update_dataset_item_not_owned(self):
        """
            Dataset API: Test update dataset item not owned
        """
        admin = self.get_user("admin")
        table = self.insert_dataset(
            "ab_permission", "", [admin.id], get_example_database()
        )
        self.login(username="alpha")
        table_data = {"description": "changed_description"}
        uri = f"api/v1/dataset/{table.id}"
        rv = self.client.put(uri, json=table_data)
        self.assertEqual(rv.status_code, 403)
        db.session.delete(table)
        db.session.commit()

    def test_delete_dataset_item(self):
        """
            Dataset API: Test delete dataset item
        """
        admin = self.get_user("admin")
        table = self.insert_dataset(
            "ab_permission", "", [admin.id], get_example_database()
        )
        self.login(username="admin")
        uri = f"api/v1/dataset/{table.id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 200)

    def test_delete_item_dataset_not_owned(self):
        """
            Dataset API: Test delete item not owned
        """
        admin = self.get_user("admin")
        table = self.insert_dataset(
            "ab_permission", "", [admin.id], get_example_database()
        )
        self.login(username="alpha")
        uri = f"api/v1/dataset/{table.id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 403)
        db.session.delete(table)
        db.session.commit()

    def test_delete_dataset_item_not_authorized(self):
        """
            Dataset API: Test delete item not authorized
        """
        admin = self.get_user("admin")
        table = self.insert_dataset(
            "ab_permission", "", [admin.id], get_example_database()
        )
        self.login(username="gamma")
        uri = f"api/v1/dataset/{table.id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 401)
        db.session.delete(table)
        db.session.commit()
