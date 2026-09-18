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
"""update_chart rebinding a chart to a semantic view via view_id (sc-120959)."""

import importlib
from types import ModuleType
from typing import Any
from unittest.mock import AsyncMock, MagicMock, Mock, patch
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from superset.connectors.sqla.models import SqlaTable
from superset.mcp_service.chart.chart_utils import DatasetValidationResult
from superset.mcp_service.chart.compile import CompileResult
from superset.mcp_service.chart.datasource_resolver import ChartDatasource
from superset.mcp_service.chart.schemas import (
    ColumnRef,
    GenerateChartResponse,
    UpdateChartRequest,
    XYChartConfig,
)
from superset.mcp_service.chart.tool.update_chart import (
    _build_preview_form_data,
    _build_update_payload,
    _rebind_target,
    _validate_update_against_target,
)
from superset.utils import json
from superset.utils.core import DatasourceType

# The package ``__init__`` re-exports the ``update_chart`` tool function under
# the module's name, so import the module explicitly for ``patch.object``.
update_chart_module: ModuleType = importlib.import_module(
    "superset.mcp_service.chart.tool.update_chart"
)


def _chart(datasource_id: int = 3, datasource_type: str = "table") -> Mock:
    chart: Mock = Mock()
    chart.id = 12
    chart.slice_name = "Revenue"
    chart.viz_type = "echarts_timeseries_line"
    chart.datasource_id = datasource_id
    chart.datasource_type = datasource_type
    chart.params = json.dumps(
        {
            "viz_type": "echarts_timeseries_line",
            "datasource": f"{datasource_id}__{datasource_type}",
            "metrics": ["revenue"],
        }
    )
    return chart


def _view_config() -> XYChartConfig:
    return XYChartConfig(
        chart_type="xy",
        x=ColumnRef(name="metric_time"),
        y=[ColumnRef(name="revenue", saved_metric=True)],
        kind="line",
    )


class TestRebindTarget:
    def test_view_id_targets_a_semantic_view(self) -> None:
        request: UpdateChartRequest = UpdateChartRequest(identifier=12, view_id=5)
        assert _rebind_target(request, _chart()) == (5, "semantic_view", True)

    def test_dataset_id_targets_a_table(self) -> None:
        request: UpdateChartRequest = UpdateChartRequest(identifier=12, dataset_id=9)
        assert _rebind_target(request, _chart()) == (9, "table", True)

    def test_same_id_different_kind_is_still_a_rebind(self) -> None:
        # Views and datasets share the id space: 3__table -> 3__semantic_view.
        request: UpdateChartRequest = UpdateChartRequest(identifier=12, view_id=3)
        assert _rebind_target(request, _chart(3, "table")) == (
            3,
            "semantic_view",
            True,
        )

    def test_no_target_keeps_the_current_datasource_kind(self) -> None:
        request: UpdateChartRequest = UpdateChartRequest(
            identifier=12, chart_name="Renamed"
        )
        assert _rebind_target(request, _chart(3, "semantic_view")) == (
            None,
            "semantic_view",
            False,
        )


class TestBuildUpdatePayload:
    def test_view_rebind_writes_semantic_view_datasource(self) -> None:
        request: UpdateChartRequest = UpdateChartRequest(
            identifier=12, view_id=5, config=_view_config()
        )
        payload: dict[str, Any] | GenerateChartResponse = _build_update_payload(
            request, _chart(), request.config
        )
        assert isinstance(payload, dict)
        assert payload["datasource_id"] == 5
        assert payload["datasource_type"] == "semantic_view"
        form_data: dict[str, Any] = json.loads(payload["params"])
        assert form_data["datasource"] == "5__semantic_view"
        assert form_data["metrics"] == ["revenue"]

    def test_view_only_rebind_without_config(self) -> None:
        request: UpdateChartRequest = UpdateChartRequest(identifier=12, view_id=5)
        payload: dict[str, Any] | GenerateChartResponse = _build_update_payload(
            request, _chart(), None
        )
        assert isinstance(payload, dict)
        assert payload["datasource_id"] == 5
        assert payload["datasource_type"] == "semantic_view"
        assert json.loads(payload["params"])["datasource"] == "5__semantic_view"
        assert payload["query_context"] is None

    def test_preview_form_data_on_a_view_backed_chart_keeps_its_kind(self) -> None:
        request: UpdateChartRequest = UpdateChartRequest(
            identifier=12, chart_name="Renamed"
        )
        merged: dict[str, Any] | GenerateChartResponse = _build_preview_form_data(
            request, _chart(3, "semantic_view"), None
        )
        assert isinstance(merged, dict)
        assert merged["datasource"] == "3__semantic_view"
        assert merged["slice_name"] == "Renamed"


class TestValidateUpdateAgainstTarget:
    def test_semantic_view_target_skips_the_dataset_dao(self) -> None:
        view: Mock = Mock()
        view.id = 5
        view.name = "Jaffle Shop"
        time_col: Mock = Mock()
        time_col.column_name = "metric_time"
        time_col.type = "TIMESTAMP"
        time_col.is_dttm = True
        view.columns = [time_col]
        revenue: Mock = Mock()
        revenue.metric_name = "revenue"
        revenue.expression = "revenue"
        revenue.description = None
        view.metrics = [revenue]
        target: ChartDatasource = ChartDatasource(
            explorable=view,
            datasource_type=DatasourceType.SEMANTIC_VIEW,
            id=5,
            name="Jaffle Shop",
        )
        with (
            patch.object(
                update_chart_module, "resolve_semantic_view", return_value=target
            ) as resolve,
            patch("superset.daos.dataset.DatasetDAO.find_by_id") as find_dataset,
        ):
            error: GenerateChartResponse | None = _validate_update_against_target(
                _view_config(),
                {},
                _chart(),
                5,
                "semantic_view",
                run_compile_check=False,
            )
        assert error is None
        resolve.assert_called_once_with(5)
        find_dataset.assert_not_called()

    def test_missing_semantic_view_is_reported(self) -> None:
        with patch.object(
            update_chart_module, "resolve_semantic_view", return_value=None
        ):
            error: GenerateChartResponse | None = _validate_update_against_target(
                None, {}, _chart(), 404, "semantic_view", run_compile_check=False
            )
        assert error is not None
        assert error.success is False
        assert error.error is not None
        assert error.error.error_type == "view_not_found"

    def test_adhoc_aggregate_on_a_view_is_rejected(self) -> None:
        view: Mock = Mock()
        view.id = 5
        view.name = "Jaffle Shop"
        view.columns = []
        view.metrics = []
        target: ChartDatasource = ChartDatasource(
            explorable=view,
            datasource_type=DatasourceType.SEMANTIC_VIEW,
            id=5,
            name="Jaffle Shop",
        )
        config: XYChartConfig = XYChartConfig(
            chart_type="xy",
            x=ColumnRef(name="metric_time"),
            y=[ColumnRef(name="revenue", aggregate="SUM")],
            kind="line",
        )
        with patch.object(
            update_chart_module, "resolve_semantic_view", return_value=target
        ):
            error: GenerateChartResponse | None = _validate_update_against_target(
                config, {}, _chart(), 5, "semantic_view"
            )
        assert error is not None
        assert error.error is not None
        assert error.error.error_type == "semantic_view_adhoc_not_supported"


def test_semantic_to_table_rebind_compiles_retained_state() -> None:
    """Validate the actual rebound query, not an empty configuration."""
    chart: Mock = _chart(3, "semantic_view")
    request: UpdateChartRequest = UpdateChartRequest(identifier=12, dataset_id=3)
    payload: dict[str, Any] | GenerateChartResponse = _build_update_payload(
        request, chart
    )
    assert isinstance(payload, dict)
    form_data: dict[str, Any] = json.loads(payload["params"])
    assert form_data["datasource"] == "3__table"
    with patch.object(
        update_chart_module, "_validate_update_against_dataset", return_value=None
    ) as validate:
        assert (
            _validate_update_against_target(
                None, form_data, chart, 3, "table", run_compile_check=False
            )
            is None
        )
    assert validate.call_args.args[1] == form_data
    assert validate.call_args.kwargs["run_compile_check"] is True


def test_unknown_persisted_source_does_not_fall_back_to_table() -> None:
    """Reject an unsupported source family instead of looking up a colliding table."""
    with pytest.raises(ValueError, match="Unsupported chart datasource type"):
        _rebind_target(
            UpdateChartRequest(identifier=12, chart_name="Rename"), _chart(3, "unknown")
        )


@pytest.mark.parametrize("semantic", [False, True])
def test_rebind_accepts_legacy_chart_double_without_source_attributes(
    semantic: bool,
) -> None:
    """Missing legacy attributes must not mask chart validation errors."""
    chart: Mock = Mock(spec=[])
    request: UpdateChartRequest = (
        UpdateChartRequest(identifier=12, view_id=3)
        if semantic
        else UpdateChartRequest(identifier=12, dataset_id=3)
    )
    assert _rebind_target(request, chart) == (
        3,
        "semantic_view" if semantic else "table",
        True,
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("visible", [True, False])
@pytest.mark.parametrize(
    "preview_mode,compile_success", [(True, True), (True, False), (False, False)]
)
async def test_uuid_rebind_entrypoint_preserves_identity_and_denial(
    mocker: MockerFixture, visible: bool, preview_mode: bool, compile_success: bool
) -> None:
    """Resolve a UUID within the view family before any preview or chart write."""
    chart: Mock = _chart(1)
    chart.uuid = None
    view: Mock = Mock(
        id=1,
        columns=[Mock(column_name="metric_time", type="TIMESTAMP", is_dttm=True)],
        metrics=[Mock(metric_name="revenue", expression="revenue", description=None)],
    )
    view.name = "Semantic revenue"
    target: ChartDatasource = ChartDatasource(
        view, DatasourceType.SEMANTIC_VIEW, 1, "Semantic revenue"
    )
    mocker.patch.object(
        update_chart_module, "find_chart_by_identifier", return_value=chart
    )
    resolve: MagicMock = mocker.patch.object(
        update_chart_module,
        "resolve_semantic_view",
        return_value=target if visible else None,
    )
    mocker.patch(
        "superset.mcp_service.auth.check_chart_data_access",
        return_value=DatasetValidationResult(True, 1, "Table", []),
    )
    mocker.patch(
        "superset.mcp_service.auth.get_user_from_request",
        return_value=Mock(id=1, username="admin", roles=[], groups=[]),
    )
    mocker.patch("superset.utils.log.DBEventLogger.log")
    preview: MagicMock = mocker.patch.object(
        update_chart_module,
        "_create_preview_url",
        return_value=("http://localhost/explore/?form_data_key=key", "key", []),
    )
    write: MagicMock = mocker.patch("superset.commands.chart.update.UpdateChartCommand")
    compile_query: MagicMock = mocker.patch.object(
        update_chart_module,
        "_compile_chart",
        return_value=CompileResult(
            success=compile_success,
            error=None if compile_success else "Provider rejected query",
        ),
    )
    identity: UUID = UUID("60bbdebe-f30c-4699-88dc-cbe7355fb4c1")
    request: UpdateChartRequest = UpdateChartRequest(
        identifier=12,
        view_id=identity,
        generate_preview=preview_mode,
        config=_view_config(),
    )
    ctx: MagicMock = MagicMock(
        info=AsyncMock(),
        debug=AsyncMock(),
        warning=AsyncMock(),
        error=AsyncMock(),
        report_progress=AsyncMock(),
    )
    response: GenerateChartResponse = await update_chart_module.update_chart(
        request, ctx=ctx
    )
    assert resolve.call_args_list[0].args == (identity,)
    write.assert_not_called()
    if visible and compile_success:
        assert response.success, response.error
        assert preview.call_args.args[1]["datasource"] == "1__semantic_view"
        assert preview.call_args.kwargs["datasource_type"] == "semantic_view"
        assert preview.call_args.kwargs["datasource_id"] == 1
    elif visible:
        assert not response.success
        assert response.error is not None
        assert response.error.error_type == "compile_error"
        assert compile_query.call_args.args[0]["datasource"] == "1__semantic_view"
        assert compile_query.call_args.kwargs["datasource_type"] == "semantic_view"
        assert compile_query.call_args.args[1] == 1
        preview.assert_not_called()
    else:
        assert not response.success
        assert response.error is not None
        assert response.error.error_type == "view_not_found"
        preview.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize("preview_mode", [False, True])
async def test_table_source_only_rebind_retains_filters_in_both_modes(
    mocker: MockerFixture, preview_mode: bool
) -> None:
    """A table-only rebind preserves retained filters without validating new roles."""
    chart: Mock = _chart()
    chart.uuid = None
    form_data: dict[str, Any] = json.loads(chart.params)
    form_data["adhoc_filters"] = [
        {
            "expressionType": "SIMPLE",
            "subject": "legacy_dim",
            "operator": "==",
            "comparator": "value",
            "clause": "WHERE",
        }
    ]
    chart.params = json.dumps(form_data)
    target: SqlaTable = SqlaTable(id=9, table_name="replacement")
    mocker.patch.object(
        update_chart_module, "find_chart_by_identifier", return_value=chart
    )
    mocker.patch("superset.daos.dataset.DatasetDAO.find_by_id", return_value=target)
    mocker.patch(
        "superset.mcp_service.auth.check_chart_data_access",
        return_value=DatasetValidationResult(True, 3, "Original", []),
    )
    mocker.patch(
        "superset.mcp_service.auth.get_user_from_request",
        return_value=Mock(id=1, username="admin", roles=[], groups=[]),
    )
    mocker.patch("superset.utils.log.DBEventLogger.log")
    preview: MagicMock = mocker.patch.object(
        update_chart_module,
        "_create_preview_url",
        return_value=("http://localhost/explore/?form_data_key=key", "key", []),
    )
    write: MagicMock = mocker.patch("superset.commands.chart.update.UpdateChartCommand")
    write.return_value.run.return_value = chart
    ctx: MagicMock = MagicMock(
        info=AsyncMock(),
        debug=AsyncMock(),
        warning=AsyncMock(),
        error=AsyncMock(),
        report_progress=AsyncMock(),
    )
    response: GenerateChartResponse = await update_chart_module.update_chart(
        UpdateChartRequest(
            identifier=12,
            dataset_id=9,
            generate_preview=preview_mode,
            preview_formats=[],
        ),
        ctx=ctx,
    )
    assert response.success, response.error
    if preview_mode:
        assert preview.call_args.args[1]["adhoc_filters"] == form_data["adhoc_filters"]
        assert preview.call_args.args[1]["datasource"] == "9__table"
        write.assert_not_called()
    else:
        assert write.call_args.args[1] == {
            "datasource_id": 9,
            "datasource_type": "table",
        }
        preview.assert_not_called()
    assert json.loads(chart.params) == form_data
