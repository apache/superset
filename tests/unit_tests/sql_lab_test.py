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
from urllib.parse import parse_qs, urlparse
from uuid import UUID

import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.app import SupersetApp
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

    # Mock db.session.refresh to avoid AttributeError during session refresh
    mocker.patch("superset.sql_lab.db.session.refresh", return_value=None)

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


def test_execute_sql_statements_mutates_before_split_by_default(
    mocker: MockerFixture, app: SupersetApp
) -> None:
    """
    With the default `MUTATE_AFTER_SPLIT=False`, `execute_sql_statements` should
    mutate the whole, un-split query once before splitting it into individual
    statement blocks, for engines that execute statements individually rather
    than as one. Regression guard for issue #30169.
    """
    query = mocker.MagicMock()
    query.limit = 1
    query.database = mocker.MagicMock()
    query.database.cache_timeout = 100
    query.status = "RUNNING"
    query.select_as_cta = False
    query.database.allow_run_async = True
    query.database.db_engine_spec.engine = "sqlite"
    query.database.db_engine_spec.run_multiple_statements_as_one = False
    query.database.db_engine_spec.allows_sql_comments = True

    mutate_mock = mocker.patch.object(
        query.database,
        "mutate_sql_based_on_config",
        side_effect=lambda sql, **kw: sql,
    )

    mocker.patch("superset.sql_lab.get_query", return_value=query)
    mocker.patch("sys.getsizeof", return_value=10000000)
    mocker.patch(
        "superset.sql_lab._serialize_payload",
        side_effect=lambda payload, use_msgpack: "serialized_payload",
    )
    mocker.patch("superset.sql_lab.db.session.refresh", return_value=None)
    mocker.patch("superset.sql_lab.results_backend", return_value=True)

    execute_sql_statements(
        query_id=1,
        rendered_query="SELECT 1; SELECT 2;",
        return_results=True,
        store_results=True,
        start_time=None,
        expand_data=False,
        log_params={},
    )

    is_split_values = [
        call.kwargs.get("is_split") for call in mutate_mock.call_args_list
    ]
    # The mutator is called once on the whole, un-split query before splitting...
    assert is_split_values[0] is False
    first_call_sql = mutate_mock.call_args_list[0].args[0]
    assert "1" in first_call_sql
    assert "2" in first_call_sql
    # Both statements are present in a single, un-split call.
    assert first_call_sql.count("SELECT") == 2
    # ...and once again per already-split statement (a no-op when
    # `MUTATE_AFTER_SPLIT=False`, since `is_split=True` won't match the config).
    assert all(value is True for value in is_split_values[1:])
    assert len(is_split_values) == 3


def test_execute_sql_statements_mutates_per_statement_when_run_as_one(
    mocker: MockerFixture, app: SupersetApp
) -> None:
    """
    Engines that always run statements as a single block (e.g. BigQuery, Kusto)
    never see `is_split=True` in the per-block mutation call further down, so with
    `MUTATE_AFTER_SPLIT=True` the mutator must instead be applied to each
    statement up front, before they're joined into that single block.
    """
    mocker.patch.dict(app.config, {"MUTATE_AFTER_SPLIT": True})

    query = mocker.MagicMock()
    query.limit = 1
    query.database = mocker.MagicMock()
    query.database.cache_timeout = 100
    query.status = "RUNNING"
    query.select_as_cta = False
    query.database.allow_run_async = True
    query.database.db_engine_spec.engine = "bigquery"
    query.database.db_engine_spec.run_multiple_statements_as_one = True
    query.database.db_engine_spec.allows_sql_comments = True

    mutate_mock = mocker.patch.object(
        query.database,
        "mutate_sql_based_on_config",
        side_effect=lambda sql, **kw: sql,
    )

    mocker.patch("superset.sql_lab.get_query", return_value=query)
    mocker.patch("sys.getsizeof", return_value=10000000)
    mocker.patch(
        "superset.sql_lab._serialize_payload",
        side_effect=lambda payload, use_msgpack: "serialized_payload",
    )
    mocker.patch("superset.sql_lab.db.session.refresh", return_value=None)
    mocker.patch("superset.sql_lab.results_backend", return_value=True)

    execute_sql_statements(
        query_id=1,
        rendered_query="SELECT 1; SELECT 2;",
        return_results=True,
        store_results=True,
        start_time=None,
        expand_data=False,
        log_params={},
    )

    is_split_values = [
        call.kwargs.get("is_split") for call in mutate_mock.call_args_list
    ]
    # Mutated once per statement before joining into the single block...
    assert is_split_values[0] is True
    assert is_split_values[1] is True
    first_call_sql = mutate_mock.call_args_list[0].args[0]
    second_call_sql = mutate_mock.call_args_list[1].args[0]
    assert "1" in first_call_sql
    assert "2" in second_call_sql
    # ...and the later per-block call is a no-op (`is_split=False` never matches
    # `MUTATE_AFTER_SPLIT=True`), so the mutator isn't applied a second time.
    assert is_split_values[2] is False
    assert len(is_split_values) == 3


def test_execute_sql_statements_raises_when_mutator_strips_all_statements(
    mocker: MockerFixture, app: SupersetApp
) -> None:
    """
    A `SQL_QUERY_MUTATOR` that strips a query down to nothing (e.g. only
    comments/whitespace) must raise a clean error instead of silently
    producing an empty block list.
    """
    query = mocker.MagicMock()
    query.limit = 1
    query.database = mocker.MagicMock()
    query.database.cache_timeout = 100
    query.status = "RUNNING"
    query.select_as_cta = False
    query.database.allow_run_async = True
    query.database.db_engine_spec.engine = "sqlite"
    query.database.db_engine_spec.run_multiple_statements_as_one = False
    query.database.db_engine_spec.allows_sql_comments = True

    mocker.patch.object(
        query.database,
        "mutate_sql_based_on_config",
        side_effect=lambda sql, **kw: "-- just a comment",
    )

    mocker.patch("superset.sql_lab.get_query", return_value=query)
    mocker.patch("superset.sql_lab.db.session.refresh", return_value=None)
    mocker.patch("superset.sql_lab.results_backend", return_value=True)

    with pytest.raises(SupersetErrorException):
        execute_sql_statements(
            query_id=1,
            rendered_query="SELECT 1;",
            return_results=True,
            store_results=True,
            start_time=None,
            expand_data=False,
            log_params={},
        )


def test_execute_sql_statements_raises_when_mutator_strips_single_block(
    mocker: MockerFixture, app: SupersetApp
) -> None:
    """
    The empty-statement guard must also cover engines that run all statements
    as one block: with `MUTATE_AFTER_SPLIT=True` the per-statement mutator
    outputs are joined into a single block, and a comment-only/empty result
    must raise a clean error instead of reaching execution as an empty block.
    """
    mocker.patch.dict(app.config, {"MUTATE_AFTER_SPLIT": True})

    query = mocker.MagicMock()
    query.limit = 1
    query.database = mocker.MagicMock()
    query.database.cache_timeout = 100
    query.status = "RUNNING"
    query.select_as_cta = False
    query.database.allow_run_async = True
    query.database.db_engine_spec.engine = "bigquery"
    query.database.db_engine_spec.run_multiple_statements_as_one = True
    query.database.db_engine_spec.allows_sql_comments = True

    mocker.patch.object(
        query.database,
        "mutate_sql_based_on_config",
        side_effect=lambda sql, **kw: "-- just a comment",
    )

    mocker.patch("superset.sql_lab.get_query", return_value=query)
    mocker.patch("superset.sql_lab.db.session.refresh", return_value=None)
    mocker.patch("superset.sql_lab.results_backend", return_value=True)

    with pytest.raises(SupersetErrorException):
        execute_sql_statements(
            query_id=1,
            rendered_query="SELECT 1; SELECT 2;",
            return_results=True,
            store_results=True,
            start_time=None,
            expand_data=False,
            log_params={},
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
    mocker.patch(
        "superset.db_engine_specs.base.generate_code_verifier",
        return_value="xkBPVZoFChVcy3VZ2l5u7d0FZPTU-olO7HtsAOok2IUGigyoZ62tG_oldy2xg9_HdqPKrWUmKZLmU-CUqz_SQ",
    )
    mocker.patch("superset.daos.key_value.KeyValueDAO.delete_expired_entries")
    mocker.patch("superset.daos.key_value.KeyValueDAO.create_entry")
    mocker.patch("superset.db_engine_specs.base.db.session.commit")

    g = mocker.patch("superset.db_engine_specs.base.g")
    g.user = mocker.MagicMock()
    g.user.id = 42

    database = Database(
        id=1,
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
        encrypted_extra=json.dumps(oauth2_client_info),
    )
    database.db_engine_spec.oauth2_exception = OAuth2Error
    get_sqla_engine = mocker.patch.object(database, "get_sqla_engine")
    get_sqla_engine().__enter__().raw_connection.side_effect = OAuth2Error(
        "OAuth2 required"
    )

    query = mocker.MagicMock(select_as_cta=False, database=database)
    mocker.patch("superset.sql_lab.get_query", return_value=query)

    payload = get_sql_results(query_id=1, rendered_query="SELECT 1")
    assert payload["status"] == QueryStatus.FAILED
    assert payload["error"] == "You don't have permission to access the data."
    assert len(payload["errors"]) == 1

    error = payload["errors"][0]
    assert error["message"] == "You don't have permission to access the data."
    assert error["error_type"] == SupersetErrorType.OAUTH2_REDIRECT
    assert error["level"] == ErrorLevel.WARNING
    assert error["extra"]["tab_id"] == "fb11f528-6eba-4a8a-837e-6b0d39ee9187"
    assert error["extra"]["redirect_uri"] == "http://localhost/api/v1/database/oauth2/"

    # Parse the OAuth2 authorization URL and verify components individually,
    # since the JWT state and PKCE code_challenge are computed deterministically
    # from mocked inputs but their exact encoding depends on library internals.
    url = urlparse(error["extra"]["url"])
    assert url.scheme == "https"
    assert url.netloc == "abcd1234.snowflakecomputing.com"
    assert url.path == "/oauth/authorize"

    params = parse_qs(url.query)
    assert params["scope"] == ["refresh_token session:role:USERADMIN"]
    assert params["response_type"] == ["code"]
    assert params["redirect_uri"] == ["http://localhost/api/v1/database/oauth2/"]
    assert params["client_id"] == ["my_client_id"]
    assert params["code_challenge_method"] == ["S256"]

    # Verify PKCE code_challenge matches the mocked code_verifier
    from superset.utils.oauth2 import generate_code_challenge

    expected_code_challenge = generate_code_challenge(
        "xkBPVZoFChVcy3VZ2l5u7d0FZPTU-olO7HtsAOok2IUGigyoZ62tG_oldy2xg9_HdqPKrWUmKZLmU-CUqz_SQ"
    )
    assert params["code_challenge"] == [expected_code_challenge]


def test_apply_rls(mocker: MockerFixture) -> None:
    """
    Test the ``apply_rls`` helper function.
    """
    database = mocker.MagicMock()
    database.get_default_schema_for_query.return_value = "public"
    database.get_default_catalog.return_value = "examples"
    database.get_default_schema.return_value = "public"
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
            mocker.call(
                Table("t1", "public", "examples"),
                database,
                "examples",
                "public",
                exclude_dataset_id=None,
            ),
            mocker.call(
                Table("t2", "public", "examples"),
                database,
                "examples",
                "public",
                exclude_dataset_id=None,
            ),
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
    dataset.get_sqla_row_level_filters.assert_called_once_with(
        include_global_guest_rls=False
    )


def test_get_predicates_for_table_matches_null_schema_dataset(
    mocker: MockerFixture,
) -> None:
    """
    A dataset stored with a NULL schema is scoped to the database's default
    schema. When a query resolves to that same default schema, the lookup must
    still match the null-schema dataset so its RLS predicates are applied;
    otherwise the predicates are silently dropped (under-filtering). Mirrors the
    existing null-catalog fallback.
    """
    database = mocker.MagicMock()
    dataset = mocker.MagicMock()
    predicate = mocker.MagicMock()
    predicate.compile.return_value = "c1 = 1"
    dataset.get_sqla_row_level_filters.return_value = [predicate]
    db = mocker.patch("superset.utils.rls.db")
    db.session.query().filter().one_or_none.return_value = dataset

    table = Table("t1", "public", "examples")
    # query resolves to the default schema ("public")
    assert get_predicates_for_table(
        table, database, "examples", default_schema="public"
    ) == ["c1 = 1"]

    lookup = str(
        db.session.query()
        .filter.call_args[0][0]
        .compile(compile_kwargs={"literal_binds": True})
    )
    # the schema filter must also accept a null-schema dataset
    assert "tables.schema IS NULL" in lookup


def test_get_predicates_for_table_null_schema_scoped_to_default(
    mocker: MockerFixture,
) -> None:
    """
    The null-schema fallback only applies when the query resolves to the default
    schema. A query against a non-default schema must not broaden the lookup to
    null-schema datasets (which belong to the default schema), to avoid applying
    the wrong dataset's RLS.
    """
    database = mocker.MagicMock()
    db = mocker.patch("superset.utils.rls.db")
    db.session.query().filter().one_or_none.return_value = None

    table = Table("t1", "sales", "examples")
    # query is on a non-default schema; default schema is "public"
    get_predicates_for_table(table, database, "examples", default_schema="public")

    lookup = str(
        db.session.query()
        .filter.call_args[0][0]
        .compile(compile_kwargs={"literal_binds": True})
    )
    assert "tables.schema IS NULL" not in lookup


def test_get_predicates_for_table_excludes_self(mocker: MockerFixture) -> None:
    """
    When ``exclude_dataset_id`` is supplied, the lookup query must add an
    ``id != exclude_dataset_id`` filter so a virtual dataset whose
    ``table_name`` matches a table referenced inside its own SQL doesn't get
    its own RLS injected into the inner SQL (would double-apply on top of the
    outer WHERE). Regression test for the physical→virtual conversion bug.
    """
    database = mocker.MagicMock()
    db = mocker.patch("superset.utils.rls.db")
    db.session.query().filter().one_or_none.return_value = None

    table = Table("orders", "public", "examples")
    assert (
        get_predicates_for_table(table, database, "examples", exclude_dataset_id=42)
        == []
    )
    # The filter call should have received four base filters plus the exclusion
    # filter, i.e. five total positional args inside and_().
    filter_call = db.session.query().filter.call_args
    and_clause = filter_call.args[0]
    assert len(and_clause.clauses) == 5
