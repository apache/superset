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
import dataclasses
import json
from collections import defaultdict
from io import BytesIO
from unittest import mock
from zipfile import is_zipfile, ZipFile
from operator import itemgetter

import prison
import pytest
import yaml

from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import DBAPIError
from sqlalchemy.sql import func

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.db_engine_specs.mysql import MySQLEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.db_engine_specs.redshift import RedshiftEngineSpec
from superset.db_engine_specs.bigquery import BigQueryEngineSpec
from superset.db_engine_specs.gsheets import GSheetsEngineSpec
from superset.db_engine_specs.hana import HanaEngineSpec
from superset.errors import SupersetError
from superset.models.core import Database, ConfigurationMethod
from superset.models.reports import ReportSchedule, ReportScheduleType
from superset.utils.core import get_example_database, get_main_database
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
)
from tests.integration_tests.fixtures.certificates import ssl_certificate
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_with_slice,
)
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
)
from tests.integration_tests.fixtures.importexport import (
    database_config,
    dataset_config,
    database_metadata_config,
    dataset_metadata_config,
)
from tests.integration_tests.fixtures.unicode_dashboard import (
    load_unicode_dashboard_with_position,
)
from tests.integration_tests.test_app import app


class TestDatabaseApi(SupersetTestCase):
    def insert_database(
        self,
        database_name: str,
        sqlalchemy_uri: str,
        extra: str = "",
        encrypted_extra: str = "",
        server_cert: str = "",
        expose_in_sqllab: bool = False,
    ) -> Database:
        database = Database(
            database_name=database_name,
            sqlalchemy_uri=sqlalchemy_uri,
            extra=extra,
            encrypted_extra=encrypted_extra,
            server_cert=server_cert,
            expose_in_sqllab=expose_in_sqllab,
        )
        db.session.add(database)
        db.session.commit()
        return database

    @pytest.fixture()
    def create_database_with_report(self):
        with self.create_app().app_context():
            example_db = get_example_database()
            database = self.insert_database(
                "database_with_report",
                example_db.sqlalchemy_uri_decrypted,
                expose_in_sqllab=True,
            )
            report_schedule = ReportSchedule(
                type=ReportScheduleType.ALERT,
                name="report_with_database",
                crontab="* * * * *",
                database=database,
            )
            db.session.add(report_schedule)
            db.session.commit()
            yield database

            # rollback changes
            db.session.delete(report_schedule)
            db.session.delete(database)
            db.session.commit()

    @pytest.fixture()
    def create_database_with_dataset(self):
        with self.create_app().app_context():
            example_db = get_example_database()
            self._database = self.insert_database(
                "database_with_dataset",
                example_db.sqlalchemy_uri_decrypted,
                expose_in_sqllab=True,
            )
            table = SqlaTable(
                schema="main", table_name="ab_permission", database=self._database
            )
            db.session.add(table)
            db.session.commit()
            yield self._database

            # rollback changes
            db.session.delete(table)
            db.session.delete(self._database)
            db.session.commit()
            self._database = None

    def create_database_import(self):
        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open("database_export/metadata.yaml", "w") as fp:
                fp.write(yaml.safe_dump(database_metadata_config).encode())
            with bundle.open(
                "database_export/databases/imported_database.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(database_config).encode())
            with bundle.open(
                "database_export/datasets/imported_dataset.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(dataset_config).encode())
        buf.seek(0)
        return buf

    def test_get_items(self):
        """
        Database API: Test get items
        """
        self.login(username="admin")
        uri = "api/v1/database/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        expected_columns = [
            "allow_csv_upload",
            "allow_ctas",
            "allow_cvas",
            "allow_dml",
            "allow_multi_schema_metadata_fetch",
            "allow_run_async",
            "allows_cost_estimate",
            "allows_subquery",
            "allows_virtual_table_explore",
            "backend",
            "changed_on",
            "changed_on_delta_humanized",
            "created_by",
            "database_name",
            "explore_database_id",
            "expose_in_sqllab",
            "extra",
            "force_ctas_schema",
            "id",
        ]
        self.assertGreater(response["count"], 0)
        self.assertEqual(list(response["result"][0].keys()), expected_columns)

    def test_get_items_filter(self):
        """
        Database API: Test get items with filter
        """
        example_db = get_example_database()
        test_database = self.insert_database(
            "test-database", example_db.sqlalchemy_uri_decrypted, expose_in_sqllab=True
        )
        dbs = db.session.query(Database).filter_by(expose_in_sqllab=True).all()

        self.login(username="admin")
        arguments = {
            "keys": ["none"],
            "filters": [{"col": "expose_in_sqllab", "opr": "eq", "value": True}],
            "order_columns": "database_name",
            "order_direction": "asc",
            "page": 0,
            "page_size": -1,
        }
        uri = f"api/v1/database/?q={prison.dumps(arguments)}"
        rv = self.client.get(uri)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 200)
        self.assertEqual(response["count"], len(dbs))

        # Cleanup
        db.session.delete(test_database)
        db.session.commit()

    def test_get_items_not_allowed(self):
        """
        Database API: Test get items not allowed
        """
        self.login(username="gamma")
        uri = "api/v1/database/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["count"], 0)

    def test_create_database(self):
        """
        Database API: Test create
        """
        extra = {
            "metadata_params": {},
            "engine_params": {},
            "metadata_cache_timeout": {},
            "schemas_allowed_for_csv_upload": [],
        }

        self.login(username="admin")
        example_db = get_example_database()
        if example_db.backend == "sqlite":
            return
        database_data = {
            "database_name": "test-create-database",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
            "server_cert": None,
            "extra": json.dumps(extra),
        }

        uri = "api/v1/database/"
        rv = self.client.post(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 201)
        # Cleanup
        model = db.session.query(Database).get(response.get("id"))
        assert model.configuration_method == ConfigurationMethod.SQLALCHEMY_FORM
        db.session.delete(model)
        db.session.commit()

    def test_create_database_invalid_configuration_method(self):
        """
        Database API: Test create with an invalid configuration method.
        """
        extra = {
            "metadata_params": {},
            "engine_params": {},
            "metadata_cache_timeout": {},
            "schemas_allowed_for_csv_upload": [],
        }

        self.login(username="admin")
        example_db = get_example_database()
        if example_db.backend == "sqlite":
            return
        database_data = {
            "database_name": "test-create-database",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
            "configuration_method": "BAD_FORM",
            "server_cert": None,
            "extra": json.dumps(extra),
        }

        uri = "api/v1/database/"
        rv = self.client.post(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        assert response == {
            "message": {"configuration_method": ["Invalid enum value BAD_FORM"]}
        }
        assert rv.status_code == 400

    def test_create_database_no_configuration_method(self):
        """
        Database API: Test create with no config method.
        """
        extra = {
            "metadata_params": {},
            "engine_params": {},
            "metadata_cache_timeout": {},
            "schemas_allowed_for_csv_upload": [],
        }

        self.login(username="admin")
        example_db = get_example_database()
        if example_db.backend == "sqlite":
            return
        database_data = {
            "database_name": "test-create-database",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
            "server_cert": None,
            "extra": json.dumps(extra),
        }

        uri = "api/v1/database/"
        rv = self.client.post(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 201
        self.assertIn("sqlalchemy_form", response["result"]["configuration_method"])

    def test_create_database_server_cert_validate(self):
        """
        Database API: Test create server cert validation
        """
        example_db = get_example_database()
        if example_db.backend == "sqlite":
            return

        self.login(username="admin")
        database_data = {
            "database_name": "test-create-database-invalid-cert",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
            "server_cert": "INVALID CERT",
        }

        uri = "api/v1/database/"
        rv = self.client.post(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"message": {"server_cert": ["Invalid certificate"]}}
        self.assertEqual(rv.status_code, 400)
        self.assertEqual(response, expected_response)

    def test_create_database_json_validate(self):
        """
        Database API: Test create encrypted extra and extra validation
        """
        example_db = get_example_database()
        if example_db.backend == "sqlite":
            return

        self.login(username="admin")
        database_data = {
            "database_name": "test-create-database-invalid-json",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
            "encrypted_extra": '{"A": "a", "B", "C"}',
            "extra": '["A": "a", "B", "C"]',
        }

        uri = "api/v1/database/"
        rv = self.client.post(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": {
                "encrypted_extra": [
                    "Field cannot be decoded by JSON. Expecting ':' "
                    "delimiter: line 1 column 15 (char 14)"
                ],
                "extra": [
                    "Field cannot be decoded by JSON. Expecting ','"
                    " delimiter: line 1 column 5 (char 4)"
                ],
            }
        }
        self.assertEqual(rv.status_code, 400)
        self.assertEqual(response, expected_response)

    def test_create_database_extra_metadata_validate(self):
        """
        Database API: Test create extra metadata_params validation
        """
        example_db = get_example_database()
        if example_db.backend == "sqlite":
            return

        extra = {
            "metadata_params": {"wrong_param": "some_value"},
            "engine_params": {},
            "metadata_cache_timeout": {},
            "schemas_allowed_for_csv_upload": [],
        }
        self.login(username="admin")
        database_data = {
            "database_name": "test-create-database-invalid-extra",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
            "extra": json.dumps(extra),
        }

        uri = "api/v1/database/"
        rv = self.client.post(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": {
                "extra": [
                    "The metadata_params in Extra field is not configured correctly."
                    " The key wrong_param is invalid."
                ]
            }
        }
        self.assertEqual(rv.status_code, 400)
        self.assertEqual(response, expected_response)

    def test_create_database_unique_validate(self):
        """
        Database API: Test create database_name already exists
        """
        example_db = get_example_database()
        if example_db.backend == "sqlite":
            return

        self.login(username="admin")
        database_data = {
            "database_name": "examples",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
        }

        uri = "api/v1/database/"
        rv = self.client.post(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": {
                "database_name": "A database with the same name already exists."
            }
        }
        self.assertEqual(rv.status_code, 422)
        self.assertEqual(response, expected_response)

    def test_create_database_uri_validate(self):
        """
        Database API: Test create fail validate sqlalchemy uri
        """
        self.login(username="admin")
        database_data = {
            "database_name": "test-database-invalid-uri",
            "sqlalchemy_uri": "wrong_uri",
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
        }

        uri = "api/v1/database/"
        rv = self.client.post(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 400)
        self.assertIn(
            "Invalid connection string", response["message"]["sqlalchemy_uri"][0],
        )

    @mock.patch(
        "superset.views.core.app.config",
        {**app.config, "PREVENT_UNSAFE_DB_CONNECTIONS": True},
    )
    def test_create_database_fail_sqllite(self):
        """
        Database API: Test create fail with sqllite
        """
        database_data = {
            "database_name": "test-create-sqlite-database",
            "sqlalchemy_uri": "sqlite:////some.db",
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
        }

        uri = "api/v1/database/"
        self.login(username="admin")
        response = self.client.post(uri, json=database_data)
        response_data = json.loads(response.data.decode("utf-8"))
        expected_response = {
            "message": {
                "sqlalchemy_uri": [
                    "SQLiteDialect_pysqlite cannot be used as a data source "
                    "for security reasons."
                ]
            }
        }
        self.assertEqual(response_data, expected_response)
        self.assertEqual(response.status_code, 400)

    def test_create_database_conn_fail(self):
        """
        Database API: Test create fails connection
        """
        example_db = get_example_database()
        if example_db.backend in ("sqlite", "hive", "presto"):
            return
        example_db.password = "wrong_password"
        database_data = {
            "database_name": "test-create-database-wrong-password",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
        }

        uri = "api/v1/database/"
        self.login(username="admin")
        response = self.client.post(uri, json=database_data)
        response_data = json.loads(response.data.decode("utf-8"))
        expected_response = {
            "message": "Connection failed, please check your connection settings"
        }
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response_data, expected_response)

    def test_update_database(self):
        """
        Database API: Test update
        """
        example_db = get_example_database()
        test_database = self.insert_database(
            "test-database", example_db.sqlalchemy_uri_decrypted
        )
        self.login(username="admin")
        database_data = {
            "database_name": "test-database-updated",
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
        }
        uri = f"api/v1/database/{test_database.id}"
        rv = self.client.put(uri, json=database_data)
        self.assertEqual(rv.status_code, 200)
        # Cleanup
        model = db.session.query(Database).get(test_database.id)
        db.session.delete(model)
        db.session.commit()

    def test_update_database_conn_fail(self):
        """
        Database API: Test update fails connection
        """
        example_db = get_example_database()
        if example_db.backend in ("sqlite", "hive", "presto"):
            return

        test_database = self.insert_database(
            "test-database1", example_db.sqlalchemy_uri_decrypted
        )
        example_db.password = "wrong_password"
        database_data = {
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
        }

        uri = f"api/v1/database/{test_database.id}"
        self.login(username="admin")
        rv = self.client.put(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": "Connection failed, please check your connection settings"
        }
        self.assertEqual(rv.status_code, 422)
        self.assertEqual(response, expected_response)
        # Cleanup
        model = db.session.query(Database).get(test_database.id)
        db.session.delete(model)
        db.session.commit()

    def test_update_database_uniqueness(self):
        """
        Database API: Test update uniqueness
        """
        example_db = get_example_database()
        test_database1 = self.insert_database(
            "test-database1", example_db.sqlalchemy_uri_decrypted
        )
        test_database2 = self.insert_database(
            "test-database2", example_db.sqlalchemy_uri_decrypted
        )

        self.login(username="admin")
        database_data = {"database_name": "test-database2"}
        uri = f"api/v1/database/{test_database1.id}"
        rv = self.client.put(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": {
                "database_name": "A database with the same name already exists."
            }
        }
        self.assertEqual(rv.status_code, 422)
        self.assertEqual(response, expected_response)
        # Cleanup
        db.session.delete(test_database1)
        db.session.delete(test_database2)
        db.session.commit()

    def test_update_database_invalid(self):
        """
        Database API: Test update invalid request
        """
        self.login(username="admin")
        database_data = {"database_name": "test-database-updated"}
        uri = "api/v1/database/invalid"
        rv = self.client.put(uri, json=database_data)
        self.assertEqual(rv.status_code, 404)

    def test_update_database_uri_validate(self):
        """
        Database API: Test update sqlalchemy_uri validate
        """
        example_db = get_example_database()
        test_database = self.insert_database(
            "test-database", example_db.sqlalchemy_uri_decrypted
        )

        self.login(username="admin")
        database_data = {
            "database_name": "test-database-updated",
            "sqlalchemy_uri": "wrong_uri",
        }
        uri = f"api/v1/database/{test_database.id}"
        rv = self.client.put(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 400)
        self.assertIn(
            "Invalid connection string", response["message"]["sqlalchemy_uri"][0],
        )

        db.session.delete(test_database)
        db.session.commit()

    def test_update_database_with_invalid_configuration_method(self):
        """
        Database API: Test update
        """
        example_db = get_example_database()
        test_database = self.insert_database(
            "test-database", example_db.sqlalchemy_uri_decrypted
        )
        self.login(username="admin")
        database_data = {
            "database_name": "test-database-updated",
            "configuration_method": "BAD_FORM",
        }
        uri = f"api/v1/database/{test_database.id}"
        rv = self.client.put(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        assert response == {
            "message": {"configuration_method": ["Invalid enum value BAD_FORM"]}
        }
        assert rv.status_code == 400

        db.session.delete(test_database)
        db.session.commit()

    def test_update_database_with_no_configuration_method(self):
        """
        Database API: Test update
        """
        example_db = get_example_database()
        test_database = self.insert_database(
            "test-database", example_db.sqlalchemy_uri_decrypted
        )
        self.login(username="admin")
        database_data = {
            "database_name": "test-database-updated",
        }
        uri = f"api/v1/database/{test_database.id}"
        rv = self.client.put(uri, json=database_data)
        assert rv.status_code == 200

        db.session.delete(test_database)
        db.session.commit()

    def test_delete_database(self):
        """
        Database API: Test delete
        """
        database_id = self.insert_database("test-database", "test_uri").id
        self.login(username="admin")
        uri = f"api/v1/database/{database_id}"
        rv = self.delete_assert_metric(uri, "delete")
        self.assertEqual(rv.status_code, 200)
        model = db.session.query(Database).get(database_id)
        self.assertEqual(model, None)

    def test_delete_database_not_found(self):
        """
        Database API: Test delete not found
        """
        max_id = db.session.query(func.max(Database.id)).scalar()
        self.login(username="admin")
        uri = f"api/v1/database/{max_id + 1}"
        rv = self.delete_assert_metric(uri, "delete")
        self.assertEqual(rv.status_code, 404)

    @pytest.mark.usefixtures("create_database_with_dataset")
    def test_delete_database_with_datasets(self):
        """
        Database API: Test delete fails because it has depending datasets
        """
        self.login(username="admin")
        uri = f"api/v1/database/{self._database.id}"
        rv = self.delete_assert_metric(uri, "delete")
        self.assertEqual(rv.status_code, 422)

    @pytest.mark.usefixtures("create_database_with_report")
    def test_delete_database_with_report(self):
        """
        Database API: Test delete with associated report
        """
        self.login(username="admin")
        database = (
            db.session.query(Database)
            .filter(Database.database_name == "database_with_report")
            .one_or_none()
        )
        uri = f"api/v1/database/{database.id}"
        rv = self.client.delete(uri)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 422)
        expected_response = {
            "message": "There are associated alerts or reports: report_with_database"
        }
        self.assertEqual(response, expected_response)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_table_metadata(self):
        """
        Database API: Test get table metadata info
        """
        example_db = get_example_database()
        self.login(username="admin")
        uri = f"api/v1/database/{example_db.id}/table/birth_names/null/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["name"], "birth_names")
        self.assertIsNone(response["comment"])
        self.assertTrue(len(response["columns"]) > 5)
        self.assertTrue(response.get("selectStar").startswith("SELECT"))

    def test_info_security_database(self):
        """
        Database API: Test info security
        """
        self.login(username="admin")
        params = {"keys": ["permissions"]}
        uri = f"api/v1/database/_info?q={prison.dumps(params)}"
        rv = self.get_assert_metric(uri, "info")
        data = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert "can_read" in data["permissions"]
        assert "can_write" in data["permissions"]
        assert len(data["permissions"]) == 2

    def test_get_invalid_database_table_metadata(self):
        """
        Database API: Test get invalid database from table metadata
        """
        database_id = 1000
        self.login(username="admin")
        uri = f"api/v1/database/{database_id}/table/some_table/some_schema/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

        uri = "api/v1/database/some_database/table/some_table/some_schema/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_get_invalid_table_table_metadata(self):
        """
        Database API: Test get invalid table from table metadata
        """
        example_db = get_example_database()
        uri = f"api/v1/database/{example_db.id}/wrong_table/null/"
        self.login(username="admin")
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_get_table_metadata_no_db_permission(self):
        """
        Database API: Test get table metadata from not permitted db
        """
        self.login(username="gamma")
        example_db = get_example_database()
        uri = f"api/v1/database/{example_db.id}/birth_names/null/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_get_select_star(self):
        """
        Database API: Test get select star
        """
        self.login(username="admin")
        example_db = get_example_database()
        uri = f"api/v1/database/{example_db.id}/select_star/birth_names/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertIn("gender", response["result"])

    def test_get_select_star_not_allowed(self):
        """
        Database API: Test get select star not allowed
        """
        self.login(username="gamma")
        example_db = get_example_database()
        uri = f"api/v1/database/{example_db.id}/select_star/birth_names/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_get_select_star_datasource_access(self):
        """
        Database API: Test get select star with datasource access
        """
        session = db.session
        table = SqlaTable(
            schema="main", table_name="ab_permission", database=get_main_database()
        )
        session.add(table)
        session.commit()

        tmp_table_perm = security_manager.find_permission_view_menu(
            "datasource_access", table.get_perm()
        )
        gamma_role = security_manager.find_role("Gamma")
        security_manager.add_permission_role(gamma_role, tmp_table_perm)

        self.login(username="gamma")
        main_db = get_main_database()
        uri = f"api/v1/database/{main_db.id}/select_star/ab_permission/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 200)

        # rollback changes
        security_manager.del_permission_role(gamma_role, tmp_table_perm)
        db.session.delete(table)
        db.session.delete(main_db)
        db.session.commit()

    def test_get_select_star_not_found_database(self):
        """
        Database API: Test get select star not found database
        """
        self.login(username="admin")
        max_id = db.session.query(func.max(Database.id)).scalar()
        uri = f"api/v1/database/{max_id + 1}/select_star/birth_names/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_get_select_star_not_found_table(self):
        """
        Database API: Test get select star not found database
        """
        self.login(username="admin")
        example_db = get_example_database()
        # sqllite will not raise a NoSuchTableError
        if example_db.backend == "sqlite":
            return
        uri = f"api/v1/database/{example_db.id}/select_star/table_does_not_exist/"
        rv = self.client.get(uri)
        # TODO(bkyryliuk): investigate why presto returns 500
        self.assertEqual(rv.status_code, 404 if example_db.backend != "presto" else 500)

    def test_database_schemas(self):
        """
        Database API: Test database schemas
        """
        self.login(username="admin")
        database = db.session.query(Database).filter_by(database_name="examples").one()
        schemas = database.get_all_schema_names()

        rv = self.client.get(f"api/v1/database/{database.id}/schemas/")
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(schemas, response["result"])

        rv = self.client.get(
            f"api/v1/database/{database.id}/schemas/?q={prison.dumps({'force': True})}"
        )
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(schemas, response["result"])

    def test_database_schemas_not_found(self):
        """
        Database API: Test database schemas not found
        """
        self.logout()
        self.login(username="gamma")
        example_db = get_example_database()
        uri = f"api/v1/database/{example_db.id}/schemas/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

    def test_database_schemas_invalid_query(self):
        """
        Database API: Test database schemas with invalid query
        """
        self.login("admin")
        database = db.session.query(Database).first()
        rv = self.client.get(
            f"api/v1/database/{database.id}/schemas/?q={prison.dumps({'force': 'nop'})}"
        )
        self.assertEqual(rv.status_code, 400)

    def test_test_connection(self):
        """
        Database API: Test test connection
        """
        extra = {
            "metadata_params": {},
            "engine_params": {},
            "metadata_cache_timeout": {},
            "schemas_allowed_for_csv_upload": [],
        }
        # need to temporarily allow sqlite dbs, teardown will undo this
        app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] = False
        self.login("admin")
        example_db = get_example_database()
        # validate that the endpoint works with the password-masked sqlalchemy uri
        data = {
            "database_name": "examples",
            "encrypted_extra": "{}",
            "extra": json.dumps(extra),
            "impersonate_user": False,
            "sqlalchemy_uri": example_db.safe_sqlalchemy_uri(),
            "server_cert": None,
        }
        url = "api/v1/database/test_connection"
        rv = self.post_assert_metric(url, data, "test_connection")
        self.assertEqual(rv.status_code, 200)
        self.assertEqual(rv.headers["Content-Type"], "application/json; charset=utf-8")

        # validate that the endpoint works with the decrypted sqlalchemy uri
        data = {
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
            "database_name": "examples",
            "impersonate_user": False,
            "extra": json.dumps(extra),
            "server_cert": None,
        }
        rv = self.post_assert_metric(url, data, "test_connection")
        self.assertEqual(rv.status_code, 200)
        self.assertEqual(rv.headers["Content-Type"], "application/json; charset=utf-8")

    def test_test_connection_failed(self):
        """
        Database API: Test test connection failed
        """
        self.login("admin")

        data = {
            "sqlalchemy_uri": "broken://url",
            "database_name": "examples",
            "impersonate_user": False,
            "server_cert": None,
        }
        url = "api/v1/database/test_connection"
        rv = self.post_assert_metric(url, data, "test_connection")
        self.assertEqual(rv.status_code, 422)
        self.assertEqual(rv.headers["Content-Type"], "application/json; charset=utf-8")
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "errors": [
                {
                    "message": "Could not load database driver: BaseEngineSpec",
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
        self.assertEqual(response, expected_response)

        data = {
            "sqlalchemy_uri": "mssql+pymssql://url",
            "database_name": "examples",
            "impersonate_user": False,
            "server_cert": None,
        }
        rv = self.post_assert_metric(url, data, "test_connection")
        self.assertEqual(rv.status_code, 422)
        self.assertEqual(rv.headers["Content-Type"], "application/json; charset=utf-8")
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "errors": [
                {
                    "message": "Could not load database driver: AzureSynapseSpec",
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
        self.assertEqual(response, expected_response)

    def test_test_connection_unsafe_uri(self):
        """
        Database API: Test test connection with unsafe uri
        """
        self.login("admin")

        app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] = True
        data = {
            "sqlalchemy_uri": "sqlite:///home/superset/unsafe.db",
            "database_name": "unsafe",
            "impersonate_user": False,
            "server_cert": None,
        }
        url = "api/v1/database/test_connection"
        rv = self.post_assert_metric(url, data, "test_connection")
        self.assertEqual(rv.status_code, 400)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": {
                "sqlalchemy_uri": [
                    "SQLiteDialect_pysqlite cannot be used as a data source for security reasons."
                ]
            }
        }
        self.assertEqual(response, expected_response)

        app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] = False

    @mock.patch(
        "superset.databases.commands.test_connection.DatabaseDAO.build_db_for_connection_test",
    )
    @mock.patch("superset.databases.commands.test_connection.event_logger",)
    def test_test_connection_failed_invalid_hostname(
        self, mock_event_logger, mock_build_db
    ):
        """
        Database API: Test test connection failed due to invalid hostname
        """
        msg = 'psql: error: could not translate host name "locahost" to address: nodename nor servname provided, or not known'
        mock_build_db.return_value.set_sqlalchemy_uri.side_effect = DBAPIError(
            msg, None, None
        )
        mock_build_db.return_value.db_engine_spec.__name__ = "Some name"
        superset_error = SupersetError(
            message='Unable to resolve hostname "locahost".',
            error_type="CONNECTION_INVALID_HOSTNAME_ERROR",
            level="error",
            extra={
                "hostname": "locahost",
                "issue_codes": [
                    {
                        "code": 1007,
                        "message": (
                            "Issue 1007 - The hostname provided can't be resolved."
                        ),
                    }
                ],
            },
        )
        mock_build_db.return_value.db_engine_spec.extract_errors.return_value = [
            superset_error
        ]

        self.login("admin")
        data = {
            "sqlalchemy_uri": "postgres://username:password@locahost:12345/db",
            "database_name": "examples",
            "impersonate_user": False,
            "server_cert": None,
        }
        url = "api/v1/database/test_connection"
        rv = self.post_assert_metric(url, data, "test_connection")

        assert rv.status_code == 422
        assert rv.headers["Content-Type"] == "application/json; charset=utf-8"
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {"errors": [dataclasses.asdict(superset_error)]}
        assert response == expected_response

    @pytest.mark.usefixtures(
        "load_unicode_dashboard_with_position",
        "load_energy_table_with_slice",
        "load_world_bank_dashboard_with_slices",
        "load_birth_names_dashboard_with_slices",
    )
    def test_get_database_related_objects(self):
        """
        Database API: Test get chart and dashboard count related to a database
        :return:
        """
        self.login(username="admin")
        database = get_example_database()
        uri = f"api/v1/database/{database.id}/related_objects/"
        rv = self.get_assert_metric(uri, "related_objects")
        self.assertEqual(rv.status_code, 200)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(response["charts"]["count"], 33)
        self.assertEqual(response["dashboards"]["count"], 3)

    def test_get_database_related_objects_not_found(self):
        """
        Database API: Test related objects not found
        """
        max_id = db.session.query(func.max(Database.id)).scalar()
        # id does not exist and we get 404
        invalid_id = max_id + 1
        uri = f"api/v1/database/{invalid_id}/related_objects/"
        self.login(username="admin")
        rv = self.get_assert_metric(uri, "related_objects")
        self.assertEqual(rv.status_code, 404)
        self.logout()
        self.login(username="gamma")
        database = get_example_database()
        uri = f"api/v1/database/{database.id}/related_objects/"
        rv = self.get_assert_metric(uri, "related_objects")
        self.assertEqual(rv.status_code, 404)

    def test_export_database(self):
        """
        Database API: Test export database
        """
        self.login(username="admin")
        database = get_example_database()
        argument = [database.id]
        uri = f"api/v1/database/export/?q={prison.dumps(argument)}"
        rv = self.get_assert_metric(uri, "export")
        assert rv.status_code == 200

        buf = BytesIO(rv.data)
        assert is_zipfile(buf)

    def test_export_database_not_allowed(self):
        """
        Database API: Test export database not allowed
        """
        self.login(username="gamma")
        database = get_example_database()
        argument = [database.id]
        uri = f"api/v1/database/export/?q={prison.dumps(argument)}"
        rv = self.client.get(uri)
        # export only requires can_read now, but gamma need to have explicit access to
        # view the database
        assert rv.status_code == 404

    def test_export_database_non_existing(self):
        """
        Database API: Test export database not allowed
        """
        max_id = db.session.query(func.max(Database.id)).scalar()
        # id does not exist and we get 404
        invalid_id = max_id + 1

        self.login(username="admin")
        argument = [invalid_id]
        uri = f"api/v1/database/export/?q={prison.dumps(argument)}"
        rv = self.get_assert_metric(uri, "export")
        assert rv.status_code == 404

    def test_import_database(self):
        """
        Database API: Test import database
        """
        self.login(username="admin")
        uri = "api/v1/database/import/"

        buf = self.create_database_import()
        form_data = {
            "formData": (buf, "database_export.zip"),
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

        dataset.owners = []
        database.owners = []
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_database_overwrite(self):
        """
        Database API: Test import existing database
        """
        self.login(username="admin")
        uri = "api/v1/database/import/"

        buf = self.create_database_import()
        form_data = {
            "formData": (buf, "database_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

        # import again without overwrite flag
        buf = self.create_database_import()
        form_data = {
            "formData": (buf, "database_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "Error importing database",
                    "error_type": "GENERIC_COMMAND_ERROR",
                    "level": "warning",
                    "extra": {
                        "databases/imported_database.yaml": "Database already exists and `overwrite=true` was not passed",
                        "issue_codes": [
                            {
                                "code": 1010,
                                "message": (
                                    "Issue 1010 - Superset encountered an "
                                    "error while running a command."
                                ),
                            }
                        ],
                    },
                }
            ]
        }

        # import with overwrite flag
        buf = self.create_database_import()
        form_data = {
            "formData": (buf, "database_export.zip"),
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
        dataset.owners = []
        database.owners = []
        db.session.delete(dataset)
        db.session.delete(database)
        db.session.commit()

    def test_import_database_invalid(self):
        """
        Database API: Test import invalid database
        """
        self.login(username="admin")
        uri = "api/v1/database/import/"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open("database_export/metadata.yaml", "w") as fp:
                fp.write(yaml.safe_dump(dataset_metadata_config).encode())
            with bundle.open(
                "database_export/databases/imported_database.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(database_config).encode())
            with bundle.open(
                "database_export/datasets/imported_dataset.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(dataset_config).encode())
        buf.seek(0)

        form_data = {
            "formData": (buf, "database_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "Error importing database",
                    "error_type": "GENERIC_COMMAND_ERROR",
                    "level": "warning",
                    "extra": {
                        "metadata.yaml": {"type": ["Must be equal to Database."]},
                        "issue_codes": [
                            {
                                "code": 1010,
                                "message": (
                                    "Issue 1010 - Superset encountered an "
                                    "error while running a command."
                                ),
                            }
                        ],
                    },
                }
            ]
        }

    def test_import_database_masked_password(self):
        """
        Database API: Test import database with masked password
        """
        self.login(username="admin")
        uri = "api/v1/database/import/"

        masked_database_config = database_config.copy()
        masked_database_config[
            "sqlalchemy_uri"
        ] = "postgresql://username:XXXXXXXXXX@host:12345/db"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open("database_export/metadata.yaml", "w") as fp:
                fp.write(yaml.safe_dump(database_metadata_config).encode())
            with bundle.open(
                "database_export/databases/imported_database.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(masked_database_config).encode())
            with bundle.open(
                "database_export/datasets/imported_dataset.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(dataset_config).encode())
        buf.seek(0)

        form_data = {
            "formData": (buf, "database_export.zip"),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "Error importing database",
                    "error_type": "GENERIC_COMMAND_ERROR",
                    "level": "warning",
                    "extra": {
                        "databases/imported_database.yaml": {
                            "_schema": ["Must provide a password for the database"]
                        },
                        "issue_codes": [
                            {
                                "code": 1010,
                                "message": (
                                    "Issue 1010 - Superset encountered an "
                                    "error while running a command."
                                ),
                            }
                        ],
                    },
                }
            ]
        }

    def test_import_database_masked_password_provided(self):
        """
        Database API: Test import database with masked password provided
        """
        self.login(username="admin")
        uri = "api/v1/database/import/"

        masked_database_config = database_config.copy()
        masked_database_config[
            "sqlalchemy_uri"
        ] = "vertica+vertica_python://hackathon:XXXXXXXXXX@host:5433/dbname?ssl=1"

        buf = BytesIO()
        with ZipFile(buf, "w") as bundle:
            with bundle.open("database_export/metadata.yaml", "w") as fp:
                fp.write(yaml.safe_dump(database_metadata_config).encode())
            with bundle.open(
                "database_export/databases/imported_database.yaml", "w"
            ) as fp:
                fp.write(yaml.safe_dump(masked_database_config).encode())
        buf.seek(0)

        form_data = {
            "formData": (buf, "database_export.zip"),
            "passwords": json.dumps({"databases/imported_database.yaml": "SECRET"}),
        }
        rv = self.client.post(uri, data=form_data, content_type="multipart/form-data")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

        database = (
            db.session.query(Database).filter_by(uuid=database_config["uuid"]).one()
        )
        assert database.database_name == "imported_database"
        assert (
            database.sqlalchemy_uri
            == "vertica+vertica_python://hackathon:XXXXXXXXXX@host:5433/dbname?ssl=1"
        )
        assert database.password == "SECRET"

        db.session.delete(database)
        db.session.commit()

    @mock.patch("superset.db_engine_specs.base.BaseEngineSpec.get_function_names",)
    def test_function_names(self, mock_get_function_names):
        example_db = get_example_database()
        if example_db.backend in {"hive", "presto"}:
            return

        mock_get_function_names.return_value = ["AVG", "MAX", "SUM"]

        self.login(username="admin")
        uri = "api/v1/database/1/function_names/"

        rv = self.client.get(uri)
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"function_names": ["AVG", "MAX", "SUM"]}

    @mock.patch("superset.databases.api.get_available_engine_specs")
    @mock.patch("superset.databases.api.app")
    def test_available(self, app, get_available_engine_specs):
        app.config = {"PREFERRED_DATABASES": ["PostgreSQL", "Google BigQuery"]}
        get_available_engine_specs.return_value = {
            PostgresEngineSpec: {"psycopg2"},
            BigQueryEngineSpec: {"bigquery"},
            MySQLEngineSpec: {"mysqlconnector", "mysqldb"},
            GSheetsEngineSpec: {"apsw"},
            RedshiftEngineSpec: {"psycopg2"},
            HanaEngineSpec: {""},
        }

        self.login(username="admin")
        uri = "api/v1/database/available/"

        rv = self.client.get(uri)
        response = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert response == {
            "databases": [
                {
                    "available_drivers": ["psycopg2"],
                    "default_driver": "psycopg2",
                    "engine": "postgresql",
                    "name": "PostgreSQL",
                    "parameters": {
                        "properties": {
                            "database": {
                                "description": "Database name",
                                "type": "string",
                            },
                            "encryption": {
                                "description": "Use an encrypted connection to the database",
                                "type": "boolean",
                            },
                            "host": {
                                "description": "Hostname or IP address",
                                "type": "string",
                            },
                            "password": {
                                "description": "Password",
                                "nullable": True,
                                "type": "string",
                            },
                            "port": {
                                "description": "Database port",
                                "format": "int32",
                                "maximum": 65536,
                                "minimum": 0,
                                "type": "integer",
                            },
                            "query": {
                                "additionalProperties": {},
                                "description": "Additional parameters",
                                "type": "object",
                            },
                            "username": {
                                "description": "Username",
                                "nullable": True,
                                "type": "string",
                            },
                        },
                        "required": ["database", "host", "port", "username"],
                        "type": "object",
                    },
                    "preferred": True,
                    "sqlalchemy_uri_placeholder": "postgresql://user:password@host:port/dbname[?key=value&key=value...]",
                },
                {
                    "available_drivers": ["bigquery"],
                    "default_driver": "bigquery",
                    "engine": "bigquery",
                    "name": "Google BigQuery",
                    "parameters": {
                        "properties": {
                            "credentials_info": {
                                "description": "Contents of BigQuery JSON credentials.",
                                "type": "string",
                                "x-encrypted-extra": True,
                            },
                            "query": {"type": "object"},
                        },
                        "type": "object",
                    },
                    "preferred": True,
                    "sqlalchemy_uri_placeholder": "bigquery://{project_id}",
                },
                {
                    "available_drivers": ["psycopg2"],
                    "default_driver": "psycopg2",
                    "engine": "redshift",
                    "name": "Amazon Redshift",
                    "parameters": {
                        "properties": {
                            "database": {
                                "description": "Database name",
                                "type": "string",
                            },
                            "encryption": {
                                "description": "Use an encrypted connection to the database",
                                "type": "boolean",
                            },
                            "host": {
                                "description": "Hostname or IP address",
                                "type": "string",
                            },
                            "password": {
                                "description": "Password",
                                "nullable": True,
                                "type": "string",
                            },
                            "port": {
                                "description": "Database port",
                                "format": "int32",
                                "maximum": 65536,
                                "minimum": 0,
                                "type": "integer",
                            },
                            "query": {
                                "additionalProperties": {},
                                "description": "Additional parameters",
                                "type": "object",
                            },
                            "username": {
                                "description": "Username",
                                "nullable": True,
                                "type": "string",
                            },
                        },
                        "required": ["database", "host", "port", "username"],
                        "type": "object",
                    },
                    "preferred": False,
                    "sqlalchemy_uri_placeholder": "redshift+psycopg2://user:password@host:port/dbname[?key=value&key=value...]",
                },
                {
                    "available_drivers": ["apsw"],
                    "default_driver": "apsw",
                    "engine": "gsheets",
                    "name": "Google Sheets",
                    "parameters": {
                        "properties": {"catalog": {"type": "object"},},
                        "type": "object",
                    },
                    "preferred": False,
                    "sqlalchemy_uri_placeholder": "gsheets://",
                },
                {
                    "available_drivers": ["mysqlconnector", "mysqldb"],
                    "default_driver": "mysqldb",
                    "engine": "mysql",
                    "name": "MySQL",
                    "parameters": {
                        "properties": {
                            "database": {
                                "description": "Database name",
                                "type": "string",
                            },
                            "encryption": {
                                "description": "Use an encrypted connection to the database",
                                "type": "boolean",
                            },
                            "host": {
                                "description": "Hostname or IP address",
                                "type": "string",
                            },
                            "password": {
                                "description": "Password",
                                "nullable": True,
                                "type": "string",
                            },
                            "port": {
                                "description": "Database port",
                                "format": "int32",
                                "maximum": 65536,
                                "minimum": 0,
                                "type": "integer",
                            },
                            "query": {
                                "additionalProperties": {},
                                "description": "Additional parameters",
                                "type": "object",
                            },
                            "username": {
                                "description": "Username",
                                "nullable": True,
                                "type": "string",
                            },
                        },
                        "required": ["database", "host", "port", "username"],
                        "type": "object",
                    },
                    "preferred": False,
                    "sqlalchemy_uri_placeholder": "mysql://user:password@host:port/dbname[?key=value&key=value...]",
                },
                {
                    "available_drivers": [""],
                    "engine": "hana",
                    "name": "SAP HANA",
                    "preferred": False,
                },
            ]
        }

    @mock.patch("superset.databases.api.get_available_engine_specs")
    @mock.patch("superset.databases.api.app")
    def test_available_no_default(self, app, get_available_engine_specs):
        app.config = {"PREFERRED_DATABASES": ["MySQL"]}
        get_available_engine_specs.return_value = {
            MySQLEngineSpec: {"mysqlconnector"},
            HanaEngineSpec: {""},
        }

        self.login(username="admin")
        uri = "api/v1/database/available/"

        rv = self.client.get(uri)
        response = json.loads(rv.data.decode("utf-8"))
        assert rv.status_code == 200
        assert response == {
            "databases": [
                {
                    "available_drivers": ["mysqlconnector"],
                    "default_driver": "mysqldb",
                    "engine": "mysql",
                    "name": "MySQL",
                    "preferred": True,
                },
                {
                    "available_drivers": [""],
                    "engine": "hana",
                    "name": "SAP HANA",
                    "preferred": False,
                },
            ]
        }

    def test_validate_parameters_invalid_payload_format(self):
        self.login(username="admin")
        url = "api/v1/database/validate_parameters"
        rv = self.client.post(url, data="INVALID", content_type="text/plain")
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 400
        assert response == {
            "errors": [
                {
                    "message": "Request is not JSON",
                    "error_type": "INVALID_PAYLOAD_FORMAT_ERROR",
                    "level": "error",
                    "extra": {
                        "issue_codes": [
                            {
                                "code": 1019,
                                "message": "Issue 1019 - The submitted payload has the incorrect format.",
                            }
                        ]
                    },
                }
            ]
        }

    def test_validate_parameters_invalid_payload_schema(self):
        self.login(username="admin")
        url = "api/v1/database/validate_parameters"
        payload = {"foo": "bar"}
        rv = self.client.post(url, json=payload)
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        response["errors"].sort(key=lambda error: error["extra"]["invalid"][0])
        assert response == {
            "errors": [
                {
                    "message": "Missing data for required field.",
                    "error_type": "INVALID_PAYLOAD_SCHEMA_ERROR",
                    "level": "error",
                    "extra": {
                        "invalid": ["configuration_method"],
                        "issue_codes": [
                            {
                                "code": 1020,
                                "message": "Issue 1020 - The submitted payload has the incorrect schema.",
                            }
                        ],
                    },
                },
                {
                    "message": "Missing data for required field.",
                    "error_type": "INVALID_PAYLOAD_SCHEMA_ERROR",
                    "level": "error",
                    "extra": {
                        "invalid": ["engine"],
                        "issue_codes": [
                            {
                                "code": 1020,
                                "message": "Issue 1020 - The submitted payload has the incorrect schema.",
                            }
                        ],
                    },
                },
            ]
        }

    def test_validate_parameters_missing_fields(self):
        self.login(username="admin")
        url = "api/v1/database/validate_parameters"
        payload = {
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
            "engine": "postgresql",
            "parameters": defaultdict(dict),
        }
        payload["parameters"].update(
            {
                "host": "",
                "port": 5432,
                "username": "",
                "password": "",
                "database": "",
                "query": {},
            }
        )
        rv = self.client.post(url, json=payload)
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "One or more parameters are missing: database, host, username",
                    "error_type": "CONNECTION_MISSING_PARAMETERS_ERROR",
                    "level": "warning",
                    "extra": {
                        "missing": ["database", "host", "username"],
                        "issue_codes": [
                            {
                                "code": 1018,
                                "message": "Issue 1018 - One or more parameters needed to configure a database are missing.",
                            }
                        ],
                    },
                }
            ]
        }

    @mock.patch("superset.db_engine_specs.base.is_hostname_valid")
    @mock.patch("superset.db_engine_specs.base.is_port_open")
    @mock.patch("superset.databases.api.ValidateDatabaseParametersCommand")
    def test_validate_parameters_valid_payload(
        self, ValidateDatabaseParametersCommand, is_port_open, is_hostname_valid
    ):
        is_hostname_valid.return_value = True
        is_port_open.return_value = True

        self.login(username="admin")
        url = "api/v1/database/validate_parameters"
        payload = {
            "engine": "postgresql",
            "parameters": defaultdict(dict),
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
        }
        payload["parameters"].update(
            {
                "host": "localhost",
                "port": 6789,
                "username": "superset",
                "password": "XXX",
                "database": "test",
                "query": {},
            }
        )
        rv = self.client.post(url, json=payload)
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 200
        assert response == {"message": "OK"}

    def test_validate_parameters_invalid_port(self):
        self.login(username="admin")
        url = "api/v1/database/validate_parameters"
        payload = {
            "engine": "postgresql",
            "parameters": defaultdict(dict),
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
        }
        payload["parameters"].update(
            {
                "host": "localhost",
                "port": "string",
                "username": "superset",
                "password": "XXX",
                "database": "test",
                "query": {},
            }
        )
        rv = self.client.post(url, json=payload)
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "Port must be a valid integer.",
                    "error_type": "CONNECTION_INVALID_PORT_ERROR",
                    "level": "error",
                    "extra": {
                        "invalid": ["port"],
                        "issue_codes": [
                            {
                                "code": 1034,
                                "message": "Issue 1034 - The port number is invalid.",
                            }
                        ],
                    },
                },
                {
                    "message": "The port must be an integer between 0 and 65535 (inclusive).",
                    "error_type": "CONNECTION_INVALID_PORT_ERROR",
                    "level": "error",
                    "extra": {
                        "invalid": ["port"],
                        "issue_codes": [
                            {
                                "code": 1034,
                                "message": "Issue 1034 - The port number is invalid.",
                            }
                        ],
                    },
                },
            ]
        }

    @mock.patch("superset.db_engine_specs.base.is_hostname_valid")
    def test_validate_parameters_invalid_host(self, is_hostname_valid):
        is_hostname_valid.return_value = False

        self.login(username="admin")
        url = "api/v1/database/validate_parameters"
        payload = {
            "engine": "postgresql",
            "parameters": defaultdict(dict),
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
        }
        payload["parameters"].update(
            {
                "host": "localhost",
                "port": 5432,
                "username": "",
                "password": "",
                "database": "",
                "query": {},
            }
        )
        rv = self.client.post(url, json=payload)
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "One or more parameters are missing: database, username",
                    "error_type": "CONNECTION_MISSING_PARAMETERS_ERROR",
                    "level": "warning",
                    "extra": {
                        "missing": ["database", "username"],
                        "issue_codes": [
                            {
                                "code": 1018,
                                "message": "Issue 1018 - One or more parameters needed to configure a database are missing.",
                            }
                        ],
                    },
                },
                {
                    "message": "The hostname provided can't be resolved.",
                    "error_type": "CONNECTION_INVALID_HOSTNAME_ERROR",
                    "level": "error",
                    "extra": {
                        "invalid": ["host"],
                        "issue_codes": [
                            {
                                "code": 1007,
                                "message": "Issue 1007 - The hostname provided can't be resolved.",
                            }
                        ],
                    },
                },
            ]
        }

    @mock.patch("superset.db_engine_specs.base.is_hostname_valid")
    def test_validate_parameters_invalid_port_range(self, is_hostname_valid):
        is_hostname_valid.return_value = True

        self.login(username="admin")
        url = "api/v1/database/validate_parameters"
        payload = {
            "engine": "postgresql",
            "parameters": defaultdict(dict),
            "configuration_method": ConfigurationMethod.SQLALCHEMY_FORM,
        }
        payload["parameters"].update(
            {
                "host": "localhost",
                "port": 65536,
                "username": "",
                "password": "",
                "database": "",
                "query": {},
            }
        )
        rv = self.client.post(url, json=payload)
        response = json.loads(rv.data.decode("utf-8"))

        assert rv.status_code == 422
        assert response == {
            "errors": [
                {
                    "message": "One or more parameters are missing: database, username",
                    "error_type": "CONNECTION_MISSING_PARAMETERS_ERROR",
                    "level": "warning",
                    "extra": {
                        "missing": ["database", "username"],
                        "issue_codes": [
                            {
                                "code": 1018,
                                "message": "Issue 1018 - One or more parameters needed to configure a database are missing.",
                            }
                        ],
                    },
                },
                {
                    "message": "The port must be an integer between 0 and 65535 (inclusive).",
                    "error_type": "CONNECTION_INVALID_PORT_ERROR",
                    "level": "error",
                    "extra": {
                        "invalid": ["port"],
                        "issue_codes": [
                            {
                                "code": 1034,
                                "message": "Issue 1034 - The port number is invalid.",
                            }
                        ],
                    },
                },
            ]
        }
