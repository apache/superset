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
Unit tests for MCP service query utilities.
"""

from superset.mcp_service.utils.query_utils import validate_names


class TestValidateNames:
    """Test validate_names function."""

    def test_all_names_valid_returns_no_errors(self) -> None:
        """Should return an empty list when every name is valid."""
        errors = validate_names(
            ["region", "product"], {"region", "product"}, "dimension"
        )
        assert errors == []

    def test_empty_requested_returns_no_errors(self) -> None:
        """Should return an empty list when nothing was requested."""
        errors = validate_names([], {"region"}, "dimension")
        assert errors == []

    def test_unknown_name_without_close_match(self) -> None:
        """Should report an unknown name with no suggestion when nothing is close."""
        errors = validate_names(["zzz_unknown"], {"region", "product"}, "dimension")
        assert len(errors) == 1
        assert errors[0] == "Unknown dimension: 'zzz_unknown'"

    def test_unknown_name_with_close_match_suggests_alternatives(self) -> None:
        """Should suggest close matches when available."""
        errors = validate_names(["regoin"], {"region", "product"}, "dimension")
        assert len(errors) == 1
        assert errors[0].startswith("Unknown dimension: 'regoin'")
        assert "Did you mean: region" in errors[0]

    def test_multiple_unknown_names_produce_multiple_errors(self) -> None:
        """Should produce one error per unknown name."""
        errors = validate_names(
            ["revenue", "bogus_metric", "zzz_unknown"], {"revenue"}, "metric"
        )
        assert len(errors) == 2
        assert any("bogus_metric" in e for e in errors)
        assert any("zzz_unknown" in e for e in errors)

    def test_error_message_uses_provided_kind(self) -> None:
        """Should label errors with the caller-provided 'kind' string."""
        errors = validate_names(["missing"], set(), "filter column")
        assert errors == ["Unknown filter column: 'missing'"]

    def test_list_valid_on_miss_lists_valid_names(self) -> None:
        """Should list valid names when no close match exists."""
        errors = validate_names(
            ["zzz_unknown"], {"count", "revenue"}, "metric", list_valid_on_miss=True
        )
        assert errors == [
            "Unknown metric: 'zzz_unknown'. Valid metrics: count, revenue"
        ]

    def test_list_valid_on_miss_truncates_with_default_hint(self) -> None:
        """Should truncate long valid lists and point at get_dataset_info."""
        valid = {f"metric_{i:02d}" for i in range(12)}
        errors = validate_names(
            ["zzz_unknown"], valid, "metric", list_valid_on_miss=True
        )
        assert len(errors) == 1
        assert "and 2 more; call get_dataset_info for the full list" in errors[0]

    def test_list_valid_on_miss_uses_custom_full_list_hint(self) -> None:
        """Should use the caller-provided full_list_hint when truncating."""
        valid = {f"metric_{i:02d}" for i in range(12)}
        errors = validate_names(
            ["zzz_unknown"],
            valid,
            "metric",
            list_valid_on_miss=True,
            full_list_hint="call list_metrics for the full list",
        )
        assert len(errors) == 1
        assert "and 2 more; call list_metrics for the full list" in errors[0]
