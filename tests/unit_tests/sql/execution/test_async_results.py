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

from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Any
from unittest.mock import MagicMock
from uuid import UUID
from zoneinfo import ZoneInfo

import pandas as pd
import pytest
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
    if data_kind != "populated" and not isinstance(tz, ZoneInfo):
        # Unparseable timezone metadata cannot be inferred without any values.
        assert cached is None
        return
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


def test_legacy_cache_without_dtypes(mocker: MockerFixture, app_context: None) -> None:
    """Record caches written before dtype metadata still load."""
    from superset_core.queries.types import QueryOptions

    from superset.extensions import cache_manager

    mocker.patch.object(
        cache_manager.data_cache,
        "get",
        return_value={
            "statements": [
                {
                    "original_sql": "SELECT value FROM t",
                    "executed_sql": "SELECT value FROM t",
                    "data": [{"value": 1}, {"value": None}],
                    "columns": ["value"],
                    "row_count": 2,
                    "execution_time_ms": 1.0,
                }
            ]
        },
    )
    executor = SQLExecutor(MagicMock())
    mocker.patch.object(executor, "_generate_cache_key", return_value="legacy")
    result = executor._get_from_cache("SELECT value FROM t", QueryOptions())
    assert result is not None
    pd.testing.assert_frame_equal(
        result.statements[0].data,
        pd.DataFrame({"value": pd.Series([1, None], dtype=object)}),
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
    assert actual["value"][2] is None


def test_legacy_nested_sidecar_remains_readable() -> None:
    """Read the untyped sidecar without interpreting JSON-looking strings."""
    from superset.sql.execution.executor import _decode_async_statement_data
    from superset.sqllab.utils import write_ipc_buffer

    result_set = _result_set(["value"], [({"a": [1]},), (None,)])
    statement = {
        "data": write_ipc_buffer(result_set.pa_table).to_pybytes(),
        "nested_columns": {"value": [{"a": [1]}, None]},
    }
    pd.testing.assert_frame_equal(
        _decode_async_statement_data(statement), result_set.to_pandas_df()
    )


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
        _decode_async_statement_data({"data": [{"value": 1}]}),
        pd.DataFrame({"value": [1]}),
    )
