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

"""Saved-chart reads resolve semantic and SQL sources without changing query work."""

import importlib
from contextlib import nullcontext
from types import ModuleType, SimpleNamespace
from typing import Any
from unittest.mock import Mock, patch

import pytest
from fastmcp import Client
from fastmcp.client.client import CallToolResult
from mcp.types import TextContent

from superset.daos.exceptions import DatasourceNotFound
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.mcp_service import guest_scope
from superset.mcp_service.app import mcp
from superset.mcp_service.chart.chart_utils import DatasetValidationResult
from superset.mcp_service.chart.schemas import ChartInfo
from superset.semantic_layers.models import SemanticView
from superset.utils import json
from superset.utils.core import DatasourceType


@pytest.mark.asyncio
@pytest.mark.parametrize("tool_name", ["get_chart_data", "get_chart_info"])
@pytest.mark.parametrize(
    "source_type, outcome",
    [
        ("semantic_view", "allowed"),
        ("table", "allowed"),
        ("semantic_view", "missing"),
        ("semantic_view", "denied"),
    ],
)
async def test_saved_chart_reads_use_the_source_type(
    tool_name: str, source_type: str, outcome: str
) -> None:
    """A saved semantic chart must pass the same read boundary as a SQL chart."""
    data_module: ModuleType = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_data"
    )
    info_module: ModuleType = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_info"
    )
    chart: SimpleNamespace = SimpleNamespace(
        id=9,
        slice_name="Sales",
        viz_type="table",
        datasource_id=17,
        datasource_type=source_type,
        params=json.dumps({"viz_type": "table", "datasource": f"17__{source_type}"}),
        query_context=json.dumps(
            {"datasource": {"id": 17, "type": source_type}, "queries": []}
        ),
    )
    info: ChartInfo = ChartInfo(
        id=9,
        slice_name="Sales",
        viz_type="table",
        datasource_id=17,
        datasource_type=source_type,
    )
    view: SemanticView = SemanticView(id=17, name="Sales")
    dataset: SimpleNamespace = SimpleNamespace(id=17, table_name="Sales", sql=None)
    query_context: SimpleNamespace = SimpleNamespace(queries=[], form_data={})
    command: Mock = Mock()
    command.run.return_value = {
        "queries": [{"data": [{"sales": 7}], "colnames": ["sales"], "rowcount": 1}]
    }
    table_lookup: Mock
    view_lookup: Mock
    view_access: Mock
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin"),
        ),
        patch("superset.mcp_service.auth.check_tool_permission", return_value=True),
        patch("superset.mcp_service.auth.has_dataset_access", return_value=True),
        patch("superset.mcp_service.guest_scope.is_guest_read", return_value=False),
        patch("superset.mcp_service.guest_scope.guest_dashboard_id", return_value=None),
        patch.object(
            data_module.event_logger, "log_context", return_value=nullcontext()
        ),
        patch.object(data_module, "find_chart_by_identifier", return_value=chart),
        patch.object(info_module.ModelGetInfoCore, "run_tool", return_value=info),
        patch("superset.daos.chart.ChartDAO.find_by_id", return_value=chart),
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id",
            return_value=dataset if source_type == "table" else None,
        ) as table_lookup,
        patch(
            "superset.daos.datasource.DatasourceDAO.get_datasource",
            return_value=view,
            side_effect=DatasourceNotFound() if outcome == "missing" else None,
        ) as view_lookup,
        patch.object(
            SemanticView,
            "raise_for_access",
            side_effect=SupersetSecurityException(
                SupersetError(
                    message="private source detail",
                    error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )
            if outcome == "denied"
            else None,
        ) as view_access,
        patch(
            "superset.charts.schemas.ChartDataQueryContextSchema.load",
            return_value=query_context,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        async with Client(mcp) as client:
            response: CallToolResult = await client.call_tool(
                tool_name, {"request": {"identifier": "9"}}
            )
    assert isinstance(response.content[0], TextContent)
    result: dict[str, Any] = json.loads(response.content[0].text)
    if outcome != "allowed":
        assert result["error_type"] == "DatasetNotAccessible"
        assert "private source detail" not in result["error"]
        command.run.assert_not_called()
        view_lookup.assert_called_once_with(DatasourceType.SEMANTIC_VIEW, 17)
        table_lookup.assert_not_called()
        if outcome == "missing":
            view_access.assert_not_called()
        else:
            view_access.assert_called_once()
        return
    assert "error_type" not in result, result
    if tool_name == "get_chart_data":
        assert result["data"] == [{"sales": 7}]
        command.validate.assert_called_once()
    else:
        assert result["slice_name"] == "Sales"
        command.run.assert_not_called()
    if source_type == "semantic_view":
        view_lookup.assert_called_once_with(DatasourceType.SEMANTIC_VIEW, 17)
        view_access.assert_called_once()
        table_lookup.assert_not_called()
    else:
        table_lookup.assert_called_once_with(17, skip_base_filter=False)
        view_lookup.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("outcome", ["allowed", "rls_refused", "missing"])
async def test_guest_semantic_chart_data_uses_dashboard_authorization(
    outcome: str,
) -> None:
    """A guest reads a semantic chart through the dashboard-scoped query check,
    like a table chart, instead of the semantic view's direct grants."""
    data_module: ModuleType = importlib.import_module(
        "superset.mcp_service.chart.tool.get_chart_data"
    )
    chart: SimpleNamespace = SimpleNamespace(
        id=9,
        slice_name="Sales",
        viz_type="table",
        datasource_id=17,
        datasource_type="semantic_view",
        params=json.dumps({"viz_type": "table", "datasource": "17__semantic_view"}),
        query_context=json.dumps(
            {"datasource": {"id": 17, "type": "semantic_view"}, "queries": []}
        ),
    )
    view: SemanticView = SemanticView(id=17, name="Sales")
    query_context: SimpleNamespace = SimpleNamespace(queries=[], form_data={})
    command: Mock = Mock()
    command.run.return_value = {
        "queries": [{"data": [{"sales": 7}], "colnames": ["sales"], "rowcount": 1}]
    }
    # The query-context check refuses guest row-level security on semantic
    # views (raise_for_unsupported_guest_rls via command.validate()).
    refusal: SupersetSecurityException = SupersetSecurityException(
        SupersetError(
            message="Semantic views cannot enforce guest row-level security rules.",
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            level=ErrorLevel.WARNING,
        )
    )
    if outcome == "rls_refused":
        command.validate.side_effect = refusal
    view_lookup: Mock
    view_access: Mock
    authorize_query: Mock
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=None, username="guest"),
        ),
        patch("superset.mcp_service.auth.check_tool_permission", return_value=True),
        patch("superset.mcp_service.guest_scope.is_guest_read", return_value=True),
        patch("superset.mcp_service.guest_scope.guest_dashboard_id", return_value=5),
        patch(
            "superset.mcp_service.guest_scope.authorize_query",
            wraps=guest_scope.authorize_query,
        ) as authorize_query,
        patch.object(
            data_module.event_logger, "log_context", return_value=nullcontext()
        ),
        patch.object(data_module, "find_chart_by_identifier", return_value=chart),
        patch(
            "superset.daos.datasource.DatasourceDAO.get_datasource",
            return_value=view,
            side_effect=DatasourceNotFound() if outcome == "missing" else None,
        ) as view_lookup,
        patch.object(
            SemanticView,
            "raise_for_access",
            side_effect=SupersetSecurityException(
                SupersetError(
                    message="no direct grant",
                    error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.ERROR,
                )
            ),
        ) as view_access,
        patch(
            "superset.charts.schemas.ChartDataQueryContextSchema.load",
            return_value=query_context,
        ),
        patch(
            "superset.commands.chart.data.get_data_command.ChartDataCommand",
            return_value=command,
        ),
    ):
        async with Client(mcp) as client:
            response: CallToolResult = await client.call_tool(
                "get_chart_data", {"request": {"identifier": "9"}}
            )
    assert isinstance(response.content[0], TextContent)
    result: dict[str, Any] = json.loads(response.content[0].text)
    view_lookup.assert_called_once_with(DatasourceType.SEMANTIC_VIEW, 17)
    view_access.assert_not_called()
    if outcome == "missing":
        assert result["error_type"] == "DatasetNotAccessible"
        authorize_query.assert_not_called()
        command.run.assert_not_called()
        return
    authorize_query.assert_called_once()
    assert query_context.form_data == {"dashboardId": 5, "slice_id": 9}
    command.validate.assert_called_once()
    if outcome == "rls_refused":
        assert "error_type" in result, result
        command.run.assert_not_called()
        return
    assert "error_type" not in result, result
    assert result["data"] == [{"sales": 7}]


@pytest.mark.parametrize(
    "source_type, outcome",
    [
        ("semantic_view", "allowed"),
        ("semantic_view", "missing"),
        ("semantic_view", "denied"),
        ("table", "allowed"),
    ],
)
def test_chart_data_access_check_uses_the_source_type(
    source_type: str, outcome: str
) -> None:
    """The shared check behind add_chart_to_existing_dashboard, generate_dashboard
    and update_chart must not authorize a semantic chart against a same-id table."""
    from superset.mcp_service.auth import check_chart_data_access

    chart: SimpleNamespace = SimpleNamespace(
        id=9, datasource_id=17, datasource_type=source_type
    )
    view: SemanticView = SemanticView(id=17, name="Sales")
    dataset: SimpleNamespace = SimpleNamespace(id=17, table_name="Sales", sql=None)
    table_lookup: Mock
    view_lookup: Mock
    view_access: Mock
    with (
        patch("superset.mcp_service.auth.has_dataset_access", return_value=True),
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id", return_value=dataset
        ) as table_lookup,
        patch(
            "superset.daos.datasource.DatasourceDAO.get_datasource",
            return_value=view,
            side_effect=DatasourceNotFound() if outcome == "missing" else None,
        ) as view_lookup,
        patch.object(
            SemanticView,
            "raise_for_access",
            side_effect=SupersetSecurityException(
                SupersetError(
                    message="private source detail",
                    error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )
            if outcome == "denied"
            else None,
        ) as view_access,
    ):
        result: DatasetValidationResult = check_chart_data_access(chart)
    assert result.is_valid is (outcome == "allowed")
    if source_type == "table":
        table_lookup.assert_called_once_with(17, skip_base_filter=False)
        view_lookup.assert_not_called()
        return
    table_lookup.assert_not_called()
    view_lookup.assert_called_once_with(DatasourceType.SEMANTIC_VIEW, 17)
    if outcome == "missing":
        view_access.assert_not_called()
    else:
        view_access.assert_called_once()
    if outcome != "allowed":
        assert result.error is not None
        assert "private source detail" not in result.error


@pytest.mark.asyncio
@pytest.mark.parametrize("outcome", ["allowed", "denied"])
async def test_update_chart_refuses_saved_semantic_charts(outcome: str) -> None:
    """update_chart builds table-typed form data, so an authorized semantic chart
    is refused rather than rebound to a same-id table; denial stays uniform."""
    update_module: ModuleType = importlib.import_module(
        "superset.mcp_service.chart.tool.update_chart"
    )
    chart: SimpleNamespace = SimpleNamespace(
        id=9,
        slice_name="Sales",
        viz_type="table",
        datasource_id=17,
        datasource_type="semantic_view",
        params=json.dumps({"viz_type": "table", "datasource": "17__semantic_view"}),
    )
    view: SemanticView = SemanticView(id=17, name="Sales")
    table_lookup: Mock
    update_command: Mock
    with (
        patch(
            "superset.mcp_service.auth.get_user_from_request",
            return_value=Mock(id=1, username="admin"),
        ),
        patch("superset.mcp_service.auth.check_tool_permission", return_value=True),
        patch.object(
            update_module.event_logger, "log_context", return_value=nullcontext()
        ),
        patch.object(update_module, "find_chart_by_identifier", return_value=chart),
        patch(
            "superset.daos.dataset.DatasetDAO.find_by_id", return_value=None
        ) as table_lookup,
        patch(
            "superset.daos.datasource.DatasourceDAO.get_datasource",
            return_value=view,
        ),
        patch.object(
            SemanticView,
            "raise_for_access",
            side_effect=SupersetSecurityException(
                SupersetError(
                    message="private source detail",
                    error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )
            if outcome == "denied"
            else None,
        ),
        patch("superset.commands.chart.update.UpdateChartCommand") as update_command,
    ):
        async with Client(mcp) as client:
            response: CallToolResult = await client.call_tool(
                "update_chart",
                {"request": {"identifier": 9, "chart_name": "Renamed"}},
            )
    result: dict[str, Any] = response.structured_content or {}
    assert result["success"] is False, result
    error: dict[str, Any] = result["error"]
    table_lookup.assert_not_called()
    update_command.assert_not_called()
    if outcome == "denied":
        assert error["error_type"] == "DatasetNotAccessible"
        assert "private source detail" not in error["message"]
    else:
        assert error["error_type"] == "UnsupportedDatasourceType"
        assert "semantic view" in error["message"]
