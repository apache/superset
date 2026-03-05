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

"""Tests for viz_type display name mapping."""

from unittest.mock import patch

import pytest

from superset.mcp_service.chart.viz_type_names import (
    _FRONTEND_ONLY_NAMES,
    get_viz_type_display_name,
    VIZ_TYPE_DISPLAY_NAMES,
)


@pytest.fixture(autouse=True)
def _reset_cache():
    """Reset the lazy display-names cache between tests."""
    import superset.mcp_service.chart.viz_type_names as mod

    mod._display_names_cache = None
    yield
    mod._display_names_cache = None


@pytest.mark.parametrize(
    ("viz_type", "expected"),
    [
        # Frontend-only modern plugins
        ("echarts_timeseries_line", "Line Chart"),
        ("echarts_timeseries_bar", "Bar Chart"),
        ("pie", "Pie Chart"),
        ("pivot_table_v2", "Pivot Table"),
        ("big_number_total", "Big Number"),
        ("table", "Table"),
        ("word_cloud", "Word Cloud"),
        ("funnel", "Funnel Chart"),
        ("sankey_v2", "Sankey Chart"),
    ],
)
def test_frontend_only_viz_types_have_display_names(
    viz_type: str, expected: str
) -> None:
    assert get_viz_type_display_name(viz_type) == expected


def test_legacy_viz_names_loaded_from_viz_py() -> None:
    """Legacy chart names are read from BaseViz.verbose_name in viz.py."""

    class FakeLegacyViz:
        viz_type = "fake_legacy"
        verbose_name = "Fake Legacy Chart"

        @classmethod
        def __subclasses__(cls):
            return set()

    class FakeBaseViz:
        viz_type = None
        verbose_name = "Base Viz"

        @classmethod
        def __subclasses__(cls):
            return {FakeLegacyViz}

    with patch(
        "superset.mcp_service.chart.viz_type_names.BaseViz",
        FakeBaseViz,
        create=True,
    ):
        # Patch the import inside _get_legacy_viz_names
        import superset.mcp_service.chart.viz_type_names as mod

        with patch.object(mod, "_get_legacy_viz_names") as mock_legacy:
            mock_legacy.return_value = {"fake_legacy": "Fake Legacy Chart"}
            mod._display_names_cache = None

            result = get_viz_type_display_name("fake_legacy")
            assert result == "Fake Legacy Chart"


def test_frontend_override_takes_precedence_over_legacy() -> None:
    """Frontend-only overrides win when viz_type exists in both sources."""
    import superset.mcp_service.chart.viz_type_names as mod

    with patch.object(mod, "_get_legacy_viz_names") as mock_legacy:
        # Simulate viz.py having a different name for "table"
        mock_legacy.return_value = {"table": "Table Viz (legacy)"}
        mod._display_names_cache = None

        # Frontend override should win: "Table" not "Table Viz (legacy)"
        assert get_viz_type_display_name("table") == "Table"


def test_unknown_viz_type_falls_back_to_title_case() -> None:
    assert get_viz_type_display_name("my_custom_plugin") == "My Custom Plugin"


def test_unknown_viz_type_with_hyphens() -> None:
    assert get_viz_type_display_name("my-custom-chart") == "My Custom Chart"


def test_none_returns_none() -> None:
    assert get_viz_type_display_name(None) is None


def test_empty_string_returns_none() -> None:
    assert get_viz_type_display_name("") is None


def test_all_frontend_only_names_are_non_empty() -> None:
    for viz_type, display_name in _FRONTEND_ONLY_NAMES.items():
        assert display_name, f"Empty display name for {viz_type}"


def test_viz_type_display_names_alias() -> None:
    """VIZ_TYPE_DISPLAY_NAMES is an alias for _FRONTEND_ONLY_NAMES."""
    assert VIZ_TYPE_DISPLAY_NAMES is _FRONTEND_ONLY_NAMES


def test_legacy_import_failure_gracefully_handled() -> None:
    """If viz.py cannot be imported, only frontend-only names are used."""
    import superset.mcp_service.chart.viz_type_names as mod

    # Simulate _get_legacy_viz_names returning empty dict (its own error
    # handling catches ImportError/RuntimeError and returns {}).
    with patch.object(mod, "_get_legacy_viz_names", return_value={}):
        mod._display_names_cache = None
        # Should still work for frontend-only types
        assert get_viz_type_display_name("pie") == "Pie Chart"
        # Unknown types fall back to title-case
        assert get_viz_type_display_name("fake_legacy") == "Fake Legacy"


def test_serialize_chart_object_populates_display_name() -> None:
    """serialize_chart_object should populate chart_type_display_name."""
    from unittest.mock import MagicMock

    from superset.mcp_service.chart.schemas import serialize_chart_object

    chart = MagicMock()
    chart.id = 1
    chart.slice_name = "Test Chart"
    chart.viz_type = "echarts_timeseries_line"
    chart.datasource_name = "test_table"
    chart.datasource_type = "table"
    chart.url = "/explore/?slice_id=1"
    chart.description = None
    chart.cache_timeout = None
    chart.changed_by = None
    chart.changed_by_name = None
    chart.changed_on = None
    chart.changed_on_humanized = None
    chart.created_by = None
    chart.created_by_name = None
    chart.created_on = None
    chart.created_on_humanized = None
    chart.uuid = None
    chart.tags = []
    chart.owners = []

    result = serialize_chart_object(chart)

    assert result is not None
    assert result.viz_type == "echarts_timeseries_line"
    assert result.chart_type_display_name == "Line Chart"


def test_serialize_chart_object_none_viz_type() -> None:
    """chart_type_display_name is None when viz_type is None."""
    from unittest.mock import MagicMock

    from superset.mcp_service.chart.schemas import serialize_chart_object

    chart = MagicMock()
    chart.id = 2
    chart.slice_name = "Unknown Type"
    chart.viz_type = None
    chart.datasource_name = None
    chart.datasource_type = None
    chart.url = None
    chart.description = None
    chart.cache_timeout = None
    chart.changed_by = None
    chart.changed_by_name = None
    chart.changed_on = None
    chart.changed_on_humanized = None
    chart.created_by = None
    chart.created_by_name = None
    chart.created_on = None
    chart.created_on_humanized = None
    chart.uuid = None
    chart.tags = []
    chart.owners = []

    result = serialize_chart_object(chart)

    assert result is not None
    assert result.viz_type is None
    assert result.chart_type_display_name is None
