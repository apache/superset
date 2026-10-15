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
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse
from uuid import UUID

import pandas as pd
import pytest
from flask import g, has_request_context, session
from freezegun import freeze_time
from pytest_mock import MockerFixture
from sqlalchemy import text
from sqlalchemy.orm import Session

from superset.app import SupersetApp
from superset.common.db_query_status import QueryStatus
from superset.db_engine_specs import BaseEngineSpec
from superset.db_engine_specs.postgres import PostgresEngineSpec
from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import OAuth2Error, SupersetErrorException
from superset.models.core import Database
from superset.sql.parse import SQLStatement, Table
from superset.sql_lab import (
    _serialize_and_expand_data,
    _serialize_payload,
    execute_query,
    execute_sql_statements,
    get_query,
    get_sql_results,
    SqlLabException,
)
from superset.utils import json as superset_json
from superset.utils.rls import apply_rls, get_predicates_for_table
from tests.conftest import with_config
from tests.unit_tests.models.core_test import oauth2_client_info


def test_sql_lab_and_view_json_normalize_decimal_nonfinite() -> None:
    """Sync SQL Lab and its view consumer share strict Decimal projection."""
    from superset.views.utils import _deserialize_results_payload

    finite = Decimal("0.10000000000000000001")
    result_set = MagicMock()
    result_set.columns = [{"name": "value"}]
    result_set.to_pandas_df.return_value = pd.DataFrame(
        {
            "value": pd.Series(
                [
                    Decimal("NaN"),
                    Decimal("sNaN"),
                    Decimal("Infinity"),
                    Decimal("-Infinity"),
                    finite,
                ],
                dtype=object,
            )
        }
    )

    data, selected_columns, all_columns, expanded_columns = _serialize_and_expand_data(
        result_set, BaseEngineSpec()
    )
    assert isinstance(data, list)
    assert [row["value"] for row in data] == [None, None, None, None, str(finite)]

    payload = {
        "data": data,
        "selected_columns": selected_columns,
        "columns": all_columns,
        "expanded_columns": expanded_columns,
    }
    serialized = _serialize_payload(payload)
    assert isinstance(serialized, str)
    assert "NaN" not in serialized
    assert "Infinity" not in serialized
    assert _deserialize_results_payload(serialized, MagicMock()) == (
        superset_json.loads(serialized)
    )


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


def test_get_query_rolls_back_session_before_retrying(
    mocker: MockerFixture, app: SupersetApp
) -> None:
    """
    A broken transaction (e.g. `PendingRollbackError` following a failed flush)
    leaves the session unusable until `session.rollback()` is called, so without
    it every `backoff` retry would reuse the same poisoned session and fail
    identically. `get_query` must roll back on failure so each retry gets a
    clean session and has a real chance to succeed.
    """
    # avoid actually sleeping through the `backoff` decorator's retry interval
    mocker.patch("backoff._sync.time.sleep")

    expected_query = mocker.MagicMock()
    mock_one = mocker.patch("superset.sql_lab.db.session.query")
    mock_one.return_value.filter_by.return_value.one.side_effect = [
        Exception("session is broken"),
        expected_query,
    ]
    mock_rollback = mocker.patch("superset.sql_lab.db.session.rollback")

    result = get_query(query_id=1)

    assert result is expected_query
    assert mock_one.return_value.filter_by.return_value.one.call_count == 2
    mock_rollback.assert_called_once()


def test_get_query_swallows_rollback_failure(
    mocker: MockerFixture, app: SupersetApp
) -> None:
    """
    If the session/connection is too broken for `rollback()` itself to succeed,
    that failure must not replace the original lookup error: `get_query` still
    needs to raise `SqlLabException` so the `backoff` decorator's retry contract
    (which only matches on `SqlLabException`) isn't bypassed.
    """
    mocker.patch("backoff._sync.time.sleep")

    mock_one = mocker.patch("superset.sql_lab.db.session.query")
    mock_one.return_value.filter_by.return_value.one.side_effect = Exception(
        "session is broken"
    )
    mocker.patch(
        "superset.sql_lab.db.session.rollback",
        side_effect=Exception("connection already closed"),
    )

    with pytest.raises(SqlLabException):
        get_query(query_id=1)


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
    mocker.patch("superset.sql_lab.commit_query_unless_stopped", return_value=True)

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
    mocker.patch("superset.sql_lab.commit_query_unless_stopped", return_value=True)

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


@pytest.mark.parametrize("allow_dml", [False, True])
def test_execute_sql_statements_rejects_client_file_transfer(
    mocker: MockerFixture, app: SupersetApp, allow_dml: bool
) -> None:
    """
    `execute_sql_statements` rejects client-side file-transfer statements
    regardless of `allow_dml`: they perform host file I/O, not DML.
    """
    from superset.exceptions import SupersetDisallowedClientFileTransferException

    query = mocker.MagicMock()
    query.limit = 1
    query.status = "RUNNING"
    query.select_as_cta = False
    query.database.allow_dml = allow_dml
    query.database.allow_run_async = False
    query.database.db_engine_spec.engine = "snowflake"

    mocker.patch("superset.sql_lab.get_query", return_value=query)
    mocker.patch("superset.sql_lab.db.session.refresh", return_value=None)
    mocker.patch("superset.sql_lab.commit_query_unless_stopped", return_value=True)

    with pytest.raises(SupersetDisallowedClientFileTransferException) as excinfo:
        execute_sql_statements(
            query_id=1,
            rendered_query="REMOVE @my_stage/b; PUT file:///tmp/data.csv @my_stage",
            return_results=True,
            store_results=False,
            start_time=None,
            expand_data=False,
            log_params={},
        )

    # Sorted and comma-separated, not raw set interpolation.
    assert excinfo.value.error.message == (
        "SQL statement contains disallowed client-side "
        "file-transfer command(s): PUT, REMOVE"
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
    mocker.patch("superset.sql_lab.commit_query_unless_stopped", return_value=True)
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
    mocker.patch("superset.sql_lab.commit_query_unless_stopped", return_value=True)
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
    mocker.patch("superset.sql_lab.commit_query_unless_stopped", return_value=True)
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
    mocker.patch("superset.sql_lab.commit_query_unless_stopped", return_value=True)
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
    # Pushed/popped manually (rather than via a ``with`` block) so the
    # ``finally`` below still pops it if an assertion fails, preventing the
    # request context from leaking into later tests in the same session.
    app_context = app.test_request_context()
    app_context.push()

    try:
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
        # handle_query_error() refreshes `query` from the DB to check for a
        # concurrently-committed STOPPED status before overwriting it with
        # FAILED; `query` here is a MagicMock, not a real persistent ORM
        # instance, so the real refresh() would error introspecting it.
        mocker.patch("superset.sql_lab.db.session.refresh", return_value=None)
        mocker.patch("superset.sql_lab.commit_query_unless_stopped", return_value=True)

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

        # `limit` and `select_as_cta_used` must match the real `Query` model's
        # defaults (nullable Integer -> None, Boolean default=False) so that
        # `apply_limit` -- called unconditionally before the mocked OAuth2 error
        # is ever reached -- doesn't try to compare an unconfigured MagicMock
        # against an int.
        query = mocker.MagicMock(
            select_as_cta=False,
            select_as_cta_used=False,
            limit=None,
            database=database,
        )
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
        assert (
            error["extra"]["redirect_uri"]
            == "http://example.com/api/v1/database/oauth2/"
        )

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
        assert params["redirect_uri"] == ["http://example.com/api/v1/database/oauth2/"]
        assert params["client_id"] == ["my_client_id"]
        assert params["code_challenge_method"] == ["S256"]

        # Verify PKCE code_challenge matches the mocked code_verifier
        from superset.utils.oauth2 import generate_code_challenge

        expected_code_challenge = generate_code_challenge(
            "xkBPVZoFChVcy3VZ2l5u7d0FZPTU-olO7HtsAOok2IUGigyoZ62tG_oldy2xg9_HdqPKrWUmKZLmU-CUqz_SQ"
        )
        assert params["code_challenge"] == [expected_code_challenge]
    finally:
        app_context.pop()


@pytest.mark.parametrize("ctas", [False, True], ids=["mutation", "ctas"])
@pytest.mark.parametrize(
    "failure",
    [
        None,
        "backend_write_false",
        "backend_set_raises",
        "serialize_raises",
        "payload_too_large",
        "returned_payload_too_large",
        "connection_close_raises",
    ],
)
def test_get_sql_results_preserves_stop_when_mutation_commits(
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    ctas: bool,
    failure: str | None,
) -> None:
    """Test that a stop stays accepted even when the mutation commits."""
    from contextlib import contextmanager
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'commit.db'}")
    Query.__table__.create(engine)

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_dml = True
    database.allow_run_async = False
    database.cache_timeout = 100
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    database.select_star.return_value = "SELECT * FROM tmp_table"
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})

    def deliver_stop() -> None:
        """Commit the stop after the last per-block check, mid target commit."""
        with Session(engine) as stop_session:
            stopped_query = stop_session.get(Query, 123)
            assert stopped_query is not None
            stopped_query.status = QueryStatus.STOPPED
            stopped_query.end_time = 1234.5
            stop_session.commit()

    conn = MagicMock()
    conn.commit.side_effect = deliver_stop

    @contextmanager
    def raw_connection(*args: Any, **kwargs: Any) -> Any:
        yield conn
        if failure == "connection_close_raises":
            raise RuntimeError("Connection close failed")

    database.get_raw_connection = raw_connection

    store_results = failure in {
        "backend_write_false",
        "backend_set_raises",
        "serialize_raises",
        "payload_too_large",
    }
    backend = MagicMock()
    backend.set.return_value = failure != "backend_write_false"
    if failure == "backend_set_raises":
        backend.set.side_effect = RuntimeError("Backend unavailable")
    mocker.patch.object(sql_lab, "results_backend", backend)
    serialize = mocker.patch.object(sql_lab, "_serialize_payload")
    serialize.return_value = b"x" * (2 * 1024 * 1024)
    if failure == "serialize_raises":
        serialize.side_effect = RuntimeError("Cannot serialize")
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    result_set = MagicMock(size=1, columns=[])
    mocker.patch.object(sql_lab, "execute_query", return_value=result_set)
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)
    mocker.patch.dict(
        app.config,
        {
            "STATS_LOGGER": MagicMock(),
            "SQLLAB_PAYLOAD_MAX_MB": (
                1
                if failure in {"payload_too_large", "returned_payload_too_large"}
                else None
            ),
        },
    )

    sql = "SELECT 1" if ctas else "INSERT INTO users VALUES (1)"
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="commit-race",
            database_id=1,
            sql=sql,
            select_as_cta=ctas,
            ctas_method="TABLE",
            tmp_table_name="tmp_table",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        payload = get_sql_results(
            123,
            sql,
            return_results=not store_results,
            store_results=store_results,
        )

        conn.commit.assert_called_once_with()
        expected = QueryStatus.STOPPED
        assert payload is not None
        assert payload["status"] == expected
        session.refresh(query)
        assert query.status == expected
        assert query.results_key is None
    engine.dispose()


@pytest.mark.parametrize("ctas", [False, True], ids=["mutation", "ctas"])
def test_get_sql_results_stop_before_target_commit_stays_stopped(
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    ctas: bool,
) -> None:
    """
    Test that a stop committed after the last statement ran but before the
    target database commit ends STOPPED: the mutation or CTAS is not committed
    and the stop is not relabeled SUCCESS.
    """
    from contextlib import contextmanager
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'precommit.db'}")
    Query.__table__.create(engine)

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_dml = True
    database.allow_run_async = False
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    database.select_star.return_value = "SELECT * FROM tmp_table"
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})

    conn = MagicMock()

    @contextmanager
    def raw_connection(*args: Any, **kwargs: Any) -> Any:
        yield conn

    database.get_raw_connection = raw_connection

    def execute_then_stop(*args: Any, **kwargs: Any) -> MagicMock:
        """Finish the last statement, then commit a stop from another session."""
        with Session(engine) as stop_session:
            stopped_query = stop_session.get(Query, 123)
            assert stopped_query is not None
            stopped_query.status = QueryStatus.STOPPED
            stopped_query.end_time = 1234.5
            stop_session.commit()
        return MagicMock(size=1, columns=[])

    mocker.patch.object(sql_lab, "execute_query", side_effect=execute_then_stop)
    mocker.patch.object(sql_lab, "results_backend", None)
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)

    sql = "SELECT 1" if ctas else "INSERT INTO users VALUES (1)"
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="precommit-stop",
            database_id=1,
            sql=sql,
            select_as_cta=ctas,
            ctas_method="TABLE",
            tmp_table_name="tmp_table",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        payload = sql_lab.execute_sql_statements(
            123,
            sql,
            True,
            False,
            None,
            False,
            None,
        )

        assert payload is not None
        assert payload["status"] == QueryStatus.STOPPED
        session.refresh(query)
        assert query.status == QueryStatus.STOPPED
        conn.commit.assert_not_called()
    engine.dispose()


@pytest.mark.parametrize("ctas", [False, True], ids=["mutation", "ctas"])
@pytest.mark.parametrize("seen", [False, True], ids=["after_finish", "while_running"])
@pytest.mark.parametrize("autocommit", [True, False], ids=["autocommit", "transaction"])
def test_get_sql_results_autocommit_work_finished_before_a_stop_is_committed(
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    autocommit: bool,
    seen: bool,
    ctas: bool,
) -> None:
    """Test that accepted stops discard autocommit results, even if unseen."""
    from contextlib import contextmanager
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'autocommit.db'}")
    Query.__table__.create(engine)

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_dml = True
    database.allow_run_async = False
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    database.select_star.return_value = "SELECT * FROM tmp_table"
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})

    conn = MagicMock()
    conn.dbapi_connection.autocommit = autocommit

    @contextmanager
    def raw_connection(*args: Any, **kwargs: Any) -> Any:
        yield conn

    database.get_raw_connection = raw_connection
    mocker.patch.object(sql_lab, "results_backend", None)
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)
    mocker.patch.dict(app.config, {"STATS_LOGGER": MagicMock()})

    sql = "SELECT 1" if ctas else "INSERT INTO users VALUES (1)"
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="autocommit-stop",
            database_id=1,
            sql=sql,
            select_as_cta=ctas,
            ctas_method="TABLE",
            tmp_table_name="tmp_table",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        def execute_then_stop(*args: Any, **kwargs: Any) -> MagicMock:
            """Finish the last statement, with a stop committed elsewhere."""
            with Session(engine) as stop_session:
                stopped_query = stop_session.get(Query, 123)
                assert stopped_query is not None
                stopped_query.status = QueryStatus.STOPPED
                stopped_query.end_time = 1234.5
                stop_session.commit()
            if seen:
                # An engine polling the running statement loads the stop.
                session.refresh(query)
            return MagicMock(size=1, columns=[])

        mocker.patch.object(sql_lab, "execute_query", side_effect=execute_then_stop)

        payload = sql_lab.execute_sql_statements(
            123,
            sql,
            True,
            False,
            None,
            False,
            None,
        )

        expected = QueryStatus.STOPPED
        assert payload is not None
        assert payload["status"] == expected
        session.refresh(query)
        assert query.status == expected
        assert not conn.commit.called
    engine.dispose()


@pytest.mark.parametrize("ctas", [True, False], ids=["ctas", "insert"])
def test_get_sql_results_sqlite_ctas_finished_before_a_stop_is_committed(
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    ctas: bool,
) -> None:
    """Test that a stopped SQLite CTAS can still leave a committed table."""
    from contextlib import contextmanager
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine, inspect

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'metadata.db'}")
    Query.__table__.create(engine)
    target = create_engine(f"sqlite:///{tmp_path / 'target.db'}")
    with target.begin() as setup:
        setup.exec_driver_sql("CREATE TABLE existing (a INTEGER)")

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_dml = True
    database.allow_run_async = False
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    database.select_star.return_value = "SELECT * FROM tmp_table"
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})

    @contextmanager
    def raw_connection(*args: Any, **kwargs: Any) -> Any:
        connection = target.raw_connection()
        try:
            yield connection
        finally:
            connection.close()

    database.get_raw_connection = raw_connection
    mocker.patch.object(sql_lab, "results_backend", None)
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)
    mocker.patch.dict(app.config, {"STATS_LOGGER": MagicMock()})

    sql = "SELECT 1 AS a" if ctas else "INSERT INTO existing VALUES (1)"
    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="sqlite-ctas",
            database_id=1,
            sql=sql,
            select_as_cta=ctas,
            ctas_method="TABLE",
            tmp_table_name="tmp_table",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        def execute_then_stop(query: Query, cursor: Any, log_params: Any) -> MagicMock:
            """Run the statement on SQLite, then commit a stop elsewhere."""
            cursor.execute(query.executed_sql)
            with Session(engine) as stop_session:
                stopped_query = stop_session.get(Query, 123)
                assert stopped_query is not None
                stopped_query.status = QueryStatus.STOPPED
                stop_session.commit()
            return MagicMock(size=1, columns=[])

        mocker.patch.object(sql_lab, "execute_query", side_effect=execute_then_stop)

        payload = sql_lab.execute_sql_statements(
            123, sql, True, False, None, False, None
        )

        expected = QueryStatus.STOPPED
        assert payload is not None
        assert payload["status"] == expected
        session.refresh(query)
        assert query.status == expected
    with target.connect() as observer:
        assert inspect(observer).has_table("tmp_table") is ctas
        rows = observer.exec_driver_sql("SELECT COUNT(*) FROM existing").scalar()
        assert rows == 0
    target.dispose()
    engine.dispose()


@pytest.mark.parametrize(
    ("stop_at", "store_results", "return_results"),
    [
        ("serialize", False, True),
        ("serialize", True, True),
        ("serialize", True, False),
        ("backend_write", True, True),
        ("backend_write", True, False),
    ],
)
def test_get_sql_results_stop_during_select_finalization_ends_stopped(
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    stop_at: str,
    store_results: bool,
    return_results: bool,
) -> None:
    """
    Test that a stop landing while a SELECT's results are serialized or stored
    ends STOPPED in both the row and the returned payload, keeps the stop's end
    time, and deletes stored results the stopped row does not reference.
    """
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'select-stop.db'}")
    Query.__table__.create(engine)

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_run_async = False
    database.cache_timeout = 100
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)
    mocker.patch.dict(app.config, {"STATS_LOGGER": MagicMock(), "SQL_MAX_ROW": 0})

    def deliver_stop() -> None:
        """Commit the stop from another session."""
        with Session(engine) as stop_session:
            stopped_query = stop_session.get(Query, 123)
            assert stopped_query is not None
            stopped_query.status = QueryStatus.STOPPED
            stopped_query.end_time = 1234.5
            stop_session.commit()

    def execute_query(*args: Any, **kwargs: Any) -> MagicMock:
        """Commit the pre-execution metadata as execute_query does."""
        sql_lab.db.session.commit()
        return MagicMock(size=1, columns=[])

    def serialize(*args: Any, **kwargs: Any) -> tuple[list[Any], ...]:
        """Serialize the result set, with the stop landing meanwhile."""
        if stop_at == "serialize":
            deliver_stop()
        return ([], [], [], [])

    mocker.patch.object(sql_lab, "execute_query", side_effect=execute_query)
    mocker.patch.object(sql_lab, "_serialize_and_expand_data", side_effect=serialize)
    mocker.patch.object(sql_lab, "_serialize_payload", return_value=b"data")

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob, with the stop landing meanwhile."""
        stored[key] = value
        if stop_at == "backend_write":
            deliver_stop()
        return True

    backend = MagicMock()
    backend.set.side_effect = store
    backend.delete.side_effect = lambda key: stored.pop(key, None) is not None
    mocker.patch.object(sql_lab, "results_backend", backend)

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="select-stop",
            database_id=1,
            sql="SELECT 1",
            executed_sql="SELECT 1",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        payload = sql_lab.get_sql_results(
            123,
            query.sql,
            return_results=return_results,
            store_results=store_results,
        )

        assert payload == {"query_id": 123, "status": QueryStatus.STOPPED}
        session.refresh(query)
        assert query.status == QueryStatus.STOPPED
        assert query.end_time == 1234.5
        assert query.results_key is None
        if store_results:
            key = backend.set.call_args.args[0]
            backend.delete.assert_called_once_with(key)
            assert key not in stored
        else:
            backend.set.assert_not_called()
            backend.delete.assert_not_called()
    engine.dispose()


@pytest.mark.parametrize("delete_fails", [False, True], ids=["deleted", "delete_error"])
@pytest.mark.parametrize("return_results", [False, True])
@pytest.mark.parametrize("stopped", [False, True], ids=["no_stop", "stop"])
@pytest.mark.parametrize("failure", ["write_timing", "final_flush"])
def test_get_sql_results_error_after_write_deletes_results_when_stopped(  # noqa: C901
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    caplog: pytest.LogCaptureFixture,
    failure: str,
    stopped: bool,
    return_results: bool,
    delete_fails: bool,
) -> None:
    """
    Test that results stored before a failure are deleted when the error
    handler finds the query stopped, that a failed delete still ends STOPPED,
    and that without a stop the failed row keeps the key, even when the failure
    rolls back the session.
    """
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine, event

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'error-stored.db'}")
    Query.__table__.create(engine)

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_run_async = False
    database.cache_timeout = 100
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)

    def execute_query(*args: Any, **kwargs: Any) -> MagicMock:
        """Commit the pre-execution metadata as execute_query does."""
        sql_lab.db.session.commit()
        return MagicMock(size=1, columns=[])

    mocker.patch.object(sql_lab, "execute_query", side_effect=execute_query)
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    mocker.patch.object(sql_lab, "_serialize_payload", return_value=b"data")

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    def delete(key: str) -> bool:
        """Remove the blob."""
        return stored.pop(key, None) is not None

    backend = MagicMock()
    backend.set.side_effect = store
    backend.delete.side_effect = (
        RuntimeError("Backend unavailable") if delete_fails else delete
    )
    mocker.patch.object(sql_lab, "results_backend", backend)

    failed = False

    def fail() -> None:
        """Raise once the results are stored, with the stop landing first."""
        nonlocal failed
        assert stored
        failed = True
        if stopped:
            with Session(engine) as stop_session:
                stopped_query = stop_session.get(Query, 123)
                assert stopped_query is not None
                stopped_query.status = QueryStatus.STOPPED
                stop_session.commit()
        raise RuntimeError("Metrics or metadata database unavailable")

    def timing(key: str, value: float) -> None:
        """Fail emitting the write timing."""
        if failure == "write_timing" and key == "sqllab.query.results_backend_write":
            if not failed:
                fail()

    @event.listens_for(engine, "before_cursor_execute")
    def fail_flush(  # noqa: PLR0913
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Fail flushing the result metadata, which rolls back the session."""
        update = statement.lstrip().startswith("UPDATE")
        if failure == "final_flush" and update and stored and not failed:
            fail()

    # get_query retries after rolling back the session the failed flush broke.
    mocker.patch("backoff._sync.time.sleep")
    stats_logger = MagicMock()
    stats_logger.timing.side_effect = timing
    mocker.patch.dict(app.config, {"STATS_LOGGER": stats_logger, "SQL_MAX_ROW": 0})

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="error-stored",
            database_id=1,
            sql="SELECT 1",
            executed_sql="SELECT 1",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        with caplog.at_level("WARNING", logger=sql_lab.logger.name):
            payload = sql_lab.get_sql_results(
                123, query.sql, return_results=return_results, store_results=True
            )

        assert failed
        backend.set.assert_called_once()
        key = backend.set.call_args.args[0]
        # The worker's session ends without committing pending metadata.
        session.rollback()
        session.refresh(query)
        assert payload is not None
        if not stopped:
            # Not a stop: the failure is reported and the row keeps its key.
            assert payload["status"] == QueryStatus.FAILED
            assert query.status == QueryStatus.FAILED
            assert query.results_key == key
            assert key in stored
            backend.delete.assert_not_called()
        else:
            assert payload["status"] == QueryStatus.STOPPED
            assert query.status == QueryStatus.STOPPED
            assert query.results_key is None
            backend.delete.assert_called_once_with(key)
            assert (key in stored) is delete_fails
            assert (
                "Failed to delete unpublished results" in caplog.text
            ) is delete_fails
    engine.dispose()


@pytest.mark.parametrize(
    ("reread", "delete_fails"),
    [("available", False), ("available", True), ("unavailable", False)],
    ids=["reread-deleted", "reread-delete_error", "no_reread"],
)
def test_get_sql_results_unrecorded_error_after_write_deletes_unreferenced_results(
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    caplog: pytest.LogCaptureFixture,
    reread: str,
    delete_fails: bool,
) -> None:
    """
    Test that results stored before a failure the task cannot record are
    deleted once a fresh read shows the row does not reference them, and kept
    until they expire when the metadata database cannot be read at all.
    """
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine, event

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'unrecorded.db'}")
    Query.__table__.create(engine)

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_run_async = False
    database.cache_timeout = 100
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)

    def execute_query(*args: Any, **kwargs: Any) -> MagicMock:
        """Commit the pre-execution metadata as execute_query does."""
        sql_lab.db.session.commit()
        return MagicMock(size=1, columns=[])

    mocker.patch.object(sql_lab, "execute_query", side_effect=execute_query)
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    mocker.patch.object(sql_lab, "_serialize_payload", return_value=b"data")
    mocker.patch("backoff._sync.time.sleep")
    mocker.patch.dict(app.config, {"SQL_MAX_ROW": 0})

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    def delete(key: str) -> bool:
        """Remove the blob."""
        return stored.pop(key, None) is not None

    backend = MagicMock()
    backend.set.side_effect = store
    backend.delete.side_effect = (
        RuntimeError("Backend unavailable") if delete_fails else delete
    )
    mocker.patch.object(sql_lab, "results_backend", backend)

    @event.listens_for(engine, "before_cursor_execute")
    def metadata_unavailable(  # noqa: PLR0913
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Fail every metadata statement once the results are stored."""
        cleanup_read = statement.startswith('SELECT "query".results_key ')
        if stored and not (reread == "available" and cleanup_read):
            raise RuntimeError("Metadata database unavailable")

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="unrecorded",
            database_id=1,
            sql="SELECT 1",
            executed_sql="SELECT 1",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        with caplog.at_level("WARNING", logger=sql_lab.logger.name):
            with pytest.raises(sql_lab.SqlLabException):
                sql_lab.get_sql_results(
                    123, query.sql, return_results=False, store_results=True
                )

        backend.set.assert_called_once()
        key = backend.set.call_args.args[0]
        if reread == "available":
            backend.delete.assert_called_once_with(key)
            assert (key in stored) is delete_fails
            assert (
                "Failed to delete unpublished results" in caplog.text
            ) is delete_fails
        else:
            backend.delete.assert_not_called()
            assert key in stored
            assert "Kept results that may be referenced" in caplog.text
    engine.dispose()


@pytest.mark.parametrize(
    ("applied", "return_results"),
    [("failed_row", False), ("failed_row", True), ("published_row", True)],
)
def test_get_sql_results_commit_that_applies_and_raises_keeps_results(  # noqa: C901
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    applied: str,
    return_results: bool,
) -> None:
    """
    Test that a metadata commit that reaches the database and then raises (its
    acknowledgement is lost) does not delete the results the committed row
    references: the failed row of the error handler, or the published row
    when the metadata database then stays unavailable.
    """
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine, event

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'applied-commit.db'}")
    Query.__table__.create(engine)

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_run_async = False
    database.cache_timeout = 100
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)

    def execute_query(*args: Any, **kwargs: Any) -> MagicMock:
        """Commit the pre-execution metadata as execute_query does."""
        sql_lab.db.session.commit()
        return MagicMock(size=1, columns=[])

    mocker.patch.object(sql_lab, "execute_query", side_effect=execute_query)
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    mocker.patch.object(sql_lab, "_serialize_payload", return_value=b"data")
    mocker.patch("backoff._sync.time.sleep")

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    backend = MagicMock()
    backend.set.side_effect = store
    backend.delete.side_effect = lambda key: stored.pop(key, None) is not None
    mocker.patch.object(sql_lab, "results_backend", backend)

    stats_logger = MagicMock()
    if applied == "failed_row":

        def timing(key: str, value: float) -> None:
            """Fail emitting the write timing, once the results are stored."""
            if key == "sqllab.query.results_backend_write":
                raise RuntimeError("Metrics unavailable")

        stats_logger.timing.side_effect = timing
    mocker.patch.dict(app.config, {"STATS_LOGGER": stats_logger, "SQL_MAX_ROW": 0})

    target = QueryStatus.FAILED if applied == "failed_row" else QueryStatus.SUCCESS
    flushed = False
    applied_commit = False

    @event.listens_for(engine, "before_cursor_execute")
    def metadata_unavailable(  # noqa: PLR0913
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Keep the metadata database down once the published row commits."""
        if applied == "published_row" and applied_commit:
            raise RuntimeError("Metadata database unavailable")

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="applied-commit",
            database_id=1,
            sql="SELECT 1",
            executed_sql="SELECT 1",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        @event.listens_for(session, "after_flush")
        def flushed_target(flushing_session: Any, context: Any) -> None:
            nonlocal flushed
            flushed = query.status == target and query.results_key is not None

        do_commit = engine.dialect.do_commit

        def lose_acknowledgement(dbapi_connection: Any) -> None:
            """Raise after the database committed the row with the key."""
            nonlocal applied_commit
            do_commit(dbapi_connection)
            if flushed and not applied_commit:
                applied_commit = True
                raise RuntimeError("Commit acknowledgement lost")

        mocker.patch.object(
            engine.dialect, "do_commit", side_effect=lose_acknowledgement
        )

        with pytest.raises((RuntimeError, sql_lab.SqlLabException)):
            sql_lab.get_sql_results(
                123, query.sql, return_results=return_results, store_results=True
            )

        assert applied_commit
        event.remove(engine, "before_cursor_execute", metadata_unavailable)
        key = backend.set.call_args.args[0]
        with Session(engine) as observer:
            persisted = observer.get(Query, 123)
            assert persisted is not None
            assert persisted.status == target
            assert persisted.results_key == key
        backend.delete.assert_not_called()
        assert key in stored
    engine.dispose()


@pytest.mark.parametrize("return_results", [False, True])
def test_get_sql_results_stop_after_an_applied_publish_keeps_results(
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    return_results: bool,
) -> None:
    """
    Test that when the publish commit reaches the database and then raises, and
    a stop lands while the error is handled, the stop wins without deleting the
    results the committed row references.
    """
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine, event

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'applied-publish.db'}")
    Query.__table__.create(engine)

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_run_async = False
    database.cache_timeout = 100
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)

    def execute_query(*args: Any, **kwargs: Any) -> MagicMock:
        """Commit the pre-execution metadata as execute_query does."""
        sql_lab.db.session.commit()
        return MagicMock(size=1, columns=[])

    mocker.patch.object(sql_lab, "execute_query", side_effect=execute_query)
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    mocker.patch.object(sql_lab, "_serialize_payload", return_value=b"data")
    mocker.patch("backoff._sync.time.sleep")

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    backend = MagicMock()
    backend.set.side_effect = store
    backend.delete.side_effect = lambda key: stored.pop(key, None) is not None
    mocker.patch.object(sql_lab, "results_backend", backend)
    mocker.patch.dict(app.config, {"STATS_LOGGER": MagicMock(), "SQL_MAX_ROW": 0})

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="applied-publish",
            database_id=1,
            sql="SELECT 1",
            executed_sql="SELECT 1",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        published = False

        @event.listens_for(session, "after_flush")
        def published_flush(flushing_session: Any, context: Any) -> None:
            nonlocal published
            published = (
                query.status == QueryStatus.SUCCESS and query.results_key is not None
            )

        do_commit = engine.dialect.do_commit
        applied_commit = False

        def lose_acknowledgement(dbapi_connection: Any) -> None:
            """Raise after the published row commits and a stop lands."""
            nonlocal applied_commit
            do_commit(dbapi_connection)
            if published and not applied_commit:
                applied_commit = True
                with Session(engine) as stop_session:
                    stopped_query = stop_session.get(Query, 123)
                    assert stopped_query is not None
                    stopped_query.status = QueryStatus.STOPPED
                    stop_session.commit()
                raise RuntimeError("Commit acknowledgement lost")

        mocker.patch.object(
            engine.dialect, "do_commit", side_effect=lose_acknowledgement
        )

        payload = sql_lab.get_sql_results(
            123, query.sql, return_results=return_results, store_results=True
        )

        assert applied_commit
        assert payload is not None
        assert payload["status"] == QueryStatus.STOPPED
        key = backend.set.call_args.args[0]
        with Session(engine) as observer:
            persisted = observer.get(Query, 123)
            assert persisted is not None
            assert persisted.status == QueryStatus.STOPPED
            assert persisted.results_key == key
        backend.delete.assert_not_called()
        assert key in stored
    engine.dispose()


@pytest.mark.parametrize("return_results", [False, True])
@pytest.mark.parametrize("failure", ["after_failed_commit", "failed_commit"])
def test_get_sql_results_deletes_results_only_without_committed_failure(  # noqa: C901
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    failure: str,
    return_results: bool,
) -> None:
    """
    Test that results stored before a failure are kept once the failed row
    referencing them is committed, even if the metadata database fails right
    after that commit, and are deleted when the failed row's commit fails.
    """
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine, event

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'failed-commit.db'}")
    Query.__table__.create(engine)

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_run_async = False
    database.cache_timeout = 100
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)

    def execute_query(*args: Any, **kwargs: Any) -> MagicMock:
        """Commit the pre-execution metadata as execute_query does."""
        sql_lab.db.session.commit()
        return MagicMock(size=1, columns=[])

    mocker.patch.object(sql_lab, "execute_query", side_effect=execute_query)
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    mocker.patch.object(sql_lab, "_serialize_payload", return_value=b"data")

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    def delete(key: str) -> bool:
        """Remove the blob."""
        return stored.pop(key, None) is not None

    backend = MagicMock()
    backend.set.side_effect = store
    backend.delete.side_effect = delete
    mocker.patch.object(sql_lab, "results_backend", backend)

    def timing(key: str, value: float) -> None:
        """Fail emitting the write timing, once the results are stored."""
        if key == "sqllab.query.results_backend_write":
            raise RuntimeError("Metrics unavailable")

    stats_logger = MagicMock()
    stats_logger.timing.side_effect = timing
    mocker.patch.dict(app.config, {"STATS_LOGGER": stats_logger, "SQL_MAX_ROW": 0})

    failed_flushed = False
    failed_committed = False

    @event.listens_for(engine, "commit")
    def fail_failed_commit(conn: Any) -> None:
        """Fail committing the failed row before the database commits it."""
        if failure == "failed_commit" and failed_flushed:
            raise RuntimeError("Metadata commit failed")

    @event.listens_for(engine, "before_cursor_execute")
    def fail_after_failed_commit(  # noqa: PLR0913
        conn: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Fail every metadata statement once the failed row is committed."""
        if failed_committed:
            raise RuntimeError("Metadata database unavailable")

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="failed-commit",
            database_id=1,
            sql="SELECT 1",
            executed_sql="SELECT 1",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        @event.listens_for(session, "after_flush")
        def flushed_failure(flushing_session: Any, context: Any) -> None:
            nonlocal failed_flushed
            failed_flushed = query.status == QueryStatus.FAILED

        @event.listens_for(session, "after_commit")
        def committed_failure(committing_session: Any) -> None:
            nonlocal failed_committed
            failed_committed = failed_flushed

        if failure == "after_failed_commit":
            payload = sql_lab.get_sql_results(
                123, query.sql, return_results=return_results, store_results=True
            )
            assert payload is not None
            assert payload["status"] == QueryStatus.FAILED
            assert failed_committed
        else:
            with pytest.raises(RuntimeError, match="Metadata commit failed"):
                sql_lab.get_sql_results(
                    123, query.sql, return_results=return_results, store_results=True
                )
            assert not failed_committed
            session.rollback()

        event.remove(engine, "before_cursor_execute", fail_after_failed_commit)
        backend.set.assert_called_once()
        key = backend.set.call_args.args[0]
        with Session(engine) as observer:
            persisted = observer.get(Query, 123)
            assert persisted is not None
            if failure == "after_failed_commit":
                # The committed failed row references the results; keep them.
                assert persisted.status == QueryStatus.FAILED
                assert persisted.results_key == key
                assert key in stored
                backend.delete.assert_not_called()
            else:
                # Nothing committed references the results; delete them.
                assert persisted.status != QueryStatus.FAILED
                assert persisted.results_key is None
                assert key not in stored
                backend.delete.assert_called_once_with(key)
    engine.dispose()


def test_get_sql_results_keeps_published_results_after_final_commit(
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
) -> None:
    """
    Test that a failure after the final metadata commit does not delete results
    whose key the committed query row already references.
    """
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'published.db'}")
    Query.__table__.create(engine)

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_run_async = False
    database.cache_timeout = 100
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)

    def execute_query(*args: Any, **kwargs: Any) -> MagicMock:
        """Commit the pre-execution metadata as execute_query does."""
        sql_lab.db.session.commit()
        return MagicMock(size=1, columns=[])

    mocker.patch.object(sql_lab, "execute_query", side_effect=execute_query)
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    # The stored payload fits; the returned one exceeds SQLLAB_PAYLOAD_MAX_MB,
    # so its check fails after the final metadata commit.
    mocker.patch.object(
        sql_lab,
        "_serialize_payload",
        side_effect=[b"data", b"x" * (2 * 1024 * 1024)],
    )
    mocker.patch.dict(
        app.config,
        {"STATS_LOGGER": MagicMock(), "SQL_MAX_ROW": 0, "SQLLAB_PAYLOAD_MAX_MB": 1},
    )

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    backend = MagicMock()
    backend.set.side_effect = store
    mocker.patch.object(sql_lab, "results_backend", backend)

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="published",
            database_id=1,
            sql="SELECT 1",
            executed_sql="SELECT 1",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        payload = sql_lab.get_sql_results(
            123, query.sql, return_results=True, store_results=True
        )

        key = backend.set.call_args.args[0]
        session.rollback()
        session.refresh(query)
        assert payload is not None
        assert payload["status"] == QueryStatus.FAILED
        assert query.status == QueryStatus.FAILED
        assert query.results_key == key
        assert key in stored
        backend.delete.assert_not_called()
    engine.dispose()


def _capture_execution_context(mocker: MockerFixture) -> dict[str, Any]:
    """
    Stub out ``execute_sql_statements`` and record the context it runs under.
    """
    captured: dict[str, Any] = {}

    def execute_sql_statements(*args: Any, **kwargs: Any) -> dict[str, Any]:
        captured["rls_tenant"] = session.get("rls_tenant")
        captured["has_request_context"] = has_request_context()
        captured["user"] = g.user
        return {"status": QueryStatus.SUCCESS}

    mocker.patch(
        "superset.sql_lab.execute_sql_statements",
        side_effect=execute_sql_statements,
    )
    mocker.patch(
        "superset.sql_lab.security_manager.find_user",
        return_value="the-user",
    )
    return captured


def test_get_sql_results_reuses_the_active_request(
    mocker: MockerFixture, app: SupersetApp
) -> None:
    """
    Test that a synchronous run keeps the real Flask session.

    SQL Lab's synchronous executor invokes this task directly rather than through
    Celery, so it already runs inside the authenticated request. Fabricating a
    second request context there would swap the real session for an empty one and
    break RLS clauses whose Jinja macros read ``flask.session``.
    """
    captured = _capture_execution_context(mocker)

    # Pushed/popped manually (rather than via a ``with`` block) so the
    # ``finally`` below still pops it if an assertion fails, preventing the
    # request context from leaking into later tests in the same session.
    app_context = app.test_request_context()
    app_context.push()

    try:
        session["rls_tenant"] = "acme"
        get_sql_results(query_id=1, rendered_query="SELECT 1")
    finally:
        app_context.pop()

    assert captured["rls_tenant"] == "acme"
    assert captured["user"] == "the-user"


def test_get_sql_results_builds_a_request_when_there_is_none(
    mocker: MockerFixture, app: SupersetApp
) -> None:
    """
    Test that a Celery run still gets a request context of its own.

    A worker has no originating request, and the OAuth2 flow needs a request
    context to build its redirect URI, so one must still be created there.
    """
    captured = _capture_execution_context(mocker)

    with app.app_context():
        assert not has_request_context()
        get_sql_results(query_id=1, rendered_query="SELECT 1", username="alice")

    assert captured["has_request_context"] is True
    assert captured["user"] == "the-user"


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
            mocker.call(
                Table("t1", "public", "examples"),
                database,
                "examples",
                exclude_dataset_id=None,
                include_global_guest_rls=True,
            ),
            mocker.call(
                Table("t2", "public", "examples"),
                database,
                "examples",
                exclude_dataset_id=None,
                include_global_guest_rls=True,
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
        include_global_guest_rls=True
    )


def test_get_predicates_for_table_null_schema_dataset(session: Session) -> None:
    """
    A dataset stored with a NULL schema is scoped to the database's default
    schema, mirroring the existing null-catalog fallback.

    A query resolving to that default schema must find the dataset, so its RLS
    predicates are applied instead of being silently dropped. A query against a
    different schema must not, since the null-schema dataset doesn't describe it.
    """
    from superset.connectors.sqla.models import SqlaTable

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="rls_db", sqlalchemy_uri="sqlite://")
    # registered without an explicit schema, e.g. via the dataset API
    dataset = SqlaTable(table_name="t1", schema=None, catalog=None, database=database)
    session.add_all([database, dataset])
    session.flush()

    with (
        patch.object(
            SqlaTable, "get_sqla_row_level_filters", return_value=[text("c1 = 1")]
        ),
        patch.object(Database, "get_default_schema", return_value="public"),
    ):
        assert get_predicates_for_table(
            Table("t1", "public", None), database, None
        ) == ["c1 = 1"]

        assert (
            get_predicates_for_table(Table("t1", "sales", None), database, None) == []
        )


def test_get_predicates_for_table_prefers_exact_schema_match(session: Session) -> None:
    """
    A dataset stored without a schema and one stored with the default schema can
    coexist for the same table. The exact match must win, and the lookup must stay
    unambiguous rather than treating both rows as candidates for a single dataset.
    """
    from superset.connectors.sqla.models import SqlaTable

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="rls_db_exact", sqlalchemy_uri="sqlite://")
    session.add_all(
        [
            database,
            SqlaTable(table_name="t1", schema=None, catalog=None, database=database),
            SqlaTable(
                table_name="t1", schema="public", catalog=None, database=database
            ),
        ]
    )
    session.flush()

    def row_level_filters(
        self: Any, include_global_guest_rls: bool = True
    ) -> list[Any]:
        return [text(f"c1 = '{self.schema}'")]

    with (
        patch.object(
            SqlaTable,
            "get_sqla_row_level_filters",
            autospec=True,
            side_effect=row_level_filters,
        ),
        patch.object(Database, "get_default_schema", return_value="public"),
    ):
        assert get_predicates_for_table(
            Table("t1", "public", None), database, None
        ) == ["c1 = 'public'"]


def test_get_predicates_for_table_case_mismatched_reference(session: Session) -> None:
    """
    On an engine that doesn't treat unquoted identifiers as case-sensitive, a
    reference whose catalog, schema or table casing differs from the registered
    dataset still resolves to the same physical table, so the dataset's RLS
    predicates must be applied. That includes a dataset stored without a schema,
    which is scoped to the database's default schema, or without a catalog, which
    is scoped to the default catalog. An engine that does treat them as
    case-sensitive keeps the exact match. Several datasets can differ only in
    case, all naming that one physical table: every one's predicates apply, so
    the exact-case dataset's predicates are never dropped and a dataset
    registered under a different casing cannot shadow it.
    """
    from superset.connectors.sqla.models import SqlaTable

    SqlaTable.metadata.create_all(session.get_bind())

    folding = Database(database_name="rls_db_ci", sqlalchemy_uri="sqlite://")
    exact = Database(database_name="rls_db_cs", sqlalchemy_uri="mysql://localhost/db")
    ambiguous = Database(database_name="rls_db_ambiguous", sqlalchemy_uri="sqlite://")
    null_schema = Database(
        database_name="rls_db_null_schema", sqlalchemy_uri="sqlite://"
    )
    null_catalog = Database(
        database_name="rls_db_null_catalog", sqlalchemy_uri="sqlite://"
    )
    session.add_all(
        [
            folding,
            exact,
            ambiguous,
            null_schema,
            null_catalog,
            SqlaTable(
                table_name="t1", schema="public", catalog="cat", database=folding
            ),
            SqlaTable(table_name="t1", schema="public", catalog=None, database=exact),
            SqlaTable(
                table_name="t1", schema="public", catalog=None, database=ambiguous
            ),
            SqlaTable(
                table_name="T1", schema="public", catalog=None, database=ambiguous
            ),
            SqlaTable(table_name="t1", schema=None, catalog=None, database=null_schema),
            SqlaTable(
                table_name="t1", schema="public", catalog=None, database=null_catalog
            ),
        ]
    )
    session.flush()

    def row_level_filters(
        self: Any, include_global_guest_rls: bool = True
    ) -> list[Any]:
        return [text(f"c1 = '{self.table_name}'")]

    with (
        patch.object(
            SqlaTable,
            "get_sqla_row_level_filters",
            autospec=True,
            side_effect=row_level_filters,
        ),
        patch.object(Database, "get_default_schema", return_value="public"),
    ):
        for reference in (
            Table("T1", "public", "cat"),
            Table("T1", "PUBLIC", "cat"),
            Table("t1", "public", "CAT"),
        ):
            assert get_predicates_for_table(reference, folding, "cat") == [
                "c1 = 't1'"
            ], f"no predicates for {reference}"

        # dataset stored without a catalog, referenced via the default catalog
        assert get_predicates_for_table(
            Table("T1", "public", "CAT"), null_catalog, "cat"
        ) == ["c1 = 't1'"]

        # dataset stored without a schema, referenced via the default schema
        assert get_predicates_for_table(
            Table("T1", "PUBLIC", None), null_schema, None
        ) == ["c1 = 't1'"]
        assert (
            get_predicates_for_table(Table("T1", "other", None), null_schema, None)
            == []
        )

        assert get_predicates_for_table(Table("T1", "public", None), exact, None) == []

        # ``t1`` and ``T1`` name the same physical table here, so both sets of
        # predicates apply whichever casing is referenced: the exact-case
        # dataset's predicates are always among them, and neither dataset can
        # shadow the other by registering a different casing
        for reference in (
            Table("t1", "public", None),
            Table("T1", "public", None),
            Table("t1", "PUBLIC", None),
        ):
            assert sorted(get_predicates_for_table(reference, ambiguous, None)) == [
                "c1 = 'T1'",
                "c1 = 't1'",
            ], f"missing predicates for {reference}"


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


@pytest.mark.parametrize("return_results", [False, True], ids=["async", "sync"])
@pytest.mark.parametrize("stop_timing", ["cursor", "error_handler"])
def test_get_sql_results_preserves_stop_during_postgres_cancellation(
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    return_results: bool,
    stop_timing: str,
) -> None:
    """A cancellation failure cannot overwrite a Stop from another session."""
    from unittest.mock import PropertyMock

    from psycopg2.errors import QueryCanceled
    from sqlalchemy import create_engine

    from superset import sql_lab
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'cancel-error.db'}")
    Query.__table__.create(engine)
    database = MagicMock()
    database.db_engine_spec = PostgresEngineSpec
    database.allow_run_async = False
    database.get_default_schema_for_query.return_value = "public"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)
    mocker.patch.dict(
        app.config, {"STATS_LOGGER": MagicMock(), "DISALLOWED_SQL_FUNCTIONS": {}}
    )

    def stop() -> None:
        """Commit the Stop independently of the worker's stale identity map."""
        with Session(engine) as stop_session:
            stopped = stop_session.get(Query, 123)
            assert stopped is not None
            stopped.status = QueryStatus.STOPPED
            stopped.end_time = 1234.5
            stop_session.commit()

    cursor_cancelled = False

    def cancelled_cursor(*args: Any, **kwargs: Any) -> None:
        """Simulate Postgres raising after the running statement is cancelled."""
        nonlocal cursor_cancelled
        cursor_cancelled = True
        raise QueryCanceled("canceling statement due to user request")

    def extract_errors(*args: Any, **kwargs: Any) -> list[Any]:
        """Let Stop commit after the error handler's preliminary status read."""
        if stop_timing == "error_handler":
            stop()
        return []

    mocker.patch.object(sql_lab, "warm_and_release_connection")

    # Use the real legacy execute_query and error handler, not a task stub.
    mocker.patch.object(PostgresEngineSpec, "get_cancel_query_id", return_value=42)
    execute_cursor = mocker.patch.object(
        PostgresEngineSpec, "execute_with_cursor", side_effect=cancelled_cursor
    )
    mocker.patch.object(sql_lab, "_extract_errors", side_effect=extract_errors)
    with Session(engine) as worker_session:
        query = Query(
            id=123,
            client_id="cancel-race",
            database_id=1,
            sql="SELECT pg_sleep(30)",
            status=QueryStatus.PENDING,
        )
        worker_session.add(query)
        worker_session.commit()
        mocker.patch.object(sql_lab.db, "session", worker_session)
        refresh = worker_session.refresh

        def refresh_then_stop(*args: Any, **kwargs: Any) -> None:
            """Commit after the cancelled cursor's handler reads its status."""
            refresh(*args, **kwargs)
            if (
                stop_timing == "cursor"
                and cursor_cancelled
                and kwargs.get("attribute_names") == ["status"]
            ):
                stop()

        mocker.patch.object(worker_session, "refresh", side_effect=refresh_then_stop)
        payload = sql_lab.get_sql_results(123, query.sql, return_results=return_results)
        execute_cursor.assert_called_once()
        with Session(engine) as observer:
            persisted = observer.get(Query, 123)
            assert persisted is not None
            assert persisted.status == QueryStatus.STOPPED
            assert persisted.end_time == 1234.5
            assert persisted.error_message is None
        assert payload is not None
        assert payload["status"] == QueryStatus.STOPPED
        assert "error" not in payload
    engine.dispose()


@pytest.mark.parametrize("mutation", [False, True], ids=["select", "mutation"])
@pytest.mark.parametrize("terminal_write", ["success", "backend_failure"])
def test_legacy_terminal_write_preserves_concurrent_stop(
    mocker: MockerFixture,
    request: pytest.FixtureRequest,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
    terminal_write: str,
    mutation: bool,
) -> None:
    """Neither result publication nor a cache failure may overwrite a Stop."""
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine, event

    from superset import sql_lab
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'terminal-stop.db'}")
    Query.__table__.create(engine)
    database = MagicMock()
    database.db_engine_spec = PostgresEngineSpec
    database.allow_run_async = False
    database.allow_dml = True
    database.cache_timeout = 100
    database.get_default_schema_for_query.return_value = "public"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)
    mocker.patch.object(sql_lab, "_serialize_payload", return_value=b"data")
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    mocker.patch.dict(app.config, {"STATS_LOGGER": MagicMock(), "SQL_MAX_ROW": 0})

    def stop() -> None:
        """Publish Stop through a separate metadata transaction."""
        with Session(engine) as stop_session:
            stopped = stop_session.get(Query, 123)
            assert stopped is not None
            stopped.status = QueryStatus.STOPPED
            stopped.end_time = 1234.5
            stop_session.commit()

    def store(*args: Any) -> bool:
        """Return a failure before racing Stop with its terminal write."""
        return terminal_write != "backend_failure"

    stop_attempted = False

    def stop_before_failure(
        target: Query, value: str, old_value: Any, initiator: Any
    ) -> None:
        """Commit after any preliminary refresh, before FAILED is flushed."""
        nonlocal stop_attempted
        if (
            terminal_write == "backend_failure"
            and value == QueryStatus.FAILED
            and not stop_attempted
        ):
            stop_attempted = True
            stop()

    event.listen(Query.status, "set", stop_before_failure)
    request.addfinalizer(lambda: event.remove(Query.status, "set", stop_before_failure))

    mocker.patch.object(PostgresEngineSpec, "get_cancel_query_id", return_value=42)
    backend = MagicMock()
    backend.set.side_effect = store
    mocker.patch.object(sql_lab, "results_backend", backend)
    with Session(engine) as worker_session:
        query = Query(
            id=123,
            client_id="final-stop",
            database_id=1,
            sql="INSERT INTO users VALUES (1)" if mutation else "SELECT 1",
            status=QueryStatus.PENDING,
        )
        worker_session.add(query)
        worker_session.commit()
        mocker.patch.object(sql_lab.db, "session", worker_session)

        def execute(*args: Any, **kwargs: Any) -> MagicMock:
            """Commit execution metadata as the real statement executor does."""
            worker_session.commit()
            return MagicMock(size=1, columns=[])

        mocker.patch.object(sql_lab, "execute_query", side_effect=execute)
        refresh = worker_session.refresh

        def refresh_then_stop(*args: Any, **kwargs: Any) -> None:
            """Stop between the final status read and terminal publication."""
            refresh(*args, **kwargs)
            if (
                terminal_write == "success"
                and kwargs.get("attribute_names") == ["status"]
                and query.results_key
            ):
                stop()

        mocker.patch.object(worker_session, "refresh", side_effect=refresh_then_stop)
        payload = sql_lab.get_sql_results(
            123, query.sql, return_results=False, store_results=True
        )
        backend.set.assert_called_once()
        with Session(engine) as observer:
            persisted = observer.get(Query, 123)
            assert persisted is not None
            assert persisted.status == QueryStatus.STOPPED
            assert persisted.end_time == 1234.5
            assert persisted.results_key is None
            assert persisted.error_message is None
        assert payload == {"query_id": 123, "status": QueryStatus.STOPPED}
        if terminal_write == "success":
            backend.delete.assert_called_once_with(backend.set.call_args.args[0])
    engine.dispose()


def test_legacy_startup_preserves_stop_before_running_write(
    mocker: MockerFixture,
    app_context: None,
    tmp_path: Any,
) -> None:
    """A Stop between the startup read and RUNNING write prevents dispatch."""
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine

    from superset import sql_lab
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'startup-stop.db'}")
    Query.__table__.create(engine)
    database = MagicMock()
    database.db_engine_spec = PostgresEngineSpec
    database.allow_run_async = False
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))

    def stop() -> None:
        """Commit after the worker's initial status check."""
        with Session(engine) as stop_session:
            stopped = stop_session.get(Query, 123)
            assert stopped is not None
            stopped.status = QueryStatus.STOPPED
            stopped.end_time = 1234.5
            stop_session.commit()

    mocker.patch.object(PostgresEngineSpec, "patch", side_effect=stop)
    parse = mocker.patch.object(
        sql_lab,
        "SQLScript",
        side_effect=AssertionError("Stopped query reached parsing"),
    )
    with Session(engine) as worker_session:
        worker_session.add(
            Query(
                id=123, client_id="startup", database_id=1, status=QueryStatus.PENDING
            )
        )
        worker_session.commit()
        mocker.patch.object(sql_lab.db, "session", worker_session)
        payload = sql_lab.execute_sql_statements(
            123, "SELECT 1", True, False, None, False, None
        )
        assert payload == {"query_id": 123, "status": QueryStatus.STOPPED}
        parse.assert_not_called()
        with Session(engine) as observer:
            persisted = observer.get(Query, 123)
            assert persisted is not None
            assert persisted.status == QueryStatus.STOPPED
            assert persisted.end_time == 1234.5
    engine.dispose()


def test_sync_payload_limit_stop_response_matches_recorded_outcome(
    mocker: MockerFixture,
    app: SupersetApp,
    app_context: None,
    tmp_path: Any,
) -> None:
    """Stop during inline size validation cannot observe a premature SUCCESS."""
    from unittest.mock import PropertyMock

    from sqlalchemy import create_engine

    from superset import sql_lab
    from superset.db_engine_specs.sqlite import SqliteEngineSpec
    from superset.models.sql_lab import Query

    engine = create_engine(f"sqlite:///{tmp_path / 'published.db'}")
    Query.__table__.create(engine)

    database = MagicMock()
    database.db_engine_spec = SqliteEngineSpec
    database.allow_run_async = False
    database.cache_timeout = 100
    database.get_default_schema_for_query.return_value = "main"
    database.mutate_sql_based_on_config.side_effect = lambda sql, is_split=False: sql
    mocker.patch.object(Query, "database", PropertyMock(return_value=database))
    mocker.patch.object(Query, "to_dict", return_value={"id": 123})
    mocker.patch.object(sql_lab.security_manager, "find_user", return_value=None)

    def execute_query(*args: Any, **kwargs: Any) -> MagicMock:
        """Commit the pre-execution metadata as execute_query does."""
        sql_lab.db.session.commit()
        return MagicMock(size=1, columns=[])

    mocker.patch.object(sql_lab, "execute_query", side_effect=execute_query)
    mocker.patch.object(
        sql_lab, "_serialize_and_expand_data", return_value=([], [], [], [])
    )
    # The stored payload fits; the returned one exceeds SQLLAB_PAYLOAD_MAX_MB,
    # so the inline size check must run before publishing SUCCESS.
    stop_responses: list[int] = []
    serializations = 0

    def serialize_with_stop(*args: Any) -> bytes:
        """Stop at the inline payload check, before any oversized-result error."""
        import inspect

        from superset.queries.api import QueryRestApi

        nonlocal serializations
        serializations += 1
        if serializations == 1:
            return b"data"
        with app.test_request_context(json={"client_id": "published"}):
            response = inspect.unwrap(QueryRestApi.stop_query)(QueryRestApi())
        stop_responses.append(response.status_code)
        return b"x" * (2 * 1024 * 1024)

    mocker.patch("superset.daos.query.get_user_id", return_value=7)
    mocker.patch.object(sql_lab, "cancel_query", return_value=False)
    mocker.patch.object(
        sql_lab,
        "_serialize_payload",
        side_effect=serialize_with_stop,
    )
    mocker.patch.dict(
        app.config,
        {"STATS_LOGGER": MagicMock(), "SQL_MAX_ROW": 0, "SQLLAB_PAYLOAD_MAX_MB": 1},
    )

    stored: dict[str, bytes] = {}

    def store(key: str, value: bytes, timeout: int) -> bool:
        """Write the blob successfully."""
        stored[key] = value
        return True

    backend = MagicMock()
    backend.set.side_effect = store
    mocker.patch.object(sql_lab, "results_backend", backend)

    with Session(engine) as session:
        query = Query(
            id=123,
            client_id="published",
            user_id=7,
            database_id=1,
            sql="SELECT 1",
            executed_sql="SELECT 1",
            status=QueryStatus.PENDING,
        )
        session.add(query)
        session.commit()
        mocker.patch.object(sql_lab.db, "session", session)

        payload = sql_lab.get_sql_results(
            123, query.sql, return_results=True, store_results=True
        )

        key = backend.set.call_args.args[0]
        session.rollback()
        session.refresh(query)
        assert payload is not None
        assert stop_responses == [200]
        assert payload["status"] == QueryStatus.STOPPED
        assert query.status == QueryStatus.STOPPED
        assert query.results_key is None
        backend.delete.assert_called_once_with(key)
    engine.dispose()
