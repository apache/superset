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
from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from superset.charts.data.dashboard_filter_context import (
    _extract_filter_extra_form_data,
    _find_chart_layout_item,
    _is_filter_in_scope_for_chart,
    _merge_extra_form_data,
    _validate_chart_on_dashboard,
    DashboardFilterContext,
    DashboardFilterStatus,
    get_dashboard_filter_context,
)
from superset.utils import json

SAMPLE_POSITION_JSON = {
    "ROOT_ID": {
        "id": "ROOT_ID",
        "type": "ROOT",
        "children": ["GRID_ID"],
    },
    "GRID_ID": {
        "id": "GRID_ID",
        "type": "GRID",
        "children": ["ROW-abc"],
        "parents": ["ROOT_ID"],
    },
    "ROW-abc": {
        "id": "ROW-abc",
        "type": "ROW",
        "children": ["CHART-xyz"],
        "parents": ["ROOT_ID", "GRID_ID"],
    },
    "CHART-xyz": {
        "id": "CHART-xyz",
        "type": "CHART",
        "meta": {"chartId": 10},
        "parents": ["ROOT_ID", "GRID_ID", "ROW-abc"],
    },
    "CHART-other": {
        "id": "CHART-other",
        "type": "CHART",
        "meta": {"chartId": 20},
        "parents": ["ROOT_ID", "GRID_ID", "ROW-abc"],
    },
}


def _make_filter(
    flt_id: str = "NATIVE_FILTER-1",
    name: str = "Region Filter",
    scope_root: list[str] | None = None,
    scope_excluded: list[int] | None = None,
    charts_in_scope: list[int] | None = None,
    default_value: list[str] | None = None,
    extra_form_data: dict[str, Any] | None = None,
    default_to_first_item: bool = False,
    target_column: str | None = "region",
    flt_type: str = "NATIVE_FILTER",
) -> dict[str, Any]:
    """Helper to build a native filter config dict for testing."""
    flt: dict[str, Any] = {
        "id": flt_id,
        "name": name,
        "type": flt_type,
        "filterType": "filter_select",
        "targets": [{"datasetId": 1, "column": {"name": target_column}}]
        if target_column
        else [],
        "scope": {
            "rootPath": scope_root or ["ROOT_ID"],
            "excluded": scope_excluded or [],
        },
        "controlValues": {
            "defaultToFirstItem": default_to_first_item,
            "multiSelect": True,
            "enableEmptyFilter": False,
        },
        "defaultDataMask": {},
    }
    if charts_in_scope is not None:
        flt["chartsInScope"] = charts_in_scope
    if default_value is not None:
        flt["defaultDataMask"]["filterState"] = {"value": default_value}
        if extra_form_data is None:
            extra_form_data = {
                "filters": [{"col": target_column, "op": "IN", "val": default_value}]
            }
    if extra_form_data is not None:
        flt["defaultDataMask"]["extraFormData"] = extra_form_data
    return flt


# --- _find_chart_layout_item ---


def test_find_chart_layout_item_found() -> None:
    result = _find_chart_layout_item(10, SAMPLE_POSITION_JSON)
    assert result is not None
    assert result["id"] == "CHART-xyz"
    assert result["meta"]["chartId"] == 10


def test_find_chart_layout_item_not_found() -> None:
    result = _find_chart_layout_item(999, SAMPLE_POSITION_JSON)
    assert result is None


def test_find_chart_layout_item_skips_non_dict_entries() -> None:
    position = {**SAMPLE_POSITION_JSON, "DASHBOARD_VERSION_KEY": "v2"}
    result = _find_chart_layout_item(10, position)
    assert result is not None


# --- _is_filter_in_scope_for_chart ---


def test_filter_in_scope_via_charts_in_scope() -> None:
    flt = _make_filter(charts_in_scope=[10, 20])
    assert _is_filter_in_scope_for_chart(flt, 10, SAMPLE_POSITION_JSON) is True


def test_filter_not_in_scope_via_charts_in_scope() -> None:
    flt = _make_filter(charts_in_scope=[20, 30])
    assert _is_filter_in_scope_for_chart(flt, 10, SAMPLE_POSITION_JSON) is False


def test_filter_in_scope_via_root_path() -> None:
    flt = _make_filter(scope_root=["ROOT_ID"])
    assert _is_filter_in_scope_for_chart(flt, 10, SAMPLE_POSITION_JSON) is True


def test_filter_excluded_from_scope() -> None:
    flt = _make_filter(scope_root=["ROOT_ID"], scope_excluded=[10])
    assert _is_filter_in_scope_for_chart(flt, 10, SAMPLE_POSITION_JSON) is False


def test_filter_not_in_scope_different_root() -> None:
    flt = _make_filter(scope_root=["TABS-nonexistent"])
    assert _is_filter_in_scope_for_chart(flt, 10, SAMPLE_POSITION_JSON) is False


def test_filter_in_scope_chart_not_in_layout() -> None:
    flt = _make_filter(scope_root=["ROOT_ID"])
    assert _is_filter_in_scope_for_chart(flt, 999, SAMPLE_POSITION_JSON) is False


# --- _extract_filter_extra_form_data ---


def test_extract_static_default_applied() -> None:
    flt = _make_filter(default_value=["US", "UK"])
    extra_form_data, status = _extract_filter_extra_form_data(flt)
    assert status == DashboardFilterStatus.APPLIED
    assert extra_form_data is not None
    assert extra_form_data["filters"][0]["val"] == ["US", "UK"]


def test_extract_default_to_first_item_not_applied() -> None:
    """defaultToFirstItem filters require a pre-query and cannot be applied."""
    flt = _make_filter(default_to_first_item=True)
    extra_form_data, status = _extract_filter_extra_form_data(flt)
    assert (
        status == DashboardFilterStatus.NOT_APPLIED_USES_DEFAULT_TO_FIRST_ITEM_PREQUERY
    )
    assert extra_form_data is None


def test_extract_no_default_value_not_applied() -> None:
    """Filters with no default are not applied, matching dashboard initial load."""
    flt = _make_filter()
    extra_form_data, status = _extract_filter_extra_form_data(flt)
    assert status == DashboardFilterStatus.NOT_APPLIED
    assert extra_form_data is None


def test_extract_default_to_first_item_overrides_static_default() -> None:
    """defaultToFirstItem takes precedence even when a static default exists."""
    flt = _make_filter(default_value=["US"], default_to_first_item=True)
    extra_form_data, status = _extract_filter_extra_form_data(flt)
    assert (
        status == DashboardFilterStatus.NOT_APPLIED_USES_DEFAULT_TO_FIRST_ITEM_PREQUERY
    )
    assert extra_form_data is None


def test_extract_filter_state_value_but_no_extra_form_data() -> None:
    """Edge case: filterState.value set but extraFormData not persisted."""
    flt = _make_filter()
    flt["defaultDataMask"] = {"filterState": {"value": ["US"]}}
    extra_form_data, status = _extract_filter_extra_form_data(flt)
    assert status == DashboardFilterStatus.NOT_APPLIED
    assert extra_form_data is None


# --- _merge_extra_form_data ---


def test_merge_extra_form_data_appends_filters() -> None:
    base = {"filters": [{"col": "a", "op": "IN", "val": ["x"]}]}
    new = {"filters": [{"col": "b", "op": "IN", "val": ["y"]}]}
    merged = _merge_extra_form_data(base, new)
    assert len(merged["filters"]) == 2


def test_merge_extra_form_data_overrides_scalars() -> None:
    base = {"time_range": "last week"}
    new = {"time_range": "last month"}
    merged = _merge_extra_form_data(base, new)
    assert merged["time_range"] == "last month"


def test_merge_extra_form_data_empty_inputs() -> None:
    assert _merge_extra_form_data({}, {}) == {}


# --- _get_filter_target_column ---


def test_target_column_from_dict() -> None:
    from superset.charts.data.dashboard_filter_context import _get_filter_target_column

    flt = _make_filter(target_column="country")
    assert _get_filter_target_column(flt) == "country"


def test_target_column_no_targets() -> None:
    from superset.charts.data.dashboard_filter_context import _get_filter_target_column

    flt = _make_filter(target_column=None)
    flt["targets"] = []
    assert _get_filter_target_column(flt) is None


# --- validate_chart_on_dashboard ---


def test_validate_chart_on_dashboard_success() -> None:
    dashboard = MagicMock()
    slice_obj = MagicMock()
    slice_obj.id = 10
    dashboard.slices = [slice_obj]
    _validate_chart_on_dashboard(dashboard, 10)


def test_validate_chart_on_dashboard_fails() -> None:
    dashboard = MagicMock()
    dashboard.id = 42
    slice_obj = MagicMock()
    slice_obj.id = 10
    dashboard.slices = [slice_obj]
    with pytest.raises(ValueError, match="not on dashboard"):
        _validate_chart_on_dashboard(dashboard, 999)


# --- DashboardFilterContext.to_dict ---


def test_dashboard_filter_context_to_dict() -> None:
    from superset.charts.data.dashboard_filter_context import DashboardFilterInfo

    ctx = DashboardFilterContext(
        extra_form_data={"filters": [{"col": "a", "op": "IN", "val": ["x"]}]},
        filters=[
            DashboardFilterInfo(
                id="f1",
                name="Filter 1",
                status=DashboardFilterStatus.APPLIED,
                column="a",
            ),
            DashboardFilterInfo(
                id="f2",
                name="Filter 2",
                status=DashboardFilterStatus.NOT_APPLIED,
            ),
        ],
    )
    result = ctx.to_dict()
    assert len(result["filters"]) == 2
    assert result["filters"][0]["status"] == "applied"
    assert result["filters"][0]["column"] == "a"
    assert result["filters"][1]["status"] == "not_applied"
    assert "column" not in result["filters"][1]


# --- get_dashboard_filter_context (integration with mocks) ---


@patch("superset.charts.data.dashboard_filter_context._check_dashboard_access")
@patch("superset.charts.data.dashboard_filter_context.db")
def test_get_dashboard_filter_context_dashboard_not_found(
    mock_db: MagicMock,
    mock_check_access: MagicMock,
) -> None:
    (
        mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value
    ) = None
    with pytest.raises(ValueError, match="not found"):
        get_dashboard_filter_context(dashboard_id=999, chart_id=10)


@patch("superset.charts.data.dashboard_filter_context._check_dashboard_access")
@patch("superset.charts.data.dashboard_filter_context.db")
def test_get_dashboard_filter_context_chart_not_on_dashboard(
    mock_db: MagicMock,
    mock_check_access: MagicMock,
) -> None:
    dashboard = MagicMock()
    dashboard.id = 42
    slice_obj = MagicMock()
    slice_obj.id = 20
    dashboard.slices = [slice_obj]
    dashboard.json_metadata = "{}"
    dashboard.position_json = "{}"
    (
        mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value
    ) = dashboard
    with pytest.raises(ValueError, match="not on dashboard"):
        get_dashboard_filter_context(dashboard_id=42, chart_id=10)


@patch("superset.charts.data.dashboard_filter_context._check_dashboard_access")
@patch("superset.charts.data.dashboard_filter_context.db")
def test_get_dashboard_filter_context_static_defaults(
    mock_db: MagicMock,
    mock_check_access: MagicMock,
) -> None:
    filter_config = [
        _make_filter(
            flt_id="f1",
            name="Region",
            scope_root=["ROOT_ID"],
            default_value=["US", "UK"],
            target_column="region",
        ),
    ]
    metadata = {"native_filter_configuration": filter_config}

    dashboard = MagicMock()
    dashboard.id = 1
    slice_obj = MagicMock()
    slice_obj.id = 10
    dashboard.slices = [slice_obj]
    dashboard.json_metadata = json.dumps(metadata)
    dashboard.position_json = json.dumps(SAMPLE_POSITION_JSON)
    (
        mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value
    ) = dashboard

    ctx = get_dashboard_filter_context(dashboard_id=1, chart_id=10)

    assert len(ctx.filters) == 1
    assert ctx.filters[0].status == DashboardFilterStatus.APPLIED
    assert ctx.filters[0].column == "region"
    assert len(ctx.extra_form_data.get("filters", [])) == 1
    assert ctx.extra_form_data["filters"][0]["val"] == ["US", "UK"]


@patch("superset.charts.data.dashboard_filter_context._check_dashboard_access")
@patch("superset.charts.data.dashboard_filter_context.db")
def test_get_dashboard_filter_context_mixed_filter_types(
    mock_db: MagicMock,
    mock_check_access: MagicMock,
) -> None:
    """Test with a mix of static, dynamic, and no-default filters."""
    filter_config = [
        _make_filter(
            flt_id="f1",
            name="Region",
            scope_root=["ROOT_ID"],
            default_value=["US"],
            target_column="region",
        ),
        _make_filter(
            flt_id="f2",
            name="City",
            scope_root=["ROOT_ID"],
            default_to_first_item=True,
            target_column="city",
        ),
        _make_filter(
            flt_id="f3",
            name="Status",
            scope_root=["ROOT_ID"],
            target_column="status",
        ),
    ]
    metadata = {"native_filter_configuration": filter_config}

    dashboard = MagicMock()
    dashboard.id = 1
    slice_obj = MagicMock()
    slice_obj.id = 10
    dashboard.slices = [slice_obj]
    dashboard.json_metadata = json.dumps(metadata)
    dashboard.position_json = json.dumps(SAMPLE_POSITION_JSON)
    (
        mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value
    ) = dashboard

    ctx = get_dashboard_filter_context(dashboard_id=1, chart_id=10)

    assert len(ctx.filters) == 3
    assert ctx.filters[0].status == DashboardFilterStatus.APPLIED
    assert (
        ctx.filters[1].status
        == DashboardFilterStatus.NOT_APPLIED_USES_DEFAULT_TO_FIRST_ITEM_PREQUERY
    )
    assert ctx.filters[2].status == DashboardFilterStatus.NOT_APPLIED

    # Only the static-default filter should contribute to extra_form_data
    assert len(ctx.extra_form_data.get("filters", [])) == 1


@patch("superset.charts.data.dashboard_filter_context._check_dashboard_access")
@patch("superset.charts.data.dashboard_filter_context.db")
def test_get_dashboard_filter_context_skips_dividers(
    mock_db: MagicMock,
    mock_check_access: MagicMock,
) -> None:
    filter_config = [
        {
            "id": "div-1",
            "type": "DIVIDER",
            "name": "Separator",
        },
        _make_filter(
            flt_id="f1",
            name="Region",
            scope_root=["ROOT_ID"],
            default_value=["US"],
            target_column="region",
        ),
    ]
    metadata = {"native_filter_configuration": filter_config}

    dashboard = MagicMock()
    dashboard.id = 1
    slice_obj = MagicMock()
    slice_obj.id = 10
    dashboard.slices = [slice_obj]
    dashboard.json_metadata = json.dumps(metadata)
    dashboard.position_json = json.dumps(SAMPLE_POSITION_JSON)
    (
        mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value
    ) = dashboard

    ctx = get_dashboard_filter_context(dashboard_id=1, chart_id=10)
    assert len(ctx.filters) == 1
    assert ctx.filters[0].name == "Region"


@patch("superset.charts.data.dashboard_filter_context._check_dashboard_access")
@patch("superset.charts.data.dashboard_filter_context.db")
def test_get_dashboard_filter_context_out_of_scope_filter_excluded(
    mock_db: MagicMock,
    mock_check_access: MagicMock,
) -> None:
    """Filters not in scope for the chart should be excluded."""
    filter_config = [
        _make_filter(
            flt_id="f1",
            name="In-scope",
            scope_root=["ROOT_ID"],
            default_value=["US"],
            target_column="region",
        ),
        _make_filter(
            flt_id="f2",
            name="Out-of-scope",
            scope_root=["TABS-nonexistent"],
            default_value=["active"],
            target_column="status",
        ),
    ]
    metadata = {"native_filter_configuration": filter_config}

    dashboard = MagicMock()
    dashboard.id = 1
    slice_obj = MagicMock()
    slice_obj.id = 10
    dashboard.slices = [slice_obj]
    dashboard.json_metadata = json.dumps(metadata)
    dashboard.position_json = json.dumps(SAMPLE_POSITION_JSON)
    (
        mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value
    ) = dashboard

    ctx = get_dashboard_filter_context(dashboard_id=1, chart_id=10)
    assert len(ctx.filters) == 1
    assert ctx.filters[0].id == "f1"
