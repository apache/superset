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
Unit tests for dashboard schema serialization.

Tests that serialize_dashboard_object correctly handles slug and other fields.
"""

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pydantic import ValidationError

from superset.mcp_service.dashboard.schemas import (
    _extract_cross_filters_enabled,
    _extract_native_filters,
    GenerateDashboardRequest,
    serialize_dashboard_object,
)
from superset.utils.json import dumps as json_dumps


def _mock_dashboard(
    id: int = 1,
    title: str = "Test Dashboard",
    slug: str | None = None,
    owners: list[Any] | None = None,
    slices: list[Any] | None = None,
    tags: list[Any] | None = None,
    roles: list[Any] | None = None,
) -> MagicMock:
    """Create a mock Dashboard ORM object."""
    dashboard = MagicMock()
    dashboard.id = id
    dashboard.dashboard_title = title
    dashboard.slug = slug
    dashboard.published = True
    dashboard.changed_by_name = "admin"
    dashboard.changed_on = None
    dashboard.changed_on_humanized = "2 hours ago"
    dashboard.created_by_name = "admin"
    dashboard.created_on = None
    dashboard.created_on_humanized = "1 day ago"
    dashboard.description = "A test dashboard"
    dashboard.css = None
    dashboard.certified_by = None
    dashboard.certification_details = None
    dashboard.json_metadata = None
    dashboard.position_json = None
    dashboard.is_managed_externally = False
    dashboard.external_url = None
    dashboard.uuid = None
    dashboard.owners = owners or []
    dashboard.slices = slices or []
    dashboard.tags = tags or []
    dashboard.roles = roles or []
    return dashboard


class TestSerializeDashboardObject:
    """Tests for serialize_dashboard_object slug handling."""

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_slug_none_returns_empty_string(self, mock_base_url):
        """Dashboards with slug=None should return slug="" for consistency
        with dashboard_serializer."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=1, slug=None)
        result = serialize_dashboard_object(dashboard)

        assert result.slug == ""

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_slug_empty_string_returns_empty_string(self, mock_base_url):
        """Dashboards with slug="" should return slug=""."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=2, slug="")
        result = serialize_dashboard_object(dashboard)

        assert result.slug == ""

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_slug_with_value_preserved(self, mock_base_url):
        """Dashboards with a real slug should preserve it."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=3, slug="my-dashboard")
        result = serialize_dashboard_object(dashboard)

        assert result.slug == "my-dashboard"

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_url_uses_id_when_no_slug(self, mock_base_url):
        """URL should use dashboard id when slug is None."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=42, slug=None)
        result = serialize_dashboard_object(dashboard)

        assert result.url == "http://localhost:8088/superset/dashboard/42/"

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_url_uses_slug_when_available(self, mock_base_url):
        """URL should use slug when available."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=42, slug="my-dashboard")
        result = serialize_dashboard_object(dashboard)

        assert result.url == "http://localhost:8088/superset/dashboard/my-dashboard/"

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_no_json_metadata_or_position_json_in_response(self, mock_base_url):
        """DashboardInfo should not contain json_metadata or position_json."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=1)
        result = serialize_dashboard_object(dashboard)

        assert not hasattr(result, "json_metadata")
        assert not hasattr(result, "position_json")

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_native_filters_extracted_from_json_metadata(self, mock_base_url):
        """Native filters should be extracted from json_metadata."""
        mock_base_url.return_value = "http://localhost:8088"

        metadata = {
            "native_filter_configuration": [
                {
                    "id": "NATIVE_FILTER-abc123",
                    "name": "Region Filter",
                    "filterType": "filter_select",
                    "targets": [{"column": {"name": "region"}, "datasetId": 10}],
                    "controlValues": {"multiSelect": True},
                    "defaultDataMask": {"filterState": {"value": ["US"]}},
                    "scope": {"rootPath": ["ROOT_ID"]},
                },
                {
                    "id": "NATIVE_FILTER-def456",
                    "name": "Date Range",
                    "filterType": "filter_range",
                    "targets": [{"column": {"name": "order_date"}, "datasetId": 10}],
                },
            ],
            "cross_filters_enabled": True,
            "color_scheme": "supersetColors",
            "shared_label_colors": {"Sales": "#1FA8C9"},
        }
        dashboard = _mock_dashboard(id=1)
        dashboard.json_metadata = json_dumps(metadata)

        result = serialize_dashboard_object(dashboard)

        assert len(result.native_filters) == 2
        assert result.native_filters[0].id == "NATIVE_FILTER-abc123"
        assert result.native_filters[0].name == "Region Filter"
        assert result.native_filters[0].filter_type == "filter_select"
        assert len(result.native_filters[0].targets) == 1
        assert result.native_filters[1].name == "Date Range"
        assert result.cross_filters_enabled is True

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_chart_summaries_are_lightweight(self, mock_base_url):
        """Charts in dashboard response should only have core fields."""
        mock_base_url.return_value = "http://localhost:8088"

        chart = MagicMock()
        chart.id = 5
        chart.slice_name = "Revenue Chart"
        chart.viz_type = "echarts_timeseries_bar"
        chart.datasource_name = "sales"
        chart.description = "Monthly revenue"

        dashboard = _mock_dashboard(id=1, slices=[chart])
        result = serialize_dashboard_object(dashboard)

        assert len(result.charts) == 1
        assert result.charts[0].id == 5
        assert result.charts[0].slice_name == "Revenue Chart"
        assert result.charts[0].viz_type == "echarts_timeseries_bar"
        assert result.charts[0].datasource_name == "sales"
        assert result.charts[0].url == "http://localhost:8088/explore/?slice_id=5"
        # Verify no heavy fields
        assert not hasattr(result.charts[0], "form_data")
        assert not hasattr(result.charts[0], "tags")
        assert not hasattr(result.charts[0], "owners")


class TestExtractNativeFilters:
    """Tests for _extract_native_filters helper."""

    def test_none_input(self):
        assert _extract_native_filters(None) == []

    def test_empty_string(self):
        assert _extract_native_filters("") == []

    def test_invalid_json(self):
        assert _extract_native_filters("not json") == []

    def test_no_filter_config(self):
        assert _extract_native_filters("{}") == []

    def test_non_list_filter_config(self):
        assert _extract_native_filters('{"native_filter_configuration": "bad"}') == []

    def test_valid_filters(self):
        metadata = json_dumps(
            {
                "native_filter_configuration": [
                    {
                        "id": "f1",
                        "name": "Filter 1",
                        "filterType": "filter_select",
                        "targets": [{"column": {"name": "col1"}}],
                    }
                ]
            }
        )
        result = _extract_native_filters(metadata)
        assert len(result) == 1
        assert result[0].id == "f1"
        assert result[0].name == "Filter 1"
        assert result[0].filter_type == "filter_select"

    def test_skips_non_dict_entries(self):
        metadata = json_dumps(
            {"native_filter_configuration": [{"id": "f1", "name": "ok"}, "bad", 123]}
        )
        result = _extract_native_filters(metadata)
        assert len(result) == 1

    def test_non_dict_top_level_json(self):
        """json_metadata that parses to a list/number should return empty."""
        assert _extract_native_filters("[]") == []
        assert _extract_native_filters("123") == []
        assert _extract_native_filters('"just a string"') == []


class TestExtractCrossFiltersEnabled:
    """Tests for _extract_cross_filters_enabled helper."""

    def test_none_input(self):
        assert _extract_cross_filters_enabled(None) is None

    def test_empty_json(self):
        assert _extract_cross_filters_enabled("{}") is None

    def test_true(self):
        assert _extract_cross_filters_enabled('{"cross_filters_enabled": true}') is True

    def test_false(self):
        assert (
            _extract_cross_filters_enabled('{"cross_filters_enabled": false}') is False
        )

    def test_non_bool_value(self):
        assert (
            _extract_cross_filters_enabled('{"cross_filters_enabled": "yes"}') is None
        )

    def test_non_dict_top_level_json(self):
        """json_metadata that parses to a list/number should return None."""
        assert _extract_cross_filters_enabled("[]") is None
        assert _extract_cross_filters_enabled("123") is None
        assert _extract_cross_filters_enabled('"just a string"') is None


class TestOmittedFieldsBuilder:
    """Tests for the shared OmittedFieldsBuilder utility."""

    def test_builder_basic(self):
        from superset.mcp_service.utils.response_utils import OmittedFieldsBuilder

        result = (
            OmittedFieldsBuilder()
            .add_raw_field("big_field", "x" * 2048, "Too large for context.")
            .add_extracted_field("meta_field", "y" * 512, "Useful parts above.")
            .build()
        )
        assert "big_field" in result
        assert "~2 KB" in result["big_field"]
        assert "Too large" in result["big_field"]
        assert "meta_field" in result
        assert "extracted" in result["meta_field"]

    def test_builder_none_values(self):
        from superset.mcp_service.utils.response_utils import OmittedFieldsBuilder

        result = (
            OmittedFieldsBuilder()
            .add_raw_field("empty_field", None, "Was not set.")
            .add_extracted_field("also_empty", None, "Nothing to extract.")
            .build()
        )
        assert "empty" in result["empty_field"]
        assert "empty" in result["also_empty"]

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_omitted_fields_in_serialized_dashboard(self, mock_base_url):
        """omitted_fields should describe what was stripped and include sizes."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=1)
        dashboard.json_metadata = json_dumps(
            {"color_scheme": "preset", "native_filter_configuration": []}
        )
        dashboard.position_json = json_dumps({"ROOT_ID": {"children": ["GRID_ID"]}})

        result = serialize_dashboard_object(dashboard)

        assert "json_metadata" in result.omitted_fields
        assert "position_json" in result.omitted_fields
        assert "extracted" in result.omitted_fields["json_metadata"]
        assert "layout tree" in result.omitted_fields["position_json"].lower()

    @patch("superset.mcp_service.utils.url_utils.get_superset_base_url")
    def test_omitted_fields_with_none_values(self, mock_base_url):
        """omitted_fields should still be present when raw fields are None."""
        mock_base_url.return_value = "http://localhost:8088"

        dashboard = _mock_dashboard(id=1)
        result = serialize_dashboard_object(dashboard)

        assert "json_metadata" in result.omitted_fields
        assert "position_json" in result.omitted_fields


class TestGenerateDashboardRequestTitleSanitization:
    """XSS / sanitization behavior for dashboard_title."""

    def test_plain_title_passes_without_warning(self) -> None:
        req = GenerateDashboardRequest(
            chart_ids=[1], dashboard_title="Analytics Dashboard"
        )
        assert req.dashboard_title == "Analytics Dashboard"
        assert req.sanitization_warnings == []

    def test_title_image_onerror_only_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="removed entirely by sanitization"):
            GenerateDashboardRequest(
                chart_ids=[1],
                dashboard_title='<img src=x onerror="alert(1)">',
            )

    def test_title_script_only_is_rejected(self) -> None:
        with pytest.raises(ValidationError, match="removed entirely by sanitization"):
            GenerateDashboardRequest(
                chart_ids=[1],
                dashboard_title="<script>alert(1)</script>",
            )

    def test_title_partial_strip_emits_warning(self) -> None:
        req = GenerateDashboardRequest(
            chart_ids=[1],
            dashboard_title="Q1 <b>Review</b>",
        )
        assert req.dashboard_title == "Q1 Review"
        assert len(req.sanitization_warnings) == 1
        assert "dashboard_title" in req.sanitization_warnings[0]

    def test_title_omitted_does_not_warn(self) -> None:
        req = GenerateDashboardRequest(chart_ids=[1])
        assert req.dashboard_title is None
        assert req.sanitization_warnings == []
