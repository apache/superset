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
import datetime
import json
from io import BytesIO
from zipfile import is_zipfile

import pandas as pd
import prison
import pytest
import random

from sqlalchemy import String, Date, Float
from sqlalchemy.sql import func

from superset import db, security_manager, ConnectorRegistry
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Database
from superset.utils.core import get_example_database, get_main_database
from tests.base_tests import SupersetTestCase
from tests.dashboard_utils import (
    create_table_for_dashboard,
    create_dashboard,
)
from tests.fixtures.certificates import ssl_certificate
from tests.fixtures.unicode_dashboard import load_unicode_dashboard_with_position
from tests.test_app import app


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
            "force_ctas_schema",
            "function_names",
            "id",
        ]
        self.assertEqual(response["count"], 2)
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
        uri = f"api/v1/database/"
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
            "database_name": "test-database",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
            "server_cert": ssl_certificate,
            "extra": json.dumps(extra),
        }

        uri = "api/v1/database/"
        rv = self.client.post(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 201)
        # Cleanup
        model = db.session.query(Database).get(response.get("id"))
        db.session.delete(model)
        db.session.commit()

    def test_create_database_server_cert_validate(self):
        """
        Database API: Test create server cert validation
        """
        example_db = get_example_database()
        if example_db.backend == "sqlite":
            return

        self.login(username="admin")
        database_data = {
            "database_name": "test-database",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
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
            "database_name": "test-database",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
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
            "database_name": "test-database",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
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
        }

        uri = "api/v1/database/"
        rv = self.client.post(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": {"database_name": "A database with the same name already exists"}
        }
        self.assertEqual(rv.status_code, 422)
        self.assertEqual(response, expected_response)

    def test_create_database_uri_validate(self):
        """
        Database API: Test create fail validate sqlalchemy uri
        """
        self.login(username="admin")
        database_data = {
            "database_name": "test-database",
            "sqlalchemy_uri": "wrong_uri",
        }

        uri = "api/v1/database/"
        rv = self.client.post(uri, json=database_data)
        response = json.loads(rv.data.decode("utf-8"))
        self.assertEqual(rv.status_code, 400)
        expected_response = {
            "message": {
                "sqlalchemy_uri": [
                    "Invalid connection string, a valid string usually "
                    "follows:'DRIVER://USER:PASSWORD@DB-HOST/DATABASE-NAME'"
                    "<p>Example:'postgresql://user:password@your-postgres-db/database'"
                    "</p>"
                ]
            }
        }
        self.assertEqual(response, expected_response)

    def test_create_database_fail_sqllite(self):
        """
        Database API: Test create fail with sqllite
        """
        database_data = {
            "database_name": "test-database",
            "sqlalchemy_uri": "sqlite:////some.db",
        }

        uri = "api/v1/database/"
        self.login(username="admin")
        response = self.client.post(uri, json=database_data)
        response_data = json.loads(response.data.decode("utf-8"))
        expected_response = {
            "message": {
                "sqlalchemy_uri": [
                    "SQLite database cannot be used as a data source "
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
            "database_name": "test-database",
            "sqlalchemy_uri": example_db.sqlalchemy_uri_decrypted,
        }

        uri = "api/v1/database/"
        self.login(username="admin")
        response = self.client.post(uri, json=database_data)
        response_data = json.loads(response.data.decode("utf-8"))
        expected_response = {"message": "Could not connect to database."}
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
        database_data = {"database_name": "test-database-updated"}
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
        expected_response = {"message": "Could not connect to database."}
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
            "message": {"database_name": "A database with the same name already exists"}
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
        uri = f"api/v1/database/invalid"
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
        expected_response = {
            "message": {
                "sqlalchemy_uri": [
                    "Invalid connection string, a valid string usually "
                    "follows:'DRIVER://USER:PASSWORD@DB-HOST/DATABASE-NAME'"
                    "<p>Example:'postgresql://user:password@your-postgres-db/database'"
                    "</p>"
                ]
            }
        }
        self.assertEqual(response, expected_response)

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

    def test_delete_database_with_datasets(self):
        """
        Database API: Test delete fails because it has depending datasets
        """
        database_id = (
            db.session.query(Database).filter_by(database_name="examples").one()
        ).id
        self.login(username="admin")
        uri = f"api/v1/database/{database_id}"
        rv = self.delete_assert_metric(uri, "delete")
        self.assertEqual(rv.status_code, 422)

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

    def test_get_invalid_database_table_metadata(self):
        """
        Database API: Test get invalid database from table metadata
        """
        database_id = 1000
        self.login(username="admin")
        uri = f"api/v1/database/{database_id}/table/some_table/some_schema/"
        rv = self.client.get(uri)
        self.assertEqual(rv.status_code, 404)

        uri = f"api/v1/database/some_database/table/some_table/some_schema/"
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
        self.login("admin")
        database = db.session.query(Database).first()
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
            "server_cert": ssl_certificate,
        }
        url = f"api/v1/database/test_connection"
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
        url = f"api/v1/database/test_connection"
        rv = self.post_assert_metric(url, data, "test_connection")
        self.assertEqual(rv.status_code, 400)
        self.assertEqual(rv.headers["Content-Type"], "application/json; charset=utf-8")
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "driver_name": "broken",
            "message": "Could not load database driver: broken",
        }
        self.assertEqual(response, expected_response)

        data = {
            "sqlalchemy_uri": "mssql+pymssql://url",
            "database_name": "examples",
            "impersonate_user": False,
            "server_cert": None,
        }
        rv = self.post_assert_metric(url, data, "test_connection")
        self.assertEqual(rv.status_code, 400)
        self.assertEqual(rv.headers["Content-Type"], "application/json; charset=utf-8")
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "driver_name": "mssql+pymssql",
            "message": "Could not load database driver: mssql+pymssql",
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
        url = f"api/v1/database/test_connection"
        rv = self.post_assert_metric(url, data, "test_connection")
        self.assertEqual(rv.status_code, 400)
        response = json.loads(rv.data.decode("utf-8"))
        expected_response = {
            "message": {
                "sqlalchemy_uri": [
                    "SQLite database cannot be used as a data source for security reasons."
                ]
            }
        }
        self.assertEqual(response, expected_response)

    @pytest.mark.usefixtures("load_unicode_dashboard_with_position")
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
        assert rv.status_code == 401

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
