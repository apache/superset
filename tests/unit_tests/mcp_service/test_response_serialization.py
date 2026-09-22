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

"""Serialization contract for the data-bearing MCP tool responses.

FastMCP renders every tool return value through
``pydantic_core.to_json(value, fallback=str)``. ``fallback`` only fires for
types pydantic does not recognise, so a recognised-but-unrenderable value
(non-UTF-8 ``bytes``, ``pandas.NaT``) raises ``PydanticSerializationError`` and
destroys the whole tool call after the warehouse query already succeeded.
These tests drive that real serializer — asserting on field values alone is
what let the failure recur after it was first patched.
"""

from __future__ import annotations

from typing import Any, Callable

import pandas as pd
import pytest
from fastmcp.tools.base import default_serializer
from pydantic import BaseModel
from pydantic_core import to_jsonable_python

from superset.mcp_service.chart.schemas import (
    ChartData,
    ChartQueryResult,
    DataColumn,
    PerformanceMetadata,
)
from superset.mcp_service.common.cache_schemas import CacheStatus
from superset.mcp_service.dashboard.schemas import (
    DashboardChartData,
    DashboardChartQueryData,
)
from superset.mcp_service.dataset.schemas import QueryDatasetResponse
from superset.mcp_service.semantic_layer.schemas import GetTableResponse
from superset.mcp_service.sql_lab.schemas import (
    ExecuteSqlResponse,
    StatementData,
    StatementInfo,
)
from superset.mcp_service.utils.serialization import BINARY_PREFIX
from superset.utils.json import loads as json_loads

#: A row as a driver can really hand it back: an undecodable BLOB and a null
#: timestamp materialised as ``pandas.NaT``.
HOSTILE_ROW: dict[str, Any] = {
    "blob": b"\xff\xfe\x00\x01",
    "ts": pd.NaT,
    "ratio": float("nan"),
    "nested": {"inner": b"\x80"},
}

#: Some engines report ``rowcount`` as a float. A fractional value is used
#: deliberately: pydantic accepts an integral float for an ``int`` field on its
#: own, so only a fractional one proves the coercion is doing the work.
FLOAT_COUNT = 5.7


def _serialize(response: BaseModel) -> dict[str, Any]:
    """Serialize exactly as FastMCP does and parse back as strict JSON.

    ``loads`` defaults to ``allow_nan=False``, so a payload carrying the
    non-standard ``NaN``/``Infinity`` literals fails here too."""
    payload = json_loads(default_serializer(response))
    # Structured content takes the other pydantic_core entry point.
    to_jsonable_python(value=response)
    return payload


def _assert_row_is_safe(row: dict[str, Any]) -> None:
    """Assert that binary, missing, and nested result values are JSON-safe."""
    assert row["blob"].startswith(BINARY_PREFIX)
    assert row["ts"] is None
    assert row["ratio"] is None
    assert row["nested"]["inner"].startswith(BINARY_PREFIX)


def _execute_sql_response() -> ExecuteSqlResponse:
    """Build a SQL Lab response with hostile rows and statement data."""
    return ExecuteSqlResponse(
        success=True,
        rows=[HOSTILE_ROW],
        columns=[],
        row_count=FLOAT_COUNT,
        affected_rows=FLOAT_COUNT,
        statements=[
            StatementInfo(
                original_sql="SELECT 1",
                executed_sql="SELECT 1",
                row_count=FLOAT_COUNT,
                data=StatementData(rows=[HOSTILE_ROW], columns=[]),
            )
        ],
    )


def _data_column() -> DataColumn:
    """Column metadata derives its samples and stats from the rows, so it
    carries the same hostile values."""
    return DataColumn(
        name="blob",
        display_name="blob",
        data_type="bytes",
        sample_values=[b"\xff\xfe", pd.NaT],
        null_count=1,
        unique_count=2,
        statistics={"min": b"\xff\xfe"},
    )


def _chart_data() -> ChartData:
    """Build a chart response with hostile rows, metadata, and query results."""
    return ChartData(
        chart_id=1,
        chart_name="chart",
        chart_type="table",
        columns=[_data_column()],
        data=[HOSTILE_ROW],
        query_results=[
            ChartQueryResult(
                query_index=0,
                columns=["blob"],
                data=[HOSTILE_ROW],
                row_count=FLOAT_COUNT,
                total_rows=FLOAT_COUNT,
            )
        ],
        row_count=FLOAT_COUNT,
        total_rows=FLOAT_COUNT,
        data_freshness=None,
        summary="summary",
        insights=[],
        data_quality={},
        recommended_visualizations=[],
        performance=PerformanceMetadata(
            query_duration_ms=42, cache_status="fresh_query"
        ),
        cache_status=CacheStatus(cache_hit=False),
    )


def _query_dataset_response() -> QueryDatasetResponse:
    """Build a dataset response with hostile rows and column metadata."""
    return QueryDatasetResponse(
        dataset_id=1,
        dataset_name="dataset",
        columns=[_data_column()],
        data=[HOSTILE_ROW],
        row_count=FLOAT_COUNT,
        total_rows=FLOAT_COUNT,
    )


def _get_table_response() -> GetTableResponse:
    """Build a semantic-layer table response with hostile warehouse values."""
    return GetTableResponse(
        columns=[_data_column()],
        data=[HOSTILE_ROW],
        row_count=FLOAT_COUNT,
        total_rows=FLOAT_COUNT,
        summary="summary",
        source="builtin",
    )


def _dashboard_chart_data() -> DashboardChartData:
    """Build a dashboard chart response with hostile samples and query data."""
    return DashboardChartData(
        chart_id=1,
        chart_name="chart",
        chart_type="table",
        columns=["blob"],
        sample_data=[HOSTILE_ROW],
        row_count=FLOAT_COUNT,
        total_rows=FLOAT_COUNT,
        queries=[
            DashboardChartQueryData(
                query_index=0,
                columns=["blob"],
                sample_data=[HOSTILE_ROW],
                row_count=FLOAT_COUNT,
                total_rows=FLOAT_COUNT,
            )
        ],
    )


@pytest.mark.parametrize(
    "build,rows_field,count_fields",
    [
        pytest.param(
            _execute_sql_response,
            "rows",
            ("row_count", "affected_rows"),
            id="execute_sql",
        ),
        pytest.param(
            _chart_data, "data", ("row_count", "total_rows"), id="get_chart_data"
        ),
        pytest.param(
            _query_dataset_response,
            "data",
            ("row_count", "total_rows"),
            id="query_dataset",
        ),
        pytest.param(
            _get_table_response, "data", ("row_count", "total_rows"), id="get_table"
        ),
        pytest.param(
            _dashboard_chart_data,
            "sample_data",
            ("row_count", "total_rows"),
            id="get_dashboard_data",
        ),
    ],
)
def test_hostile_result_set_serializes(
    build: Callable[[], BaseModel],
    rows_field: str,
    count_fields: tuple[str, ...],
) -> None:
    """Float row counts and a non-UTF-8 binary column must not abort the call."""
    payload = _serialize(build())

    for field in count_fields:
        assert payload[field] == 5, field
    _assert_row_is_safe(payload[rows_field][0])


def test_execute_sql_statements_are_sanitized() -> None:
    payload = _serialize(_execute_sql_response())
    statement = payload["statements"][0]

    assert statement["row_count"] == 5
    _assert_row_is_safe(statement["data"]["rows"][0])


def test_chart_query_results_are_sanitized() -> None:
    payload = _serialize(_chart_data())
    result = payload["query_results"][0]

    assert result["row_count"] == result["total_rows"] == 5
    _assert_row_is_safe(result["data"][0])


@pytest.mark.parametrize(
    "build",
    [_chart_data, _query_dataset_response, _get_table_response],
    ids=["get_chart_data", "query_dataset", "get_table"],
)
def test_column_metadata_is_sanitized(build: Callable[[], BaseModel]) -> None:
    """Column samples and statistics are lifted straight out of the rows."""
    column = _serialize(build())["columns"][0]

    assert column["sample_values"][0].startswith(BINARY_PREFIX)
    assert column["sample_values"][1] is None
    assert column["statistics"]["min"].startswith(BINARY_PREFIX)
    assert column["null_count"] == 1
    assert column["unique_count"] == 2


@pytest.mark.parametrize(
    "count,expected",
    [
        (5.7, 5),
        (float("nan"), None),
        ("unknown", None),
        (None, None),
        (True, None),
        (False, None),
    ],
    ids=["fractional-float", "nan", "non-numeric", "missing", "true", "false"],
)
def test_unusable_nullable_count_becomes_null(count: Any, expected: int | None) -> None:
    """A count the engine reports in an unusable form must not fail the call."""
    response = QueryDatasetResponse(
        dataset_id=1, dataset_name="dataset", data=[], row_count=0, total_rows=count
    )

    assert _serialize(response)["total_rows"] == expected


def test_unusable_required_count_becomes_zero() -> None:
    """A non-nullable count falls back to 0 rather than failing validation."""
    response = StatementInfo(
        original_sql="SET x", executed_sql="SET x", row_count="unknown"
    )

    assert _serialize(response)["row_count"] == 0


def test_clean_results_are_untouched() -> None:
    """The coercion must not disturb ordinary payloads."""
    response = QueryDatasetResponse(
        dataset_id=1,
        dataset_name="dataset",
        data=[{"count": 3, "label": "a", "ratio": 1.5}],
        row_count=1,
        total_rows=None,
    )
    payload = _serialize(response)

    assert payload["data"] == [{"count": 3, "label": "a", "ratio": 1.5}]
    assert payload["row_count"] == 1
    assert payload["total_rows"] is None
