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
# pylint: disable=import-outside-toplevel, invalid-name, unused-argument, too-many-locals

import json  # noqa: TID251
from unittest.mock import MagicMock
from uuid import UUID

import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.common.db_query_status import QueryStatus
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import OAuth2Error, SupersetErrorException
from superset.models.core import Database
from superset.sql.parse import SQLStatement, Table
from superset.sql_lab import (
    execute_query,
    execute_sql_statements,
    get_sql_results,
)
from superset.utils.rls import apply_rls, get_predicates_for_table
from tests.conftest import with_config
from tests.unit_tests.models.core_test import oauth2_client_info


def test_execute_query(mocker: MockerFixture, app: None) -> None:
    """
    Simple test for `execute_sql_statement`.
    """
    query = mocker.MagicMock()
    query.executed_sql = "SELECT 42 AS answer"

    query.limit = 1
    database = query.database
    database.allow_dml = False
    db_engine_spec = database.db_engine_spec
    db_engine_spec.fetch_data.return_value = [(42,)]

    cursor = mocker.MagicMock()
    SupersetResultSet = mocker.patch("superset.sql_lab.SupersetResultSet")  # noqa: N806

    execute_query(query, cursor=cursor, log_params={})

    db_engine_spec.execute_with_cursor.assert_called_with(
        cursor,
        "SELECT 42 AS answer",
        query,
    )
    SupersetResultSet.assert_called_with([(42,)], cursor.description, db_engine_spec)


@with_config(
    {
        "SQLLAB_PAYLOAD_MAX_MB": 50,
        "DISALLOWED_SQL_FUNCTIONS": {},
        "SQLLAB_CTAS_NO_LIMIT": False,
        "SQL_MAX_ROW": 100000,
        "QUERY_LOGGER": None,
        "TROUBLESHOOTING_LINK": None,
        "STATS_LOGGER": MagicMock(),
    }
)
def test_execute_sql_statement_exceeds_payload_limit(
    mocker: MockerFixture, app
) -> None:
    """
    Test for `execute_sql_statements` when the result payload size exceeds the limit.
    """

    # Mock the query object and database
    query = mocker.MagicMock()
    query.limit = 1
    query.database = mocker.MagicMock()
    query.database.cache_timeout = 100
    query.status = "RUNNING"
    query.select_as_cta = False
    query.database.allow_run_async = True

    # Mock get_query to return our mocked query object
    mocker.patch("superset.sql_lab.get_query", return_value=query)

    # Mock sys.getsizeof to simulate a large payload size
    mocker.patch("sys.getsizeof", return_value=100000000)  # 100 MB

    # Mock _serialize_payload
    def mock_serialize_payload(payload, use_msgpack):
        return "serialized_payload"

    mocker.patch(
        "superset.sql_lab._serialize_payload", side_effect=mock_serialize_payload
    )

    # Mock db.session.refresh to avoid AttributeError during session refresh
    mocker.patch("superset.sql_lab.db.session.refresh", return_value=None)

    # Mock the results backend to avoid "Results backend is not configured" error
    mocker.patch("superset.sql_lab.results_backend", return_value=True)

    # Test that the exception is raised when the payload exceeds the limit
    with pytest.raises(SupersetErrorException):
        execute_sql_statements(
            query_id=1,
            rendered_query="SELECT 42 AS answer",
            return_results=True,  # Simulate that results are being returned
            store_results=True,  # Not storing results but returning them
            start_time=None,
            expand_data=False,
            log_params={},
        )


@with_config(
    {
        "SQLLAB_PAYLOAD_MAX_MB": 50,
        "DISALLOWED_SQL_FUNCTIONS": {},
        "SQLLAB_CTAS_NO_LIMIT": False,
        "SQL_MAX_ROW": 100000,
        "QUERY_LOGGER": None,
        "TROUBLESHOOTING_LINK": None,
        "STATS_LOGGER": MagicMock(),
    }
)
def test_execute_sql_statement_within_payload_limit(mocker: MockerFixture, app) -> None:
    """
    Test for `execute_sql_statements` when the result payload size is within the limit,
    and check if the flow executes smoothly without raising any exceptions.
    """

    # Mock the query object and database
    query = mocker.MagicMock()
    query.limit = 1
    query.database = mocker.MagicMock()
    query.database.cache_timeout = 100
    query.status = "RUNNING"
    query.select_as_cta = False
    query.database.allow_run_async = True

    # Mock get_query to return our mocked query object
    mocker.patch("superset.sql_lab.get_query", return_value=query)

    # Mock sys.getsizeof to simulate a payload size that is within the limit
    mocker.patch("sys.getsizeof", return_value=10000000)  # 10 MB (within limit)

    # Mock _serialize_payload
    def mock_serialize_payload(payload, use_msgpack):
        return "serialized_payload"

    mocker.patch(
        "superset.sql_lab._serialize_payload", side_effect=mock_serialize_payload
    )

    # Mock db.session.refresh to avoid AttributeError during session refresh
    mocker.patch("superset.sql_lab.db.session.refresh", return_value=None)

    # Mock the results backend to avoid "Results backend is not configured" error
    mocker.patch("superset.sql_lab.results_backend", return_value=True)

    # Test that no exception is raised and the function executes smoothly
    try:
        execute_sql_statements(
            query_id=1,
            rendered_query="SELECT 42 AS answer",
            return_results=True,  # Simulate that results are being returned
            store_results=True,  # Not storing results but returning them
            start_time=None,
            expand_data=False,
            log_params={},
        )
    except SupersetErrorException:
        pytest.fail(
            "SupersetErrorException should not have been raised for payload within the limit"  # noqa: E501
        )


@freeze_time("2021-04-01T00:00:00Z")
def test_get_sql_results_oauth2(mocker: MockerFixture, app) -> None:
    """
    Test that `get_sql_results` works with OAuth2.
    """
    app_context = app.test_request_context()
    app_context.push()

    mocker.patch(
        "superset.db_engine_specs.base.uuid4",
        return_value=UUID("fb11f528-6eba-4a8a-837e-6b0d39ee9187"),
    )

    g = mocker.patch("superset.db_engine_specs.base.g")
    g.user = mocker.MagicMock()
    g.user.id = 42

    database = Database(
        id=1,
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
        encrypted_extra=json.dumps(oauth2_client_info),
    )
    database.db_engine_spec.oauth2_exception = OAuth2Error  # type: ignore
    get_sqla_engine = mocker.patch.object(database, "get_sqla_engine")
    get_sqla_engine().__enter__().raw_connection.side_effect = OAuth2Error(
        "OAuth2 required"
    )

    query = mocker.MagicMock(select_as_cta=False, database=database)
    mocker.patch("superset.sql_lab.get_query", return_value=query)

    payload = get_sql_results(query_id=1, rendered_query="SELECT 1")
    assert payload == {
        "status": QueryStatus.FAILED,
        "error": "You don't have permission to access the data.",
        "errors": [
            {
                "message": "You don't have permission to access the data.",
                "error_type": SupersetErrorType.OAUTH2_REDIRECT,
                "level": ErrorLevel.WARNING,
                "extra": {
                    "url": "https://abcd1234.snowflakecomputing.com/oauth/authorize?scope=refresh_token+session%3Arole%3AUSERADMIN&access_type=offline&include_granted_scopes=false&response_type=code&state=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9%252EeyJleHAiOjE2MTcyMzU1MDAsImRhdGFiYXNlX2lkIjoxLCJ1c2VyX2lkIjo0MiwiZGVmYXVsdF9yZWRpcmVjdF91cmkiOiJodHRwOi8vbG9jYWxob3N0L2FwaS92MS9kYXRhYmFzZS9vYXV0aDIvIiwidGFiX2lkIjoiZmIxMWY1MjgtNmViYS00YThhLTgzN2UtNmIwZDM5ZWU5MTg3In0%252E7nLkei6-V8sVk_Pgm8cFhk0tnKRKayRE1Vc7RxuM9mw&redirect_uri=http%3A%2F%2Flocalhost%2Fapi%2Fv1%2Fdatabase%2Foauth2%2F&client_id=my_client_id&prompt=consent",
                    "tab_id": "fb11f528-6eba-4a8a-837e-6b0d39ee9187",
                    "redirect_uri": "http://localhost/api/v1/database/oauth2/",
                },
            }
        ],
    }


def test_apply_rls(mocker: MockerFixture) -> None:
    """
    Test the ``apply_rls`` helper function.
    """
    database = mocker.MagicMock()
    database.get_default_schema_for_query.return_value = "public"
    database.get_default_catalog.return_value = "examples"
    database.db_engine_spec = PostgresEngineSpec
    get_predicates_for_table = mocker.patch(
        "superset.utils.rls.get_predicates_for_table",
        side_effect=[["c1 = 1"], ["c2 = 2"]],
    )

    parsed_statement = SQLStatement("SELECT * FROM t1, t2", "postgresql")
    parsed_statement.tables = sorted(parsed_statement.tables, key=lambda x: x.table)  # type: ignore

    apply_rls(database, "examples", "public", parsed_statement)

    get_predicates_for_table.assert_has_calls(
        [
            mocker.call(Table("t1", "public", "examples"), database, "examples"),
            mocker.call(Table("t2", "public", "examples"), database, "examples"),
        ]
    )

    assert (
        parsed_statement.format()
        == """
SELECT
  *
FROM (
  SELECT
    *
  FROM t1
  WHERE
    c1 = 1
) AS "t1", (
  SELECT
    *
  FROM t2
  WHERE
    c2 = 2
) AS "t2"
        """.strip()
    )


def test_get_predicates_for_table(mocker: MockerFixture) -> None:
    """
    Test the ``get_predicates_for_table`` helper function.
    """
    database = mocker.MagicMock()
    dataset = mocker.MagicMock()
    predicate = mocker.MagicMock()
    predicate.compile.return_value = "c1 = 1"
    dataset.get_sqla_row_level_filters.return_value = [predicate]
    db = mocker.patch("superset.utils.rls.db")
    db.session.query().filter().one_or_none.return_value = dataset

    table = Table("t1", "public", "examples")
    assert get_predicates_for_table(table, database, "examples") == ["c1 = 1"]
