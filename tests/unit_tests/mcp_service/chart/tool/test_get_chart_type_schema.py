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

"""Tests for get_chart_type_schema tool logic."""

from typing import Any

import pytest

from superset.extensions import feature_flag_manager
from superset.mcp_service.chart.tool.get_chart_type_schema import (
    _CHART_EXAMPLES,
    _CHART_TYPE_ADAPTERS,
    _compiled_chart_schema,
    _get_chart_type_schema_impl as _call_schema,
    VALID_CHART_TYPES,
)


@pytest.fixture(autouse=True)
def enable_all_feature_flags(monkeypatch: pytest.MonkeyPatch) -> None:
    """Exercise every registered adapter, including host-gated chart types."""
    monkeypatch.setattr(feature_flag_manager, "is_feature_enabled", lambda _: True)


class TestGetChartTypeSchema:
    @pytest.mark.parametrize("chart_type", VALID_CHART_TYPES)
    def test_valid_chart_type_returns_schema(self, chart_type: str) -> None:
        result = _call_schema(chart_type)
        assert "schema" in result
        assert result["chart_type"] == chart_type
        assert isinstance(result["schema"], dict)
        assert "properties" in result["schema"]
        assert "examples" in result

    def test_xy_schema_has_expected_fields(self) -> None:
        result = _call_schema("xy")
        props = result["schema"]["properties"]
        assert "x" in props
        assert "y" in props
        assert "kind" in props

    def test_table_schema_has_columns_and_column_config(self) -> None:
        result = _call_schema("table")
        props = result["schema"]["properties"]
        assert "columns" in props
        assert "column_config" in props
        description = props["column_config"]["description"]
        assert "columnWidth" in description
        assert "d3NumberFormat" in description
        assert "d3TimeFormat" in description
        column_config_schema = result["schema"]["$defs"]["TableColumnConfig"]
        assert column_config_schema["additionalProperties"] is False

    def test_pie_schema_has_dimension_metric(self) -> None:
        result = _call_schema("pie")
        props = result["schema"]["properties"]
        assert "dimension" in props
        assert "metric" in props

    def test_big_number_schema_has_metric(self) -> None:
        result = _call_schema("big_number")
        props = result["schema"]["properties"]
        assert "metric" in props

    def test_gauge_uses_public_identity_and_full_control_schema(self) -> None:
        result = _call_schema("gauge")
        assert result["chart_type"] == "gauge"
        props = result["schema"]["properties"]
        assert {
            "metric",
            "groupby",
            "sort_by_metric",
            "min_val",
            "max_val",
            "color_scheme",
            "number_format",
            "currency_format",
            "value_formatter",
            "start_angle",
            "end_angle",
            "show_pointer",
            "show_progress",
            "intervals",
            "interval_color_indices",
            "time_range",
            "granularity_sqla",
        } <= set(props)
        assert all(example["chart_type"] == "gauge" for example in result["examples"])

    def test_native_gauge_alias_returns_public_schema_identity(self) -> None:
        result = _call_schema("gauge_chart")
        assert result["chart_type"] == "gauge"

    def test_include_examples_false_omits_examples(self) -> None:
        result = _call_schema("xy", include_examples=False)
        assert "schema" in result
        assert "examples" not in result

    def test_invalid_chart_type_returns_error(self) -> None:
        result = _call_schema("nonexistent")
        assert "error" in result
        assert "valid_chart_types" in result
        assert result["valid_chart_types"] == VALID_CHART_TYPES

    def test_invalid_chart_type_returns_structured_error(self) -> None:
        """Invalid chart_type must return a populated, structured error body.

        Without this guarantee, MCP clients see an empty/unstructured payload
        and cannot self-correct (Eval 26 Test 26.5).
        """
        result = _call_schema("nonexistent")
        err = result["error"]
        assert isinstance(err, dict)
        assert err["error_type"] == "invalid_chart_type"
        assert err["error_code"] == "INVALID_CHART_TYPE"
        assert "nonexistent" in err["message"]
        assert err["details"]
        assert err["suggestions"]
        # Suggestions must name at least one valid chart type so callers know
        # what to try next.
        assert any(vt in " ".join(err["suggestions"]) for vt in VALID_CHART_TYPES)

    def test_examples_match_chart_type(self) -> None:
        result = _call_schema("pie")
        for example in result["examples"]:
            assert example["chart_type"] == "pie"

    def test_valid_chart_types_constant(self) -> None:
        # Parity with the adapter registry rather than a brittle magic number,
        # so adding a chart type doesn't fail this test spuriously.
        assert set(VALID_CHART_TYPES) == set(_CHART_TYPE_ADAPTERS)
        # A few load-bearing members that must always be present.
        assert {"xy", "table", "pie", "waterfall"} <= set(VALID_CHART_TYPES)

    def test_all_chart_types_have_examples(self) -> None:
        for chart_type in VALID_CHART_TYPES:
            assert chart_type in _CHART_EXAMPLES
            assert len(_CHART_EXAMPLES[chart_type]) >= 1


def test_schema_cache_compiles_once_and_isolates_response_mutation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Repeated discovery avoids compilation without sharing mutable response data."""
    _compiled_chart_schema.cache_clear()
    adapter = _CHART_TYPE_ADAPTERS["treemap_v2"]
    original = adapter.json_schema
    calls = 0

    def counted_schema() -> dict[str, Any]:
        nonlocal calls
        calls += 1
        return original()

    monkeypatch.setattr(adapter, "json_schema", counted_schema)
    first = _call_schema("treemap_v2")
    first["schema"]["properties"].clear()
    second = _call_schema("treemap_v2")
    assert "groupby" in second["schema"]["properties"]
    assert calls == 1
    _compiled_chart_schema.cache_clear()
