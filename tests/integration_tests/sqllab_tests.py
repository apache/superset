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
"""Unit tests for Sql Lab"""
import json
from datetime import datetime, timedelta

import pytest
from celery.exceptions import SoftTimeLimitExceeded
from parameterized import parameterized
from random import random
from unittest import mock
from superset.extensions import db
import prison

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.db_engine_specs import BaseEngineSpec
from superset.db_engine_specs.hive import HiveEngineSpec
from superset.db_engine_specs.presto import PrestoEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException
from superset.models.core import Database
from superset.models.sql_lab import Query, SavedQuery
from superset.result_set import SupersetResultSet
from superset.sqllab.limiting_factor import LimitingFactor
from superset.sql_lab import (
    cancel_query,
    execute_sql_statements,
    execute_sql_statement,
    get_sql_results,
    SqlLabException,
    apply_limit_if_exists,
)
from superset.sql_parse import CtasMethod
from superset.utils.core import (
    backend,
    datetime_to_epoch,
    get_example_database,
    get_main_database,
)

from .base_tests import SupersetTestCase
from .conftest import CTAS_SCHEMA_NAME
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)

QUERY_1 = "SELECT * FROM birth_names LIMIT 1"
QUERY_2 = "SELECT * FROM NO_TABLE"
QUERY_3 = "SELECT * FROM birth_names LIMIT 10"


@pytest.mark.sql_json_flow
class TestSqlLab(SupersetTestCase):
    """Testings for Sql Lab"""

    def run_some_queries(self):
        db.session.query(Query).delete()
        db.session.commit()
        self.run_sql(QUERY_1, client_id="client_id_1", user_name="admin")
        self.run_sql(QUERY_2, client_id="client_id_3", user_name="admin")
        self.run_sql(QUERY_3, client_id="client_id_2", user_name="gamma_sqllab")
        self.logout()

    def tearDown(self):
        self.logout()
        db.session.query(Query).delete()
        db.session.commit()
        db.session.close()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_json(self):
        examples_db = get_example_database()
        engine_name = examples_db.db_engine_spec.engine_name

        self.login("admin")

        data = self.run_sql("SELECT * FROM birth_names LIMIT 10", "1")
        self.assertLess(0, len(data["data"]))

        data = self.run_sql("SELECT * FROM unexistant_table", "2")
        if backend() == "presto":
            assert (
                data["errors"][0]["error_type"]
                == SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR
            )
            assert data["errors"][0]["level"] == ErrorLevel.ERROR
            assert data["errors"][0]["extra"] == {
                "engine_name": "Presto",
                "issue_codes": [
                    {
                        "code": 1003,
                        "message": "Issue 1003 - There is a syntax error in the SQL query. Perhaps there was a misspelling or a typo.",
                    },
                    {
                        "code": 1005,
                        "message": "Issue 1005 - The table was deleted or renamed in the database.",
                    },
                ],
            }
        else:
            assert (
                data["errors"][0]["error_type"]
                == SupersetErrorType.GENERIC_DB_ENGINE_ERROR
            )
            assert data["errors"][0]["level"] == ErrorLevel.ERROR
            assert data["errors"][0]["extra"] == {
                "issue_codes": [
                    {
                        "code": 1002,
                        "message": "Issue 1002 - The database returned an unexpected error.",
                    }
                ],
                "engine_name": engine_name,
            }

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_json_dml_disallowed(self):
        self.login("admin")

        data = self.run_sql("DELETE FROM birth_names", "1")
        assert data == {
            "errors": [
                {
                    "message": "Only SELECT statements are allowed against this database.",
                    "error_type": SupersetErrorType.DML_NOT_ALLOWED_ERROR,
                    "level": ErrorLevel.ERROR,
                    "extra": {
                        "issue_codes": [
                            {
                                "code": 1022,
                                "message": "Issue 1022 - Database does not allow data manipulation.",
                            }
                        ]
                    },
                }
            ]
        }

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_json_to_saved_query_info(self):
        """
        SQLLab: Test SQLLab query execution info propagation to saved queries
        """
        from freezegun import freeze_time

        self.login("admin")

        sql_statement = "SELECT * FROM birth_names LIMIT 10"
        examples_db_id = get_example_database().id
        saved_query = SavedQuery(db_id=examples_db_id, sql=sql_statement)
        db.session.add(saved_query)
        db.session.commit()

        with freeze_time("2020-01-01T00:00:00Z"):
            self.run_sql(sql_statement, "1")
            saved_query_ = (
                db.session.query(SavedQuery)
                .filter(
                    SavedQuery.db_id == examples_db_id, SavedQuery.sql == sql_statement
                )
                .one_or_none()
            )
            assert saved_query_.rows is not None
            assert saved_query_.last_run == datetime.now()
            # Rollback changes
            db.session.delete(saved_query_)
            db.session.commit()

    @parameterized.expand([CtasMethod.TABLE, CtasMethod.VIEW])
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_json_cta_dynamic_db(self, ctas_method):
        examples_db = get_example_database()
        if examples_db.backend == "sqlite":
            # sqlite doesn't support database creation
            return

        with mock.patch(
            "superset.sqllab.sqllab_execution_context.get_cta_schema_name",
            lambda d, u, s, sql: f"{u.username}_database",
        ):
            old_allow_ctas = examples_db.allow_ctas
            examples_db.allow_ctas = True  # enable cta

            self.login("admin")
            tmp_table_name = f"test_target_{ctas_method.lower()}"
            self.run_sql(
                "SELECT * FROM birth_names",
                "1",
                database_name="examples",
                tmp_table_name=tmp_table_name,
                select_as_cta=True,
                ctas_method=ctas_method,
            )

            # assertions
            db.session.commit()
            examples_db = get_example_database()
            engine = examples_db.get_sqla_engine()
            data = engine.execute(
                f"SELECT * FROM admin_database.{tmp_table_name}"
            ).fetchall()
            names_count = engine.execute(f"SELECT COUNT(*) FROM birth_names").first()
            self.assertEqual(
                names_count[0], len(data)
            )  # SQL_MAX_ROW not applied due to the SQLLAB_CTAS_NO_LIMIT set to True

            # cleanup
            engine.execute(f"DROP {ctas_method} admin_database.{tmp_table_name}")
            examples_db.allow_ctas = old_allow_ctas
            db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_multi_sql(self):
        self.login("admin")

        multi_sql = """
        SELECT * FROM birth_names LIMIT 1;
        SELECT * FROM birth_names LIMIT 2;
        """
        data = self.run_sql(multi_sql, "2234")
        self.assertLess(0, len(data["data"]))

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_explain(self):
        self.login("admin")

        data = self.run_sql("EXPLAIN SELECT * FROM birth_names", "1")
        self.assertLess(0, len(data["data"]))

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_json_has_access(self):
        examples_db = get_example_database()
        examples_db_permission_view = security_manager.add_permission_view_menu(
            "database_access", examples_db.perm
        )
        astronaut = security_manager.add_role("ExampleDBAccess")
        security_manager.add_permission_role(astronaut, examples_db_permission_view)
        # Gamma user, with sqllab and db permission
        self.create_user_with_roles("Gagarin", ["ExampleDBAccess", "Gamma", "sql_lab"])

        data = self.run_sql(QUERY_1, "1", user_name="Gagarin")
        db.session.query(Query).delete()
        db.session.commit()
        self.assertLess(0, len(data["data"]))

    def test_sql_json_schema_access(self):
        examples_db = get_example_database()
        db_backend = examples_db.backend
        if db_backend == "sqlite":
            # sqlite doesn't support database creation
            return

        sqllab_test_db_schema_permission_view = security_manager.add_permission_view_menu(
            "schema_access", f"[{examples_db.name}].[{CTAS_SCHEMA_NAME}]"
        )
        schema_perm_role = security_manager.add_role("SchemaPermission")
        security_manager.add_permission_role(
            schema_perm_role, sqllab_test_db_schema_permission_view
        )
        self.create_user_with_roles(
            "SchemaUser", ["SchemaPermission", "Gamma", "sql_lab"]
        )

        examples_db.get_sqla_engine().execute(
            f"CREATE TABLE IF NOT EXISTS {CTAS_SCHEMA_NAME}.test_table AS SELECT 1 as c1, 2 as c2"
        )

        data = self.run_sql(
            f"SELECT * FROM {CTAS_SCHEMA_NAME}.test_table", "3", user_name="SchemaUser"
        )
        self.assertEqual(1, len(data["data"]))

        data = self.run_sql(
            f"SELECT * FROM {CTAS_SCHEMA_NAME}.test_table",
            "4",
            user_name="SchemaUser",
            schema=CTAS_SCHEMA_NAME,
        )
        self.assertEqual(1, len(data["data"]))

        # postgres needs a schema as a part of the table name.
        if db_backend == "mysql":
            data = self.run_sql(
                "SELECT * FROM test_table",
                "5",
                user_name="SchemaUser",
                schema=CTAS_SCHEMA_NAME,
            )
            self.assertEqual(1, len(data["data"]))

        db.session.query(Query).delete()
        get_example_database().get_sqla_engine().execute(
            f"DROP TABLE IF EXISTS {CTAS_SCHEMA_NAME}.test_table"
        )
        db.session.commit()

    def test_queries_endpoint(self):
        self.run_some_queries()

        # Not logged in, should error out
        resp = self.client.get("/superset/queries/0")
        # Redirects to the login page
        self.assertEqual(401, resp.status_code)

        # Admin sees queries
        self.login("admin")
        data = self.get_json_resp("/superset/queries/0")
        self.assertEqual(2, len(data))
        data = self.get_json_resp("/superset/queries/0.0")
        self.assertEqual(2, len(data))

        # Run 2 more queries
        self.run_sql("SELECT * FROM birth_names LIMIT 1", client_id="client_id_4")
        self.run_sql("SELECT * FROM birth_names LIMIT 2", client_id="client_id_5")
        self.login("admin")
        data = self.get_json_resp("/superset/queries/0")
        self.assertEqual(4, len(data))

        now = datetime.now() + timedelta(days=1)
        query = (
            db.session.query(Query)
            .filter_by(sql="SELECT * FROM birth_names LIMIT 1")
            .first()
        )
        query.changed_on = now
        db.session.commit()

        data = self.get_json_resp(
            "/superset/queries/{}".format(float(datetime_to_epoch(now)) - 1000)
        )
        self.assertEqual(1, len(data))

        self.logout()
        resp = self.client.get("/superset/queries/0")
        # Redirects to the login page
        self.assertEqual(401, resp.status_code)

    def test_search_query_on_db_id(self):
        self.run_some_queries()
        self.login("admin")
        examples_dbid = get_example_database().id

        # Test search queries on database Id
        data = self.get_json_resp(
            f"/superset/search_queries?database_id={examples_dbid}"
        )
        self.assertEqual(3, len(data))
        db_ids = [k["dbId"] for k in data]
        self.assertEqual([examples_dbid for i in range(3)], db_ids)

        resp = self.get_resp("/superset/search_queries?database_id=-1")
        data = json.loads(resp)
        self.assertEqual(0, len(data))

    def test_search_query_on_user(self):
        self.run_some_queries()
        self.login("admin")

        # Test search queries on user Id
        user_id = security_manager.find_user("admin").id
        data = self.get_json_resp("/superset/search_queries?user_id={}".format(user_id))
        self.assertEqual(2, len(data))
        user_ids = {k["userId"] for k in data}
        self.assertEqual(set([user_id]), user_ids)

        user_id = security_manager.find_user("gamma_sqllab").id
        resp = self.get_resp("/superset/search_queries?user_id={}".format(user_id))
        data = json.loads(resp)
        self.assertEqual(1, len(data))
        self.assertEqual(data[0]["userId"], user_id)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_search_query_on_status(self):
        self.run_some_queries()
        self.login("admin")
        # Test search queries on status
        resp = self.get_resp("/superset/search_queries?status=success")
        data = json.loads(resp)
        self.assertEqual(2, len(data))
        states = [k["state"] for k in data]
        self.assertEqual(["success", "success"], states)

        resp = self.get_resp("/superset/search_queries?status=failed")
        data = json.loads(resp)
        self.assertEqual(1, len(data))
        self.assertEqual(data[0]["state"], "failed")

    def test_search_query_on_text(self):
        self.run_some_queries()
        self.login("admin")
        url = "/superset/search_queries?search_text=birth"
        data = self.get_json_resp(url)
        self.assertEqual(2, len(data))
        self.assertIn("birth", data[0]["sql"])

    def test_search_query_on_time(self):
        self.run_some_queries()
        self.login("admin")
        first_query_time = (
            db.session.query(Query).filter_by(sql=QUERY_1).one()
        ).start_time
        second_query_time = (
            db.session.query(Query).filter_by(sql=QUERY_3).one()
        ).start_time
        # Test search queries on time filter
        from_time = "from={}".format(int(first_query_time))
        to_time = "to={}".format(int(second_query_time))
        params = [from_time, to_time]
        resp = self.get_resp("/superset/search_queries?" + "&".join(params))
        data = json.loads(resp)
        self.assertEqual(2, len(data))

    def test_search_query_only_owned(self) -> None:
        """
        Test a search query with a user that does not have can_access_all_queries.
        """
        # Test search_queries for Alpha user
        self.run_some_queries()
        self.login("gamma_sqllab")

        user_id = security_manager.find_user("gamma_sqllab").id
        data = self.get_json_resp("/superset/search_queries")

        self.assertEqual(1, len(data))
        user_ids = {k["userId"] for k in data}
        self.assertEqual(set([user_id]), user_ids)

    def test_alias_duplicate(self):
        self.run_sql(
            "SELECT name as col, gender as col FROM birth_names LIMIT 10",
            client_id="2e2df3",
            user_name="admin",
            raise_on_error=True,
        )

    def test_ps_conversion_no_dict(self):
        cols = [["string_col", "string"], ["int_col", "int"], ["float_col", "float"]]
        data = [["a", 4, 4.0]]
        results = SupersetResultSet(data, cols, BaseEngineSpec)

        self.assertEqual(len(data), results.size)
        self.assertEqual(len(cols), len(results.columns))

    def test_pa_conversion_tuple(self):
        cols = ["string_col", "int_col", "list_col", "float_col"]
        data = [("Text", 111, [123], 1.0)]
        results = SupersetResultSet(data, cols, BaseEngineSpec)

        self.assertEqual(len(data), results.size)
        self.assertEqual(len(cols), len(results.columns))

    def test_pa_conversion_dict(self):
        cols = ["string_col", "dict_col", "int_col"]
        data = [["a", {"c1": 1, "c2": 2, "c3": 3}, 4]]
        results = SupersetResultSet(data, cols, BaseEngineSpec)

        self.assertEqual(len(data), results.size)
        self.assertEqual(len(cols), len(results.columns))

    def test_sqllab_viz(self):
        self.login("admin")
        examples_dbid = get_example_database().id
        payload = {
            "chartType": "dist_bar",
            "datasourceName": f"test_viz_flow_table_{random()}",
            "schema": "superset",
            "columns": [
                {"is_date": False, "type": "STRING", "name": f"viz_type_{random()}"},
                {"is_date": False, "type": "OBJECT", "name": f"ccount_{random()}"},
            ],
            "sql": """\
                SELECT *
                FROM birth_names
                LIMIT 10""",
            "dbId": examples_dbid,
        }
        data = {"data": json.dumps(payload)}
        resp = self.get_json_resp("/superset/sqllab_viz/", data=data)
        self.assertIn("table_id", resp)

        # ensure owner is set correctly
        table_id = resp["table_id"]
        table = db.session.query(SqlaTable).filter_by(id=table_id).one()
        self.assertEqual([owner.username for owner in table.owners], ["admin"])
        view_menu = security_manager.find_view_menu(table.get_perm())
        assert view_menu is not None

        # Cleanup
        db.session.delete(table)
        db.session.commit()

    def test_sqllab_viz_bad_payload(self):
        self.login("admin")
        payload = {
            "chartType": "dist_bar",
            "schema": "superset",
            "columns": [
                {"is_date": False, "type": "STRING", "name": f"viz_type_{random()}"},
                {"is_date": False, "type": "OBJECT", "name": f"ccount_{random()}"},
            ],
            "sql": """\
                SELECT *
                FROM birth_names
                LIMIT 10""",
        }
        data = {"data": json.dumps(payload)}
        url = "/superset/sqllab_viz/"
        response = self.client.post(url, data=data, follow_redirects=True)
        assert response.status_code == 400

    def test_sqllab_table_viz(self):
        self.login("admin")
        examples_db = get_example_database()
        examples_db.get_sqla_engine().execute(
            "DROP TABLE IF EXISTS test_sqllab_table_viz"
        )
        examples_db.get_sqla_engine().execute(
            "CREATE TABLE test_sqllab_table_viz AS SELECT 2 as col"
        )
        examples_dbid = examples_db.id

        payload = {
            "datasourceName": "test_sqllab_table_viz",
            "columns": [],
            "dbId": examples_dbid,
        }

        data = {"data": json.dumps(payload)}
        resp = self.get_json_resp("/superset/get_or_create_table/", data=data)
        self.assertIn("table_id", resp)

        # ensure owner is set correctly
        table_id = resp["table_id"]
        table = db.session.query(SqlaTable).filter_by(id=table_id).one()
        self.assertEqual([owner.username for owner in table.owners], ["admin"])
        db.session.delete(table)
        get_example_database().get_sqla_engine().execute(
            "DROP TABLE test_sqllab_table_viz"
        )
        db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_limit(self):
        self.login("admin")
        test_limit = 1
        data = self.run_sql("SELECT * FROM birth_names", client_id="sql_limit_1")
        self.assertGreater(len(data["data"]), test_limit)
        data = self.run_sql(
            "SELECT * FROM birth_names", client_id="sql_limit_2", query_limit=test_limit
        )
        self.assertEqual(len(data["data"]), test_limit)

        data = self.run_sql(
            "SELECT * FROM birth_names LIMIT {}".format(test_limit),
            client_id="sql_limit_3",
            query_limit=test_limit + 1,
        )
        self.assertEqual(len(data["data"]), test_limit)
        self.assertEqual(data["query"]["limitingFactor"], LimitingFactor.QUERY)

        data = self.run_sql(
            "SELECT * FROM birth_names LIMIT {}".format(test_limit + 1),
            client_id="sql_limit_4",
            query_limit=test_limit,
        )
        self.assertEqual(len(data["data"]), test_limit)
        self.assertEqual(data["query"]["limitingFactor"], LimitingFactor.DROPDOWN)

        data = self.run_sql(
            "SELECT * FROM birth_names LIMIT {}".format(test_limit),
            client_id="sql_limit_5",
            query_limit=test_limit,
        )
        self.assertEqual(len(data["data"]), test_limit)
        self.assertEqual(
            data["query"]["limitingFactor"], LimitingFactor.QUERY_AND_DROPDOWN
        )

        data = self.run_sql(
            "SELECT * FROM birth_names", client_id="sql_limit_6", query_limit=10000,
        )
        self.assertEqual(len(data["data"]), 1200)
        self.assertEqual(data["query"]["limitingFactor"], LimitingFactor.NOT_LIMITED)

        data = self.run_sql(
            "SELECT * FROM birth_names", client_id="sql_limit_7", query_limit=1200,
        )
        self.assertEqual(len(data["data"]), 1200)
        self.assertEqual(data["query"]["limitingFactor"], LimitingFactor.NOT_LIMITED)

    def test_query_api_filter(self) -> None:
        """
        Test query api without can_only_access_owned_queries perm added to
        Admin and make sure all queries show up.
        """
        self.run_some_queries()
        self.login(username="admin")

        url = "/api/v1/query/"
        data = self.get_json_resp(url)
        admin = security_manager.find_user("admin")
        gamma_sqllab = security_manager.find_user("gamma_sqllab")
        self.assertEqual(3, len(data["result"]))
        user_queries = [result.get("user").get("username") for result in data["result"]]
        assert admin.username in user_queries
        assert gamma_sqllab.username in user_queries

    def test_query_api_can_access_all_queries(self) -> None:
        """
        Test query api with can_access_all_queries perm added to
        gamma and make sure all queries show up.
        """
        session = db.session

        # Add all_query_access perm to Gamma user
        all_queries_view = security_manager.find_permission_view_menu(
            "all_query_access", "all_query_access"
        )

        security_manager.add_permission_role(
            security_manager.find_role("gamma_sqllab"), all_queries_view
        )
        session.commit()

        # Test search_queries for Admin user
        self.run_some_queries()
        self.login("gamma_sqllab")
        url = "/api/v1/query/"
        data = self.get_json_resp(url)
        self.assertEqual(3, len(data["result"]))

        # Remove all_query_access from gamma sqllab
        all_queries_view = security_manager.find_permission_view_menu(
            "all_query_access", "all_query_access"
        )
        security_manager.del_permission_role(
            security_manager.find_role("gamma_sqllab"), all_queries_view
        )

        session.commit()

    def test_query_admin_can_access_all_queries(self) -> None:
        """
        Test query api with all_query_access perm added to
        Admin and make sure only Admin queries show up. This is the default
        """
        # Test search_queries for Admin user
        self.run_some_queries()
        self.login("admin")

        url = "/api/v1/query/"
        data = self.get_json_resp(url)
        self.assertEqual(3, len(data["result"]))

    def test_api_database(self):
        self.login("admin")
        self.create_fake_db()
        get_example_database()
        get_main_database()

        arguments = {
            "keys": [],
            "filters": [{"col": "expose_in_sqllab", "opr": "eq", "value": True}],
            "order_column": "database_name",
            "order_direction": "asc",
            "page": 0,
            "page_size": -1,
        }
        url = f"api/v1/database/?q={prison.dumps(arguments)}"

        self.assertEqual(
            {"examples", "fake_db_100", "main"},
            {r.get("database_name") for r in self.get_json_resp(url)["result"]},
        )
        self.delete_fake_db()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"ENABLE_TEMPLATE_PROCESSING": True},
        clear=True,
    )
    def test_sql_json_parameter_error(self):
        self.login("admin")

        data = self.run_sql(
            "SELECT * FROM birth_names WHERE state = '{{ state }}' LIMIT 10",
            "1",
            template_params=json.dumps({"state": "CA"}),
        )
        assert data["status"] == "success"

        data = self.run_sql(
            "SELECT * FROM birth_names WHERE state = '{{ stat }}' LIMIT 10",
            "2",
            template_params=json.dumps({"state": "CA"}),
        )
        assert data["errors"][0]["error_type"] == "MISSING_TEMPLATE_PARAMS_ERROR"
        assert data["errors"][0]["extra"] == {
            "issue_codes": [
                {
                    "code": 1006,
                    "message": "Issue 1006 - One or more parameters specified in the query are missing.",
                }
            ],
            "template_parameters": {"state": "CA"},
            "undefined_parameters": ["stat"],
        }

    @mock.patch("superset.sql_lab.get_query")
    @mock.patch("superset.sql_lab.execute_sql_statement")
    def test_execute_sql_statements(self, mock_execute_sql_statement, mock_get_query):
        sql = """
            -- comment
            SET @value = 42;
            SELECT @value AS foo;
            -- comment
        """
        mock_session = mock.MagicMock()
        mock_query = mock.MagicMock()
        mock_query.database.allow_run_async = False
        mock_cursor = mock.MagicMock()
        mock_query.database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value = (
            mock_cursor
        )
        mock_query.database.db_engine_spec.run_multiple_statements_as_one = False
        mock_get_query.return_value = mock_query

        execute_sql_statements(
            query_id=1,
            rendered_query=sql,
            return_results=True,
            store_results=False,
            user_name="admin",
            session=mock_session,
            start_time=None,
            expand_data=False,
            log_params=None,
        )
        mock_execute_sql_statement.assert_has_calls(
            [
                mock.call(
                    "SET @value = 42",
                    mock_query,
                    "admin",
                    mock_session,
                    mock_cursor,
                    None,
                    False,
                ),
                mock.call(
                    "SELECT @value AS foo",
                    mock_query,
                    "admin",
                    mock_session,
                    mock_cursor,
                    None,
                    False,
                ),
            ]
        )

    @mock.patch("superset.sql_lab.results_backend", None)
    @mock.patch("superset.sql_lab.get_query")
    @mock.patch("superset.sql_lab.execute_sql_statement")
    def test_execute_sql_statements_no_results_backend(
        self, mock_execute_sql_statement, mock_get_query
    ):
        sql = """
            -- comment
            SET @value = 42;
            SELECT @value AS foo;
            -- comment
        """
        mock_session = mock.MagicMock()
        mock_query = mock.MagicMock()
        mock_query.database.allow_run_async = True
        mock_cursor = mock.MagicMock()
        mock_query.database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value = (
            mock_cursor
        )
        mock_query.database.db_engine_spec.run_multiple_statements_as_one = False
        mock_get_query.return_value = mock_query

        with pytest.raises(SupersetErrorException) as excinfo:
            execute_sql_statements(
                query_id=1,
                rendered_query=sql,
                return_results=True,
                store_results=False,
                user_name="admin",
                session=mock_session,
                start_time=None,
                expand_data=False,
                log_params=None,
            )

        assert excinfo.value.error == SupersetError(
            message="Results backend is not configured.",
            error_type=SupersetErrorType.RESULTS_BACKEND_NOT_CONFIGURED_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "issue_codes": [
                    {
                        "code": 1021,
                        "message": (
                            "Issue 1021 - Results backend needed for asynchronous "
                            "queries is not configured."
                        ),
                    }
                ]
            },
        )

    @mock.patch("superset.sql_lab.get_query")
    @mock.patch("superset.sql_lab.execute_sql_statement")
    def test_execute_sql_statements_ctas(
        self, mock_execute_sql_statement, mock_get_query
    ):
        sql = """
            -- comment
            SET @value = 42;
            SELECT @value AS foo;
            -- comment
        """
        mock_session = mock.MagicMock()
        mock_query = mock.MagicMock()
        mock_query.database.allow_run_async = False
        mock_cursor = mock.MagicMock()
        mock_query.database.get_sqla_engine.return_value.raw_connection.return_value.cursor.return_value = (
            mock_cursor
        )
        mock_query.database.db_engine_spec.run_multiple_statements_as_one = False
        mock_get_query.return_value = mock_query

        # set the query to CTAS
        mock_query.select_as_cta = True
        mock_query.ctas_method = CtasMethod.TABLE

        execute_sql_statements(
            query_id=1,
            rendered_query=sql,
            return_results=True,
            store_results=False,
            user_name="admin",
            session=mock_session,
            start_time=None,
            expand_data=False,
            log_params=None,
        )
        mock_execute_sql_statement.assert_has_calls(
            [
                mock.call(
                    "SET @value = 42",
                    mock_query,
                    "admin",
                    mock_session,
                    mock_cursor,
                    None,
                    False,
                ),
                mock.call(
                    "SELECT @value AS foo",
                    mock_query,
                    "admin",
                    mock_session,
                    mock_cursor,
                    None,
                    True,  # apply_ctas
                ),
            ]
        )

        # try invalid CTAS
        sql = "DROP TABLE my_table"
        with pytest.raises(SupersetErrorException) as excinfo:
            execute_sql_statements(
                query_id=1,
                rendered_query=sql,
                return_results=True,
                store_results=False,
                user_name="admin",
                session=mock_session,
                start_time=None,
                expand_data=False,
                log_params=None,
            )
        assert excinfo.value.error == SupersetError(
            message="CTAS (create table as select) can only be run with a query where the last statement is a SELECT. Please make sure your query has a SELECT as its last statement. Then, try running your query again.",
            error_type=SupersetErrorType.INVALID_CTAS_QUERY_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "issue_codes": [
                    {
                        "code": 1023,
                        "message": "Issue 1023 - The CTAS (create table as select) doesn't have a SELECT statement at the end. Please make sure your query has a SELECT as its last statement. Then, try running your query again.",
                    }
                ]
            },
        )

        # try invalid CVAS
        mock_query.ctas_method = CtasMethod.VIEW
        sql = """
            -- comment
            SET @value = 42;
            SELECT @value AS foo;
            -- comment
        """
        with pytest.raises(SupersetErrorException) as excinfo:
            execute_sql_statements(
                query_id=1,
                rendered_query=sql,
                return_results=True,
                store_results=False,
                user_name="admin",
                session=mock_session,
                start_time=None,
                expand_data=False,
                log_params=None,
            )
        assert excinfo.value.error == SupersetError(
            message="CVAS (create view as select) can only be run with a query with a single SELECT statement. Please make sure your query has only a SELECT statement. Then, try running your query again.",
            error_type=SupersetErrorType.INVALID_CVAS_QUERY_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "issue_codes": [
                    {
                        "code": 1024,
                        "message": "Issue 1024 - CVAS (create view as select) query has more than one statement.",
                    },
                    {
                        "code": 1025,
                        "message": "Issue 1025 - CVAS (create view as select) query is not a SELECT statement.",
                    },
                ]
            },
        )

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_json_soft_timeout(self):
        examples_db = get_example_database()
        if examples_db.backend == "sqlite":
            return

        self.login("admin")

        with mock.patch.object(
            examples_db.db_engine_spec, "handle_cursor"
        ) as handle_cursor:
            handle_cursor.side_effect = SoftTimeLimitExceeded()
            data = self.run_sql("SELECT * FROM birth_names LIMIT 1", "1")

        assert data == {
            "errors": [
                {
                    "message": (
                        "The query was killed after 21600 seconds. It might be too complex, "
                        "or the database might be under heavy load."
                    ),
                    "error_type": SupersetErrorType.SQLLAB_TIMEOUT_ERROR,
                    "level": ErrorLevel.ERROR,
                    "extra": {
                        "issue_codes": [
                            {
                                "code": 1026,
                                "message": "Issue 1026 - Query is too complex and takes too long to run.",
                            },
                            {
                                "code": 1027,
                                "message": "Issue 1027 - The database is currently running too many queries.",
                            },
                        ]
                    },
                }
            ]
        }

    def test_apply_limit_if_exists_when_incremented_limit_is_none(self):
        sql = """
                   SET @value = 42;
                   SELECT @value AS foo;
               """
        database = get_example_database()
        mock_query = mock.MagicMock()
        mock_query.limit = 300
        final_sql = apply_limit_if_exists(database, None, mock_query, sql)

        assert final_sql == sql

    def test_apply_limit_if_exists_when_increased_limit(self):
        sql = """
                   SET @value = 42;
                   SELECT @value AS foo;
               """
        database = get_example_database()
        mock_query = mock.MagicMock()
        mock_query.limit = 300
        final_sql = apply_limit_if_exists(database, 1000, mock_query, sql)
        assert "LIMIT 1000" in final_sql


@pytest.mark.parametrize("spec", [HiveEngineSpec, PrestoEngineSpec])
def test_cancel_query_implicit(spec: BaseEngineSpec) -> None:
    query = mock.MagicMock()
    query.database.db_engine_spec = spec
    assert cancel_query(query)
