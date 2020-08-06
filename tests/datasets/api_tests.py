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
from unittest.mock import patch

import prison
import yaml
from sqlalchemy.sql import func

import tests.test_app
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.dao.exceptions import (
    DAOCreateFailedError,
    DAODeleteFailedError,
    DAOUpdateFailedError,
)
from superset.extensions import db, security_manager
from superset.models.core import Database
from superset.utils.core import get_example_database, get_main_database
from superset.utils.dict_import_export import export_to_dict
from superset.views.base import generate_download_headers
from tests.base_tests import SupersetTestCase


class TestDatasetApi(SupersetTestCase):
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
        table.fetch_metadata()
        return table

    def insert_default_dataset(self):
        return self.insert_dataset(
            "ab_permission", "", [self.get_user("admin").id], get_main_database()
        )

    @staticmethod
    def get_birth_names_dataset():
        example_db = get_example_database()
        return (
            db.session.query(SqlaTable)
            .filter_by(database=example_db, table_name="birth_names")
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
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["count"], 1)
        expected_columns = [
            "changed_by",
            "changed_by_name",
            "changed_by_url",
            "changed_on_delta_humanized",
            "changed_on_utc",
            "database",
            "default_endpoint",
            "explore_url",
            "id",
            "kind",
            "owners",
            "schema",
            "sql",
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
        rv = self.get_assert_metric(uri, "get_list")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["result"], [])

    def test_get_dataset_related_database_gamma(self):
        """
        Dataset API: Test get dataset related databases gamma
        """
        example_db = get_example_database()
        self.login(username="gamma")
        uri = "api/v1/dataset/related/database"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["count"], 0)
        self.assertEqual(response["result"], [])

    def test_get_dataset_item(self):
        """
        Dataset API: Test get dataset item
        """
        table = self.get_birth_names_dataset()
        self.login(username="admin")
        uri = f"api/v1/dataset/{table.id}"
        rv = self.get_assert_metric(uri, "get")
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
        for key, value in expected_result.items():
            self.assertEqual(response["result"][key], value)
        self.assertEqual(len(response["result"]["columns"]), 8)
        self.assertEqual(len(response["result"]["metrics"]), 2)

    def test_get_dataset_info(self):
        """
        Dataset API: Test get dataset info
        """
        self.login(username="admin")
        uri = "api/v1/dataset/_info"
        rv = self.get_assert_metric(uri, "info")
        self.assertEqual(rv.status_code, 200)

    def test_create_dataset_item(self):
        """
        Dataset API: Test create dataset item
        """
        main_db = get_main_database()
        self.login(username="admin")
        table_data = {
            "database": main_db.id,
            "schema": "",
            "table_name": "ab_permission",
        }
        uri = "api/v1/dataset/"
        rv = self.post_assert_metric(uri, table_data, "post")
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        table_id = data.get("id")
        model = db.session.query(SqlaTable).get(table_id)
        self.assertEqual(model.table_name, table_data["table_name"])
        self.assertEqual(model.database_id, table_data["database"])

        # Assert that columns were created
        columns = (
            db.session.query(TableColumn)
            .filter_by(table_id=table_id)
            .order_by("column_name")
            .all()
        )
        self.assertEqual(columns[0].column_name, "id")
        self.assertEqual(columns[1].column_name, "name")

        # Assert that metrics were created
        columns = (
            db.session.query(SqlMetric)
            .filter_by(table_id=table_id)
            .order_by("metric_name")
            .all()
        )
        self.assertEqual(columns[0].expression, "COUNT(*)")

        db.session.delete(model)
        db.session.commit()

    def test_create_dataset_item_gamma(self):
        """
        Dataset API: Test create dataset item gamma
        """
        self.login(username="gamma")
        main_db = get_main_database()
        table_data = {
            "database": main_db.id,
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
        main_db = get_main_database()
        self.login(username="alpha")
        admin = self.get_user("admin")
        alpha = self.get_user("alpha")

        table_data = {
            "database": main_db.id,
            "schema": "",
            "table_name": "ab_permission",
            "owners": [admin.id],
        }
        uri = "api/v1/dataset/"
        rv = self.post_assert_metric(uri, table_data, "post")
        self.assertEqual(rv.status_code, 201)
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(SqlaTable).get(data.get("id"))
        self.assertIn(admin, model.owners)
        self.assertIn(alpha, model.owners)
        db.session.delete(model)
        db.session.commit()

    def test_create_dataset_item_owners_invalid(self):
        """
        Dataset API: Test create dataset item owner invalid
        """
        admin = self.get_user("admin")
        main_db = get_main_database()
        self.login(username="admin")
        table_data = {
            "database": main_db.id,
            "schema": "",
            "table_name": "ab_permission",
            "owners": [admin.id, 1000],
        }
        uri = f"api/v1/dataset/"
        rv = self.post_assert_metric(uri, table_data, "post")
        self.assertEqual(rv.status_code, 422)
        data = json.loads(rv.data.decode("utf-8"))
        expected_result = {"message": {"owners": ["Owners are invalid"]}}
        self.assertEqual(data, expected_result)

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
        rv = self.post_assert_metric(uri, table_data, "post")
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
        dataset_data = {"database": 1000, "schema": "", "table_name": "birth_names"}
        uri = "api/v1/dataset/"
        rv = self.post_assert_metric(uri, dataset_data, "post")
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
        rv = self.post_assert_metric(uri, table_data, "post")
        self.assertEqual(rv.status_code, 422)

    @patch("superset.datasets.dao.DatasetDAO.create")
    def test_create_dataset_sqlalchemy_error(self, mock_dao_create):
        """
        Dataset API: Test create dataset sqlalchemy error
        """
        mock_dao_create.side_effect = DAOCreateFailedError()
        self.login(username="admin")
        main_db = get_main_database()
        dataset_data = {
            "database": main_db.id,
            "schema": "",
            "table_name": "ab_permission",
        }
        uri = "api/v1/dataset/"
        rv = self.post_assert_metric(uri, dataset_data, "post")
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 422)
        self.assertEqual(data, {"message": "Dataset could not be created."})

    def test_update_dataset_item(self):
        """
        Dataset API: Test update dataset item
        """
        dataset = self.insert_default_dataset()
        self.login(username="admin")
        dataset_data = {"description": "changed_description"}
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.put_assert_metric(uri, dataset_data, "put")
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(SqlaTable).get(dataset.id)
        self.assertEqual(model.description, dataset_data["description"])
        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_create_column(self):
        """
        Dataset API: Test update dataset create column
        """
        # create example dataset by Command
        dataset = self.insert_default_dataset()

        new_column_data = {
            "column_name": "new_col",
            "description": "description",
            "expression": "expression",
            "type": "INTEGER",
            "verbose_name": "New Col",
        }
        uri = f"api/v1/dataset/{dataset.id}"
        # Get current cols and append the new column
        self.login(username="admin")
        rv = self.get_assert_metric(uri, "get")
        data = json.loads(rv.data.decode("utf-8"))

        for column in data["result"]["columns"]:
            column.pop("changed_on", None)
            column.pop("created_on", None)

        data["result"]["columns"].append(new_column_data)
        rv = self.client.put(uri, json={"columns": data["result"]["columns"]})

        self.assertEqual(rv.status_code, 200)

        columns = (
            db.session.query(TableColumn)
            .filter_by(table_id=dataset.id)
            .order_by("column_name")
            .all()
        )
        self.assertEqual(columns[0].column_name, "id")
        self.assertEqual(columns[1].column_name, "name")
        self.assertEqual(columns[2].column_name, new_column_data["column_name"])
        self.assertEqual(columns[2].description, new_column_data["description"])
        self.assertEqual(columns[2].expression, new_column_data["expression"])
        self.assertEqual(columns[2].type, new_column_data["type"])
        self.assertEqual(columns[2].verbose_name, new_column_data["verbose_name"])

        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_update_column(self):
        """
        Dataset API: Test update dataset columns
        """
        dataset = self.insert_default_dataset()

        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}"
        # Get current cols and alter one
        rv = self.get_assert_metric(uri, "get")
        resp_columns = json.loads(rv.data.decode("utf-8"))["result"]["columns"]
        for column in resp_columns:
            column.pop("changed_on", None)
            column.pop("created_on", None)

        resp_columns[0]["groupby"] = False
        resp_columns[0]["filterable"] = False
        v = self.client.put(uri, json={"columns": resp_columns})
        self.assertEqual(rv.status_code, 200)
        columns = (
            db.session.query(TableColumn)
            .filter_by(table_id=dataset.id)
            .order_by("column_name")
            .all()
        )
        self.assertEqual(columns[0].column_name, "id")
        self.assertEqual(columns[1].column_name, "name")
        self.assertEqual(columns[0].groupby, False)
        self.assertEqual(columns[0].filterable, False)

        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_update_column_uniqueness(self):
        """
        Dataset API: Test update dataset columns uniqueness
        """
        dataset = self.insert_default_dataset()

        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}"
        # try to insert a new column ID that already exists
        data = {"columns": [{"column_name": "id", "type": "INTEGER"}]}
        rv = self.put_assert_metric(uri, data, "put")
        self.assertEqual(rv.status_code, 422)
        data = json.loads(rv.data.decode("utf-8"))
        expected_result = {
            "message": {"columns": ["One or more columns already exist"]}
        }
        self.assertEqual(data, expected_result)
        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_update_metric_uniqueness(self):
        """
        Dataset API: Test update dataset metric uniqueness
        """
        dataset = self.insert_default_dataset()

        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}"
        # try to insert a new column ID that already exists
        data = {"metrics": [{"metric_name": "count", "expression": "COUNT(*)"}]}
        rv = self.put_assert_metric(uri, data, "put")
        self.assertEqual(rv.status_code, 422)
        data = json.loads(rv.data.decode("utf-8"))
        expected_result = {
            "message": {"metrics": ["One or more metrics already exist"]}
        }
        self.assertEqual(data, expected_result)
        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_update_column_duplicate(self):
        """
        Dataset API: Test update dataset columns duplicate
        """
        dataset = self.insert_default_dataset()

        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}"
        # try to insert a new column ID that already exists
        data = {
            "columns": [
                {"column_name": "id", "type": "INTEGER"},
                {"column_name": "id", "type": "VARCHAR"},
            ]
        }
        rv = self.put_assert_metric(uri, data, "put")
        self.assertEqual(rv.status_code, 422)
        data = json.loads(rv.data.decode("utf-8"))
        expected_result = {
            "message": {"columns": ["One or more columns are duplicated"]}
        }
        self.assertEqual(data, expected_result)
        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_update_metric_duplicate(self):
        """
        Dataset API: Test update dataset metric duplicate
        """
        dataset = self.insert_default_dataset()

        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}"
        # try to insert a new column ID that already exists
        data = {
            "metrics": [
                {"metric_name": "dup", "expression": "COUNT(*)"},
                {"metric_name": "dup", "expression": "DIFF_COUNT(*)"},
            ]
        }
        rv = self.put_assert_metric(uri, data, "put")
        self.assertEqual(rv.status_code, 422)
        data = json.loads(rv.data.decode("utf-8"))
        expected_result = {
            "message": {"metrics": ["One or more metrics are duplicated"]}
        }
        self.assertEqual(data, expected_result)
        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_item_gamma(self):
        """
        Dataset API: Test update dataset item gamma
        """
        dataset = self.insert_default_dataset()
        self.login(username="gamma")
        table_data = {"description": "changed_description"}
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.client.put(uri, json=table_data)
        self.assertEqual(rv.status_code, 401)
        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_item_not_owned(self):
        """
        Dataset API: Test update dataset item not owned
        """
        dataset = self.insert_default_dataset()
        self.login(username="alpha")
        table_data = {"description": "changed_description"}
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.put_assert_metric(uri, table_data, "put")
        self.assertEqual(rv.status_code, 403)
        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_item_owners_invalid(self):
        """
        Dataset API: Test update dataset item owner invalid
        """
        dataset = self.insert_default_dataset()
        self.login(username="admin")
        table_data = {"description": "changed_description", "owners": [1000]}
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.put_assert_metric(uri, table_data, "put")
        self.assertEqual(rv.status_code, 422)
        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_item_uniqueness(self):
        """
        Dataset API: Test update dataset uniqueness
        """
        dataset = self.insert_default_dataset()
        self.login(username="admin")
        ab_user = self.insert_dataset(
            "ab_user", "", [self.get_user("admin").id], get_main_database()
        )
        table_data = {"table_name": "ab_user"}
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.put_assert_metric(uri, table_data, "put")
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 422)
        expected_response = {
            "message": {"table_name": ["Datasource ab_user already exists"]}
        }
        self.assertEqual(data, expected_response)
        db.session.delete(dataset)
        db.session.delete(ab_user)
        db.session.commit()

    @patch("superset.datasets.dao.DatasetDAO.update")
    def test_update_dataset_sqlalchemy_error(self, mock_dao_update):
        """
        Dataset API: Test update dataset sqlalchemy error
        """
        mock_dao_update.side_effect = DAOUpdateFailedError()

        dataset = self.insert_default_dataset()
        self.login(username="admin")
        table_data = {"description": "changed_description"}
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.client.put(uri, json=table_data)
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 422)
        self.assertEqual(data, {"message": "Dataset could not be updated."})

        db.session.delete(dataset)
        db.session.commit()

    def test_delete_dataset_item(self):
        """
        Dataset API: Test delete dataset item
        """
        dataset = self.insert_default_dataset()
        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 200)

    def test_delete_item_dataset_not_owned(self):
        """
        Dataset API: Test delete item not owned
        """
        dataset = self.insert_default_dataset()
        self.login(username="alpha")
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.delete_assert_metric(uri, "delete")
        self.assertEqual(rv.status_code, 403)
        db.session.delete(dataset)
        db.session.commit()

    def test_delete_dataset_item_not_authorized(self):
        """
        Dataset API: Test delete item not authorized
        """
        dataset = self.insert_default_dataset()
        self.login(username="gamma")
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.client.delete(uri)
        self.assertEqual(rv.status_code, 401)
        db.session.delete(dataset)
        db.session.commit()

    @patch("superset.datasets.dao.DatasetDAO.delete")
    def test_delete_dataset_sqlalchemy_error(self, mock_dao_delete):
        """
        Dataset API: Test delete dataset sqlalchemy error
        """
        mock_dao_delete.side_effect = DAODeleteFailedError()

        dataset = self.insert_default_dataset()
        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.delete_assert_metric(uri, "delete")
        data = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 422)
        self.assertEqual(data, {"message": "Dataset could not be deleted."})
        db.session.delete(dataset)
        db.session.commit()

    def test_dataset_item_refresh(self):
        """
        Dataset API: Test item refresh
        """
        dataset = self.insert_default_dataset()
        # delete a column
        id_column = (
            db.session.query(TableColumn)
            .filter_by(table_id=dataset.id, column_name="id")
            .one()
        )
        db.session.delete(id_column)
        db.session.commit()

        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}/refresh"
        rv = self.put_assert_metric(uri, {}, "refresh")
        self.assertEqual(rv.status_code, 200)
        # Assert the column is restored on refresh
        id_column = (
            db.session.query(TableColumn)
            .filter_by(table_id=dataset.id, column_name="id")
            .one()
        )
        self.assertIsNotNone(id_column)
        db.session.delete(dataset)
        db.session.commit()

    def test_dataset_item_refresh_not_found(self):
        """
        Dataset API: Test item refresh not found dataset
        """
        max_id = db.session.query(func.max(SqlaTable.id)).scalar()

        self.login(username="admin")
        uri = f"api/v1/dataset/{max_id + 1}/refresh"
        rv = self.put_assert_metric(uri, {}, "refresh")
        self.assertEqual(rv.status_code, 404)

    def test_dataset_item_refresh_not_owned(self):
        """
        Dataset API: Test item refresh not owned dataset
        """
        dataset = self.insert_default_dataset()
        self.login(username="alpha")
        uri = f"api/v1/dataset/{dataset.id}/refresh"
        rv = self.put_assert_metric(uri, {}, "refresh")
        self.assertEqual(rv.status_code, 403)

        db.session.delete(dataset)
        db.session.commit()

    def test_export_dataset(self):
        """
        Dataset API: Test export dataset
        """
        birth_names_dataset = self.get_birth_names_dataset()

        argument = [birth_names_dataset.id]
        uri = f"api/v1/dataset/export/?q={prison.dumps(argument)}"

        self.login(username="admin")
        rv = self.get_assert_metric(uri, "export")
        self.assertEqual(rv.status_code, 200)
        self.assertEqual(
            rv.headers["Content-Disposition"],
            generate_download_headers("yaml")["Content-Disposition"],
        )

        cli_export = export_to_dict(
            recursive=True, back_references=False, include_defaults=False,
        )
        cli_export_tables = cli_export["databases"][0]["tables"]
        expected_response = []
        for export_table in cli_export_tables:
            if export_table["table_name"] == "birth_names":
                expected_response = export_table
                break
        ui_export = yaml.safe_load(rv.data.decode("utf-8"))
        self.assertEqual(ui_export[0], expected_response)

    def test_export_dataset_not_found(self):
        """
        Dataset API: Test export dataset not found
        """
        max_id = db.session.query(func.max(SqlaTable.id)).scalar()
        # Just one does not exist and we get 404
        argument = [max_id + 1, 1]
        uri = f"api/v1/dataset/export/?q={prison.dumps(argument)}"
        self.login(username="admin")
        rv = self.get_assert_metric(uri, "export")
        self.assertEqual(rv.status_code, 404)

    def test_export_dataset_gamma(self):
        """
        Dataset API: Test export dataset has gamma
        """
        birth_names_dataset = self.get_birth_names_dataset()

        argument = [birth_names_dataset.id]
        uri = f"api/v1/dataset/export/?q={prison.dumps(argument)}"

        self.login(username="gamma")
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 401)

    def test_get_dataset_related_objects(self):
        """
        Dataset API: Test get chart and dashboard count related to a dataset
        :return:
        """
        self.login(username="admin")
        table = self.get_birth_names_dataset()
        uri = f"api/v1/dataset/{table.id}/related_objects"
        rv = self.get_assert_metric(uri, "related_objects")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["charts"]["count"], 18)
        self.assertEqual(response["dashboards"]["count"], 2)

    def test_get_dataset_related_objects_not_found(self):
        """
        Dataset API: Test related objects not found
        """
        max_id = db.session.query(func.max(SqlaTable.id)).scalar()
        # id does not exist and we get 404
        invalid_id = max_id + 1
        uri = f"api/v1/dataset/{invalid_id}/related_objects/"
        self.login(username="admin")
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)
        self.logout()
        self.login(username="gamma")
        table = self.get_birth_names_dataset()
        uri = f"api/v1/dataset/{table.id}/related_objects"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)
