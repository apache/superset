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

"""Unit tests for the get_table MCP tool."""

from __future__ import annotations

import importlib
from collections.abc import Generator
from types import ModuleType
from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pyarrow as pa
import pytest
from fastmcp import Client, FastMCP
from superset_core.semantic_layers.types import Dimension, Grains

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.app import mcp
from superset.mcp_service.semantic_layer.schemas import (
    GetTableRequest,
    GetTableResponse,
    SemanticLayerError,
)
from superset.utils import json

get_table_module: ModuleType = importlib.import_module(
    "superset.mcp_service.semantic_layer.tool.get_table"
)


@pytest.fixture
def mcp_server() -> FastMCP:
    return mcp


@pytest.fixture(autouse=True)
def mock_auth() -> Generator[MagicMock, None, None]:
    with (
        patch("superset.mcp_service.auth.get_user_from_request") as mock_get_user,
        patch.object(
            get_table_module,
            "user_can_view_data_model_metadata",
            return_value=True,
        ),
    ):
        mock_user = Mock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_get_user.return_value = mock_user
        yield mock_get_user


def _make_metric(name: str, expression: str = "COUNT(*)") -> MagicMock:
    m = MagicMock()
    m.metric_name = name
    m.verbose_name = None
    m.expression = expression
    m.description = None
    m.d3format = None
    m.warning_text = None
    return m


def _make_column(name: str, is_dttm: bool = False) -> MagicMock:
    col = MagicMock()
    col.column_name = name
    col.verbose_name = None
    col.description = None
    col.type = "VARCHAR"
    col.is_dttm = is_dttm
    col.groupby = True
    col.filterable = True
    return col


def _make_dataset(dataset_id: int = 42) -> MagicMock:
    ds = MagicMock()
    ds.id = dataset_id
    ds.table_name = f"table_{dataset_id}"
    ds.main_dttm_col = "created_at"
    ds.metrics = [_make_metric("revenue", "SUM(revenue)")]
    ds.columns = [
        _make_column("region"),
        _make_column("created_at", is_dttm=True),
    ]
    return ds


def _make_view(view_id: int = 5) -> MagicMock:
    view = MagicMock()
    view.id = view_id
    view.name = f"view_{view_id}"
    view.raise_for_access = MagicMock(return_value=None)
    view.metrics = [_make_metric("bookings")]
    view.columns = [_make_column("country_name")]
    return view


@pytest.fixture
def temporal_view() -> Generator[MagicMock, None, None]:
    """Resolve a view with a temporal dimension and three queryable grains."""
    view: MagicMock = _make_view()
    view.get_compatible_dimensions.return_value = ["country_name"]
    view.columns = [
        _make_column("metric_time", True),
        _make_column("country_name"),
    ]
    view.implementation.get_dimensions.return_value = [
        Dimension(
            id=f"metric_time__{grain.name}",
            name="metric_time",
            type=pa.timestamp("us"),
            grain=grain,
        )
        for grain in (Grains.DAY, Grains.WEEK, Grains.MONTH)
    ] + [
        # Production get_dimensions() also returns the unaggregated variant
        # and every non-temporal dimension, both with grain=None.
        Dimension(id="metric_time", name="metric_time", type=pa.timestamp("us")),
        Dimension(id="country_name", name="country_name", type=pa.string()),
    ]
    with patch(
        "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
    ):
        yield view


@pytest.mark.asyncio
async def test_get_table_temporal_result_type(
    mcp_server: FastMCP,
    temporal_view: MagicMock,
) -> None:
    """Grain-suffixed temporal results use the shared MCP temporal vocabulary."""
    with patch.object(
        get_table_module,
        "execute_tabular_query",
        return_value={
            "queries": [
                {
                    "data": [
                        {
                            "metric_time__day": "2024-09-01T00:00:00Z",
                            "country_name": "Canada",
                        }
                    ],
                    "colnames": ["metric_time__day", "country_name"],
                }
            ]
        },
    ):
        async with Client(mcp_server) as client:
            data: dict[str, Any] = json.loads(
                (
                    await client.call_tool(
                        "get_table",
                        {
                            "request": {
                                "view_id": 5,
                                "metrics": ["bookings"],
                                "dimensions": ["metric_time", "country_name"],
                            }
                        },
                    )
                )
                .content[0]
                .text
            )
    assert data["success"] is True
    assert data["columns"][0]["data_type"] == "temporal"
    assert data["columns"][1]["data_type"] == "string"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("result_column", "value", "expected_type"),
    [
        ("date__label", "September", "string"),
        ("date_count", 12, "numeric"),
        ("date", "2024-09-01", "temporal"),
        ("date__Month", "2024-09-01", "temporal"),
        ("date__P1M", "2024-09-01", "temporal"),
        ("date__", "September", "string"),
        ("date__Year", "2024", "string"),
    ],
)
async def test_get_table_temporal_result_requires_known_variant(
    mcp_server: FastMCP,
    temporal_view: MagicMock,
    result_column: str,
    value: str | int,
    expected_type: str,
) -> None:
    """Only exact temporal names and their declared grains override result typing."""
    temporal_view.columns = [
        _make_column("date", True),
        _make_column("date__label"),
        _make_column("date__"),
        _make_column("date__Year"),
        _make_column("other_date", True),
    ]
    temporal_view.metrics = [_make_metric("date_count")]
    temporal_view.get_compatible_dimensions.return_value = [
        "date__label",
        "date__",
        "date__Year",
    ]
    temporal_view.implementation.get_dimensions.return_value = [
        Dimension(
            id="date_month", name="date", type=pa.timestamp("us"), grain=Grains.MONTH
        ),
        Dimension(
            id="other_year",
            name="other_date",
            type=pa.timestamp("us"),
            grain=Grains.YEAR,
        ),
    ]
    with patch.object(
        get_table_module,
        "execute_tabular_query",
        return_value={
            "queries": [{"data": [{result_column: value}], "colnames": [result_column]}]
        },
    ):
        async with Client(mcp_server) as client:
            response: GetTableResponse = GetTableResponse.model_validate_json(
                (
                    await client.call_tool(
                        "get_table",
                        {
                            "request": {
                                "view_id": 5,
                                "metrics": ["date_count"],
                                "dimensions": [
                                    "date",
                                    "date__label",
                                    "date__",
                                    "date__Year",
                                ],
                                "time_column": "date",
                                "time_grain": "P1M",
                            }
                        },
                    )
                )
                .content[0]
                .text
            )
    assert response.success is True
    assert response.columns[0].data_type == expected_type


def _access_denied_exc(message: str = "Access denied") -> SupersetSecurityException:
    return SupersetSecurityException(
        SupersetError(
            message=message,
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.ERROR,
        )
    )


@pytest.mark.parametrize("grain", ["P1M", "month", " Month "])
def test_get_table_time_grain_query(grain: str, temporal_view: MagicMock) -> None:
    """Duration and name forms reach the existing BASE_AXIS query builder."""
    request: GetTableRequest = GetTableRequest(
        view_id=5, metrics=["bookings"], dimensions=["metric_time"], time_grain=grain
    )
    resolved: Any = get_table_module._resolve_external_view(request)
    assert not isinstance(resolved, SemanticLayerError)
    query: dict[str, Any] = get_table_module._build_query_dict(
        request, resolved.time_col, resolved.grain_column
    )
    assert query["extras"]["time_grain_sqla"] == "P1M"
    assert query["columns"][0] == {
        "label": "metric_time",
        "sqlExpression": "metric_time",
        "isColumnReference": True,
        "columnType": "BASE_AXIS",
        "timeGrain": "P1M",
    }


def test_get_table_unsupported_time_grain(temporal_view: MagicMock) -> None:
    """Unsupported grains list this view's queryable durations and names."""
    result: Any = get_table_module._resolve_external_view(
        GetTableRequest(view_id=5, dimensions=["metric_time"], time_grain="PT1H")
    )
    assert isinstance(result, SemanticLayerError)
    assert result.error_type == "ValidationError"
    assert all(
        choice in result.error for choice in ("P1D (Day)", "P1W (Week)", "P1M (Month)")
    )


@pytest.mark.asyncio
async def test_get_table_grain_alias_hint_for_other_temporal_column(
    mcp_server: FastMCP, temporal_view: MagicMock
) -> None:
    """A selected column's grains do not erase another column's alias hint."""
    temporal_view.columns.append(_make_column("signup_date", True))
    temporal_view.implementation.get_dimensions.return_value.append(
        Dimension(
            id="signup_date__Year",
            name="signup_date",
            type=pa.timestamp("us"),
            grain=Grains.YEAR,
        )
    )
    with patch.object(get_table_module, "execute_tabular_query") as execute:
        async with Client(mcp_server) as client:
            result: Any = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "view_id": 5,
                        "metrics": ["bookings"],
                        "dimensions": ["metric_time", "signup_date__Year"],
                        "time_grain": "P1D",
                        "time_column": "metric_time",
                    }
                },
            )
        data: dict[str, Any] = json.loads(result.content[0].text)
    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "dimension 'signup_date'" in data["error"]
    assert "time_grain='P1Y'" in data["error"]
    execute.assert_not_called()


def test_get_table_grain_hints_match_each_columns_validation(
    temporal_view: MagicMock,
) -> None:
    """A grain advertised for metric_time must not be suggested for signup_date."""
    from superset.mcp_service.semantic_layer.tool.get_table import _ResolvedDatasource

    temporal_view.columns.append(_make_column("signup_date", True))
    temporal_view.implementation.get_dimensions.return_value = [
        Dimension(
            "metric_time_day", "metric_time", pa.timestamp("us"), grain=Grains.DAY
        ),
        Dimension(
            "metric_time_month", "metric_time", pa.timestamp("us"), grain=Grains.MONTH
        ),
        Dimension(
            "signup_date_day", "signup_date", pa.timestamp("us"), grain=Grains.DAY
        ),
    ]
    request: GetTableRequest = GetTableRequest(
        view_id=5, dimensions=["signup_date__Month"]
    )
    resolved: _ResolvedDatasource | SemanticLayerError = (
        get_table_module._resolve_external_view(request)
    )
    assert not isinstance(resolved, SemanticLayerError)
    errors: list[str] = get_table_module._validate_request_names(
        request, resolved.valid_columns, resolved.valid_metrics, resolved.valid_grains
    )
    assert any("Unknown dimension" in error for error in errors)
    assert not any("time_grain='P1M'" in error for error in errors)
    errors = get_table_module._validate_request_names(
        GetTableRequest(
            view_id=5, dimensions=["signup_date__Day", "metric_time__Month"]
        ),
        resolved.valid_columns,
        resolved.valid_metrics,
        resolved.valid_grains,
    )
    assert any(
        "dimension 'signup_date'" in error and "time_grain='P1D'" in error
        for error in errors
    )
    assert any(
        "dimension 'metric_time'" in error and "time_grain='P1M'" in error
        for error in errors
    )
    accepted: _ResolvedDatasource | SemanticLayerError = (
        get_table_module._resolve_external_view(
            GetTableRequest(view_id=5, dimensions=["signup_date"], time_grain="P1D")
        )
    )
    assert not isinstance(accepted, SemanticLayerError)
    rejected: _ResolvedDatasource | SemanticLayerError = (
        get_table_module._resolve_external_view(
            GetTableRequest(view_id=5, dimensions=["signup_date"], time_grain="P1M")
        )
    )
    assert isinstance(rejected, SemanticLayerError)
    assert "Queryable grains: P1D (Day)" in rejected.error


def test_get_table_grain_alias_hint(temporal_view: MagicMock) -> None:
    """A grain-suffixed unknown dimension suggests the base and time_grain."""
    request: GetTableRequest = GetTableRequest(
        view_id=5, dimensions=["metric_time__month"]
    )
    resolved: Any = get_table_module._resolve_external_view(request)
    errors: list[str] = get_table_module._validate_request_names(
        request, resolved.valid_columns, resolved.valid_metrics, resolved.valid_grains
    )
    assert any("Unknown dimension" in error for error in errors)
    assert any(
        "time_grain='P1M'" in error and "'metric_time'" in error for error in errors
    )


@pytest.mark.parametrize("dimensions", [[], ["metric_time", "other_time"]])
def test_get_table_grain_requires_time_column(
    temporal_view: MagicMock,
    dimensions: list[str],
) -> None:
    """Absent or ambiguous temporal selections require an explicit column."""
    temporal_view.columns.append(_make_column("other_time", True))
    result: Any = get_table_module._resolve_external_view(
        GetTableRequest(view_id=5, dimensions=dimensions, time_grain="P1M")
    )
    assert isinstance(result, SemanticLayerError)
    assert result.error_type == "ValidationError"
    assert "Set time_column" in result.error
    assert all(name in result.error for name in dimensions)


def test_get_table_grain_explicit_time_column(temporal_view: MagicMock) -> None:
    """An explicit temporal column disambiguates the requested grain."""
    temporal_view.columns.append(_make_column("other_time", True))
    temporal_view.implementation.get_dimensions.return_value.append(
        Dimension(
            id="other_time__month",
            name="other_time",
            type=pa.timestamp("us"),
            grain=Grains.MONTH,
        )
    )
    result: Any = get_table_module._resolve_external_view(
        GetTableRequest(
            view_id=5,
            dimensions=["metric_time", "other_time"],
            time_column="other_time",
            time_grain="P1M",
        )
    )
    assert not isinstance(result, SemanticLayerError)
    assert result.grain_column == "other_time"


def test_get_table_builtin_grain_rejected() -> None:
    """Built-in datasets reject the unsupported grain parameter explicitly."""
    result: Any = get_table_module._resolve_builtin_dataset(
        GetTableRequest(dataset_id=42, time_grain="month")
    )
    assert isinstance(result, SemanticLayerError)
    assert result.error_type == "ValidationError"
    assert "semantic views only" in result.error


@pytest.mark.asyncio
async def test_get_table_incompatible_view_dimensions(mcp_server: FastMCP) -> None:
    """Reject known-incompatible pairs before querying, with deterministic guidance."""
    view: MagicMock = _make_view()
    view.metrics = [_make_metric("orders"), _make_metric("bookings")]
    view.columns = [_make_column("product__product_name"), _make_column("category")]
    view.get_compatible_dimensions.return_value = ["country_name"]
    with (
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
        ),
        patch.object(get_table_module, "execute_tabular_query") as execute,
        patch.object(get_table_module, "_build_query_dict") as build,
    ):
        async with Client(mcp_server) as client:
            result: Any = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "view_id": 5,
                        "metrics": ["orders", "bookings"],
                        "dimensions": ["product__product_name", "category"],
                    }
                },
            )
        data: dict[str, Any] = json.loads(result.content[0].text)
    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert data["error"] == (
        "Dimension(s) ['category', 'product__product_name'] are not compatible "
        "with the selected metric(s) ['bookings', 'orders'] for view 'view_5'. "
        "Call get_compatible_dimensions for the valid combinations."
    )
    view.get_compatible_dimensions.assert_called_once_with(["orders", "bookings"], [])
    build.assert_not_called()
    execute.assert_not_called()


@pytest.mark.parametrize("backend_fails", [False, True])
@pytest.mark.asyncio
async def test_get_table_compatible_view_executes(
    mcp_server: FastMCP,
    backend_fails: bool,
) -> None:
    """Compatible selections execute; genuine backend failures remain InternalError."""
    view: MagicMock = _make_view()
    view.get_compatible_dimensions.return_value = ["country_name"]
    query_result: dict[str, Any] = {
        "queries": [
            {
                "data": [{"country_name": "GB", "bookings": 3}],
                "colnames": ["country_name", "bookings"],
                "rowcount": 1,
            }
        ]
    }
    with (
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
        ),
        patch.object(
            get_table_module, "execute_tabular_query", return_value=query_result
        ) as execute,
    ):
        if backend_fails:
            execute.side_effect = RuntimeError("provider execution failed")
        async with Client(mcp_server) as client:
            result: Any = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "view_id": 5,
                        "metrics": ["bookings"],
                        "dimensions": ["country_name"],
                    }
                },
            )
        data: dict[str, Any] = json.loads(result.content[0].text)
    view.get_compatible_dimensions.assert_called_once_with(["bookings"], [])
    execute.assert_called_once()
    assert execute.call_args.args[:2] == (5, "semantic_view")
    if backend_fails:
        assert data["success"] is False
        assert data["error_type"] == "InternalError"
        assert "provider execution failed" in data["error"]
    else:
        assert data["success"] is True
        assert data["data"] == [{"country_name": "GB", "bookings": 3}]


@pytest.mark.parametrize(
    "builtin,metrics,dimensions",
    [
        (True, ["revenue"], ["region"]),
        (False, [], ["country_name"]),
        (False, ["bookings"], []),
    ],
)
@pytest.mark.asyncio
async def test_get_table_skips_compatibility_without_join_risk(
    mcp_server: FastMCP,
    builtin: bool,
    metrics: list[str],
    dimensions: list[str],
) -> None:
    """Builtin datasets and empty selections never consult view compatibility."""
    dataset: MagicMock = _make_dataset()
    view: MagicMock = _make_view()
    query_result: dict[str, Any] = {"queries": [{"data": [], "colnames": []}]}
    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset),
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
        ),
        patch.object(
            get_table_module, "execute_tabular_query", return_value=query_result
        ) as execute,
    ):
        async with Client(mcp_server) as client:
            result: Any = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "dataset_id" if builtin else "view_id": 42 if builtin else 5,
                        "metrics": metrics,
                        "dimensions": dimensions,
                    }
                },
            )
        data: dict[str, Any] = json.loads(result.content[0].text)
    assert data["success"] is True
    execute.assert_called_once()
    dataset.get_compatible_dimensions.assert_not_called()
    view.get_compatible_dimensions.assert_not_called()


@pytest.mark.asyncio
async def test_get_table_builtin_happy_path(mcp_server: FastMCP) -> None:
    """get_table returns tabular data for a built-in dataset."""
    mock_ds = _make_dataset(42)
    query_result = {
        "queries": [
            {
                "data": [{"region": "west", "revenue": 100}],
                "colnames": ["region", "revenue"],
                "rowcount": 1,
            }
        ]
    }

    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as mock_command_cls,
        patch(
            "superset.common.query_context_factory.QueryContextFactory"
        ) as mock_factory_cls,
    ):
        mock_command_cls.return_value.run.return_value = query_result
        mock_factory_cls.return_value.create.return_value = MagicMock()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "dataset_id": 42,
                        "metrics": ["revenue"],
                        "dimensions": ["region"],
                    }
                },
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is True
    assert data["row_count"] == 1
    assert data["source"] == "builtin"
    assert data["dataset_id"] == 42
    assert data["dataset_name"] == mock_ds.table_name


@pytest.mark.asyncio
async def test_get_table_requires_one_source(mcp_server: FastMCP) -> None:
    """get_table errors when neither dataset_id nor view_id is provided."""
    async with Client(mcp_server) as client:
        result = await client.call_tool("get_table", {"request": {}})
    data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"


@pytest.mark.asyncio
async def test_get_table_mutual_exclusion_validation(mcp_server: FastMCP) -> None:
    """get_table errors when both dataset_id and view_id are provided."""
    async with Client(mcp_server) as client:
        result = await client.call_tool(
            "get_table", {"request": {"dataset_id": 1, "view_id": 2}}
        )
    data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"


@pytest.mark.asyncio
async def test_get_table_privacy_check(mcp_server: FastMCP) -> None:
    """get_table errors when the user lacks data-model metadata access."""
    with patch.object(
        get_table_module,
        "user_can_view_data_model_metadata",
        return_value=False,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool("get_table", {"request": {"dataset_id": 1}})
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "DataModelMetadataRestricted"


@pytest.mark.asyncio
async def test_get_table_unknown_metric_validation_error(mcp_server: FastMCP) -> None:
    """get_table errors when a requested metric doesn't exist on the dataset."""
    mock_ds = _make_dataset(42)

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {"request": {"dataset_id": 42, "metrics": ["does_not_exist"]}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "Valid metrics: revenue" in data["error"]


@pytest.mark.asyncio
async def test_get_table_time_column_not_dttm_validation_error(
    mcp_server: FastMCP,
) -> None:
    """get_table rejects a time_column that isn't marked as a temporal column."""
    mock_ds = _make_dataset(42)

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "dataset_id": 42,
                        "metrics": ["revenue"],
                        "time_column": "region",
                    }
                },
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "not marked as a temporal column" in data["message"]


@pytest.mark.asyncio
async def test_get_table_external_view_access_denied(mcp_server: FastMCP) -> None:
    """get_table returns AccessDenied when raise_for_access rejects the view."""
    mock_view = _make_view(5)
    mock_view.raise_for_access.side_effect = _access_denied_exc()

    with patch(
        "superset.daos.semantic_layer.SemanticViewDAO.find_by_id",
        return_value=mock_view,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {"request": {"view_id": 5, "metrics": ["bookings"]}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "AccessDenied"


@pytest.mark.asyncio
async def test_get_table_external_time_range_without_dttm_validation_error(
    mcp_server: FastMCP,
) -> None:
    """get_table rejects time_range on a view with no temporal dimension.

    Regression test: previously this silently dropped the time filter and
    ran an unfiltered query instead of erroring, which could return
    incorrect data for a time-bounded request.
    """
    mock_view = _make_view(5)  # columns have no is_dttm=True column

    with patch(
        "superset.daos.semantic_layer.SemanticViewDAO.find_by_id",
        return_value=mock_view,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "view_id": 5,
                        "metrics": ["bookings"],
                        "time_range": "Last 30 days",
                    }
                },
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "no temporal dimension" in data["message"]


@pytest.mark.asyncio
async def test_get_table_dataset_not_found(mcp_server: FastMCP) -> None:
    """get_table returns NotFound when dataset_id doesn't resolve to a dataset."""
    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=None):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {"request": {"dataset_id": 999999, "metrics": ["revenue"]}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "NotFound"
    assert "999999" in data["message"]


@pytest.mark.asyncio
async def test_get_table_view_not_found(mcp_server: FastMCP) -> None:
    """get_table returns NotFound when view_id doesn't resolve to a view."""
    with patch(
        "superset.daos.semantic_layer.SemanticViewDAO.find_by_id",
        return_value=None,
    ):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {"request": {"view_id": 999999, "metrics": ["bookings"]}},
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "NotFound"
    assert "999999" in data["message"]


@pytest.mark.asyncio
async def test_get_table_invalid_filter_column_validation_error(
    mcp_server: FastMCP,
) -> None:
    """get_table errors when a filter references an unknown column."""
    mock_ds = _make_dataset(42)

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "dataset_id": 42,
                        "metrics": ["revenue"],
                        "filters": [{"col": "bogus_col", "op": "==", "val": "x"}],
                    }
                },
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "Unknown filter column: 'bogus_col'" in data["error"]


@pytest.mark.asyncio
async def test_get_table_invalid_order_by_validation_error(
    mcp_server: FastMCP,
) -> None:
    """get_table errors when order_by references an unknown column/metric."""
    mock_ds = _make_dataset(42)

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "dataset_id": 42,
                        "metrics": ["revenue"],
                        "order_by": ["bogus_order_col"],
                    }
                },
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "Unknown order_by: 'bogus_order_col'" in data["error"]


@pytest.mark.asyncio
async def test_get_table_unknown_filter_operator_passes_through(
    mcp_server: FastMCP,
) -> None:
    """An operator string outside the documented set is not schema-validated.

    ``GetTableFilter.op`` is a plain ``str`` field (not a Literal/Enum), so
    the tool does not reject unrecognized operator values itself -- it
    forwards them verbatim to the query layer, which is responsible for
    interpreting/rejecting them.
    """
    mock_ds = _make_dataset(42)
    query_result: dict[str, Any] = {
        "queries": [
            {
                "data": [{"region": "west", "revenue": 100}],
                "colnames": ["region", "revenue"],
                "rowcount": 1,
            }
        ]
    }

    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as mock_command_cls,
        patch(
            "superset.common.query_context_factory.QueryContextFactory"
        ) as mock_factory_cls,
    ):
        mock_command_cls.return_value.run.return_value = query_result
        mock_factory_cls.return_value.create.return_value = MagicMock()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "dataset_id": 42,
                        "metrics": ["revenue"],
                        "filters": [
                            {"col": "region", "op": "TOTALLY_BOGUS_OP", "val": "x"}
                        ],
                    }
                },
            )
        data = json.loads(result.content[0].text)

        create_kwargs: dict[str, Any] = (
            mock_factory_cls.return_value.create.call_args.kwargs
        )
        forwarded_filters: list[dict[str, Any]] = create_kwargs["queries"][0]["filters"]

    assert data["success"] is True
    assert {"col": "region", "op": "TOTALLY_BOGUS_OP", "val": "x"} in forwarded_filters


@pytest.mark.asyncio
async def test_get_table_unicode_filter_value_passes_through(
    mcp_server: FastMCP,
) -> None:
    """Unicode filter values are forwarded to the query layer unmodified."""
    mock_ds = _make_dataset(42)
    query_result: dict[str, Any] = {
        "queries": [
            {
                "data": [{"region": "west", "revenue": 100}],
                "colnames": ["region", "revenue"],
                "rowcount": 1,
            }
        ]
    }
    unicode_val: str = "日本語 café €"

    with (
        patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand"
        ) as mock_command_cls,
        patch(
            "superset.common.query_context_factory.QueryContextFactory"
        ) as mock_factory_cls,
    ):
        mock_command_cls.return_value.run.return_value = query_result
        mock_factory_cls.return_value.create.return_value = MagicMock()

        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "dataset_id": 42,
                        "metrics": ["revenue"],
                        "filters": [{"col": "region", "op": "==", "val": unicode_val}],
                    }
                },
            )
        data = json.loads(result.content[0].text)

        create_kwargs: dict[str, Any] = (
            mock_factory_cls.return_value.create.call_args.kwargs
        )
        forwarded_filters: list[dict[str, Any]] = create_kwargs["queries"][0]["filters"]

    assert data["success"] is True
    assert {"col": "region", "op": "==", "val": unicode_val} in forwarded_filters


@pytest.mark.asyncio
async def test_get_table_builtin_time_range_without_configured_dttm_validation_error(
    mcp_server: FastMCP,
) -> None:
    """get_table rejects time_range on a builtin dataset with no main_dttm_col.

    Mirrors the external-view "no temporal dimension" case, but for the
    builtin path where the temporal column is inferred from
    ``dataset.main_dttm_col`` instead of scanning columns.
    """
    mock_ds = _make_dataset(42)
    mock_ds.main_dttm_col = None

    with patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=mock_ds):
        async with Client(mcp_server) as client:
            result = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "dataset_id": 42,
                        "metrics": ["revenue"],
                        "time_range": "Last 7 days",
                    }
                },
            )
        data = json.loads(result.content[0].text)

    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "no temporal column is configured" in data["message"]


@pytest.mark.parametrize("dimensions", [[], ["country_name"]])
@pytest.mark.asyncio
async def test_get_table_rejects_incompatible_ordering_dimension(
    mcp_server: FastMCP, dimensions: list[str]
) -> None:
    """Ordering by an unselected dimension still requires a compatible join."""
    view: MagicMock = _make_view()
    view.columns.append(_make_column("product_name"))
    view.get_compatible_dimensions.return_value = ["country_name"]
    with (
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
        ),
        patch.object(get_table_module, "execute_tabular_query") as execute,
        patch.object(get_table_module, "_build_query_dict") as build,
    ):
        async with Client(mcp_server) as client:
            result: Any = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "view_id": 5,
                        "metrics": ["bookings"],
                        "dimensions": dimensions,
                        "order_by": ["product_name"],
                    }
                },
            )
        data: dict[str, Any] = json.loads(result.content[0].text)
    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "product_name" in data["error"]
    view.get_compatible_dimensions.assert_called_once_with(["bookings"], [])
    build.assert_not_called()
    execute.assert_not_called()


@pytest.mark.parametrize(
    "order_by", [["country_name"], ["bookings"], ["country_name", "bookings"]]
)
@pytest.mark.asyncio
async def test_get_table_preserves_compatible_and_metric_ordering(
    mcp_server: FastMCP, order_by: list[str]
) -> None:
    """Metric ordering is not mistaken for a required join dimension."""
    view: MagicMock = _make_view()
    view.get_compatible_dimensions.return_value = ["country_name"]
    with (
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
        ),
        patch.object(
            get_table_module,
            "execute_tabular_query",
            return_value={"queries": [{"data": [], "colnames": []}]},
        ) as execute,
    ):
        async with Client(mcp_server) as client:
            result: Any = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "view_id": 5,
                        "metrics": ["bookings"],
                        "order_by": order_by,
                    }
                },
            )
        data: dict[str, Any] = json.loads(result.content[0].text)
    assert data["success"] is True
    execute.assert_called_once()
    assert [name for name, _ in execute.call_args.args[2]["orderby"]] == order_by
    if "country_name" in order_by:
        view.get_compatible_dimensions.assert_called_once_with(["bookings"], [])
    else:
        view.get_compatible_dimensions.assert_not_called()


@pytest.mark.parametrize("longhand", [False, True])
@pytest.mark.asyncio
async def test_temporal_filter_spellings_delegate_to_execution(
    mcp_server: FastMCP, longhand: bool
) -> None:
    """Both temporal spellings execute even when discovery excludes the axis."""
    view: MagicMock = _make_view()
    view.columns.append(_make_column("order_ts", True))
    view.get_compatible_dimensions.return_value = ["country_name"]
    request: dict[str, Any] = {"view_id": 5, "metrics": ["bookings"]}
    temporal_filter: dict[str, str] = {
        "col": "order_ts",
        "op": "TEMPORAL_RANGE",
        "val": "2024-01-01 : 2024-03-01",
    }
    if longhand:
        request["filters"] = [temporal_filter]
    else:
        request.update(time_column="order_ts", time_range=temporal_filter["val"])
    with (
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
        ),
        patch.object(
            get_table_module,
            "execute_tabular_query",
            return_value={"queries": [{"data": [], "colnames": []}]},
        ) as execute,
    ):
        async with Client(mcp_server) as client:
            result: Any = await client.call_tool("get_table", {"request": request})
        data: dict[str, Any] = json.loads(result.content[0].text)
    assert data["success"] is True
    execute.assert_called_once()
    assert execute.call_args.args[2]["filters"] == [temporal_filter]
    view.get_compatible_dimensions.assert_not_called()


@pytest.mark.parametrize(
    "usage", ["ordinary_filter", "groupby", "ordering", "temporal_range"]
)
@pytest.mark.parametrize("temporal", [False, True])
@pytest.mark.asyncio
async def test_temporal_column_identity_controls_compatibility_exemption(
    mcp_server: FastMCP, usage: str, temporal: bool
) -> None:
    """An undiscovered time axis remains usable; ordinary columns are rejected."""
    view: MagicMock = _make_view()
    view.columns.append(_make_column("order_ts", True))
    view.get_compatible_dimensions.return_value = []
    column: str = "order_ts" if temporal else "country_name"
    request: dict[str, Any] = {
        "view_id": 5,
        "metrics": ["bookings"],
    }
    if usage == "ordinary_filter":
        request["filters"] = [{"col": column, "op": "==", "val": "2024-02-01"}]
    elif usage == "groupby":
        request["dimensions"] = [column]
    elif usage == "ordering":
        request["order_by"] = [column]
    else:
        request["filters"] = [
            {"col": column, "op": "TEMPORAL_RANGE", "val": "2024-01-01 : 2024-03-01"}
        ]
    with (
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
        ),
        patch.object(
            get_table_module,
            "execute_tabular_query",
            return_value={"queries": [{"data": [], "colnames": []}]},
        ) as execute,
    ):
        async with Client(mcp_server) as client:
            result: Any = await client.call_tool("get_table", {"request": request})
        data: dict[str, Any] = json.loads(result.content[0].text)
    assert data["success"] is temporal
    if temporal:
        execute.assert_called_once()
        view.get_compatible_dimensions.assert_not_called()
    else:
        assert data["error_type"] == "ValidationError"
        assert column in data["error"]
        execute.assert_not_called()


class TestGetTableTimeRangeValidation:
    """GetTableRequest.time_range rejects values get_since_until() would
    otherwise silently resolve to an unbounded, full-table range.

    See SC-114824: shared validator in
    superset.mcp_service.common.time_range_validation.
    """

    def test_valid_relative_range_passes(self) -> None:
        from superset.mcp_service.semantic_layer.schemas import GetTableRequest

        req = GetTableRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "Last 30 days"}
        )
        assert req.time_range == "Last 30 days"

    def test_iso_range_passes(self) -> None:
        from superset.mcp_service.semantic_layer.schemas import GetTableRequest

        req = GetTableRequest.model_validate(
            {
                "dataset_id": 1,
                "metrics": ["count"],
                "time_range": "2003-01-01 : 2004-01-01",
            }
        )
        assert req.time_range == "2003-01-01 : 2004-01-01"

    def test_bracket_shorthand_normalizes(self) -> None:
        from superset.mcp_service.semantic_layer.schemas import GetTableRequest

        req = GetTableRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": "[quarter]"}
        )
        assert req.time_range == "Last quarter"

    @pytest.mark.parametrize(
        "bad_value",
        ["banana", "this week", "this month", "last week", "yesterday", "[decade]"],
    )
    def test_previously_silent_values_now_raise(self, bad_value: str) -> None:
        """Live testing against dataset 28 (cleaned_sales_data, 2823 rows)
        showed these values returned the entire table with success: true
        and empty warnings. They must now raise a ValidationError."""
        from pydantic import ValidationError

        from superset.mcp_service.semantic_layer.schemas import GetTableRequest

        with pytest.raises(ValidationError, match="Unrecognized time_range"):
            GetTableRequest.model_validate(
                {"dataset_id": 1, "metrics": ["count"], "time_range": bad_value}
            )

    def test_none_passes(self) -> None:
        from superset.mcp_service.semantic_layer.schemas import GetTableRequest

        req = GetTableRequest.model_validate(
            {"dataset_id": 1, "metrics": ["count"], "time_range": None}
        )
        assert req.time_range is None


class TestGetTableTemporalRangeFilterValidation:
    """A TEMPORAL_RANGE spelled out longhand in `filters` gets the same
    validation as the dedicated `time_range` field -- otherwise the
    identical silent full-table match stays reachable through that field.
    """

    @staticmethod
    def _request(val: Any) -> dict[str, Any]:
        return {
            "dataset_id": 1,
            "metrics": ["count"],
            "filters": [{"col": "ts", "op": "TEMPORAL_RANGE", "val": val}],
        }

    @pytest.mark.parametrize("bad_value", ["banana", "this month", "Last nonsense"])
    def test_malformed_temporal_range_filter_rejected(self, bad_value: str) -> None:
        from pydantic import ValidationError

        from superset.mcp_service.semantic_layer.schemas import GetTableRequest

        with pytest.raises(ValidationError, match="Unrecognized time_range"):
            GetTableRequest.model_validate(self._request(bad_value))

    def test_temporal_range_filter_normalizes_like_time_range(self) -> None:
        from superset.mcp_service.semantic_layer.schemas import GetTableRequest

        req = GetTableRequest.model_validate(self._request("Last hour"))
        assert req.filters[0].val == (
            "DATEADD(DATETIME('now'), -1, HOUR) : DATETIME('now')"
        )

    def test_valid_temporal_range_filter_unchanged(self) -> None:
        from superset.mcp_service.semantic_layer.schemas import GetTableRequest

        req = GetTableRequest.model_validate(self._request("Last 7 days"))
        assert req.filters[0].val == "Last 7 days"

    def test_non_temporal_operator_value_untouched(self) -> None:
        from superset.mcp_service.semantic_layer.schemas import GetTableRequest

        req = GetTableRequest.model_validate(
            {
                "dataset_id": 1,
                "metrics": ["count"],
                "filters": [{"col": "fruit", "op": "==", "val": "banana"}],
            }
        )
        assert req.filters[0].val == "banana"


@pytest.mark.parametrize("is_builtin", [False, True])
@pytest.mark.parametrize("empty", [False, True])
def test_response_preserves_execution_time_bounds(
    is_builtin: bool, empty: bool
) -> None:
    """Use execution metadata, including for empty results, rather than reparse."""
    from datetime import datetime

    from superset.mcp_service.semantic_layer.schemas import GetTableRequest

    request = GetTableRequest(
        dataset_id=42 if is_builtin else None,
        view_id=None if is_builtin else 1,
        metrics=["count"],
        time_range="Last month",
    )
    response = get_table_module._build_response(
        request,
        is_builtin,
        "orders",
        {
            "data": [] if empty else [{"count": 3}],
            "colnames": ["count"],
            "from_dttm": datetime(2026, 6, 1),
            "to_dttm": datetime(2026, 7, 1),
            "is_cached": True,
        },
        10,
        [],
    )
    data = response.model_dump(mode="json")
    assert data["from_dttm"] == "2026-06-01T00:00:00"
    assert data["to_dttm"] == "2026-07-01T00:00:00"


@pytest.mark.parametrize("source_field", ["dataset_id", "view_id"])
@pytest.mark.parametrize("expression", ["2025-01-01 : ", " : 2025-02-01"])
@pytest.mark.asyncio
async def test_get_table_rejects_open_ended_range_before_execution(
    mcp_server: FastMCP, source_field: str, expression: str
) -> None:
    """Open-ended MCP input cannot reach the shared comparison-filter rewrite."""
    from fastmcp.exceptions import ToolError

    with patch.object(get_table_module, "execute_tabular_query") as execute:
        async with Client(mcp_server) as client:
            with pytest.raises(ToolError, match="Unrecognized time_range"):
                await client.call_tool(
                    "get_table",
                    {
                        "request": {
                            source_field: 1,
                            "metrics": ["count"],
                            "time_range": expression,
                        }
                    },
                )
    execute.assert_not_called()


@pytest.mark.parametrize("dimensions", [[], ["country_name"]])
@pytest.mark.asyncio
async def test_get_table_rejects_unselected_incompatible_filter(
    mcp_server: FastMCP,
    dimensions: list[str],
) -> None:
    """Filtering still requires a join when the dimension is absent from groupby."""
    view: MagicMock = _make_view()
    view.columns.append(_make_column("product_name"))
    view.get_compatible_dimensions.return_value = ["country_name"]
    with (
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
        ),
        patch.object(get_table_module, "execute_tabular_query") as execute,
        patch.object(get_table_module, "_build_query_dict") as build,
    ):
        async with Client(mcp_server) as client:
            result: Any = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "view_id": 5,
                        "metrics": ["bookings"],
                        "dimensions": dimensions,
                        "filters": [
                            {"col": "product_name", "op": "==", "val": "Widget"}
                        ],
                    }
                },
            )
        data: dict[str, Any] = json.loads(result.content[0].text)
    assert data["success"] is False
    assert data["error_type"] == "ValidationError"
    assert "product_name" in data["error"]
    view.get_compatible_dimensions.assert_called_once_with(["bookings"], [])
    build.assert_not_called()
    execute.assert_not_called()


@pytest.mark.asyncio
async def test_get_table_compatible_filter_without_groupby(mcp_server: FastMCP) -> None:
    """A filter-only compatible dimension is validated and retained in the query."""
    view: MagicMock = _make_view()
    view.get_compatible_dimensions.return_value = ["country_name"]
    with (
        patch(
            "superset.daos.semantic_layer.SemanticViewDAO.find_by_id", return_value=view
        ),
        patch.object(
            get_table_module,
            "execute_tabular_query",
            return_value={"queries": [{"data": [], "colnames": []}]},
        ) as execute,
    ):
        async with Client(mcp_server) as client:
            result: Any = await client.call_tool(
                "get_table",
                {
                    "request": {
                        "view_id": 5,
                        "metrics": ["bookings"],
                        "dimensions": [],
                        "filters": [{"col": "country_name", "op": "==", "val": "GB"}],
                    }
                },
            )
        data: dict[str, Any] = json.loads(result.content[0].text)
    assert data["success"] is True
    view.get_compatible_dimensions.assert_called_once_with(["bookings"], [])
    execute.assert_called_once()
    assert execute.call_args.args[2]["filters"] == [
        {"col": "country_name", "op": "==", "val": "GB"}
    ]


@pytest.mark.parametrize("explicit_column", [False, True])
def test_grain_is_validated_for_selected_column(
    temporal_view: MagicMock,
    explicit_column: bool,
) -> None:
    """A grain supported by another temporal column is not silently substituted."""
    temporal_view.columns.append(_make_column("signup_date", True))
    temporal_view.implementation.get_dimensions.return_value.extend(
        [
            Dimension(
                id="signup_date__day",
                name="signup_date",
                type=pa.timestamp("us"),
                grain=Grains.DAY,
            ),
            Dimension(
                id="signup_date__year",
                name="signup_date",
                type=pa.timestamp("us"),
                grain=Grains.YEAR,
            ),
        ]
    )
    result: Any = get_table_module._resolve_external_view(
        GetTableRequest(
            view_id=5,
            dimensions=["signup_date"],
            time_grain="P1M",
            time_column="signup_date" if explicit_column else None,
        )
    )
    assert isinstance(result, SemanticLayerError)
    assert result.error_type == "ValidationError"
    assert "signup_date" in result.error
    assert "P1D (Day)" in result.error
    assert "P1Y (Year)" in result.error
    assert "P1M (Month)" not in result.error


def test_time_range_uses_the_selected_grain_axis(temporal_view: MagicMock) -> None:
    """The filter granularity and BASE_AXIS refer to the same selected dimension."""
    temporal_view.columns.append(_make_column("signup_date", True))
    temporal_view.implementation.get_dimensions.return_value.append(
        Dimension(
            id="signup_date__month",
            name="signup_date",
            type=pa.timestamp("us"),
            grain=Grains.MONTH,
        )
    )
    request: GetTableRequest = GetTableRequest(
        view_id=5,
        dimensions=["signup_date"],
        time_grain="P1M",
        time_range="2024-01-01 : 2024-03-01",
    )
    resolved: Any = get_table_module._resolve_external_view(request)
    assert not isinstance(resolved, SemanticLayerError)
    query: dict[str, Any] = get_table_module._build_query_dict(
        request,
        resolved.time_col,
        resolved.grain_column,
    )
    assert query["granularity"] == "signup_date"
    assert query["columns"][0]["sqlExpression"] == query["granularity"]
    assert query["columns"][0]["timeGrain"] == "P1M"
    assert query["filters"] == [
        {"col": "signup_date", "op": "TEMPORAL_RANGE", "val": request.time_range}
    ]
