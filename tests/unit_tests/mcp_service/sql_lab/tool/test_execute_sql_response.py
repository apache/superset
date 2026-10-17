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

"""Regression tests for compact SQL execution responses."""

from typing import Any

import pandas as pd
import pytest
from superset_core.queries.types import QueryResult, QueryStatus, StatementResult

from superset.mcp_service.sql_lab.tool.execute_sql import _convert_to_response


@pytest.mark.parametrize("cached", [False, True])
@pytest.mark.parametrize("empty", [False, True])
def test_single_select_returns_data_once(cached: bool, empty: bool) -> None:
    """A single SELECT exposes rows and columns only at the top level."""
    rows = [] if empty else [{"x": 1}]
    result = QueryResult(
        status=QueryStatus.SUCCESS,
        statements=[
            StatementResult(
                original_sql="SELECT 1 AS x",
                executed_sql="SELECT 1 AS x",
                data=rows if cached else pd.DataFrame(rows, columns=["x"]),
                row_count=len(rows),
                truncated=True,
                execution_time_ms=2.0,
            )
        ],
        is_cached=cached,
    )

    response = _convert_to_response(result).model_dump(mode="json")

    assert response["success"] is True
    assert response["rows"] == rows
    assert response["row_count"] == len(rows)
    if not cached or not empty:
        assert response["columns"][0]["name"] == "x"
    statement = response["statements"][0]
    assert statement["data"] is None
    assert statement["original_sql"] == "SELECT 1 AS x"
    assert statement["executed_sql"] is None
    assert statement["row_count"] == len(rows)
    assert statement["truncated"] is True
    assert statement["execution_time_ms"] == 2.0
    assert response["multi_statement_warning"] is None
    # Converting must not discard data from the QueryResult (including cache hits).
    assert result.statements[0].data is not None


@pytest.mark.parametrize("trailing_dml", [False, True])
def test_multi_select_preserves_earlier_results(trailing_dml: bool) -> None:
    """Identical SELECTs are distinct results; trailing DML is not the last result."""
    statements = [
        StatementResult(
            original_sql="SELECT 1 AS x",
            executed_sql="SELECT 1 AS x",
            data=pd.DataFrame([{"x": 1}]),
            row_count=1,
        )
        for _ in range(2)
    ]
    if trailing_dml:
        statements.append(
            StatementResult(
                original_sql="UPDATE users SET active = true",
                executed_sql="UPDATE users SET active = true",
                data=None,
                row_count=5,
            )
        )
    result = QueryResult(status=QueryStatus.SUCCESS, statements=statements)

    response = _convert_to_response(result).model_dump(mode="json")

    assert response["rows"] == [{"x": 1}]
    assert response["row_count"] == 1
    assert response["affected_rows"] is None
    assert response["statements"][0]["data"]["rows"] == [{"x": 1}]
    assert response["statements"][0]["data"]["columns"] == response["columns"]
    assert response["statements"][1]["data"] is None
    if trailing_dml:
        assert response["statements"][2]["data"] is None
        assert response["statements"][2]["row_count"] == 5
    assert all(stmt["executed_sql"] is None for stmt in response["statements"])
    assert "2 data-bearing statements" in response["multi_statement_warning"]


@pytest.mark.parametrize("executed_sql", ["SELECT 1 AS x", "SELECT 1 AS x LIMIT 10"])
def test_executed_sql_only_when_transformed(executed_sql: str) -> None:
    """Retain transformed SQL, but do not repeat an unchanged SQL string."""
    result = QueryResult(
        status=QueryStatus.SUCCESS,
        statements=[
            StatementResult(
                original_sql="SELECT 1 AS x",
                executed_sql=executed_sql,
                data=[{"x": 1}],
                row_count=1,
            )
        ],
    )

    response: dict[str, Any] = _convert_to_response(result).model_dump(mode="json")

    statement = response["statements"][0]
    assert statement["original_sql"] == "SELECT 1 AS x"
    assert statement["executed_sql"] == (
        None if executed_sql == "SELECT 1 AS x" else executed_sql
    )
