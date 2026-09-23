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
"""Verify semantic chart generation preserves authorized source identity."""

from typing import Any
from unittest.mock import AsyncMock, MagicMock, Mock
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from superset.commands.chart.exceptions import ChartDataQueryFailedError
from superset.commands.explore.form_data.parameters import CommandParameters
from superset.daos.exceptions import DatasourceNotFound
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.mcp_service.chart.compile import _compile_chart, CompileResult
from superset.mcp_service.chart.preview_utils import generate_preview_from_form_data
from superset.mcp_service.chart.schemas import (
    ChartError,
    ChartPreview,
    ColumnRef,
    GenerateChartRequest,
    GenerateChartResponse,
    GetChartPreviewRequest,
    URLPreview,
    XYChartConfig,
)
from superset.mcp_service.chart.tool.generate_chart import generate_chart
from superset.mcp_service.chart.tool.get_chart_preview import (
    _get_chart_preview_internal,
)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "save_chart,generate_preview", [(False, True), (True, False), (True, True)]
)
@pytest.mark.parametrize("compile_success", [False, True])
async def test_generate_view_never_looks_up_colliding_table(
    mocker: MockerFixture,
    save_chart: bool,
    generate_preview: bool,
    compile_success: bool,
) -> None:
    """Pass saved metric names and the selected family to every output boundary."""
    view: Mock = Mock(id=1)
    view.name = "Semantic revenue"
    view.columns = [Mock(column_name="region", type="STRING", is_dttm=False)]
    view.metrics = [Mock(metric_name="revenue", expression="revenue", description=None)]
    mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource", return_value=view
    )
    table_lookup: MagicMock = mocker.patch(
        "superset.daos.dataset.DatasetDAO.find_by_id"
    )
    table_lookup.side_effect = AssertionError("Must not read the colliding table")
    user: Mock = Mock(id=1, username="admin", roles=[], groups=[])
    mocker.patch("superset.mcp_service.auth.get_user_from_request", return_value=user)
    mocker.patch("superset.utils.log.DBEventLogger.log")
    compile_query: MagicMock = mocker.patch(
        "superset.mcp_service.chart.tool.generate_chart._compile_chart",
        return_value=CompileResult(
            success=compile_success, error=None if compile_success else "Invalid query"
        ),
    )
    link: MagicMock = mocker.patch(
        "superset.mcp_service.chart.chart_utils.generate_explore_link",
        return_value="http://localhost/explore/?form_data_key=semantic-key",
    )
    cache: MagicMock = mocker.patch(
        "superset.mcp_service.commands.create_form_data.MCPCreateFormDataCommand"
    )
    cache.return_value.run.return_value = "saved-key"
    create: MagicMock = mocker.patch(
        "superset.commands.chart.create.CreateChartCommand"
    )
    chart: Mock = Mock(
        id=91,
        slice_name="Revenue",
        viz_type="echarts_timeseries_bar",
        uuid=UUID("60bbdebe-f30c-4699-88dc-cbe7355fb4c1"),
        datasource_id=1,
        datasource_type="semantic_view",
    )
    create.return_value.run.return_value = chart
    mocker.patch(
        "superset.mcp_service.chart.tool.get_chart_preview.find_chart_by_identifier",
        return_value=chart,
    )
    mocker.patch(
        "superset.mcp_service.chart.tool.get_chart_preview.PreviewFormatGenerator.generate",
        return_value=URLPreview(
            preview_url="http://localhost/explore/?slice_id=91", width=800, height=600
        ),
    )
    mocker.patch("superset.extensions.db.session.refresh")
    mocker.patch(
        "superset.mcp_service.chart.schemas.serialize_chart_object", return_value=None
    )
    ctx: MagicMock = MagicMock(
        info=AsyncMock(),
        debug=AsyncMock(),
        warning=AsyncMock(),
        error=AsyncMock(),
        report_progress=AsyncMock(),
    )
    request: GenerateChartRequest = GenerateChartRequest(
        view_id=1,
        save_chart=save_chart,
        generate_preview=generate_preview,
        config=XYChartConfig(
            chart_type="xy",
            kind="bar",
            x=ColumnRef(name="region"),
            y=[ColumnRef(name="revenue", saved_metric=True)],
        ),
    )
    response: GenerateChartResponse = await generate_chart(request, ctx=ctx)
    if not compile_success:
        assert response.success is False
        create.assert_not_called()
        link.assert_not_called()
        cache.assert_not_called()
        return
    assert response.success, response.error
    assert response.form_data["datasource"] == "1__semantic_view"
    assert response.form_data["metrics"] == ["revenue"]
    assert compile_query.call_args.kwargs["datasource_type"] == "semantic_view"
    assert compile_query.call_args.args[1] == 1
    table_lookup.assert_not_called()
    assert view.raise_for_access.call_count == (
        2 if save_chart and generate_preview else 1
    )
    if save_chart:
        if generate_preview:
            assert "url" in response.previews
        properties: dict[str, Any] = create.call_args.args[0]
        assert properties["datasource_id"] == 1
        assert properties["datasource_type"] == "semantic_view"
        parameters: CommandParameters = cache.call_args.args[0]
        assert parameters.datasource_type == "semantic_view"
        assert parameters.datasource_id == 1
    else:
        create.assert_not_called()
        assert link.call_args.kwargs["datasource_type"] == "semantic_view"


@pytest.mark.parametrize("preview", [False, True])
def test_query_boundary_preserves_semantic_family(
    mocker: MockerFixture, preview: bool
) -> None:
    """Execute the real query builder with type-qualified semantic form data."""
    mocker.patch(
        "superset.mcp_service.chart.datasource_resolver.resolve_semantic_view",
        return_value=Mock(),
    )
    table: MagicMock = mocker.patch(
        "superset.daos.dataset.DatasetDAO.find_by_id",
        side_effect=AssertionError("No table lookup"),
    )
    mocker.patch(
        "superset.mcp_service.chart.chart_helpers.resolve_datasource_engine",
        return_value="base",
    )
    factory: MagicMock = mocker.patch(
        "superset.common.query_context_factory.QueryContextFactory"
    )
    command: MagicMock = mocker.patch(
        "superset.commands.chart.data.get_data_command.ChartDataCommand"
    )
    command.return_value.run.return_value = {
        "queries": [{"status": "success", "data": []}]
    }
    form_data: dict[str, Any] = {
        "viz_type": "table",
        "metrics": ["revenue"],
        "groupby": ["region"],
        "datasource": "1__semantic_view",
    }
    if preview:
        generate_preview_from_form_data(
            form_data, 1, "table", datasource_type="semantic_view"
        )
    else:
        assert _compile_chart(form_data, 1, datasource_type="semantic_view").success
    assert factory.return_value.create.call_args.kwargs["datasource"] == {
        "id": 1,
        "type": "semantic_view",
    }
    command.return_value.validate.assert_called_once()
    command.return_value.run.assert_called_once()
    table.assert_not_called()


def test_semantic_compile_failure_does_not_classify_using_colliding_table(
    mocker: MockerFixture,
) -> None:
    """Even the error classifier must not resolve a semantic ID as a table."""
    mocker.patch(
        "superset.mcp_service.chart.chart_helpers.build_query_context_from_form_data"
    )
    command: MagicMock = mocker.patch(
        "superset.commands.chart.data.get_data_command.ChartDataCommand"
    )
    command.return_value.run.side_effect = ChartDataQueryFailedError("Provider failure")
    table: MagicMock = mocker.patch("superset.daos.dataset.DatasetDAO.find_by_id")
    result: CompileResult = _compile_chart(
        {"viz_type": "table", "metrics": ["revenue"]},
        1,
        datasource_type="semantic_view",
    )
    assert not result.success
    table.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("access", ["allowed", "denied", "missing"])
async def test_saved_view_preview_authorizes_its_own_source(
    mocker: MockerFixture, access: str
) -> None:
    """Missing or denied views never borrow a colliding table's preview access."""
    chart: Mock = Mock(
        id=91,
        slice_name="Revenue",
        viz_type="table",
        datasource_id=1,
        datasource_type="semantic_view",
        params="{}",
    )
    view: Mock = Mock(id=1)
    view.name = "Revenue view"
    if access == "denied":
        view.raise_for_access.side_effect = SupersetSecurityException(
            SupersetError(
                message="denied",
                level=ErrorLevel.ERROR,
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            )
        )
    lookup: MagicMock = mocker.patch(
        "superset.daos.datasource.DatasourceDAO.get_datasource",
        return_value=view,
        side_effect=DatasourceNotFound() if access == "missing" else None,
    )
    table: MagicMock = mocker.patch("superset.daos.dataset.DatasetDAO.find_by_id")
    table.side_effect = AssertionError("Must not read the colliding table")
    mocker.patch(
        "superset.mcp_service.chart.tool.get_chart_preview.find_chart_by_identifier",
        return_value=chart,
    )
    mocker.patch("superset.extensions.db.session.refresh")
    mocker.patch("superset.utils.log.DBEventLogger.log")
    render: MagicMock = mocker.patch(
        "superset.mcp_service.chart.tool.get_chart_preview.PreviewFormatGenerator.generate",
        return_value=URLPreview(
            preview_url="http://localhost/explore/?slice_id=91", width=800, height=600
        ),
    )
    ctx: MagicMock = MagicMock(
        info=AsyncMock(),
        debug=AsyncMock(),
        warning=AsyncMock(),
        error=AsyncMock(),
        report_progress=AsyncMock(),
    )
    result: ChartPreview | ChartError = await _get_chart_preview_internal(
        GetChartPreviewRequest(identifier=91, format="url"), ctx
    )
    lookup.assert_called_once()
    table.assert_not_called()
    if access == "allowed":
        assert isinstance(result, ChartPreview)
        render.assert_called_once()
    else:
        assert isinstance(result, ChartError)
        assert result.error_type == "DatasetNotAccessible"
        assert result.error == "Semantic view not found: 1."
        render.assert_not_called()
    if access != "missing":
        view.raise_for_access.assert_called_once()
