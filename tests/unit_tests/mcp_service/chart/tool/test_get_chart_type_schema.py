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

import pytest

from superset.mcp_service.chart.tool.get_chart_type_schema import (
    _CHART_EXAMPLES,
    _get_chart_type_schema_impl as _call_schema,
    VALID_CHART_TYPES,
)


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

    def test_table_schema_has_columns(self) -> None:
        result = _call_schema("table")
        props = result["schema"]["properties"]
        assert "columns" in props

    def test_pie_schema_has_dimension_metric(self) -> None:
        result = _call_schema("pie")
        props = result["schema"]["properties"]
        assert "dimension" in props
        assert "metric" in props

    def test_big_number_schema_has_metric(self) -> None:
        result = _call_schema("big_number")
        props = result["schema"]["properties"]
        assert "metric" in props

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
        assert len(VALID_CHART_TYPES) == 7
        assert "xy" in VALID_CHART_TYPES
        assert "table" in VALID_CHART_TYPES

    def test_all_chart_types_have_examples(self) -> None:
        for chart_type in VALID_CHART_TYPES:
            assert chart_type in _CHART_EXAMPLES
            assert len(_CHART_EXAMPLES[chart_type]) >= 1
