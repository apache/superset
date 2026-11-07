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
"""Tests for the dashboard description handed to export extensions."""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from unittest import mock

import pytest
from superset_core.exports.types import AppliedFilter

from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.dashboards.export_info import describe_dashboard_export
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException

MODULE = "superset.dashboards.export_info"


def _chart(chart_id: int, name: str) -> mock.MagicMock:
    chart = mock.MagicMock()
    chart.id = chart_id
    chart.slice_name = name
    return chart


_EFD = {"filters": [{"col": "region", "op": "IN", "val": ["EU"]}]}


@pytest.fixture
def mocks(app_context: None) -> Iterator[dict[str, Any]]:
    with (
        mock.patch.multiple(
            MODULE,
            DashboardDAO=mock.DEFAULT,
            CreateDashboardPermalinkCommand=mock.DEFAULT,
            get_url_path=mock.DEFAULT,
            get_charts_in_layout_order=mock.DEFAULT,
        ) as patched,
        mock.patch(
            f"{MODULE}.security_manager", new_callable=mock.MagicMock
        ) as security_manager,
    ):
        patched["security_manager"] = security_manager
        dashboard = patched["DashboardDAO"].find_by_id.return_value
        dashboard.dashboard_title = "Sales"
        dashboard.params_dict = {
            "native_filter_configuration": [{"id": "NATIVE_FILTER-1", "name": "Region"}]
        }
        patched["CreateDashboardPermalinkCommand"].return_value.run.return_value = "k"
        patched["get_url_path"].return_value = "https://bi/p/k/"
        patched["get_charts_in_layout_order"].return_value = []
        yield patched


def test_permalink_created_from_exported_state(mocks: dict[str, Any]) -> None:
    mocks["CreateDashboardPermalinkCommand"].return_value.run.return_value = "abc"
    mocks["get_url_path"].return_value = "https://bi/superset/dashboard/p/abc/"
    mask = {
        "NATIVE_FILTER-1": {"extraFormData": _EFD, "filterState": {"value": ["EU"]}}
    }

    info = describe_dashboard_export(5, mask)

    mocks["CreateDashboardPermalinkCommand"].assert_called_once_with(
        dashboard_id="5", state={"dataMask": mask}
    )
    mocks["get_url_path"].assert_any_call(
        "Superset.dashboard_permalink", user_friendly=True, key="abc"
    )
    assert info.title == "Sales"
    assert info.permalink_url.endswith("/p/abc/")


def test_native_filter_uses_configured_name_and_label(mocks: dict[str, Any]) -> None:
    mask = {
        "NATIVE_FILTER-1": {
            "extraFormData": _EFD,
            "filterState": {"value": ["EU", "US"], "label": "EU, US"},
        }
    }
    info = describe_dashboard_export(5, mask)
    assert info.applied_filters == [AppliedFilter("Region", "EU, US")]


def test_value_joined_when_no_label(mocks: dict[str, Any]) -> None:
    mask = {
        "NATIVE_FILTER-1": {
            "extraFormData": _EFD,
            "filterState": {"value": ["EU", "US"]},
        }
    }
    info = describe_dashboard_export(5, mask)
    assert info.applied_filters == [AppliedFilter("Region", "EU, US")]


def test_scalar_value_stringified(mocks: dict[str, Any]) -> None:
    mask = {"NATIVE_FILTER-1": {"extraFormData": _EFD, "filterState": {"value": 3}}}
    info = describe_dashboard_export(5, mask)
    assert info.applied_filters == [AppliedFilter("Region", "3")]


def test_keys_that_are_not_native_filters_are_ignored(mocks: dict[str, Any]) -> None:
    mocks["get_charts_in_layout_order"].return_value = [_chart(12, "Top regions")]
    mask = {
        "12": {"extraFormData": _EFD, "filterState": {"value": ["EU"]}},
        "NATIVE_FILTER-9": {"extraFormData": _EFD, "filterState": {"value": ["x"]}},
    }
    assert describe_dashboard_export(5, mask).applied_filters == []


@pytest.mark.parametrize("empty", [None, [], ""])
def test_empty_filters_dropped(mocks: dict[str, Any], empty: Any) -> None:
    mask = {"NATIVE_FILTER-1": {"extraFormData": _EFD, "filterState": {"value": empty}}}
    assert describe_dashboard_export(5, mask).applied_filters == []


def test_missing_filter_state_dropped(mocks: dict[str, Any]) -> None:
    assert describe_dashboard_export(5, {"NATIVE_FILTER-1": {}}).applied_filters == []


def test_filters_in_sorted_id_order(mocks: dict[str, Any]) -> None:
    mocks["DashboardDAO"].find_by_id.return_value.params_dict = {
        "native_filter_configuration": [
            {"id": "b", "name": "b"},
            {"id": "a", "name": "a"},
        ]
    }
    mask = {
        "b": {"extraFormData": _EFD, "filterState": {"value": [2]}},
        "a": {"extraFormData": _EFD, "filterState": {"value": [1]}},
    }
    info = describe_dashboard_export(5, mask)
    assert info.applied_filters == [AppliedFilter("a", "1"), AppliedFilter("b", "2")]


def _use_filter_with_default(mocks: dict[str, Any], **extra: Any) -> None:
    config = {
        "id": "NATIVE_FILTER-1",
        "name": "Region",
        "defaultDataMask": {
            "filterState": {"value": ["EU"]},
            "extraFormData": {"filters": [{"col": "region", "val": ["EU"]}]},
        },
        **extra,
    }
    mocks["DashboardDAO"].find_by_id.return_value.params_dict = {
        "native_filter_configuration": [config]
    }


def test_saved_default_listed_when_mask_has_no_entry(mocks: dict[str, Any]) -> None:
    _use_filter_with_default(mocks)
    info = describe_dashboard_export(5, {})
    assert info.applied_filters == [AppliedFilter("Region", "EU")]


def test_active_entry_overrides_saved_default(mocks: dict[str, Any]) -> None:
    _use_filter_with_default(mocks)
    mask = {"NATIVE_FILTER-1": {"extraFormData": {}, "filterState": {"value": None}}}
    assert describe_dashboard_export(5, mask).applied_filters == []


def test_value_without_extra_form_data_not_listed(mocks: dict[str, Any]) -> None:
    mask = {"NATIVE_FILTER-1": {"extraFormData": {}, "filterState": {"value": ["EU"]}}}
    assert describe_dashboard_export(5, mask).applied_filters == []


def test_default_to_first_item_not_listed(mocks: dict[str, Any]) -> None:
    _use_filter_with_default(mocks, controlValues={"defaultToFirstItem": True})
    assert describe_dashboard_export(5, {}).applied_filters == []


def test_chart_urls_point_at_explore(mocks: dict[str, Any]) -> None:
    mocks["get_charts_in_layout_order"].return_value = [_chart(12, "a")]
    mocks["get_url_path"].side_effect = lambda view, **kw: f"{view}:{kw}"
    info = describe_dashboard_export(5, {})
    assert info.chart_urls == {
        12: "ExploreView.root:{'user_friendly': True, 'slice_id': 12}"
    }


def test_missing_dashboard_raises(mocks: dict[str, Any]) -> None:
    mocks["DashboardDAO"].find_by_id.return_value = None
    with pytest.raises(DashboardNotFoundError):
        describe_dashboard_export(5, {})


def test_dashboard_access_checked(mocks: dict[str, Any]) -> None:
    error = SupersetError(
        message="denied",
        error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
        level=ErrorLevel.ERROR,
    )
    mocks["security_manager"].raise_for_access.side_effect = SupersetSecurityException(
        error
    )
    with pytest.raises(SupersetSecurityException):
        describe_dashboard_export(5, {})
    mocks["CreateDashboardPermalinkCommand"].assert_not_called()


@pytest.mark.parametrize(
    "entry",
    [
        "EU",
        ["EU"],
        {"filterState": "EU"},
        {"filterState": ["EU"]},
        {"filterState": None},
    ],
)
def test_malformed_mask_entries_skipped(mocks: dict[str, Any], entry: Any) -> None:
    mocks["DashboardDAO"].find_by_id.return_value.params_dict = {
        "native_filter_configuration": [
            {"id": "NATIVE_FILTER-1", "name": "Region"},
            {"id": "NATIVE_FILTER-2", "name": "Country"},
        ]
    }
    mask = {
        "NATIVE_FILTER-1": entry,
        "NATIVE_FILTER-2": {"extraFormData": _EFD, "filterState": {"value": ["EU"]}},
    }
    info = describe_dashboard_export(5, mask)
    assert info.applied_filters == [AppliedFilter("Country", "EU")]
