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
Regression tests for validation pipeline error surfacing.

Ensures that unknown fields (like adhoc_filters) produce actionable error
messages instead of opaque "An error occurred" responses.

See: sc-103356
"""

import pytest

from superset.mcp_service.chart.validation.pipeline import ValidationPipeline


@pytest.fixture
def xy_chart_request_with_adhoc_filters():
    """Request matching the sc-103356 reproduction case."""
    return {
        "dataset_id": 2,
        "chart_name": "Japan's RPG Dominance Over Time",
        "save_chart": True,
        "config": {
            "chart_type": "xy",
            "kind": "line",
            "x": {"name": "year"},
            "y": [{"aggregate": "SUM", "label": "Japan RPG Sales", "name": "jp_sales"}],
            "adhoc_filters": [
                {
                    "clause": "WHERE",
                    "comparator": "Role-Playing",
                    "expressionType": "SIMPLE",
                    "operator": "==",
                    "subject": "genre",
                }
            ],
        },
    }


def test_adhoc_filters_produces_actionable_error(xy_chart_request_with_adhoc_filters):
    """adhoc_filters must produce error mentioning 'filters'."""
    result = ValidationPipeline.validate_request_with_warnings(
        xy_chart_request_with_adhoc_filters
    )

    assert not result.is_valid
    assert result.error is not None
    # Must NOT be the opaque "An error occurred" message
    assert result.error.message != "An error occurred"
    # Must mention the correct field name so the LLM can self-correct
    assert (
        "filters" in result.error.message.lower()
        or "filters" in (result.error.details or "").lower()
    )
    # Error code should indicate config validation, not a system error
    assert result.error.error_code == "CONFIG_VALIDATION_ERROR"


def test_unknown_field_error_includes_suggestion(xy_chart_request_with_adhoc_filters):
    """Error response must include suggestions to help LLM self-correct."""
    result = ValidationPipeline.validate_request_with_warnings(
        xy_chart_request_with_adhoc_filters
    )

    assert result.error is not None
    assert len(result.error.suggestions) > 0
    # At least one suggestion should mention the correct approach
    suggestion_text = " ".join(result.error.suggestions).lower()
    assert "filters" in suggestion_text
    # The adhoc_filters guidance should appear as a custom suggestion
    assert any("adhoc_filters" in s for s in result.error.suggestions)


def test_arbitrary_unknown_field_produces_helpful_error():
    """Any unknown field should produce a helpful error, not opaque message."""
    request_data = {
        "dataset_id": 1,
        "config": {
            "chart_type": "xy",
            "x": {"name": "date"},
            "y": [{"name": "revenue", "aggregate": "SUM"}],
            "totally_fake_field": "value",
        },
    }

    result = ValidationPipeline.validate_request_with_warnings(request_data)

    assert not result.is_valid
    assert result.error is not None
    assert result.error.message != "An error occurred"
    assert "totally_fake_field" in (result.error.details or "") or "Unknown field" in (
        result.error.message + (result.error.details or "")
    )
