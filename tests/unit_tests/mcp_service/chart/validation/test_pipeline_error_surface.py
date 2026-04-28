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

"""Regression tests for validation-pipeline error surfacing.

Previously, when ``parse_chart_config`` raised a Pydantic ValueError inside
``ValidationPipeline.validate_request_with_warnings``, the pipeline's generic
``except Exception`` branch routed the sanitized reason through
``ChartErrorBuilder.build_error(template_key='validation_error', ...)``.
That template key did not exist in ``ChartErrorBuilder.TEMPLATES``, so the
builder fell back to the default ``"An error occurred"`` message with empty
details and no suggestions — producing a silent failure for LLM callers.

The most common trigger was a ``mixed_timeseries`` config that used the XY
field names ``kind`` / ``kind_secondary`` instead of the mixed-timeseries
fields ``primary_kind`` / ``secondary_kind``.
"""

from unittest.mock import patch

import pytest

from superset.mcp_service.chart.schemas import GenerateChartRequest
from superset.mcp_service.chart.validation.pipeline import ValidationPipeline
from superset.mcp_service.dashboard.schemas import GenerateDashboardRequest
from superset.mcp_service.utils.error_builder import ChartErrorBuilder


def _passthrough_normalize(request, *_args, **_kwargs):
    return request


def test_validation_error_template_exists() -> None:
    """The ``validation_error`` template must be registered so pipeline
    failures surface an actionable message and suggestions."""
    assert "validation_error" in ChartErrorBuilder.TEMPLATES

    error = ChartErrorBuilder.build_error(
        error_type="validation_system_error",
        template_key="validation_error",
        template_vars={"reason": "Unknown field 'kind'"},
        error_code="VALIDATION_PIPELINE_ERROR",
    )
    dumped = error.model_dump()
    assert dumped["message"] != "An error occurred"
    assert "Unknown field" in dumped["message"]
    assert "Unknown field" in dumped["details"]
    assert dumped["suggestions"], "validation_error template must have suggestions"


def test_mixed_timeseries_with_wrong_kind_fields_returns_actionable_error() -> None:
    """Regression: mixed_timeseries + XY field names (``kind`` / ``kind_secondary``)
    used to return an error with empty details and no suggestions."""
    request_data = {
        "dataset_id": 1,
        "config": {
            "chart_type": "mixed_timeseries",
            "x": {"name": "order_date"},
            "y": [{"name": "revenue", "aggregate": "SUM"}],
            "y_secondary": [{"name": "orders", "aggregate": "COUNT"}],
            "kind": "line",
            "kind_secondary": "bar",
        },
    }

    with (
        patch.object(ValidationPipeline, "_get_dataset_context", return_value=None),
        patch.object(
            ValidationPipeline, "_validate_dataset", return_value=(True, None)
        ),
        patch.object(
            ValidationPipeline, "_validate_runtime", return_value=(True, None)
        ),
        patch.object(
            ValidationPipeline,
            "_normalize_column_names",
            side_effect=_passthrough_normalize,
        ),
    ):
        result = ValidationPipeline.validate_request_with_warnings(request_data)

    assert result.is_valid is False
    assert result.error is not None
    dumped = result.error.model_dump()

    # The bug symptom was a generic empty message — verify both message and
    # details carry the actionable reason now.
    assert dumped["message"] != "An error occurred"
    assert dumped["details"] != ""
    assert "kind" in dumped["details"]
    # Ugly Pydantic tagged-union prefix must be stripped from the surfaced body.
    assert "tagged-union" not in dumped["details"]
    assert "tagged-union" not in dumped["message"]
    # Suggestions should steer callers back to a valid schema.
    assert dumped["suggestions"]
    assert dumped["error_code"] == "VALIDATION_ERROR"
    assert dumped["error_type"] == "validation_error"


def test_adhoc_filters_returns_actionable_error() -> None:
    """Regression: adhoc_filters is not a valid field — generate_chart should
    return a clear validation_error pointing to 'filters' instead of an opaque
    validation_system_error.

    See: https://app.shortcut.com/preset/story/103356
    """
    request_data = {
        "dataset_id": 1,
        "config": {
            "chart_type": "xy",
            "x": {"name": "year"},
            "y": [{"name": "sales", "aggregate": "SUM"}],
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

    with (
        patch.object(ValidationPipeline, "_get_dataset_context", return_value=None),
        patch.object(
            ValidationPipeline, "_validate_dataset", return_value=(True, None)
        ),
        patch.object(
            ValidationPipeline, "_validate_runtime", return_value=(True, None)
        ),
        patch.object(
            ValidationPipeline,
            "_normalize_column_names",
            side_effect=_passthrough_normalize,
        ),
    ):
        result = ValidationPipeline.validate_request_with_warnings(request_data)

    assert result.is_valid is False
    assert result.error is not None
    dumped = result.error.model_dump()

    # Must NOT be the opaque validation_system_error
    assert dumped["error_type"] == "validation_error"
    assert dumped["error_code"] == "VALIDATION_ERROR"
    # Message must mention filters as the correct field name
    assert "filters" in dumped["message"]
    assert dumped["details"] != ""
    assert dumped["suggestions"]


def test_valid_mixed_timeseries_config_passes() -> None:
    """Sanity check: the correct field names still validate successfully."""
    request_data = {
        "dataset_id": 1,
        "config": {
            "chart_type": "mixed_timeseries",
            "x": {"name": "order_date"},
            "y": [{"name": "revenue", "aggregate": "SUM"}],
            "y_secondary": [{"name": "orders", "aggregate": "COUNT"}],
            "primary_kind": "line",
            "secondary_kind": "bar",
        },
    }

    with (
        patch.object(ValidationPipeline, "_get_dataset_context", return_value=None),
        patch.object(
            ValidationPipeline, "_validate_dataset", return_value=(True, None)
        ),
        patch.object(
            ValidationPipeline, "_validate_runtime", return_value=(True, None)
        ),
        patch.object(
            ValidationPipeline,
            "_normalize_column_names",
            side_effect=_passthrough_normalize,
        ),
    ):
        result = ValidationPipeline.validate_request_with_warnings(request_data)

    assert result.is_valid is True
    assert result.error is None


def test_non_value_error_pydantic_body_is_surfaced() -> None:
    """The tagged-union cleanup must also handle non-``Value error`` bodies
    like ``Input should be ...`` (literal_error from Pydantic enums).

    Regression for the case where the sanitizer only matched ``Value error,``
    and left the long tagged-union header attached, causing the 200-char
    truncation to swallow the actionable message.
    """
    # Invalid aggregate value — triggers a Pydantic literal_error whose body
    # starts with ``Input should be 'SUM', 'COUNT', ...``, not ``Value error,``.
    request_data = {
        "dataset_id": 1,
        "config": {
            "chart_type": "pie",
            "dimension": {"name": "product"},
            "metric": {"name": "revenue", "aggregate": "BOGUS"},
        },
    }

    with (
        patch.object(ValidationPipeline, "_get_dataset_context", return_value=None),
        patch.object(
            ValidationPipeline, "_validate_dataset", return_value=(True, None)
        ),
        patch.object(
            ValidationPipeline, "_validate_runtime", return_value=(True, None)
        ),
        patch.object(
            ValidationPipeline,
            "_normalize_column_names",
            side_effect=_passthrough_normalize,
        ),
    ):
        result = ValidationPipeline.validate_request_with_warnings(request_data)

    assert result.is_valid is False
    assert result.error is not None
    dumped = result.error.model_dump()
    assert dumped["error_code"] == "VALIDATION_ERROR"
    assert dumped["error_type"] == "validation_error"
    assert "tagged-union" not in dumped["message"]
    assert "tagged-union" not in dumped["details"]
    # The actionable body must survive the 200-char truncation.
    assert "Input should be" in dumped["details"]


def test_validation_error_template_suggestions_are_chart_type_agnostic() -> None:
    """The ``validation_error`` template fires for every chart type, so its
    suggestions must not mention specific chart-type field names."""
    template = ChartErrorBuilder.TEMPLATES["validation_error"]
    joined = " ".join(template["suggestions"]).lower()
    assert "mixed_timeseries" not in joined
    assert "primary_kind" not in joined
    assert "secondary_kind" not in joined


# --- Alias field tests ---


def test_title_alias_populates_dashboard_title() -> None:
    """Sending ``title`` instead of ``dashboard_title`` should populate the field."""
    req = GenerateDashboardRequest(
        chart_ids=[1],
        title="My Dashboard",
    )
    assert req.dashboard_title == "My Dashboard"


def test_name_alias_populates_chart_name() -> None:
    """Sending ``name`` instead of ``chart_name`` should populate the field."""
    req = GenerateChartRequest(
        dataset_id=1,
        config={
            "chart_type": "xy",
            "x": {"name": "col"},
            "y": [{"name": "val", "aggregate": "SUM"}],
        },
        name="My Chart",
    )
    assert req.chart_name == "My Chart"


def test_xss_via_alias_title_is_rejected() -> None:
    """XSS payload via alias field ``title`` should be rejected by sanitization."""
    with pytest.raises(ValueError, match="sanitization"):
        GenerateDashboardRequest(
            chart_ids=[1],
            title="<script>alert(1)</script>",
        )


def test_chart_name_and_name_simultaneously_first_alias_wins() -> None:
    """When both ``chart_name`` and ``name`` are provided, ``chart_name``
    takes precedence because it appears first in the alias list."""
    req = GenerateChartRequest(
        dataset_id=1,
        config={
            "chart_type": "xy",
            "x": {"name": "col"},
            "y": [{"name": "val", "aggregate": "SUM"}],
        },
        chart_name="Primary Name",
        name="Secondary Name",
    )
    # chart_name is the canonical field and takes precedence via AliasChoices
    assert req.chart_name == "Primary Name"
