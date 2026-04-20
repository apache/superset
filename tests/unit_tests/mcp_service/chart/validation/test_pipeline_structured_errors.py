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

"""Structured-error guarantees for the chart validation pipeline.

Regression tests for scenarios where ``generate_chart`` previously returned
a generic ``VALIDATION_PIPELINE_ERROR`` with empty message / details /
suggestions (Eval 21.4/21.7/21.9, Eval 23.6).
"""

from unittest.mock import patch

from superset.mcp_service.chart.validation.pipeline import ValidationPipeline


def test_compare_lag_without_trendline_returns_structured_error() -> None:
    """compare_lag set without show_trendline must surface a specific error.

    Without the fix, parse_chart_config raised a generic ValueError caught by
    the pipeline's except-all, producing an empty VALIDATION_PIPELINE_ERROR.
    """
    result = ValidationPipeline.validate_request_with_warnings(
        {
            "dataset_id": 1,
            "config": {
                "chart_type": "big_number",
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "compare_lag": 1,
            },
        }
    )
    assert result.is_valid is False
    assert result.error is not None
    assert result.error.error_code == "CHART_CONFIG_VALIDATION_ERROR"
    assert result.error.error_type == "chart_config_validation_error"
    assert "compare_lag" in result.error.message
    assert "show_trendline" in result.error.message
    assert result.error.suggestions
    # Suggestions must nudge the caller toward get_chart_type_schema for the
    # specific chart type they were attempting.
    assert any("big_number" in s for s in result.error.suggestions)


def test_unknown_field_returns_structured_error() -> None:
    """Unknown config fields must list valid alternatives, not fail silently."""
    result = ValidationPipeline.validate_request_with_warnings(
        {
            "dataset_id": 1,
            "config": {
                "chart_type": "big_number",
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "bogus_field": "whatever",
            },
        }
    )
    assert result.is_valid is False
    assert result.error is not None
    assert result.error.error_code == "CHART_CONFIG_VALIDATION_ERROR"
    assert "bogus_field" in result.error.message
    assert result.error.suggestions
    assert result.error.validation_errors


def test_outer_fallback_populates_message_and_suggestions() -> None:
    """Unexpected exceptions must still yield a non-empty structured error.

    Even when an unrelated exception bubbles up, the generic fallback must
    include the sanitized reason plus actionable suggestions.
    """
    with patch(
        "superset.mcp_service.chart.validation.schema_validator."
        "SchemaValidator.validate_request",
        side_effect=RuntimeError("boom"),
    ):
        result = ValidationPipeline.validate_request_with_warnings(
            {"dataset_id": 1, "config": {"chart_type": "xy"}}
        )
    assert result.is_valid is False
    assert result.error is not None
    assert result.error.error_code == "VALIDATION_PIPELINE_ERROR"
    assert result.error.message
    assert result.error.message != "An error occurred"
    assert "boom" in result.error.message or "boom" in result.error.details
    assert result.error.suggestions


def test_show_trendline_without_temporal_column_still_structured() -> None:
    """Pre-validate's structured error path must remain intact."""
    result = ValidationPipeline.validate_request_with_warnings(
        {
            "dataset_id": 1,
            "config": {
                "chart_type": "big_number",
                "metric": {"name": "revenue", "aggregate": "SUM"},
                "show_trendline": True,
            },
        }
    )
    assert result.is_valid is False
    assert result.error is not None
    assert result.error.error_code == "MISSING_TEMPORAL_COLUMN"


def test_invalid_chart_type_still_structured() -> None:
    """Pre-validate's invalid_chart_type path must remain intact."""
    result = ValidationPipeline.validate_request_with_warnings(
        {"dataset_id": 1, "config": {"chart_type": "not_a_real_type"}}
    )
    assert result.is_valid is False
    assert result.error is not None
    assert result.error.error_code == "INVALID_CHART_TYPE"
