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

"""
Round-trip tests for async SQLExecutor results.

These tests write results with the real Celery task serializer
(``_finalize_successful_query`` + ``_store_results_in_backend``) and read them
back with the real ``AsyncQueryHandle.get_result`` reader, so the two sides of
the results backend contract are exercised together without mocking the
compression or serialization layers.
"""

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock
from uuid import UUID
from zoneinfo import ZoneInfo

import pandas as pd
import pytest
from flask import current_app
from pytest_mock import MockerFixture
from superset_core.queries.types import QueryStatus

from superset.db_engine_specs.sqlite import SqliteEngineSpec
from superset.models.core import Database
from superset.result_set import SupersetResultSet
from superset.sql.execution.celery_task import (
    _finalize_successful_query,
    _store_results_in_backend,
)
from superset.sql.execution.executor import SQLExecutor
from superset.sql.parse import SQLScript
from superset.superset_typing import DbapiDescription

ExecutionResult = tuple[str, SupersetResultSet | None, float, int]


class DictResultsBackend:
    """Minimal in-memory stand-in for a cachelib results backend."""

    def __init__(self) -> None:
        self.store: dict[str, Any] = {}

    def set(self, key: str, value: Any, timeout: int | None = None) -> bool:
        self.store[key] = value
        return True

    def get(self, key: str) -> Any:
        return self.store.get(key)


def _result_set(columns: list[str], rows: list[tuple[Any, ...]]) -> SupersetResultSet:
    description: DbapiDescription = [
        (name, "", None, None, None, None, True) for name in columns
    ]
    return SupersetResultSet(rows, description, SqliteEngineSpec)


def _select(
    sql: str, columns: list[str], rows: list[tuple[Any, ...]]
) -> ExecutionResult:
    return (sql, _result_set(columns, rows), 5.0, len(rows))


def _store_and_read(
    mocker: MockerFixture,
    sql: str,
    execution_results: list[ExecutionResult],
    *,
    write_msgpack: bool,
    read_msgpack: bool | None = None,
    legacy_records: bool = False,
) -> Any:
    """Store results with the Celery task writer, read them with the handle."""
    backend = DictResultsBackend()
    mocker.patch("superset.sql.execution.celery_task.results_backend", backend)
    results_backend_manager = MagicMock()
    results_backend_manager.results_backend = backend
    mocker.patch("superset.results_backend_manager", results_backend_manager)

    query = MagicMock()
    query.id = 1
    query.status = "success"
    query.error_message = None
    query.extra = {}
    query.to_dict.return_value = {"id": 1}

    database = MagicMock()
    database.cache_timeout = 60

    mocker.patch("superset.results_backend_use_msgpack", write_msgpack)
    payload: dict[str, Any] = {"query_id": query.id}
    _finalize_successful_query(
        query, SQLScript(sql, engine="sqlite"), execution_results, payload, 10.0
    )
    if legacy_records and not write_msgpack:
        from superset.dataframe import df_to_records

        for statement, (_, result_set, _, _) in zip(
            payload["statements"], execution_results, strict=True
        ):
            if result_set is not None:
                statement["data"] = (
                    df_to_records(result_set.to_pandas_df(), convert_decimals=True)
                    or []
                )
    _store_results_in_backend(query, payload, database)
    assert query.results_key in backend.store

    if read_msgpack is not None:
        mocker.patch("superset.results_backend_use_msgpack", read_msgpack)

    mocker.patch(
        "superset.sql.execution.executor.db.session.query"
    ).return_value.filter_by.return_value.one_or_none.return_value = query
    return SQLExecutor(database)._create_async_handle(query.id).get_result()


@pytest.mark.parametrize("use_msgpack", [True, False])
@pytest.mark.parametrize("statement_count", [1, 2])
def test_async_text_payload_limit_excludes_base64_overhead(
    mocker: MockerFixture,
    app_context: None,
    use_msgpack: bool,
    statement_count: int,
) -> None:
    """Eight MiB of text fits a ten MiB limit in either backend transport."""
    mocker.patch.dict(current_app.config, {"SQLLAB_PAYLOAD_MAX_MB": 10})
    text = "x" * (8 * 1024 * 1024 // statement_count)
    sql = "; ".join(["SELECT text"] * statement_count)
    result = _store_and_read(
        mocker,
        sql,
        [_select("SELECT text", ["text"], [(text,)])] * statement_count,
        write_msgpack=use_msgpack,
    )

    assert result.status == QueryStatus.SUCCESS
    assert len(result.statements) == statement_count
    for statement in result.statements:
        assert statement.data is not None
        assert statement.data["text"].tolist() == [text]


@pytest.mark.parametrize("use_msgpack", [True, False])
def test_async_result_single_select(
    mocker: MockerFixture, app_context: None, use_msgpack: bool
) -> None:
    """``SELECT 42 AS value`` round-trips through the results backend."""
    result = _store_and_read(
        mocker,
        "SELECT 42 AS value",
        [_select("SELECT 42 AS value", ["value"], [(42,)])],
        write_msgpack=use_msgpack,
    )

    assert result.status == QueryStatus.SUCCESS, result.error_message
    assert result.error_message is None
    assert len(result.statements) == 1
    statement = result.statements[0]
    assert (
        statement.original_sql
        == SQLScript("SELECT 42 AS value", engine="sqlite").statements[0].format()
    )
    assert statement.executed_sql == "SELECT 42 AS value"
    assert statement.row_count == 1
    assert isinstance(statement.data, pd.DataFrame)
    assert list(statement.data.columns) == ["value"]
    assert statement.data["value"].tolist() == [42]
    assert result.total_execution_time_ms == 10.0


@pytest.mark.parametrize("use_msgpack", [True, False])
def test_async_result_empty_select_keeps_columns(
    mocker: MockerFixture, app_context: None, use_msgpack: bool
) -> None:
    """A zero-row SELECT yields an empty DataFrame, like the sync path."""
    result = _store_and_read(
        mocker,
        "SELECT 1 AS a, 'x' AS b WHERE 1 = 0",
        [_select("SELECT 1 AS a, 'x' AS b WHERE 1 = 0", ["a", "b"], [])],
        write_msgpack=use_msgpack,
    )

    assert result.status == QueryStatus.SUCCESS, result.error_message
    statement = result.statements[0]
    assert statement.row_count == 0
    assert isinstance(statement.data, pd.DataFrame)
    assert statement.data.empty
    assert list(statement.data.columns) == ["a", "b"]


@pytest.mark.parametrize("use_msgpack", [True, False])
def test_async_result_nulls_and_mixed_types(
    mocker: MockerFixture, app_context: None, use_msgpack: bool
) -> None:
    """Nulls, strings and floats survive the round trip."""
    result = _store_and_read(
        mocker,
        "SELECT a, b, c FROM t",
        [
            _select(
                "SELECT a, b, c FROM t",
                ["a", "b", "c"],
                [(1, "x", 1.5), (None, None, None), (3, "zé", 2.25)],
            )
        ],
        write_msgpack=use_msgpack,
    )

    assert result.status == QueryStatus.SUCCESS, result.error_message
    df = result.statements[0].data
    assert isinstance(df, pd.DataFrame)
    assert result.statements[0].row_count == 3
    # Integer columns with nulls keep ``None``, as in the synchronous path.
    assert df["a"].tolist() == [1, None, 3]
    assert df["b"].tolist()[0] == "x"
    assert df["b"].tolist()[2] == "zé"
    assert pd.isna(df["b"].tolist()[1])
    assert df["c"].tolist()[0] == 1.5
    assert pd.isna(df["c"].tolist()[1])


@pytest.mark.parametrize("use_msgpack", [True, False])
def test_async_result_dml_statement(
    mocker: MockerFixture, app_context: None, use_msgpack: bool
) -> None:
    """A DML statement has no data and keeps its affected row count."""
    result = _store_and_read(
        mocker,
        "UPDATE t SET a = 1",
        [("UPDATE t SET a = 1", None, 3.0, 7)],
        write_msgpack=use_msgpack,
    )

    assert result.status == QueryStatus.SUCCESS, result.error_message
    statement = result.statements[0]
    assert statement.data is None
    assert statement.row_count == 7


@pytest.mark.parametrize("use_msgpack", [True, False])
def test_async_result_multi_statement(
    mocker: MockerFixture, app_context: None, use_msgpack: bool
) -> None:
    """Each statement of a multi-statement script is decoded independently."""
    sql = "SELECT 1 AS a; UPDATE t SET a = 1; SELECT 'b' AS b, 2 AS c"
    result = _store_and_read(
        mocker,
        sql,
        [
            _select("SELECT 1 AS a", ["a"], [(1,)]),
            ("UPDATE t SET a = 1", None, 1.0, 2),
            _select("SELECT 'b' AS b, 2 AS c", ["b", "c"], [("b", 2), ("bb", 3)]),
        ],
        write_msgpack=use_msgpack,
    )

    assert result.status == QueryStatus.SUCCESS, result.error_message
    assert len(result.statements) == 3
    first, dml, last = result.statements
    assert isinstance(first.data, pd.DataFrame)
    assert first.data["a"].tolist() == [1]
    assert dml.data is None
    assert dml.row_count == 2
    assert isinstance(last.data, pd.DataFrame)
    assert last.data.to_dict("records") == [{"b": "b", "c": 2}, {"b": "bb", "c": 3}]
    assert [s.row_count for s in result.statements] == [1, 2, 2]


@pytest.mark.parametrize("write_msgpack,read_msgpack", [(True, False), (False, True)])
def test_async_result_survives_msgpack_setting_change(
    mocker: MockerFixture,
    app_context: None,
    write_msgpack: bool,
    read_msgpack: bool,
) -> None:
    """
    Results stay readable if ``RESULTS_BACKEND_USE_MSGPACK`` differs between
    the worker that wrote them and the process that reads them.
    """
    result = _store_and_read(
        mocker,
        "SELECT 42 AS value",
        [_select("SELECT 42 AS value", ["value"], [(42,)])],
        write_msgpack=write_msgpack,
        read_msgpack=read_msgpack,
    )

    assert result.status == QueryStatus.SUCCESS, result.error_message
    assert result.statements[0].data["value"].tolist() == [42]


@pytest.mark.parametrize(
    "db_status,expected",
    [
        ("stopped", QueryStatus.STOPPED),
        ("failed", QueryStatus.FAILED),
        ("timed_out", QueryStatus.TIMED_OUT),
    ],
)
def test_async_result_non_success_does_not_read_backend(
    mocker: MockerFixture,
    app_context: None,
    db_status: str,
    expected: QueryStatus,
) -> None:
    """Stopped, failed and timed-out handles report status without decoding."""
    backend = MagicMock()
    results_backend_manager = MagicMock()
    results_backend_manager.results_backend = backend
    mocker.patch("superset.results_backend_manager", results_backend_manager)

    query = MagicMock()
    query.status = db_status
    query.error_message = "boom"
    query.results_key = "stale-key"
    mocker.patch(
        "superset.sql.execution.executor.db.session.query"
    ).return_value.filter_by.return_value.one_or_none.return_value = query

    result = SQLExecutor._get_async_query_result(1)

    assert result.status == expected
    assert result.error_message == "boom"
    assert result.statements == []
    backend.get.assert_not_called()


def test_decode_json_statement_data_mixed_and_nested_values() -> None:
    """Mixed-type and nested JSON columns are kept as Python objects."""
    from superset.sql.execution.executor import _decode_async_statement_data

    df = _decode_async_statement_data(
        {
            "data": [
                {"mixed": 1, "nested": {"k": [1, 2]}, "f": 1.5},
                {"mixed": "a", "nested": None, "f": None},
            ],
            "columns": [{"column_name": "mixed"}, {"name": "nested"}, {"name": "f"}],
        }
    )

    assert df is not None
    assert list(df.columns) == ["mixed", "nested", "f"]
    assert df["mixed"].tolist() == [1, "a"]
    assert df["nested"].tolist() == [{"k": [1, 2]}, None]
    assert df["f"].tolist()[0] == 1.5
    assert pd.isna(df["f"].tolist()[1])


class DictCache:
    """Minimal in-memory stand-in for the Flask-Caching data cache."""

    def __init__(self) -> None:
        self.store: dict[str, Any] = {}

    def get(self, key: str) -> Any:
        return self.store.get(key)

    def set(self, key: str, value: Any, timeout: int | None = None) -> bool:
        self.store[key] = value
        return True


def test_cache_hit_returns_dataframes(mocker: MockerFixture, app_context: None) -> None:
    """
    Results served from the data cache keep the ``StatementResult`` contract:
    SELECT data is a DataFrame (empty ones keep their columns, integer nulls
    stay ``None``) and DML data is ``None``. This covers both sync cache hits
    and the cached handle returned by ``execute_async``.
    """
    from superset_core.queries.types import (
        QueryOptions,
        QueryResult,
        StatementResult,
    )

    from superset.extensions import cache_manager
    from superset.models.core import Database

    cache = DictCache()
    mocker.patch.object(cache_manager.data_cache, "get", side_effect=cache.get)
    mocker.patch.object(cache_manager.data_cache, "set", side_effect=cache.set)
    database = Database(id=1, database_name="db", sqlalchemy_uri="sqlite://")
    executor = SQLExecutor(database)
    sql = "SELECT a FROM t; SELECT b FROM t WHERE 1 = 0; UPDATE t SET a = 1"
    options = QueryOptions()

    executor._store_in_cache(
        QueryResult(
            status=QueryStatus.SUCCESS,
            statements=[
                StatementResult(
                    original_sql="SELECT a FROM t",
                    executed_sql="SELECT a FROM t",
                    data=pd.DataFrame({"a": pd.Series([1, None], dtype=object)}),
                    row_count=2,
                ),
                StatementResult(
                    original_sql="SELECT b FROM t WHERE 1 = 0",
                    executed_sql="SELECT b FROM t WHERE 1 = 0",
                    data=pd.DataFrame({"b": pd.Series([], dtype=object)}),
                    row_count=0,
                ),
                StatementResult(
                    original_sql="UPDATE t SET a = 1",
                    executed_sql="UPDATE t SET a = 1",
                    data=None,
                    row_count=4,
                ),
            ],
            total_execution_time_ms=3.0,
        ),
        sql,
        options,
    )

    cached = executor._get_from_cache(sql, options)
    assert cached is not None
    handle = executor._create_cached_handle(cached)

    for result in (cached, handle.get_result()):
        assert result.is_cached is True
        select, empty, dml = result.statements
        assert isinstance(select.data, pd.DataFrame)
        assert select.data["a"].tolist() == [1, None]
        assert isinstance(empty.data, pd.DataFrame)
        assert empty.data.empty
        assert list(empty.data.columns) == ["b"]
        assert dml.data is None
        assert dml.row_count == 4


@pytest.mark.parametrize(
    "use_msgpack,read_msgpack",
    [(True, True), (False, False), (True, False), (False, True)],
)
def test_async_temporal_results_match_sync(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    use_msgpack: bool,
    read_msgpack: bool,
) -> None:
    """Temporal values and dtypes match synchronous execution for both codecs."""
    from datetime import date, datetime, timezone

    from flask import current_app

    from .conftest import create_mock_connection, create_mock_cursor

    sql = "SELECT timestamp_value, date_value, text_value, tz_value FROM t"
    rows = [
        (
            datetime(2026, 1, 2, 3, 4, 5, 123456),
            date(2026, 1, 2),
            "2026-01-02",
            datetime(2026, 1, 2, tzinfo=timezone.utc),
        ),
        (None, None, None, None),
    ]
    columns = ["timestamp_value", "date_value", "text_value", "tz_value"]
    cursor = create_mock_cursor(columns, rows)
    mocker.patch.object(
        database, "get_raw_connection", return_value=create_mock_connection(cursor)
    )
    mocker.patch.object(
        database, "mutate_sql_based_on_config", side_effect=lambda sql, **kw: sql
    )
    mocker.patch.object(database.db_engine_spec, "execute")
    mocker.patch.object(database.db_engine_spec, "fetch_data", return_value=rows)
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )
    sync = database.execute(sql)
    assert sync.status == QueryStatus.SUCCESS, sync.error_message
    result = _store_and_read(
        mocker,
        sql,
        [_select(sql, columns, rows)],
        write_msgpack=use_msgpack,
        read_msgpack=read_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    pd.testing.assert_frame_equal(result.statements[0].data, sync.statements[0].data)


def test_temporal_cache_hit_matches_sync(
    mocker: MockerFixture, app_context: None, database: Database
) -> None:
    """The shared records reader keeps Python temporal values on cache hits."""
    from datetime import date, datetime

    from superset_core.queries.types import QueryOptions, QueryResult, StatementResult

    from superset.extensions import cache_manager

    sql = "SELECT timestamp_value, date_value FROM t"
    expected = _result_set(
        ["timestamp_value", "date_value"],
        [(datetime(2026, 1, 2, 3, 4, 5), date(2026, 1, 2)), (None, None)],
    ).to_pandas_df()
    executor = SQLExecutor(database)
    mocker.patch.object(executor, "_generate_cache_key", return_value="temporal-key")
    cache = DictCache()
    mocker.patch.object(cache_manager.data_cache, "get", side_effect=cache.get)
    mocker.patch.object(cache_manager.data_cache, "set", side_effect=cache.set)
    executor._store_in_cache(
        QueryResult(
            status=QueryStatus.SUCCESS,
            statements=[
                StatementResult(
                    original_sql=sql,
                    executed_sql=sql,
                    data=expected,
                    row_count=2,
                )
            ],
        ),
        sql,
        QueryOptions(),
    )
    cached = executor._get_from_cache(sql, QueryOptions())
    assert cached is not None
    pd.testing.assert_frame_equal(cached.statements[0].data, expected)
    handle = executor._create_cached_handle(cached)
    pd.testing.assert_frame_equal(handle.get_result().statements[0].data, expected)


def _execute_sync(
    mocker: MockerFixture,
    database: Database,
    sql: str,
    columns: list[str],
    rows: list[tuple[Any, ...]],
) -> Any:
    """Execute with a real executor and a cursor returning the given values."""
    from flask import current_app

    from .conftest import create_mock_connection, create_mock_cursor

    cursor = create_mock_cursor(columns, rows)
    mocker.patch.object(
        database, "get_raw_connection", return_value=create_mock_connection(cursor)
    )
    mocker.patch.object(
        database, "mutate_sql_based_on_config", side_effect=lambda sql, **kw: sql
    )
    mocker.patch.object(database.db_engine_spec, "execute")
    mocker.patch.object(database.db_engine_spec, "fetch_data", return_value=rows)
    mocker.patch.dict(
        current_app.config,
        {
            "SQL_QUERY_MUTATOR": None,
            "SQLLAB_TIMEOUT": 30,
            "SQL_MAX_ROW": None,
            "QUERY_LOGGER": None,
        },
    )
    result = database.execute(sql)
    assert result.status == QueryStatus.SUCCESS, result.error_message
    return result


@pytest.mark.parametrize(
    "value",
    [
        pytest.param(time(3, 4, 5), id="time"),
        pytest.param(timedelta(hours=1), id="interval"),
        pytest.param(timedelta(minutes=-15), id="negative_interval"),
        pytest.param(pd.Timedelta(1, unit="ns"), id="nanosecond_interval"),
        pytest.param(2**60, id="int64"),
        pytest.param(Decimal("1.10"), id="decimal"),
        pytest.param(b"binary", id="bytes"),
        pytest.param(b"\xff\x00\x80", id="non_utf8_bytes"),
    ],
)
@pytest.mark.parametrize(
    "write_msgpack,read_msgpack",
    [(False, False), (False, True), (True, True), (True, False)],
)
@pytest.mark.parametrize("include_null", [False, True])
def test_async_scalar_types_match_sync(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    value: Any,
    write_msgpack: bool,
    read_msgpack: bool,
    include_null: bool,
) -> None:
    """Both backend codecs retain scalar values and dtypes, including binary."""
    sql = "SELECT value FROM t"
    rows = [(value,), (None,)] if include_null else [(value,)]
    sync = _execute_sync(mocker, database, sql, ["value"], rows)
    result = _store_and_read(
        mocker,
        sql,
        [_select(sql, ["value"], rows)],
        write_msgpack=write_msgpack,
        read_msgpack=read_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    pd.testing.assert_frame_equal(result.statements[0].data, sync.statements[0].data)


@pytest.mark.parametrize(
    "tz", [ZoneInfo("America/New_York"), timezone(timedelta(hours=-4))]
)
@pytest.mark.parametrize("data_kind", ["populated", "empty", "nulls"])
def test_timezone_cache_hit_dtype_matches_sync(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    tz: Any,
    data_kind: str,
) -> None:
    """Sync and async cache hits keep the original timezone and timestamp unit."""
    from superset_core.queries.types import QueryOptions

    from superset.extensions import cache_manager

    sql = "SELECT value FROM t"
    rows = [
        (datetime(2026, 1, 2, 3, tzinfo=tz),),
        (pd.Timestamp("2026-01-02 03:04:05.123456789", tz=tz),),
        (None,),
    ]
    sync = _execute_sync(mocker, database, sql, ["value"], rows)
    if data_kind == "empty":
        sync.statements[0].data = sync.statements[0].data.iloc[:0]
    elif data_kind == "nulls":
        sync.statements[0].data = sync.statements[0].data.iloc[-1:]
    # Cache records carry no DataFrame index.
    sync.statements[0].data = sync.statements[0].data.reset_index(drop=True)
    cache = DictCache()
    mocker.patch.object(cache_manager.data_cache, "get", side_effect=cache.get)
    mocker.patch.object(cache_manager.data_cache, "set", side_effect=cache.set)
    executor = SQLExecutor(database)
    mocker.patch.object(executor, "_generate_cache_key", return_value="tz-key")
    executor._store_in_cache(sync, sql, QueryOptions())
    cached = executor._get_from_cache(sql, QueryOptions())
    # A fixed-offset tz's dtype string round-trips through pandas' own
    # "UTC+HH:MM" parsing even without a non-null value to infer it from, so
    # every data_kind/tz combination here is a cache hit.
    assert cached is not None
    for result in (
        cached,
        executor.execute(sql),
        executor.execute_async(sql).get_result(),
    ):
        assert result.is_cached
        pd.testing.assert_frame_equal(
            result.statements[0].data, sync.statements[0].data
        )


@pytest.mark.parametrize("use_msgpack", [False, True])
def test_async_legacy_payload_without_schema(
    mocker: MockerFixture, app_context: None, use_msgpack: bool
) -> None:
    """Pre-schema payloads remain readable without guessing types from strings."""
    from datetime import date

    columns = ["value", "date_value"]
    result = _store_and_read(
        mocker,
        "SELECT value, date_value FROM t",
        [
            _select(
                "SELECT value, date_value FROM t",
                columns,
                [("2026-01-02", date(2026, 1, 2)), (None, None)],
            )
        ],
        write_msgpack=use_msgpack,
        read_msgpack=not use_msgpack,
        legacy_records=True,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    pd.testing.assert_frame_equal(
        result.statements[0].data,
        pd.DataFrame(
            {
                "value": ["2026-01-02", None],
                "date_value": [date(2026, 1, 2) if use_msgpack else "2026-01-02", None],
            }
        ),
    )


@pytest.mark.parametrize("async_execution", [False, True])
def test_legacy_cache_without_column_metadata_preserves_values(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    async_execution: bool,
) -> None:
    """Old record caches retain nullable large integers on both entry points."""
    from superset.extensions import cache_manager

    sql = "SELECT id FROM t"
    value = 2**60 + 1
    mocker.patch.object(
        cache_manager.data_cache,
        "get",
        return_value={
            "statements": [
                {
                    "original_sql": sql,
                    "executed_sql": sql,
                    "data": [{"id": value}, {"id": None}],
                    "row_count": 2,
                    "truncated": False,
                    "execution_time_ms": 1.0,
                }
            ],
            "total_execution_time_ms": 1.0,
        },
    )
    executor = SQLExecutor(database)
    mocker.patch.object(executor, "_generate_cache_key", return_value="legacy")
    result = (
        executor.execute_async(sql).get_result()
        if async_execution
        else executor.execute(sql)
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    assert result.is_cached
    assert result.statements[0].data is not None
    assert result.statements[0].data["id"].tolist() == [value, None]
    pd.testing.assert_frame_equal(
        result.statements[0].data,
        pd.DataFrame({"id": pd.Series([value, None], dtype=object)}),
    )


@pytest.mark.parametrize(
    "write_msgpack,read_msgpack",
    [(False, False), (False, True), (True, True), (True, False)],
)
@pytest.mark.parametrize("value", [{"key": [1, 2]}, [1, {"key": 2}]])
def test_async_json_nested_values_match_sync(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    write_msgpack: bool,
    read_msgpack: bool,
    value: Any,
) -> None:
    """Schema-based restoration does not stringify original nested JSON values."""
    sql = "SELECT value FROM t"
    rows = [(value,), ('{"looks": "json"}',), (None,)]
    sync = _execute_sync(mocker, database, sql, ["value"], rows)
    result = _store_and_read(
        mocker,
        sql,
        [_select(sql, ["value"], rows)],
        write_msgpack=write_msgpack,
        read_msgpack=read_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    pd.testing.assert_frame_equal(result.statements[0].data, sync.statements[0].data)


@pytest.mark.parametrize(
    "write_msgpack,read_msgpack",
    [(False, False), (False, True), (True, True), (True, False)],
)
@pytest.mark.parametrize("values", [[1, 2**60], [0, -1, 2**60, None]])
def test_async_mixed_large_integers_match_sync(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    write_msgpack: bool,
    read_msgpack: bool,
    values: list[Any],
) -> None:
    """Large IDs mixed with small sentinels never pass through JSON coercion."""
    sql = "SELECT value FROM t"
    rows = [(value,) for value in values]
    sync = _execute_sync(mocker, database, sql, ["value"], rows)
    result = _store_and_read(
        mocker,
        sql,
        [_select(sql, ["value"], rows)],
        write_msgpack=write_msgpack,
        read_msgpack=read_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    pd.testing.assert_frame_equal(result.statements[0].data, sync.statements[0].data)


@pytest.mark.parametrize(
    "write_msgpack,read_msgpack",
    [(False, False), (False, True), (True, True), (True, False)],
)
def test_async_month_day_nano_interval_matches_sync(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    write_msgpack: bool,
    read_msgpack: bool,
) -> None:
    """Intervals unsupported by JSON inference use the same Arrow path as sync."""
    import pyarrow as pa

    sql = "SELECT value FROM t"
    rows = [(pa.MonthDayNano([2, 3, 4]),), (None,)]
    sync = _execute_sync(mocker, database, sql, ["value"], rows)
    result = _store_and_read(
        mocker,
        sql,
        [_select(sql, ["value"], rows)],
        write_msgpack=write_msgpack,
        read_msgpack=read_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    pd.testing.assert_frame_equal(result.statements[0].data, sync.statements[0].data)


@pytest.mark.parametrize("async_execution", [False, True])
@pytest.mark.parametrize(
    "cached",
    [
        {"statements": [{"data": []}]},
        {
            "statements": [
                {
                    "original_sql": "SELECT 1",
                    "executed_sql": "SELECT 1",
                    "data": [{"value": 1}],
                    "columns": ["value"],
                    "dtypes": ["int64", "object"],
                    "row_count": 1,
                    "execution_time_ms": 1,
                }
            ]
        },
    ],
)
def test_corrupt_cache_is_a_miss(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    async_execution: bool,
    cached: dict[str, Any],
) -> None:
    """Both entry points execute again rather than fail on unreadable cache data."""
    from superset.extensions import cache_manager

    sql = "SELECT 1 AS value"
    _execute_sync(mocker, database, sql, ["value"], [(1,)])
    executor = SQLExecutor(database)
    mocker.patch.object(executor, "_generate_cache_key", return_value="corrupt")
    mocker.patch.object(cache_manager.data_cache, "get", return_value=cached)
    if async_execution:
        submit = mocker.patch(
            "superset.sql.execution.celery_task.execute_sql_task.delay"
        )
        query = mocker.patch.object(executor, "_create_query_record").return_value
        query.id = 42
        handle = executor.execute_async(sql)
        assert handle.query_id == 42
        submit.assert_called_once()
    else:
        result = executor.execute(sql)
        assert result.status == QueryStatus.SUCCESS, result.error_message
        assert not result.is_cached
        assert result.statements[0].data is not None
        assert result.statements[0].data["value"].tolist() == [1]


@pytest.mark.parametrize("use_msgpack", [False, True])
def test_async_payload_uses_one_arrow_format(
    mocker: MockerFixture,
    app_context: None,
    use_msgpack: bool,
) -> None:
    """SELECT data carries its schema once, with Base64 only for JSON transport."""
    import base64

    import pyarrow as pa

    mocker.patch("superset.results_backend_use_msgpack", use_msgpack)
    payload: dict[str, Any] = {}
    _finalize_successful_query(
        MagicMock(),
        SQLScript("SELECT 1", engine="sqlite"),
        [_select("SELECT 1", ["value"], [(1,)])],
        payload,
        1.0,
    )
    statement = payload["statements"][0]
    assert "arrow_schema" not in statement
    assert "temporal_schema" not in statement
    data = statement["data"]
    if not use_msgpack:
        assert isinstance(data, str)
        data = base64.b64decode(data)
    assert isinstance(data, bytes)
    assert pa.ipc.open_stream(data).read_all().to_pydict() == {"value": [1]}


@pytest.mark.parametrize("use_msgpack", [True, False])
@pytest.mark.parametrize("value", [2**70, -(2**70)])
def test_async_nested_oversized_integer_matches_sync(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    use_msgpack: bool,
    value: int,
) -> None:
    """Nested integers outside MessagePack's range must not fail the query."""
    sql = "SELECT value FROM t"
    rows = [({"a": [value]},), (None,)]
    sync = _execute_sync(mocker, database, sql, ["value"], rows)
    result = _store_and_read(
        mocker,
        sql,
        [_select(sql, ["value"], rows)],
        write_msgpack=use_msgpack,
        read_msgpack=not use_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    pd.testing.assert_frame_equal(result.statements[0].data, sync.statements[0].data)
    actual = result.statements[0].data["value"][0]["a"][0]
    expected = sync.statements[0].data["value"][0]["a"][0]
    assert actual == expected
    assert type(actual) is type(expected)


@pytest.mark.parametrize("use_msgpack", [True, False])
@pytest.mark.parametrize(
    "value",
    [
        pytest.param(datetime(2026, 1, 2, 3, 4, 5, 123456), id="datetime"),
        pytest.param(
            datetime(2026, 1, 2, 3, 4, 5, 123456, tzinfo=timezone.utc),
            id="aware_datetime",
        ),
        pytest.param(
            datetime(2026, 1, 2, 3, 4, 5, 123456, tzinfo=timezone(timedelta(hours=-4))),
            id="offset_datetime",
        ),
        pytest.param(UUID("12345678-1234-5678-1234-567812345678"), id="uuid"),
        pytest.param(Decimal("1.100000000000000000000001"), id="decimal"),
        pytest.param(b"binary", id="bytes"),
        pytest.param(b"\xff\x00\x80", id="non_utf8_bytes"),
    ],
)
def test_async_nested_scalar_types_match_sync(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    use_msgpack: bool,
    value: Any,
) -> None:
    """Nested non-JSON scalars retain the synchronous value and Python type."""
    sql = "SELECT value FROM t"
    rows = [({"a": [{"b": value}]},), (None,)]
    sync = _execute_sync(mocker, database, sql, ["value"], rows)
    result = _store_and_read(
        mocker,
        sql,
        [_select(sql, ["value"], rows)],
        write_msgpack=use_msgpack,
        read_msgpack=not use_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    actual = result.statements[0].data["value"][0]["a"][0]["b"]
    expected = sync.statements[0].data["value"][0]["a"][0]["b"]
    assert actual == expected
    assert type(actual) is type(expected)
    pd.testing.assert_frame_equal(result.statements[0].data, sync.statements[0].data)


@pytest.mark.parametrize("use_msgpack", [True, False])
@pytest.mark.parametrize(
    "value",
    [
        pytest.param({"a": {1, 2}}, id="set"),
        pytest.param({"a": (1, 2)}, id="tuple"),
        pytest.param({"a": pd.Timestamp("2026-01-02")}, id="scalar_subclass"),
        pytest.param(
            {"a": datetime(2026, 11, 1, 1, 30, tzinfo=ZoneInfo("America/New_York"))},
            id="named_timezone",
        ),
    ],
)
def test_async_unsupported_nested_types_use_arrow_strings(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    use_msgpack: bool,
    value: Any,
) -> None:
    """Unsupported types fall back for the column without failing the query."""
    sql = "SELECT value FROM t"
    rows = [(value,), ({"a": [3]},), (None,)]
    sync = _execute_sync(mocker, database, sql, ["value"], rows)
    result_set = _result_set(["value"], rows)
    result = _store_and_read(
        mocker,
        sql,
        [(sql, result_set, 5.0, len(rows))],
        write_msgpack=use_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    actual = result.statements[0].data
    pd.testing.assert_frame_equal(
        actual, SupersetResultSet.convert_table_to_df(result_set.pa_table)
    )
    assert isinstance(actual["value"][0], str)
    assert actual["value"][0] != sync.statements[0].data["value"][0]
    assert type(actual["value"][0]) is not type(sync.statements[0].data["value"][0])
    assert actual["value"][1] == '{"a": [3]}'
    # StringDtype's missing-value sentinel is float nan, not None.
    assert pd.isna(actual["value"][2])


def test_legacy_nested_oversized_integer_matches_sync() -> None:
    """Legacy record decoding also tolerates nested integers outside int64."""
    from superset.sql.execution.executor import _decode_async_statement_data

    value = {"a": 2**70}
    result = _decode_async_statement_data(
        {"data": [{"value": value}], "columns": [{"name": "value"}]}
    )
    assert result is not None
    pd.testing.assert_frame_equal(
        result, _result_set(["value"], [(value,)]).to_pandas_df()
    )
    assert type(result["value"][0]["a"]) is int


def test_nested_sidecar_rejects_unknown_type_tag() -> None:
    """Unknown sidecar extensions are rejected rather than guessed as scalars."""
    import base64

    import msgpack

    from superset.sql.execution.serialization import deserialize_nested_columns

    data = msgpack.dumps([msgpack.ExtType(99, b"unknown")], use_bin_type=True)
    with pytest.raises(ValueError, match="Unsupported nested SQL type tag"):
        deserialize_nested_columns({"value": base64.b64encode(data).decode("ascii")})


def test_decode_legacy_records_without_column_metadata() -> None:
    """Legacy records can supply their own column names without metadata."""
    from superset.sql.execution.executor import _decode_async_statement_data

    pd.testing.assert_frame_equal(
        _decode_async_statement_data({"data": [{"value": 2**60 + 1}, {"value": None}]}),
        pd.DataFrame({"value": pd.Series([2**60 + 1, None], dtype=object)}),
    )


@pytest.mark.parametrize(
    "records,expected",
    [
        pytest.param([], pd.DataFrame(), id="empty"),
        pytest.param([{}, {}], pd.DataFrame([{}, {}]), id="empty_rows"),
        pytest.param(
            [{"b": 2**60 + 1}, {"a": "later"}],
            pd.DataFrame(
                {
                    "b": pd.Series([2**60 + 1, None], dtype=object),
                    "a": [None, "later"],
                }
            ),
            id="ordered_union",
        ),
        pytest.param([(1,), (2,)], pd.DataFrame({0: [1, 2]}), id="positional"),
    ],
)
def test_legacy_record_column_inference(
    records: list[Any], expected: pd.DataFrame
) -> None:
    """Inferred names include later keys in order without losing empty rows."""
    from superset.sql.execution.executor import _records_to_dataframe

    pd.testing.assert_frame_equal(_records_to_dataframe(records, []), expected)


def test_records_to_dataframe_unparseable_dtype_falls_back_to_inference() -> None:
    """A dtype string pandas cannot parse falls back to value inference."""
    from superset.sql.execution.executor import _records_to_dataframe

    result = _records_to_dataframe(
        [{"value": "a"}, {"value": None}], ["value"], ["not-a-dtype"]
    )

    assert list(result["value"].iloc[:1]) == ["a"]
    assert pd.isna(result["value"].iloc[1])


def test_records_to_dataframe_unparseable_dtype_without_values_raises() -> None:
    """Without a non-null value there is nothing to infer from, so it raises."""
    from superset.sql.execution.executor import _records_to_dataframe

    with pytest.raises(TypeError):
        _records_to_dataframe([{"value": None}], ["value"], ["not-a-dtype"])


@pytest.mark.parametrize("use_msgpack", [True, False])
@pytest.mark.parametrize("row_count", [1, 50_000])
def test_nested_payload_limit_does_not_charge_duplicate_sidecar(
    mocker: MockerFixture, app_context: None, use_msgpack: bool, row_count: int
) -> None:
    """Nested data below ten MiB is not charged twice by its typed sidecar."""
    mocker.patch.dict(current_app.config, {"SQLLAB_PAYLOAD_MAX_MB": 10})
    value = {"text": "x" * (6 * 1024 * 1024 // row_count)}
    rows = [(value,)] * row_count
    result = _store_and_read(
        mocker,
        "SELECT value",
        [_select("SELECT value", ["value"], rows)],
        write_msgpack=use_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    assert result.statements[0].data["value"].tolist() == [value] * row_count


@pytest.mark.parametrize("use_msgpack", [True, False])
def test_nested_binary_payload_limit_rejects_sidecar_only_bytes(
    mocker: MockerFixture,
    app_context: None,
    mock_query: MagicMock,
    mock_database: MagicMock,
    use_msgpack: bool,
) -> None:
    """Binary replaced by Arrow placeholders must still count toward the limit."""
    from os import urandom

    from superset.errors import SupersetErrorType
    from superset.sql.execution import celery_task

    rows = [([b"\xff\xff" + urandom(4095)],) for _ in range(300)]
    result_set = _result_set(["value"], rows)
    # Invalid UTF-8 and odd-length UTF-16 become tiny placeholders in Arrow.
    assert result_set.pa_table.column("value").to_pylist() == ['["[bytes]"]'] * 300
    assert sum(len(row[0][0]) for row in rows) > 1024 * 1024
    mocker.patch("superset.results_backend_use_msgpack", use_msgpack)
    mocker.patch.dict(current_app.config, {"SQLLAB_PAYLOAD_MAX_MB": 1})
    backend = mocker.patch.object(celery_task, "results_backend")
    backend.set.return_value = True
    mock_query.sql = "SELECT value"
    mock_query.database = mock_database
    mock_database.is_oauth2_enabled.return_value = False
    mocker.patch.object(celery_task, "_get_query", return_value=mock_query)
    mocker.patch.object(celery_task, "security_manager")
    mocker.patch.object(celery_task, "_commit_query_unless_stopped", return_value=True)
    mocker.patch.object(
        celery_task,
        "execute_sql_with_cursor",
        return_value=[("SELECT value", result_set, 1.0, len(rows))],
    )

    payload = celery_task.execute_sql_task(mock_query.id, mock_query.sql)

    assert payload is not None
    assert payload["status"] == "failed"
    assert (
        payload["errors"][0]["error_type"] == SupersetErrorType.RESULT_TOO_LARGE_ERROR
    )
    assert mock_query.status == "failed"
    backend.set.assert_not_called()
    assert mock_query.results_key is None


@pytest.mark.parametrize("use_msgpack", [True, False])
def test_sync_nested_binary_does_not_use_backend_payload_limit(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    use_msgpack: bool,
) -> None:
    """The in-process DataFrame path has no results-backend payload or sidecar."""
    mocker.patch("superset.results_backend_use_msgpack", use_msgpack)
    mocker.patch.dict(current_app.config, {"SQLLAB_PAYLOAD_MAX_MB": 1})
    backend = mocker.patch("superset.sql.execution.celery_task.results_backend")
    value = [b"\xff" * (1024 * 1024 + 1)]
    result = _execute_sync(mocker, database, "SELECT value", ["value"], [(value,)])

    assert result.statements[0].data["value"].tolist() == [value]
    backend.set.assert_not_called()


def test_msgpack_nested_sidecar_uses_raw_bytes(
    mocker: MockerFixture, app_context: None
) -> None:
    """MessagePack does not need a Base64 wrapper around nested values."""
    import msgpack

    mocker.patch("superset.results_backend_use_msgpack", True)
    payload: dict[str, Any] = {}
    _finalize_successful_query(
        MagicMock(),
        SQLScript("SELECT value", engine="sqlite"),
        [_select("SELECT value", ["value"], [([1, 2],)])],
        payload,
        1.0,
    )
    data = payload["statements"][0]["nested_columns_msgpack"]["value"]
    assert isinstance(data, bytes)
    assert msgpack.loads(data) == [[1, 2]]


@pytest.mark.parametrize("use_msgpack", [True, False])
@pytest.mark.parametrize(
    "invalid",
    [
        "unknown_tag",
        "invalid_base64",
        "wrong_length",
        "missing_column",
        "scalar",
        "tag1",
        "tag2",
        "tag3",
        "tag4",
        "tag5",
        "tag6",
        "tag7_unpack",
        "tag7_shape",
        "tag7_type",
        "tag7_overflow",
        "tag4_nonascii",
    ],
)
def test_bad_nested_sidecar_keeps_arrow_and_other_columns(
    mocker: MockerFixture, app_context: None, use_msgpack: bool, invalid: str
) -> None:
    """One unreadable sidecar cannot discard statements or valid sidecars."""
    import base64

    import msgpack

    from superset.sql.execution.serialization import serialize_nested_columns

    bad: bytes | str
    if invalid == "unknown_tag":
        bad = base64.b64encode(msgpack.dumps([msgpack.ExtType(99, b"future")])).decode()
    elif invalid.startswith("tag"):
        code = int(invalid[3])
        payload = {
            "tag7_unpack": b"\xc1",
            "tag7_shape": msgpack.dumps([1, 2]),
            "tag7_type": msgpack.dumps(["bad", 0, 0]),
            "tag7_overflow": msgpack.dumps([2**63, 0, 0]),
            "tag4_nonascii": b"\xff",
        }.get(invalid, b"malformed")
        data = msgpack.dumps([msgpack.ExtType(code, payload)])
        bad = data if use_msgpack else base64.b64encode(data).decode("ascii")
    elif invalid == "invalid_base64":
        bad = "!"
    elif invalid == "missing_column":
        bad = serialize_nested_columns({"missing": [[1, 2]]})["missing"]
    else:
        bad = base64.b64encode(
            msgpack.dumps(42 if invalid == "scalar" else [])
        ).decode()
    good = serialize_nested_columns({"good": [[3, 4]]})["good"]
    mocker.patch(
        "superset.sql.execution.celery_task.serialize_nested_columns",
        return_value={
            "missing" if invalid == "missing_column" else "bad": bad,
            "good": good,
        },
    )
    result = _store_and_read(
        mocker,
        "SELECT bad, good",
        [_select("SELECT bad, good", ["bad", "good"], [([1, 2], [3, 4])])],
        write_msgpack=use_msgpack,
        read_msgpack=not use_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    assert list(result.statements[0].data.columns) == ["bad", "good"]
    assert result.statements[0].data["bad"].tolist() == ["[1, 2]"]
    assert result.statements[0].data["good"].tolist() == [[3, 4]]


@pytest.mark.parametrize("use_msgpack", [True, False])
@pytest.mark.parametrize(
    "value",
    [
        date(2026, 1, 1),
        time(3, 4, 5, 123456),
        time(3, 4, 5, tzinfo=timezone(timedelta(hours=3))),
        timedelta(days=-2, seconds=3, microseconds=456),
    ],
)
def test_nested_temporal_scalars_match_sync(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    use_msgpack: bool,
    value: Any,
) -> None:
    """Date, time and interval tags preserve values without losing nearby rows."""
    rows = [([value],), ([1, 2],), (None,)]
    sync = _execute_sync(mocker, database, "SELECT value", ["value"], rows)
    result = _store_and_read(
        mocker,
        "SELECT value",
        [_select("SELECT value", ["value"], rows)],
        write_msgpack=use_msgpack,
        read_msgpack=not use_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    pd.testing.assert_frame_equal(result.statements[0].data, sync.statements[0].data)
    assert type(result.statements[0].data["value"][0][0]) is type(value)


@pytest.mark.parametrize("use_msgpack", [True, False])
def test_deep_nested_sidecar_falls_back_to_arrow(
    mocker: MockerFixture, app_context: None, use_msgpack: bool
) -> None:
    """Recursion limits in optional sidecars must not fail an async result."""
    value: Any = 1
    for _ in range(550):
        value = [value]
    result_set = _result_set(["value"], [(value,)])
    result = _store_and_read(
        mocker,
        "SELECT value",
        [("SELECT value", result_set, 1.0, 1)],
        write_msgpack=use_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    pd.testing.assert_frame_equal(
        result.statements[0].data,
        SupersetResultSet.convert_table_to_df(result_set.pa_table),
    )


def test_unsupported_nested_sidecar_logs_fallback(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Unsupported column fallback is observable without logging SQL values."""
    import logging

    from superset.sql.execution.serialization import serialize_nested_columns

    with caplog.at_level(logging.DEBUG):
        assert serialize_nested_columns({"value": [[{1, 2}], [3, 4]]}) == {}
    assert "value" in caplog.text
    assert "Arrow" in caplog.text
    assert "{1, 2}" not in caplog.text


@pytest.mark.parametrize("failure", ["backend", "decode"])
@pytest.mark.parametrize("async_execution", [True, False])
def test_cache_failure_logs_exception_and_source(
    mocker: MockerFixture,
    app_context: None,
    database: Database,
    caplog: pytest.LogCaptureFixture,
    failure: str,
    async_execution: bool,
) -> None:
    """Cache backend outages and malformed entries retain distinct diagnostics."""
    import logging

    from superset.extensions import cache_manager

    sql = "SELECT 1 AS value"
    _execute_sync(mocker, database, sql, ["value"], [(1,)])
    executor = SQLExecutor(database)
    mocker.patch.object(executor, "_generate_cache_key", return_value="broken")
    error = (
        ConnectionError("cache unavailable")
        if failure == "backend"
        else ValueError("bad cache")
    )
    get = mocker.patch.object(cache_manager.data_cache, "get")
    if failure == "backend":
        get.side_effect = error
    else:
        get.return_value = {
            "statements": [
                {
                    "original_sql": sql,
                    "executed_sql": sql,
                    "data": [],
                    "columns": ["value"],
                }
            ]
        }
        mocker.patch(
            "superset.sql.execution.executor._records_to_dataframe", side_effect=error
        )
    with caplog.at_level(logging.WARNING):
        if async_execution:
            mocker.patch("superset.sql.execution.celery_task.execute_sql_task.delay")
            mocker.patch.object(executor, "_create_query_record").return_value.id = 42
            assert executor.execute_async(sql).query_id == 42
        else:
            assert executor.execute(sql).status == QueryStatus.SUCCESS
    records = [
        record
        for record in caplog.records
        if record.exc_info and record.exc_info[1] is error
    ]
    assert len(records) == 1
    assert (
        "read SQL result cache" if failure == "backend" else "decode cached SQL result"
    ) in records[0].message


@pytest.mark.parametrize("use_msgpack", [True, False])
@pytest.mark.parametrize("sidecars", [None, [], "future-format"])
def test_non_dict_nested_sidecars_preserve_statements(
    mocker: MockerFixture,
    app_context: None,
    use_msgpack: bool,
    sidecars: object,
) -> None:
    """Unknown sidecar containers retain Arrow columns and other statements."""
    mocker.patch.dict(current_app.config, {"SQLLAB_PAYLOAD_MAX_MB": 0})
    mocker.patch(
        "superset.sql.execution.celery_task.serialize_nested_columns",
        return_value=sidecars,
    )
    result = _store_and_read(
        mocker,
        "SELECT nested, scalar; SELECT other",
        [
            _select("SELECT nested, scalar", ["nested", "scalar"], [([1, 2], 42)]),
            _select("SELECT other", ["other"], [(7,)]),
        ],
        write_msgpack=use_msgpack,
        read_msgpack=not use_msgpack,
    )
    assert result.status == QueryStatus.SUCCESS, result.error_message
    pd.testing.assert_frame_equal(
        result.statements[0].data,
        pd.DataFrame({"nested": ["[1, 2]"], "scalar": [42]}),
    )
    pd.testing.assert_frame_equal(
        result.statements[1].data, pd.DataFrame({"other": [7]})
    )


@pytest.mark.parametrize("use_msgpack", [True, False])
def test_nested_payload_size_does_not_decode_arrow(
    mocker: MockerFixture, app_context: None, use_msgpack: bool
) -> None:
    """Size accounting uses the writer's column sizes without reopening IPC."""
    import base64

    import pyarrow as pa

    from superset.sql.execution.celery_task import _get_payload_size, _serialize_payload

    mocker.patch("superset.results_backend_use_msgpack", use_msgpack)
    result_set = _result_set(
        ["nested", "binary", "scalar"], [([1, 2], [b"\xff\xff\xff"], 42)]
    )
    payload: dict[str, Any] = {}
    query = MagicMock()
    query.to_dict.return_value = {"id": 1}
    _finalize_successful_query(
        query,
        SQLScript("SELECT nested, binary, scalar", engine="sqlite"),
        [("SELECT nested, binary, scalar", result_set, 1.0, 1)],
        payload,
        1.0,
    )
    statement = payload["statements"][0]
    sizes = {
        name: result_set.pa_table.column(name).nbytes
        for name in result_set.nested_columns
    }
    data = statement["data"]
    table = pa.ipc.open_stream(
        data if use_msgpack else base64.b64decode(data)
    ).read_all()
    assert sizes == {name: table.column(name).nbytes for name in sizes}
    serialized = _serialize_payload(payload)
    expected_size = len(serialized)
    if not use_msgpack:
        expected_size -= len(data) - len(base64.b64decode(data))
    for name, value in statement["nested_columns_msgpack"].items():
        raw_size = len(value if use_msgpack else base64.b64decode(value))
        expected_size -= len(value) - raw_size + min(raw_size, sizes[name])
    mocker.patch("base64.b64decode", side_effect=AssertionError("decoded Arrow"))
    mocker.patch(
        "pyarrow.ipc.open_stream", side_effect=AssertionError("reopened Arrow")
    )

    assert _get_payload_size(payload, serialized) == expected_size
    assert statement["nested_columns_arrow_nbytes"] == sizes
