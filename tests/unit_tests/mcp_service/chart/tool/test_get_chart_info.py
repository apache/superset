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
Unit tests for get_chart_info MCP tool: dashboard-filter resolution path.
"""

from unittest.mock import MagicMock, patch

import pytest

from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.mcp_service.chart.chart_helpers import (
    _resolve_filter_operator_and_value,
    build_applied_dashboard_filters,
    ChartNotOnDashboardError,
)
from superset.mcp_service.chart.schemas import GetChartInfoRequest


class TestGetChartInfoRequestSchema:
    def test_dashboard_id_optional(self):
        request = GetChartInfoRequest(identifier=1)
        assert request.dashboard_id is None

    def test_dashboard_id_accepted(self):
        request = GetChartInfoRequest(identifier=1, dashboard_id=42)
        assert request.dashboard_id == 42


class TestResolveFilterOperatorAndValue:
    def test_matches_adhoc_filter_by_subject(self):
        efd = {
            "adhoc_filters": [
                {
                    "subject": "country",
                    "operator": "IN",
                    "comparator": ["US", "CA"],
                }
            ]
        }
        assert _resolve_filter_operator_and_value(efd, "country") == (
            "IN",
            ["US", "CA"],
        )

    def test_matches_legacy_filter_by_col(self):
        efd = {"filters": [{"col": "state", "op": "==", "val": "NY"}]}
        assert _resolve_filter_operator_and_value(efd, "state") == ("==", "NY")

    def test_time_range_when_no_column(self):
        efd = {"time_range": "Last 7 days"}
        assert _resolve_filter_operator_and_value(efd, None) == (
            "TIME_RANGE",
            "Last 7 days",
        )

    def test_column_not_in_extra_form_data(self):
        efd = {
            "adhoc_filters": [{"subject": "other", "operator": "==", "comparator": 1}]
        }
        assert _resolve_filter_operator_and_value(efd, "country") == (None, None)

    def test_none_extra_form_data(self):
        assert _resolve_filter_operator_and_value(None, "country") == (None, None)

    def test_ignores_non_dict_entries(self):
        efd = {
            "adhoc_filters": ["not-a-dict", None],
            "filters": [42, "foo"],
        }
        assert _resolve_filter_operator_and_value(efd, "country") == (None, None)


class TestBuildAppliedDashboardFilters:
    """The helper validates access, checks chart-on-dashboard, iterates
    native filters, resolves scope, and maps each to AppliedDashboardFilter."""

    def _make_dashboard(self, json_metadata=None, position_json=None, slice_ids=None):
        dashboard = MagicMock()
        dashboard.json_metadata = json_metadata or "{}"
        dashboard.position_json = position_json or "{}"
        dashboard.slices = [MagicMock(id=sid) for sid in (slice_ids or [])]
        return dashboard

    def test_chart_not_on_dashboard_raises(self):
        dashboard = self._make_dashboard(slice_ids=[2, 3])
        with (
            patch("superset.db") as mock_db,
            patch("superset.security_manager"),
        ):
            mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value = dashboard  # noqa: E501
            with pytest.raises(ChartNotOnDashboardError, match="not on dashboard"):
                build_applied_dashboard_filters(dashboard_id=10, chart_id=1)

    def test_dashboard_not_found_raises(self):
        with (
            patch("superset.db") as mock_db,
            patch("superset.security_manager"),
        ):
            mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value = None  # noqa: E501
            with pytest.raises(DashboardNotFoundError):
                build_applied_dashboard_filters(dashboard_id=10, chart_id=1)

    def test_in_scope_filter_with_static_default(self):
        native_filter = {
            "id": "NATIVE_FILTER-1",
            "name": "Country",
            "type": "NATIVE_FILTER",
            "filterType": "filter_select",
            "chartsInScope": [1],
            "targets": [{"column": {"name": "country"}, "datasetId": 7}],
            "defaultDataMask": {
                "filterState": {"value": ["US"]},
                "extraFormData": {
                    "adhoc_filters": [
                        {
                            "subject": "country",
                            "operator": "IN",
                            "comparator": ["US"],
                        }
                    ]
                },
            },
        }
        dashboard = self._make_dashboard(
            json_metadata='{"native_filter_configuration": %s}'
            % _json(native_filter_list=[native_filter]),
            slice_ids=[1],
        )

        with (
            patch("superset.db") as mock_db,
            patch("superset.security_manager"),
        ):
            mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value = dashboard  # noqa: E501
            result = build_applied_dashboard_filters(dashboard_id=10, chart_id=1)

        assert len(result) == 1
        flt = result[0]
        assert flt.id == "NATIVE_FILTER-1"
        assert flt.name == "Country"
        assert flt.filter_type == "filter_select"
        assert flt.column == "country"
        assert flt.operator == "IN"
        assert flt.value == ["US"]
        assert flt.status == "applied"

    def test_excluded_chart_filter_skipped(self):
        native_filter = {
            "id": "NATIVE_FILTER-1",
            "name": "Region",
            "type": "NATIVE_FILTER",
            "filterType": "filter_select",
            "chartsInScope": [2, 3],  # chart 1 excluded
            "targets": [{"column": {"name": "region"}, "datasetId": 7}],
            "defaultDataMask": {
                "filterState": {"value": ["NA"]},
                "extraFormData": {
                    "filters": [{"col": "region", "op": "==", "val": "NA"}]
                },
            },
        }
        dashboard = self._make_dashboard(
            json_metadata='{"native_filter_configuration": %s}'
            % _json(native_filter_list=[native_filter]),
            slice_ids=[1],
        )

        with (
            patch("superset.db") as mock_db,
            patch("superset.security_manager"),
        ):
            mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value = dashboard  # noqa: E501
            result = build_applied_dashboard_filters(dashboard_id=10, chart_id=1)

        assert result == []

    def test_default_to_first_item_marks_prequery(self):
        native_filter = {
            "id": "NATIVE_FILTER-1",
            "name": "Region",
            "type": "NATIVE_FILTER",
            "filterType": "filter_select",
            "chartsInScope": [1],
            "targets": [{"column": {"name": "region"}, "datasetId": 7}],
            "controlValues": {"defaultToFirstItem": True},
            "defaultDataMask": {},
        }
        dashboard = self._make_dashboard(
            json_metadata='{"native_filter_configuration": %s}'
            % _json(native_filter_list=[native_filter]),
            slice_ids=[1],
        )

        with (
            patch("superset.db") as mock_db,
            patch("superset.security_manager"),
        ):
            mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value = dashboard  # noqa: E501
            result = build_applied_dashboard_filters(dashboard_id=10, chart_id=1)

        assert len(result) == 1
        assert result[0].status == "not_applied_uses_default_to_first_item_prequery"
        assert result[0].operator is None
        assert result[0].value is None

    def test_divider_entry_skipped(self):
        divider = {
            "id": "DIVIDER-1",
            "name": "Section header",
            "type": "DIVIDER",
        }
        dashboard = self._make_dashboard(
            json_metadata='{"native_filter_configuration": %s}'
            % _json(native_filter_list=[divider]),
            slice_ids=[1],
        )

        with (
            patch("superset.db") as mock_db,
            patch("superset.security_manager"),
        ):
            mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value = dashboard  # noqa: E501
            result = build_applied_dashboard_filters(dashboard_id=10, chart_id=1)

        assert result == []

    def test_no_native_filters_returns_empty_list(self):
        dashboard = self._make_dashboard(
            json_metadata="{}",
            slice_ids=[1],
        )

        with (
            patch("superset.db") as mock_db,
            patch("superset.security_manager"),
        ):
            mock_db.session.query.return_value.filter_by.return_value.one_or_none.return_value = dashboard  # noqa: E501
            result = build_applied_dashboard_filters(dashboard_id=10, chart_id=1)

        assert result == []


def _json(native_filter_list):
    """Serialize a native_filter list as JSON string for embedding in
    json_metadata fixtures without escaping issues."""
    from superset.utils import json

    return json.dumps(native_filter_list)
