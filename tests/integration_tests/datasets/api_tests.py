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
# pylint: disable=too-many-public-methods, invalid-name
"""Unit tests for Superset"""
import json
import unittest
from io import BytesIO
from typing import List, Optional
from unittest.mock import patch
from zipfile import is_zipfile, ZipFile

import prison
import pytest
import yaml
from sqlalchemy.sql import func

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.dao.exceptions import (
    DAOCreateFailedError,
    DAODeleteFailedError,
    DAOUpdateFailedError,
)
from superset.extensions import db, security_manager
from superset.models.core import Database
from superset.utils.core import backend, get_example_database, get_main_database
from superset.utils.dict_import_export import export_to_dict
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import CTAS_SCHEMA_NAME
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
)
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_with_slice,
)
from tests.integration_tests.fixtures.importexport import (
    database_config,
    database_metadata_config,
    dataset_config,
    dataset_metadata_config,
    dataset_ui_export,
)


class TestDatasetApi(SupersetTestCase):

    fixture_tables_names = ("ab_permission", "ab_permission_view", "ab_view_menu")
    fixture_virtual_table_names = ("sql_virtual_dataset_1", "sql_virtual_dataset_2")

    @staticmethod
    def insert_dataset(
        table_name: str,
        schema: str,
        owners: List[int],
        database: Database,
        sql: Optional[str] = None,
    ) -> SqlaTable:
        obj_owners = list()
        for owner in owners:
            user = db.session.query(security_manager.user_model).get(owner)
            obj_owners.append(user)
        table = SqlaTable(
            table_name=table_name,
            schema=schema,
            owners=obj_owners,
            database=database,
            sql=sql,
        )
        db.session.add(table)
        db.session.commit()
        table.fetch_metadata()
        return table

    def insert_default_dataset(self):
        return self.insert_dataset(
            "ab_permission", "", [self.get_user("admin").id], get_main_database()
        )

    def get_fixture_datasets(self) -> List[SqlaTable]:
        return (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name.in_(self.fixture_tables_names))
            .all()
        )

    @pytest.fixture()
    def create_virtual_datasets(self):
        with self.create_app().app_context():
            datasets = []
            admin = self.get_user("admin")
            main_db = get_main_database()
            for table_name in self.fixture_virtual_table_names:
                datasets.append(
                    self.insert_dataset(
                        table_name,
                        "",
                        [admin.id],
                        main_db,
                        "SELECT * from ab_view_menu;",
                    )
                )
            yield datasets

            # rollback changes
            for dataset in datasets:
                db.session.delete(dataset)
            db.session.commit()

    @pytest.fixture()
    def create_datasets(self):
        with self.create_app().app_context():
            datasets = []
            admin = self.get_user("admin")
            main_db = get_main_database()
            for tables_name in self.fixture_tables_names:
                datasets.append(
                    self.insert_dataset(tables_name, "", [admin.id], main_db)
                )
            yield datasets

            # rollback changes
            for dataset in datasets:
                db.session.delete(dataset)
            db.session.commit()

    @staticmethod
    def get_energy_usage_dataset():
        example_db = get_example_database()
        return (
            db.session.query(SqlaTable)
            .filter_by(database=example_db, table_name="energy_usage")
            .one()
        )

    def create_dataset_import(self):
        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open("dataset_export/metadata.yaml", "w") as fp:
                fp.write(yaml.safe_dump(dataset_metadata_config).encode())
            with bundle.open(
                "dataset_export/databases/imported_database.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(database_config).encode())
            with bundle.open(
                "dataset_export/datasets/imported_dataset.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(dataset_config).encode())
        buf.seek(0)
        return buf

    def test_get_dataset_list(self):
        """
        Dataset API: Test get dataset list
        """
        example_db = get_example_database()
        self.login(username="admin")
        arguments = {
            "filters": [
                {"col": "database", "opr": "rel_o_m", "value": f"{example_db.id}"},
                {"col": "table_name", "opr": "eq", "value": "birth_names"},
            ]
        }
        uri = f"api/v1/dataset/?q={prison.dumps(arguments)}"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] == 1
        expected_columns = [
            "changed_by",
            "changed_by_name",
            "changed_by_url",
            "changed_on_delta_humanized",
            "changed_on_utc",
            "database",
            "default_endpoint",
            "explore_url",
            "extra",
            "id",
            "kind",
            "owners",
            "schema",
            "sql",
            "table_name",
        ]
        assert sorted(list(response["result"][0].keys())) == expected_columns

    def test_get_dataset_list_gamma(self):
        """
        Dataset API: Test get dataset list gamma
        """
        self.login(username="gamma")
        uri = "api/v1/dataset/"
        rv = self.get_assert_metric(uri, "get_list")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["result"] == []

    def test_get_dataset_related_database_gamma(self):
        """
        Dataset API: Test get dataset related databases gamma
        """
        self.login(username="gamma")
        uri = "api/v1/dataset/related/database"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] == 0
        assert response["result"] == []

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_get_dataset_item(self):
        """
        Dataset API: Test get dataset item
        """
        table = self.get_energy_usage_dataset()
        self.login(username="admin")
        uri = f"api/v1/dataset/{table.id}"
        rv = self.get_assert_metric(uri, "get")
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        expected_result = {
            "cache_timeout": None,
            "database": {"database_name": "examples", "id": 1},
            "default_endpoint": None,
            "description": "Energy consumption",
            "extra": None,
            "fetch_values_predicate": None,
            "filter_select_enabled": False,
            "is_sqllab_view": False,
            "main_dttm_col": None,
            "offset": 0,
            "owners": [],
            "schema": None,
            "sql": None,
            "table_name": "energy_usage",
            "template_params": None,
        }
        assert {
            k: v for k, v in response["result"].items() if k in expected_result
        } == expected_result
        assert len(response["result"]["columns"]) == 3
        assert len(response["result"]["metrics"]) == 2

    def test_get_dataset_distinct_schema(self):
        """
        Dataset API: Test get dataset distinct schema
        """

        def pg_test_query_parameter(query_parameter, expected_response):
            uri = f"api/v1/dataset/distinct/schema?q={prison.dumps(query_parameter)}"
            rv = self.client.get(uri)
            response = json.loads(rv.data.decode("utf-8"))
            assert rv.status_code == 200
            assert response == expected_response

        example_db = get_example_database()
        datasets = []
        if example_db.backend == "postgresql":
            datasets.append(
                self.insert_dataset("ab_permission", "public", [], get_main_database())
            )
            datasets.append(
                self.insert_dataset(
                    "columns", "information_schema", [], get_main_database()
                )
            )
            schema_values = [
                "admin_database",
                "information_schema",
                "public",
            ]
            expected_response = {
                "count": 3,
                "result": [{"text": val, "value": val} for val in schema_values],
            }
            self.login(username="admin")
            uri = "api/v1/dataset/distinct/schema"
            rv = self.client.get(uri)
            response = json.loads(rv.data.decode("utf-8"))
            assert rv.status_code == 200
            assert response == expected_response

            # Test filter
            query_parameter = {"filter": "inf"}
            pg_test_query_parameter(
                query_parameter,
                {
                    "count": 1,
                    "result": [
                        {"text": "information_schema", "value": "information_schema"}
                    ],
                },
            )

            query_parameter = {"page": 0, "page_size": 1}
            pg_test_query_parameter(
                query_parameter,
                {
                    "count": 3,
                    "result": [{"text": "admin_database", "value": "admin_database"}],
                },
            )

        for dataset in datasets:
            db.session.delete(dataset)
        db.session.commit()

    def test_get_dataset_distinct_not_allowed(self):
        """
        Dataset API: Test get dataset distinct not allowed
        """
        self.login(username="admin")
        uri = "api/v1/dataset/distinct/table_name"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    def test_get_dataset_distinct_gamma(self):
        """
        Dataset API: Test get dataset distinct with gamma
        """
        dataset = self.insert_default_dataset()

        self.login(username="gamma")
        uri = "api/v1/dataset/distinct/schema"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        response = json.loads(rv.data.decode("utf-8"))
        assert response["count"] == 0
        assert response["result"] == []

        db.session.delete(dataset)
        db.session.commit()

    def test_get_dataset_info(self):
        """
        Dataset API: Test get dataset info
        """
        self.login(username="admin")
        uri = "api/v1/dataset/_info"
        rv = self.get_assert_metric(uri, "info")
        assert rv.status_code == 200

    def test_info_security_dataset(self):
        """
        Dataset API: Test info security
        """
        self.login(username="admin")
        params = {"keys": ["permissions"]}
        uri = f"api/v1/dataset/_info?q={prison.dumps(params)}"
        rv = self.get_assert_metric(uri, "info")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert "can_read" in data["permissions"]
        assert "can_write" in data["permissions"]
        assert len(data["permissions"]) == 2

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
        assert rv.status_code == 201
        data = json.loads(rv.data.decode("utf-8"))
        table_id = data.get("id")
        model = db.session.query(SqlaTable).get(table_id)
        assert model.table_name == table_data["table_name"]
        assert model.database_id == table_data["database"]

        # Assert that columns were created
        columns = (
            db.session.query(TableColumn)
            .filter_by(table_id=table_id)
            .order_by("column_name")
            .all()
        )
        assert columns[0].column_name == "id"
        assert columns[1].column_name == "name"

        # Assert that metrics were created
        columns = (
            db.session.query(SqlMetric)
            .filter_by(table_id=table_id)
            .order_by("metric_name")
            .all()
        )
        assert columns[0].expression == "COUNT(*)"

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
        assert rv.status_code == 401

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
        assert rv.status_code == 201
        data = json.loads(rv.data.decode("utf-8"))
        model = db.session.query(SqlaTable).get(data.get("id"))
        assert admin in model.owners
        assert alpha in model.owners
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
        uri = "api/v1/dataset/"
        rv = self.post_assert_metric(uri, table_data, "post")
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        expected_result = {"message": {"owners": ["Owners are invalid"]}}
        assert data == expected_result

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    def test_create_dataset_validate_uniqueness(self):
        """
        Dataset API: Test create dataset validate table uniqueness
        """
        energy_usage_ds = self.get_energy_usage_dataset()
        self.login(username="admin")
        table_data = {
            "database": energy_usage_ds.database_id,
            "table_name": energy_usage_ds.table_name,
        }
        rv = self.post_assert_metric("/api/v1/dataset/", table_data, "post")
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {
            "message": {"table_name": ["Dataset energy_usage already exists"]}
        }

    def test_create_dataset_same_name_different_schema(self):
        if backend() == "sqlite":
            # sqlite doesn't support schemas
            return

        example_db = get_example_database()
        example_db.get_sqla_engine().execute(
            f"CREATE TABLE {CTAS_SCHEMA_NAME}.birth_names AS SELECT 2 as two"
        )

        self.login(username="admin")
        table_data = {
            "database": example_db.id,
            "schema": CTAS_SCHEMA_NAME,
            "table_name": "birth_names",
        }

        uri = "api/v1/dataset/"
        rv = self.post_assert_metric(uri, table_data, "post")
        assert rv.status_code == 201

        # cleanup
        data = json.loads(rv.data.decode("utf-8"))
        uri = f'api/v1/dataset/{data.get("id")}'
        rv = self.client.delete(uri)
        assert rv.status_code == 200
        example_db.get_sqla_engine().execute(
            f"DROP TABLE {CTAS_SCHEMA_NAME}.birth_names"
        )

    def test_create_dataset_validate_database(self):
        """
        Dataset API: Test create dataset validate database exists
        """
        self.login(username="admin")
        dataset_data = {"database": 1000, "schema": "", "table_name": "birth_names"}
        uri = "api/v1/dataset/"
        rv = self.post_assert_metric(uri, dataset_data, "post")
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        assert data == {"message": {"database": ["Database does not exist"]}}

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
        assert rv.status_code == 422

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
        assert rv.status_code == 422
        assert data == {"message": "Dataset could not be created."}

    def test_update_dataset_item(self):
        """
        Dataset API: Test update dataset item
        """
        dataset = self.insert_default_dataset()
        self.login(username="admin")
        dataset_data = {"description": "changed_description"}
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.put_assert_metric(uri, dataset_data, "put")
        assert rv.status_code == 200
        model = db.session.query(SqlaTable).get(dataset.id)
        assert model.description == dataset_data["description"]

        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_item_w_override_columns(self):
        """
        Dataset API: Test update dataset with override columns
        """
        # Add default dataset
        dataset = self.insert_default_dataset()
        self.login(username="admin")
        new_col_dict = {
            "column_name": "new_col",
            "description": "description",
            "expression": "expression",
            "type": "INTEGER",
            "verbose_name": "New Col",
        }
        dataset_data = {
            "columns": [new_col_dict],
            "description": "changed description",
        }
        uri = f"api/v1/dataset/{dataset.id}?override_columns=true"
        rv = self.put_assert_metric(uri, dataset_data, "put")
        assert rv.status_code == 200

        columns = db.session.query(TableColumn).filter_by(table_id=dataset.id).all()

        assert new_col_dict["column_name"] in [col.column_name for col in columns]
        assert new_col_dict["description"] in [col.description for col in columns]
        assert new_col_dict["expression"] in [col.expression for col in columns]
        assert new_col_dict["type"] in [col.type for col in columns]

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
            column.pop("type_generic", None)

        data["result"]["columns"].append(new_column_data)
        rv = self.client.put(uri, json={"columns": data["result"]["columns"]})

        assert rv.status_code == 200

        columns = (
            db.session.query(TableColumn)
            .filter_by(table_id=dataset.id)
            .order_by("column_name")
            .all()
        )
        assert columns[0].column_name == "id"
        assert columns[1].column_name == "name"
        assert columns[2].column_name == new_column_data["column_name"]
        assert columns[2].description == new_column_data["description"]
        assert columns[2].expression == new_column_data["expression"]
        assert columns[2].type == new_column_data["type"]
        assert columns[2].verbose_name == new_column_data["verbose_name"]

        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_delete_column(self):
        """
        Dataset API: Test update dataset delete column
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
            column.pop("type_generic", None)

        data["result"]["columns"].append(new_column_data)
        rv = self.client.put(uri, json={"columns": data["result"]["columns"]})

        assert rv.status_code == 200

        # Remove this new column
        data["result"]["columns"].remove(new_column_data)
        rv = self.client.put(uri, json={"columns": data["result"]["columns"]})
        assert rv.status_code == 200

        columns = (
            db.session.query(TableColumn)
            .filter_by(table_id=dataset.id)
            .order_by("column_name")
            .all()
        )
        assert columns[0].column_name == "id"
        assert columns[1].column_name == "name"
        assert len(columns) == 2

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
            column.pop("type_generic", None)

        resp_columns[0]["groupby"] = False
        resp_columns[0]["filterable"] = False
        rv = self.client.put(uri, json={"columns": resp_columns})
        assert rv.status_code == 200
        columns = (
            db.session.query(TableColumn)
            .filter_by(table_id=dataset.id)
            .order_by("column_name")
            .all()
        )
        assert columns[0].column_name == "id"
        assert columns[1].column_name, "name"
        # TODO(bkyryliuk): find the reason why update is failing for the presto database
        if get_example_database().backend != "presto":
            assert columns[0].groupby is False
            assert columns[0].filterable is False

        db.session.delete(dataset)
        db.session.commit()

    def test_update_dataset_delete_metric(self):
        """
        Dataset API: Test update dataset delete metric
        """
        dataset = self.insert_default_dataset()
        metrics_query = (
            db.session.query(SqlMetric)
            .filter_by(table_id=dataset.id)
            .order_by("metric_name")
        )

        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}"
        data = {
            "metrics": [
                {"metric_name": "metric1", "expression": "COUNT(*)"},
                {"metric_name": "metric2", "expression": "DIFF_COUNT(*)"},
            ]
        }
        rv = self.put_assert_metric(uri, data, "put")
        assert rv.status_code == 200

        metrics = metrics_query.all()
        assert len(metrics) == 2

        data = {
            "metrics": [
                {
                    "id": metrics[0].id,
                    "metric_name": "metric1",
                    "expression": "COUNT(*)",
                },
            ]
        }
        rv = self.put_assert_metric(uri, data, "put")
        assert rv.status_code == 200

        metrics = metrics_query.all()
        assert len(metrics) == 1

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
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        expected_result = {
            "message": {"columns": ["One or more columns already exist"]}
        }
        assert data == expected_result
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
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        expected_result = {
            "message": {"metrics": ["One or more metrics already exist"]}
        }
        assert data == expected_result
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
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        expected_result = {
            "message": {"columns": ["One or more columns are duplicated"]}
        }
        assert data == expected_result
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
        assert rv.status_code == 422
        data = json.loads(rv.data.decode("utf-8"))
        expected_result = {
            "message": {"metrics": ["One or more metrics are duplicated"]}
        }
        assert data == expected_result
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
        assert rv.status_code == 401
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
        assert rv.status_code == 403
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
        assert rv.status_code == 422
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
        assert rv.status_code == 422
        expected_response = {
            "message": {"table_name": ["Dataset ab_user already exists"]}
        }
        assert data == expected_response
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
        assert rv.status_code == 422
        assert data == {"message": "Dataset could not be updated."}

        db.session.delete(dataset)
        db.session.commit()

    def test_delete_dataset_item(self):
        """
        Dataset API: Test delete dataset item
        """
        dataset = self.insert_default_dataset()
        view_menu = security_manager.find_view_menu(dataset.get_perm())
        assert view_menu is not None
        view_menu_id = view_menu.id
        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 200
        non_view_menu = db.session.query(security_manager.viewmenu_model).get(
            view_menu_id
        )
        assert non_view_menu is None

    def test_delete_item_dataset_not_owned(self):
        """
        Dataset API: Test delete item not owned
        """
        dataset = self.insert_default_dataset()
        self.login(username="alpha")
        uri = f"api/v1/dataset/{dataset.id}"
        rv = self.delete_assert_metric(uri, "delete")
        assert rv.status_code == 403
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
        assert rv.status_code == 401
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
        assert rv.status_code == 422
        assert data == {"message": "Dataset could not be deleted."}
        db.session.delete(dataset)
        db.session.commit()

    @pytest.mark.usefixtures("create_datasets")
    def test_delete_dataset_column(self):
        """
        Dataset API: Test delete dataset column
        """
        dataset = self.get_fixture_datasets()[0]
        column_id = dataset.columns[0].id
        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}/column/{column_id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 200
        assert db.session.query(TableColumn).get(column_id) == None

    @pytest.mark.usefixtures("create_datasets")
    def test_delete_dataset_column_not_found(self):
        """
        Dataset API: Test delete dataset column not found
        """
        dataset = self.get_fixture_datasets()[0]
        non_id = self.get_nonexistent_numeric_id(TableColumn)

        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}/column/{non_id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 404

        non_id = self.get_nonexistent_numeric_id(SqlaTable)
        column_id = dataset.columns[0].id

        self.login(username="admin")
        uri = f"api/v1/dataset/{non_id}/column/{column_id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_datasets")
    def test_delete_dataset_column_not_owned(self):
        """
        Dataset API: Test delete dataset column not owned
        """
        dataset = self.get_fixture_datasets()[0]
        column_id = dataset.columns[0].id

        self.login(username="alpha")
        uri = f"api/v1/dataset/{dataset.id}/column/{column_id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 403

    @pytest.mark.usefixtures("create_datasets")
    @patch("superset.datasets.dao.DatasetDAO.delete")
    def test_delete_dataset_column_fail(self, mock_dao_delete):
        """
        Dataset API: Test delete dataset column
        """
        mock_dao_delete.side_effect = DAODeleteFailedError()
        dataset = self.get_fixture_datasets()[0]
        column_id = dataset.columns[0].id
        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}/column/{column_id}"
        rv = self.client.delete(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 422
        assert data == {"message": "Dataset column delete failed."}

    @pytest.mark.usefixtures("create_datasets")
    def test_delete_dataset_metric(self):
        """
        Dataset API: Test delete dataset metric
        """
        dataset = self.get_fixture_datasets()[0]
        test_metric = SqlMetric(
            metric_name="metric1", expression="COUNT(*)", table=dataset
        )
        db.session.add(test_metric)
        db.session.commit()

        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}/metric/{test_metric.id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 200
        assert db.session.query(SqlMetric).get(test_metric.id) == None

    @pytest.mark.usefixtures("create_datasets")
    def test_delete_dataset_metric_not_found(self):
        """
        Dataset API: Test delete dataset metric not found
        """
        dataset = self.get_fixture_datasets()[0]
        non_id = self.get_nonexistent_numeric_id(SqlMetric)

        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}/metric/{non_id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 404

        non_id = self.get_nonexistent_numeric_id(SqlaTable)
        metric_id = dataset.metrics[0].id

        self.login(username="admin")
        uri = f"api/v1/dataset/{non_id}/metric/{metric_id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_datasets")
    def test_delete_dataset_metric_not_owned(self):
        """
        Dataset API: Test delete dataset metric not owned
        """
        dataset = self.get_fixture_datasets()[0]
        metric_id = dataset.metrics[0].id

        self.login(username="alpha")
        uri = f"api/v1/dataset/{dataset.id}/metric/{metric_id}"
        rv = self.client.delete(uri)
        assert rv.status_code == 403

    @pytest.mark.usefixtures("create_datasets")
    @patch("superset.datasets.dao.DatasetDAO.delete")
    def test_delete_dataset_metric_fail(self, mock_dao_delete):
        """
        Dataset API: Test delete dataset metric
        """
        mock_dao_delete.side_effect = DAODeleteFailedError()
        dataset = self.get_fixture_datasets()[0]
        column_id = dataset.metrics[0].id
        self.login(username="admin")
        uri = f"api/v1/dataset/{dataset.id}/metric/{column_id}"
        rv = self.client.delete(uri)
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 422
        assert data == {"message": "Dataset metric delete failed."}

    @pytest.mark.usefixtures("create_datasets")
    def test_bulk_delete_dataset_items(self):
        """
        Dataset API: Test bulk delete dataset items
        """
        datasets = self.get_fixture_datasets()
        dataset_ids = [dataset.id for dataset in datasets]

        view_menu_names = []
        for dataset in datasets:
            view_menu_names.append(dataset.get_perm())

        self.login(username="admin")
        uri = f"api/v1/dataset/?q={prison.dumps(dataset_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        expected_response = {"message": f"Deleted {len(datasets)} datasets"}
        assert data == expected_response
        datasets = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name.in_(self.fixture_tables_names))
            .all()
        )
        assert datasets == []
        # Assert permissions get cleaned
        for view_menu_name in view_menu_names:
            assert security_manager.find_view_menu(view_menu_name) is None

    @pytest.mark.usefixtures("create_datasets")
    def test_bulk_delete_item_dataset_not_owned(self):
        """
        Dataset API: Test bulk delete item not owned
        """
        datasets = self.get_fixture_datasets()
        dataset_ids = [dataset.id for dataset in datasets]

        self.login(username="alpha")
        uri = f"api/v1/dataset/?q={prison.dumps(dataset_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 403

    @pytest.mark.usefixtures("create_datasets")
    def test_bulk_delete_item_not_found(self):
        """
        Dataset API: Test bulk delete item not found
        """
        datasets = self.get_fixture_datasets()
        dataset_ids = [dataset.id for dataset in datasets]
        dataset_ids.append(db.session.query(func.max(SqlaTable.id)).scalar())

        self.login(username="admin")
        uri = f"api/v1/dataset/?q={prison.dumps(dataset_ids)}"
        rv = self.delete_assert_metric(uri, "bulk_delete")
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_datasets")
    def test_bulk_delete_dataset_item_not_authorized(self):
        """
        Dataset API: Test bulk delete item not authorized
        """
        datasets = self.get_fixture_datasets()
        dataset_ids = [dataset.id for dataset in datasets]

        self.login(username="gamma")
        uri = f"api/v1/dataset/?q={prison.dumps(dataset_ids)}"
        rv = self.client.delete(uri)
        assert rv.status_code == 401

    @pytest.mark.usefixtures("create_datasets")
    def test_bulk_delete_dataset_item_incorrect(self):
        """
        Dataset API: Test bulk delete item incorrect request
        """
        datasets = self.get_fixture_datasets()
        dataset_ids = [dataset.id for dataset in datasets]
        dataset_ids.append("Wrong")

        self.login(username="admin")
        uri = f"api/v1/dataset/?q={prison.dumps(dataset_ids)}"
        rv = self.client.delete(uri)
        assert rv.status_code == 400

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
        assert rv.status_code == 200
        # Assert the column is restored on refresh
        id_column = (
            db.session.query(TableColumn)
            .filter_by(table_id=dataset.id, column_name="id")
            .one()
        )
        assert id_column is not None
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
        assert rv.status_code == 404

    def test_dataset_item_refresh_not_owned(self):
        """
        Dataset API: Test item refresh not owned dataset
        """
        dataset = self.insert_default_dataset()
        self.login(username="alpha")
        uri = f"api/v1/dataset/{dataset.id}/refresh"
        rv = self.put_assert_metric(uri, {}, "refresh")
        assert rv.status_code == 403

        db.session.delete(dataset)
        db.session.commit()

    @unittest.skip("test is failing stochastically")
    def test_export_dataset(self):
        """
        Dataset API: Test export dataset
        """
        birth_names_dataset = self.get_birth_names_dataset()
        # TODO: fix test for presto
        # debug with dump: https://github.com/apache/superset/runs/1092546855
        if birth_names_dataset.database.backend in {"presto", "hive"}:
            return

        argument = [birth_names_dataset.id]
        uri = f"api/v1/dataset/export/?q={prison.dumps(argument)}"

        self.login(username="admin")
        rv = self.get_assert_metric(uri, "export")
        assert rv.status_code == 200

        cli_export = export_to_dict(
            session=db.session,
            recursive=True,
            back_references=False,
            include_defaults=False,
        )
        cli_export_tables = cli_export["databases"][0]["tables"]
        expected_response = {}
        for export_table in cli_export_tables:
            if export_table["table_name"] == "birth_names":
                expected_response = export_table
                break
        ui_export = yaml.safe_load(rv.data.decode("utf-8"))
        assert ui_export[0] == expected_response

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
        assert rv.status_code == 404

    def test_export_dataset_gamma(self):
        """
        Dataset API: Test export dataset has gamma
        """
        birth_names_dataset = self.get_birth_names_dataset()

        argument = [birth_names_dataset.id]
        uri = f"api/v1/dataset/export/?q={prison.dumps(argument)}"

        self.login(username="gamma")
        rv = self.client.get(uri)
        assert rv.status_code == 404

    @patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"VERSIONED_EXPORT": True},
        clear=True,
    )
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_export_dataset_bundle(self):
        """
        Dataset API: Test export dataset
        """
        birth_names_dataset = self.get_birth_names_dataset()
        # TODO: fix test for presto
        # debug with dump: https://github.com/apache/superset/runs/1092546855
        if birth_names_dataset.database.backend in {"presto", "hive"}:
            return

        argument = [birth_names_dataset.id]
        uri = f"api/v1/dataset/export/?q={prison.dumps(argument)}"

        self.login(username="admin")
        rv = self.get_assert_metric(uri, "export")

        assert rv.status_code == 200

        buf = BytesIO(rv.data)
        assert is_zipfile(buf)

    @patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"VERSIONED_EXPORT": True},
        clear=True,
    )
    def test_export_dataset_bundle_not_found(self):
        """
        Dataset API: Test export dataset not found
        """
        # Just one does not exist and we get 404
        argument = [-1, 1]
        uri = f"api/v1/dataset/export/?q={prison.dumps(argument)}"
        self.login(username="admin")
        rv = self.get_assert_metric(uri, "export")

        assert rv.status_code == 404

    @patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"VERSIONED_EXPORT": True},
        clear=True,
    )
    def test_export_dataset_bundle_gamma(self):
        """
        Dataset API: Test export dataset has gamma
        """
        birth_names_dataset = self.get_birth_names_dataset()

        argument = [birth_names_dataset.id]
        uri = f"api/v1/dataset/export/?q={prison.dumps(argument)}"

        self.login(username="gamma")
        rv = self.client.get(uri)
        # gamma users by default do not have access to this dataset
        assert rv.status_code == 404

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_dataset_related_objects(self):
        """
        Dataset API: Test get chart and dashboard count related to a dataset
        :return:
        """
        self.login(username="admin")
        table = self.get_birth_names_dataset()
        uri = f"api/v1/dataset/{table.id}/related_objects"
        rv = self.get_assert_metric(uri, "related_objects")
        response = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert response["charts"]["count"] == 18
        assert response["dashboards"]["count"] == 1

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
        assert rv.status_code == 404
        self.logout()
        self.login(username="gamma")
        table = self.get_birth_names_dataset()
        uri = f"api/v1/dataset/{table.id}/related_objects"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    @pytest.mark.usefixtures("create_datasets", "create_virtual_datasets")
    def test_get_datasets_custom_filter_sql(self):
        """
        Dataset API: Test custom dataset_is_null_or_empty filter for sql
        """
        arguments = {
            "filters": [
                {"col": "sql", "opr": "dataset_is_null_or_empty", "value": False}
            ]
        }
        self.login(username="admin")
        uri = f"api/v1/dataset/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)

        assert rv.status_code == 200

        data = json.loads(rv.data.decode("utf-8"))
        for table_name in self.fixture_virtual_table_names:
            assert table_name in [ds["table_name"] for ds in data["result"]]

        arguments = {
            "filters": [
                {"col": "sql", "opr": "dataset_is_null_or_empty", "value": True}
            ]
        }
        self.login(username="admin")
        uri = f"api/v1/dataset/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        assert rv.status_code == 200

        data = json.loads(rv.data.decode("utf-8"))
        for table_name in self.fixture_tables_names:
            assert table_name in [ds["table_name"] for ds in data["result"]]

    def test_import_dataset(self):
        """
        Dataset API: Test import dataset
        """
        self.login(username="admin")
        uri = "api/v1/dataset/import/"

        buf = self.create_dataset_import()
        form_data = {
            "formData": (buf, "dataset_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert database.database_name == "imported_database"

        assert len(database.tables) == 1
        dataset = database.tables[0]
        assert dataset.table_name == "imported_dataset"
        assert str(dataset.uuid) == dataset_config["uuid"]

        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_dataset_v0_export(self):
        num_datasets = db.session.query(SqlaTable).count()

        self.login(username="admin")
        uri = "api/v1/dataset/import/"

        buf = BytesIO()
        buf.write(json.dumps(dataset_ui_export).encode())
        buf.seek(0)
        form_data = {
            "formData": (buf, "dataset_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}
        assert db.session.query(SqlaTable).count() == num_datasets + 1

        dataset = (
            db.session.query(SqlaTable).filter_by(table_name="birth_names_2").one()
        )
        db.session.delete(dataset)
        db.session.commit()

    def test_import_dataset_overwrite(self):
        """
        Dataset API: Test import existing dataset
        """
        self.login(username="admin")
        uri = "api/v1/dataset/import/"

        buf = self.create_dataset_import()
        form_data = {
            "formData": (buf, "dataset_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

        # import again without overwrite flag
        buf = self.create_dataset_import()
        form_data = {
            "formData": (buf, "dataset_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "Error importing dataset",
                    "error_type": "GENERIC_COMMAND_ERROR",
                    "level": "warning",
                    "extra": {
                        "datasets/imported_dataset.yaml": "Dataset already exists and `overwrite=true` was not passed",
                        "issue_codes": [
                            {
                                "code": 1010,
                                "message": "Issue 1010 - Superset encountered an error while running a command.",
                            }
                        ],
                    },
                }
            ]
        }

        # import with overwrite flag
        buf = self.create_dataset_import()
        form_data = {
            "formData": (buf, "dataset_export.zip"),
            "overwrite": "true",
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

        # clean up
        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        dataset = database.tables[0]

        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_dataset_invalid(self):
        """
        Dataset API: Test import invalid dataset
        """
        self.login(username="admin")
        uri = "api/v1/dataset/import/"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open("dataset_export/metadata.yaml", "w") as fp:
                fp.write(yaml.safe_dump(database_metadata_config).encode())
            with bundle.open(
                "dataset_export/databases/imported_database.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(database_config).encode())
            with bundle.open(
                "dataset_export/datasets/imported_dataset.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(dataset_config).encode())
        buf.seek(0)

        form_data = {
            "formData": (buf, "dataset_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "Error importing dataset",
                    "error_type": "GENERIC_COMMAND_ERROR",
                    "level": "warning",
                    "extra": {
                        "metadata.yaml": {"type": ["Must be equal to SqlaTable."]},
                        "issue_codes": [
                            {
                                "code": 1010,
                                "message": (
                                    "Issue 1010 - Superset encountered "
                                    "an error while running a command."
                                ),
                            }
                        ],
                    },
                }
            ]
        }

    def test_import_dataset_invalid_v0_validation(self):
        """
        Dataset API: Test import invalid dataset
        """
        self.login(username="admin")
        uri = "api/v1/dataset/import/"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open(
                "dataset_export/databases/imported_database.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(database_config).encode())
            with bundle.open(
                "dataset_export/datasets/imported_dataset.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(dataset_config).encode())
        buf.seek(0)

        form_data = {
            "formData": (buf, "dataset_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "Could not find a valid command to import file",
                    "error_type": "GENERIC_COMMAND_ERROR",
                    "level": "warning",
                    "extra": {
                        "issue_codes": [
                            {
                                "code": 1010,
                                "message": "Issue 1010 - Superset encountered an error while running a command.",
                            }
                        ]
                    },
                }
            ]
        }
