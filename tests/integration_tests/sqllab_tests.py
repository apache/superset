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

from datetime import datetime
from textwrap import dedent

import pytest
from celery.exceptions import SoftTimeLimitExceeded
from parameterized import parameterized
from unittest import mock
import prison

from freezegun import freeze_time
from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable  # noqa: F401
from superset.db_engine_specs import BaseEngineSpec
from superset.db_engine_specs.hive import HiveEngineSpec
from superset.db_engine_specs.presto import PrestoEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException
from superset.models.sql_lab import Query, SavedQuery
from superset.result_set import SupersetResultSet
from superset.sqllab.limiting_factor import LimitingFactor
from superset.sql_lab import (
    cancel_query,
    execute_sql_statements,
    apply_limit_if_exists,
)
from superset.sql_parse import CtasMethod
from superset.utils.core import backend
from superset.utils import json
from superset.utils.json import datetime_to_epoch  # noqa: F401
from superset.utils.database import get_example_database, get_main_database

from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.conftest import CTAS_SCHEMA_NAME
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    GAMMA_SQLLAB_NO_DATA_USERNAME,
    GAMMA_SQLLAB_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.fixtures.users import create_gamma_sqllab_no_data  # noqa: F401

QUERY_1 = "SELECT * FROM birth_names LIMIT 1"
QUERY_2 = "SELECT * FROM NO_TABLE"
QUERY_3 = "SELECT * FROM birth_names LIMIT 10"


@pytest.mark.sql_json_flow
class TestSqlLab(SupersetTestCase):
    """Testings for Sql Lab"""

    def run_some_queries(self):
        db.session.query(Query).delete()
        self.run_sql(QUERY_1, client_id="client_id_1", username="admin")
        self.run_sql(QUERY_2, client_id="client_id_2", username="admin")
        self.run_sql(QUERY_3, client_id="client_id_3", username="gamma_sqllab")

    def tearDown(self):
        db.session.query(Query).delete()
        db.session.commit()
        db.session.close()
        super().tearDown()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_json(self):
        examples_db = get_example_database()
        engine_name = examples_db.db_engine_spec.engine_name

        self.login(ADMIN_USERNAME)

        data = self.run_sql("SELECT * FROM birth_names LIMIT 10", "1")
        assert 0 < len(data["data"])

        data = self.run_sql("SELECT * FROM nonexistent_table", "2")
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
        self.login(ADMIN_USERNAME)

        data = self.run_sql("DELETE FROM birth_names", "1")
        assert data == {
            "errors": [
                {
                    "message": (
                        "This database does not allow for DDL/DML, and the query "
                        "could not be parsed to confirm it is a read-only query. Please "
                        "contact your administrator for more assistance."
                    ),
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
        self.login(ADMIN_USERNAME)

        sql_statement = "SELECT * FROM birth_names LIMIT 10"
        examples_db_id = get_example_database().id
        saved_query = SavedQuery(db_id=examples_db_id, sql=sql_statement)
        db.session.add(saved_query)
        db.session.commit()

        with freeze_time(datetime.now().isoformat(timespec="seconds")):
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

            self.login(ADMIN_USERNAME)
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
            with examples_db.get_sqla_engine() as engine:
                data = engine.execute(
                    f"SELECT * FROM admin_database.{tmp_table_name}"
                ).fetchall()
                names_count = engine.execute(
                    f"SELECT COUNT(*) FROM birth_names"  # noqa: F541
                ).first()
                assert names_count[0] == len(
                    data
                )  # SQL_MAX_ROW not applied due to the SQLLAB_CTAS_NO_LIMIT set to True

                # cleanup
                engine.execute(f"DROP {ctas_method} admin_database.{tmp_table_name}")
                examples_db.allow_ctas = old_allow_ctas
                db.session.commit()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_multi_sql(self):
        self.login(ADMIN_USERNAME)

        multi_sql = """
        SELECT * FROM birth_names LIMIT 1;
        SELECT * FROM birth_names LIMIT 2;
        """
        data = self.run_sql(multi_sql, "2234")
        assert 0 < len(data["data"])

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_explain(self):
        self.login(ADMIN_USERNAME)

        data = self.run_sql("EXPLAIN SELECT * FROM birth_names", "1")
        assert 0 < len(data["data"])

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

        data = self.run_sql(QUERY_1, "1", username="Gagarin")
        db.session.query(Query).delete()
        db.session.commit()
        assert 0 < len(data["data"])

    def test_sqllab_has_access(self):
        for username in (ADMIN_USERNAME, GAMMA_SQLLAB_USERNAME):
            self.login(username)
            for endpoint in ("/sqllab/", "/sqllab/history/"):
                resp = self.client.get(endpoint)
                assert 200 == resp.status_code

    def test_sqllab_no_access(self):
        self.login(GAMMA_USERNAME)
        for endpoint in ("/sqllab/", "/sqllab/history/"):
            resp = self.client.get(endpoint)
            # Redirects to the main page
            assert 302 == resp.status_code

    def test_sql_json_schema_access(self):
        examples_db = get_example_database()
        db_backend = examples_db.backend
        if db_backend == "sqlite":
            # sqlite doesn't support database creation
            return

        catalog = examples_db.get_default_catalog()
        sqllab_test_db_schema_permission_view = (
            security_manager.add_permission_view_menu(
                "schema_access",
                security_manager.get_schema_perm(
                    examples_db.name,
                    catalog,
                    CTAS_SCHEMA_NAME,
                ),
            )
        )
        schema_perm_role = security_manager.add_role("SchemaPermission")
        security_manager.add_permission_role(
            schema_perm_role, sqllab_test_db_schema_permission_view
        )
        self.create_user_with_roles(
            "SchemaUser", ["SchemaPermission", "Gamma", "sql_lab"]
        )

        with examples_db.get_sqla_engine() as engine:
            engine.execute(
                f"CREATE TABLE IF NOT EXISTS {CTAS_SCHEMA_NAME}.test_table AS SELECT 1 as c1, 2 as c2"
            )

        data = self.run_sql(
            f"SELECT * FROM {CTAS_SCHEMA_NAME}.test_table", "3", username="SchemaUser"
        )
        assert 1 == len(data["data"])

        data = self.run_sql(
            f"SELECT * FROM {CTAS_SCHEMA_NAME}.test_table",
            "4",
            username="SchemaUser",
            schema=CTAS_SCHEMA_NAME,
        )
        assert 1 == len(data["data"])

        # postgres needs a schema as a part of the table name.
        if db_backend == "mysql":
            data = self.run_sql(
                "SELECT * FROM test_table",
                "5",
                username="SchemaUser",
                schema=CTAS_SCHEMA_NAME,
            )
            assert 1 == len(data["data"])

        db.session.query(Query).delete()
        with get_example_database().get_sqla_engine() as engine:
            engine.execute(f"DROP TABLE IF EXISTS {CTAS_SCHEMA_NAME}.test_table")
        db.session.commit()

    def test_alias_duplicate(self):
        self.run_sql(
            "SELECT name as col, gender as col FROM birth_names LIMIT 10",
            client_id="2e2df3",
            username=ADMIN_USERNAME,
            raise_on_error=True,
        )

    def test_ps_conversion_no_dict(self):
        cols = [["string_col", "string"], ["int_col", "int"], ["float_col", "float"]]
        data = [["a", 4, 4.0]]
        results = SupersetResultSet(data, cols, BaseEngineSpec)

        assert len(data) == results.size
        assert len(cols) == len(results.columns)

    def test_pa_conversion_tuple(self):
        cols = ["string_col", "int_col", "list_col", "float_col"]
        data = [("Text", 111, [123], 1.0)]
        results = SupersetResultSet(data, cols, BaseEngineSpec)

        assert len(data) == results.size
        assert len(cols) == len(results.columns)

    def test_pa_conversion_dict(self):
        cols = ["string_col", "dict_col", "int_col"]
        data = [["a", {"c1": 1, "c2": 2, "c3": 3}, 4]]
        results = SupersetResultSet(data, cols, BaseEngineSpec)

        assert len(data) == results.size
        assert len(cols) == len(results.columns)

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_sql_limit(self):
        self.login(ADMIN_USERNAME)
        test_limit = 1
        data = self.run_sql("SELECT * FROM birth_names", client_id="sql_limit_1")
        assert len(data["data"]) > test_limit
        data = self.run_sql(
            "SELECT * FROM birth_names", client_id="sql_limit_2", query_limit=test_limit
        )
        assert len(data["data"]) == test_limit

        data = self.run_sql(
            f"SELECT * FROM birth_names LIMIT {test_limit}",
            client_id="sql_limit_3",
            query_limit=test_limit + 1,
        )
        assert len(data["data"]) == test_limit
        assert data["query"]["limitingFactor"] == LimitingFactor.QUERY

        data = self.run_sql(
            f"SELECT * FROM birth_names LIMIT {test_limit + 1}",
            client_id="sql_limit_4",
            query_limit=test_limit,
        )
        assert len(data["data"]) == test_limit
        assert data["query"]["limitingFactor"] == LimitingFactor.DROPDOWN

        data = self.run_sql(
            f"SELECT * FROM birth_names LIMIT {test_limit}",
            client_id="sql_limit_5",
            query_limit=test_limit,
        )
        assert len(data["data"]) == test_limit
        assert data["query"]["limitingFactor"] == LimitingFactor.QUERY_AND_DROPDOWN

        data = self.run_sql(
            "SELECT * FROM birth_names",
            client_id="sql_limit_6",
            query_limit=10000,
        )
        assert len(data["data"]) == 1200
        assert data["query"]["limitingFactor"] == LimitingFactor.NOT_LIMITED

        data = self.run_sql(
            "SELECT * FROM birth_names",
            client_id="sql_limit_7",
            query_limit=1200,
        )
        assert len(data["data"]) == 1200
        assert data["query"]["limitingFactor"] == LimitingFactor.NOT_LIMITED

    @pytest.mark.usefixtures("load_birth_names_data")
    def test_query_api_filter(self) -> None:
        """
        Test query api without can_only_access_owned_queries perm added to
        Admin and make sure all queries show up.
        """
        self.run_some_queries()
        self.login(ADMIN_USERNAME)

        url = "/api/v1/query/"
        data = self.get_json_resp(url)
        admin = security_manager.find_user("admin")
        gamma_sqllab = security_manager.find_user("gamma_sqllab")
        assert 3 == len(data["result"])
        user_queries = [
            result.get("user").get("first_name") for result in data["result"]
        ]
        assert admin.first_name in user_queries
        assert gamma_sqllab.first_name in user_queries

    @pytest.mark.usefixtures("load_birth_names_data")
    def test_query_api_can_access_all_queries(self) -> None:
        """
        Test query api with can_access_all_queries perm added to
        gamma and make sure all queries show up.
        """
        # Add all_query_access perm to Gamma user
        all_queries_view = security_manager.find_permission_view_menu(
            "all_query_access", "all_query_access"
        )

        security_manager.add_permission_role(
            security_manager.find_role("gamma_sqllab"), all_queries_view
        )
        db.session.commit()

        self.run_some_queries()
        self.login(GAMMA_SQLLAB_USERNAME)
        url = "/api/v1/query/"
        data = self.get_json_resp(url)
        assert 3 == len(data["result"])

        # Remove all_query_access from gamma sqllab
        all_queries_view = security_manager.find_permission_view_menu(
            "all_query_access", "all_query_access"
        )
        security_manager.del_permission_role(
            security_manager.find_role("gamma_sqllab"), all_queries_view
        )

        db.session.commit()

    def test_query_api_can_access_sql_editor_id_associated_queries(self) -> None:
        """
        Test query api with sql_editor_id filter to
        gamma and make sure sql editor associated queries show up.
        """
        self.login(GAMMA_SQLLAB_USERNAME)

        # create a tab
        data = {
            "queryEditor": json.dumps(
                {
                    "title": "Untitled Query 1",
                    "dbId": 1,
                    "schema": None,
                    "autorun": False,
                    "sql": "SELECT ...",
                    "queryLimit": 1000,
                }
            )
        }
        resp = self.get_json_resp("/tabstateview/", data=data)
        tab_state_id = resp["id"]
        # run a query in the created tab
        self.run_sql(
            "SELECT 1",
            "client_id_1",
            raise_on_error=True,
            sql_editor_id=str(tab_state_id),
        )
        self.run_sql(
            "SELECT 2",
            "client_id_2",
            raise_on_error=True,
            sql_editor_id=str(tab_state_id),
        )
        # run an orphan query (no tab)
        self.run_sql(
            "SELECT 3",
            "client_id_3",
            raise_on_error=True,
        )

        arguments = {
            "filters": [
                {"col": "sql_editor_id", "opr": "eq", "value": str(tab_state_id)}
            ]
        }
        url = f"/api/v1/query/?q={prison.dumps(arguments)}"
        assert {"SELECT 1", "SELECT 2"} == {
            r.get("sql") for r in self.get_json_resp(url)["result"]
        }

    @pytest.mark.usefixtures("load_birth_names_data")
    def test_query_admin_can_access_all_queries(self) -> None:
        """
        Test query api with all_query_access perm added to
        Admin and make sure only Admin queries show up. This is the default
        """
        self.run_some_queries()
        self.login(ADMIN_USERNAME)

        url = "/api/v1/query/"
        data = self.get_json_resp(url)
        assert 3 == len(data["result"])

    def test_api_database(self):
        self.login(ADMIN_USERNAME)
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

        assert {"examples", "fake_db_100", "main"} == {
            r.get("database_name") for r in self.get_json_resp(url)["result"]
        }
        self.delete_fake_db()

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"ENABLE_TEMPLATE_PROCESSING": True},
        clear=True,
    )
    def test_sql_json_parameter_error(self):
        self.login(ADMIN_USERNAME)

        data = self.run_sql(
            "SELECT * FROM birth_names WHERE state = '{{ state }}' LIMIT 10",
            "1",
            template_params=json.dumps({"state": "CA"}),
        )
        assert data["status"] == "success"

        data = self.run_sql(
            "SELECT * FROM birth_names WHERE state = '{{ state }}' -- blabblah {{ extra1 }}\nLIMIT 10",
            "3",
            template_params=json.dumps({"state": "CA", "extra1": "comment"}),
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

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"ENABLE_TEMPLATE_PROCESSING": True},
        clear=True,
    )
    def test_sql_json_parameter_authorized(self):
        self.login(ADMIN_USERNAME)

        data = self.run_sql(
            "SELECT name FROM {{ table }} LIMIT 10",
            "3",
            template_params=json.dumps({"table": "birth_names"}),
        )
        assert data["status"] == "success"

    @pytest.mark.usefixtures("create_gamma_sqllab_no_data")
    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    @mock.patch.dict(
        "superset.extensions.feature_flag_manager._feature_flags",
        {"ENABLE_TEMPLATE_PROCESSING": True},
        clear=True,
    )
    def test_sql_json_parameter_forbidden(self):
        self.login(GAMMA_SQLLAB_NO_DATA_USERNAME)

        data = self.run_sql(
            "SELECT name FROM {{ table }} LIMIT 10",
            "4",
            template_params=json.dumps({"table": "birth_names"}),
        )
        assert data["errors"][0]["message"] == (
            "The database referenced in this query was not found."
            " Please contact an administrator for further assistance or try again."
        )
        assert data["errors"][0]["error_type"] == "GENERIC_BACKEND_ERROR"

    @mock.patch("superset.sql_lab.db")
    @mock.patch("superset.sql_lab.get_query")
    @mock.patch("superset.sql_lab.execute_sql_statement")
    def test_execute_sql_statements(
        self,
        mock_execute_sql_statement,
        mock_get_query,
        mock_db,
    ):
        sql = dedent(
            """
            -- comment
            SET @value = 42;
            SELECT /*+ hint */ @value AS foo;
        """
        )
        mock_db = mock.MagicMock()  # noqa: F841
        mock_query = mock.MagicMock()
        mock_query.database.allow_run_async = False
        mock_cursor = mock.MagicMock()
        mock_query.database.get_raw_connection().__enter__().cursor.return_value = (
            mock_cursor
        )
        mock_query.database.db_engine_spec.run_multiple_statements_as_one = False
        mock_get_query.return_value = mock_query

        execute_sql_statements(
            query_id=1,
            rendered_query=sql,
            return_results=True,
            store_results=False,
            start_time=None,
            expand_data=False,
            log_params=None,
        )
        mock_execute_sql_statement.assert_has_calls(
            [
                mock.call(
                    "-- comment\nSET @value = 42",
                    mock_query,
                    mock_cursor,
                    None,
                    False,
                ),
                mock.call(
                    "SELECT /*+ hint */ @value AS foo",
                    mock_query,
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
        sql = dedent(
            """
            -- comment
            SET @value = 42;
            SELECT /*+ hint */ @value AS foo;
        """
        )
        mock_query = mock.MagicMock()
        mock_query.database.allow_run_async = True
        mock_cursor = mock.MagicMock()
        mock_query.database.get_raw_connection().__enter__().cursor.return_value = (
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

    @mock.patch("superset.sql_lab.db")
    @mock.patch("superset.sql_lab.get_query")
    @mock.patch("superset.sql_lab.execute_sql_statement")
    def test_execute_sql_statements_ctas(
        self,
        mock_execute_sql_statement,
        mock_get_query,
        mock_db,
    ):
        sql = dedent(
            """
            -- comment
            SET @value = 42;
            SELECT /*+ hint */ @value AS foo;
        """
        )
        mock_db = mock.MagicMock()  # noqa: F841
        mock_query = mock.MagicMock()
        mock_query.database.allow_run_async = False
        mock_cursor = mock.MagicMock()
        mock_query.database.get_raw_connection().__enter__().cursor.return_value = (
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
            start_time=None,
            expand_data=False,
            log_params=None,
        )
        mock_execute_sql_statement.assert_has_calls(
            [
                mock.call(
                    "-- comment\nSET @value = 42",
                    mock_query,
                    mock_cursor,
                    None,
                    False,
                ),
                mock.call(
                    "SELECT /*+ hint */ @value AS foo",
                    mock_query,
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
        sql = dedent(
            """
            -- comment
            SET @value = 42;
            SELECT /*+ hint */ @value AS foo;
        """
        )
        with pytest.raises(SupersetErrorException) as excinfo:
            execute_sql_statements(
                query_id=1,
                rendered_query=sql,
                return_results=True,
                store_results=False,
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

        self.login(ADMIN_USERNAME)

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
