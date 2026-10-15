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

from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pytest
from pytest_mock import MockerFixture
from superset_core.queries.types import QueryStatus

from superset.db_engine_specs.sqlite import SqliteEngineSpec
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
    _store_results_in_backend(query, payload, database)
    assert query.results_key in backend.store

    if read_msgpack is not None:
        mocker.patch("superset.results_backend_use_msgpack", read_msgpack)

    mocker.patch(
        "superset.sql.execution.executor.db.session.query"
    ).return_value.filter_by.return_value.one_or_none.return_value = query
    return SQLExecutor._get_async_query_result(query.id)


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
