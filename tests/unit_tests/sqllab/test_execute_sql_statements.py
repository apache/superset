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

from unittest import mock
import pytest

from tests.common.test_app import app
from superset import db
from superset.db_engine_specs import BaseEngineSpec
from superset.db_engine_specs.hive import HiveEngineSpec
from superset.db_engine_specs.presto import PrestoEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException
from superset.models.sql_lab import Query
from superset.sql_lab import (
    apply_limit_if_exists,
    execute_sql_statement,
    execute_sql_statements,
)
from superset.sql_parse import CtasMethod
from superset.utils.core import get_example_database
from tests.common.base_tests import SupersetTestCase


class TestSqlLab(SupersetTestCase):
    @mock.patch("superset.sql_lab.get_query")
    @mock.patch("superset.sql_lab.execute_sql_statement")
    def test_execute_sql_statements(
        self, mock_execute_sql_statement, mock_get_query
    ) -> None:
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
    def test_execute_sql_statements_no_results_backend(self, mock_get_query) -> None:
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
    ) -> None:
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

    def test_apply_limit_if_exists_when_incremented_limit_is_none(self) -> None:
        sql = """
                   SET @value = 42;
                   SELECT @value AS foo;
               """
        database = get_example_database()
        mock_query = mock.MagicMock()
        mock_query.limit = 300
        final_sql = apply_limit_if_exists(database, None, mock_query, sql)

        assert final_sql == sql

    def test_apply_limit_if_exists_when_increased_limit(self) -> None:
        sql = """
                   SET @value = 42;
                   SELECT @value AS foo;
               """
        database = get_example_database()
        mock_query = mock.MagicMock()
        mock_query.limit = 300
        final_sql = apply_limit_if_exists(database, 1000, mock_query, sql)
        assert "LIMIT 1000" in final_sql

    def test_sql_mutator(self) -> None:
        sql = "select * from birth_name"
        sql_with_comment = """-- start comment
            select * from birth_names limit 1
            -- end comment
            """
        query = Query()
        query.id = 1
        query.database_id = 1
        query.client_id = 1
        query.start_time = 1640526534
        db.session.add(query)
        db.session.commit()

        query.database.db_engine_spec.execute = mock.MagicMock()
        query.database.db_engine_spec.handle_cursor = mock.MagicMock()
        query.database.db_engine_spec.fetch_data = mock.MagicMock(
            return_value=[
                ("1960-01-01 00:00:00.000000", "girl", "name", 1, "some state", 0, 10),
            ]
        )
        cursor = mock.MagicMock()
        cursor.description = [
            "ds",
            "gender",
            "name",
            "num",
            "state",
            "num_boys",
            "num_girls",
        ]

        mutator = mock.MagicMock(return_value=sql_with_comment)
        with mock.patch("superset.sql_lab.SQL_QUERY_MUTATOR", mutator):
            data = execute_sql_statement(
                sql, query, "admin", db.session, cursor, {}, True
            )

        assert data.size == 1
        mutator.assert_called_once()
        assert query.executed_sql == sql_with_comment

        db.session.delete(query)
        db.session.commit()


@pytest.mark.parametrize("spec", [HiveEngineSpec, PrestoEngineSpec])
def test_cancel_query_implicit(spec: BaseEngineSpec) -> None:
    from superset.sql_lab import cancel_query

    query = mock.MagicMock()
    query.database.db_engine_spec = spec
    assert cancel_query(query)


# TODO (mayur): these 2 tests gives instance has been deleted when loading birth name slices fixture data.
# but we haven't flushed the session,so don't know why instance goes in Deleted state.

# @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
# def test_allow_dml_statements(app, session):
#     sql = "DELETE from birth_names"
#     query = Query()
#     query.id = 1
#     query.database_id = 1
#     query.client_id = 1
#     db.session.add(query)
#     db.session.commit()

#     with pytest.raises(SupersetErrorException):
#         execute_sql_statement(sql, query, "me", session, None, {}, False)

#     db.session.delete(query)
#     db.session.commit()

# @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
# def test_apply_ctas(app):
#     sql = "select * from birth_names"
#     query = Query()
#     query.id = 1
#     query.database_id = 1
#     query.client_id = 1
#     query.start_time = 1640526534
#     query.tmp_table_name = "tmp_table"
#     db.session.add(query)
#     db.session.commit()

#     query.database.allow_dml = True

#     engine = query.database.get_sqla_engine(
#     schema=query.schema,
#     nullpool=True,
#     user_name="admin",
#     source=QuerySource.SQL_LAB,
# )
#     with closing(engine.raw_connection()) as conn:
#         cursor = conn.cursor()
#         execute_sql_statement(sql, query, "admin", db.session, cursor, {}, True)

#     assert query.select_as_cta_used == True
#     assert query.database.has_table_by_name("tmp_table")

#     db.session.delete(query)
#     db.session.commit()
