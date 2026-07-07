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

import pytest
from flask import current_app
from marshmallow import ValidationError

from superset.charts.schemas import (
    ChartDataProphetOptionsSchema,
    ChartDataQueryObjectSchema,
    ChartDataRollingOptionsSchema,
    ChartPostSchema,
    ChartPutSchema,
    DEFAULT_MAX_PROPHET_PERIODS,
    get_max_prophet_periods,
    get_time_grain_choices,
)


def test_get_time_grain_choices(app_context: None) -> None:
    """Test that get_time_grain_choices returns values with config addons"""
    # Save original config
    original_addons = current_app.config.get("TIME_GRAIN_ADDONS", {})

    try:
        # Test with no addons
        current_app.config["TIME_GRAIN_ADDONS"] = {}
        choices = get_time_grain_choices()
        # Should have at least the basic time grains
        assert "P1D" in choices
        assert "P1W" in choices
        assert "P1M" in choices
        assert "P1Y" in choices

        # Test with addons
        current_app.config["TIME_GRAIN_ADDONS"] = {
            "PT5M": "5 minutes",
            "P2W": "2 weeks",
        }
        choices = get_time_grain_choices()
        assert "PT5M" in choices
        assert "P2W" in choices
        assert "P1D" in choices  # Still has built-in choices
    finally:
        # Restore original config
        current_app.config["TIME_GRAIN_ADDONS"] = original_addons


def test_chart_data_prophet_options_schema_time_grain_validation(
    app_context: None,
) -> None:
    """Test that ChartDataProphetOptionsSchema validates time_grain choices"""
    schema = ChartDataProphetOptionsSchema()

    # Valid time grain should pass
    valid_data = {
        "time_grain": "P1D",
        "periods": 7,
        "confidence_interval": 0.8,
    }
    result = schema.load(valid_data)
    assert result["time_grain"] == "P1D"

    # Invalid time grain should fail
    invalid_data = {
        "time_grain": "invalid_grain",
        "periods": 7,
        "confidence_interval": 0.8,
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(invalid_data)
    assert "time_grain" in exc_info.value.messages
    assert "Must be one of" in str(exc_info.value.messages["time_grain"])

    # Empty time grain should fail (required field)
    missing_data = {
        "periods": 7,
        "confidence_interval": 0.8,
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(missing_data)
    assert "time_grain" in exc_info.value.messages


def test_chart_put_schema_query_context_json_validation(
    app_context: None,
) -> None:
    """ChartPutSchema.query_context must reject invalid JSON (parity with POST)."""
    schema = ChartPutSchema()

    # Valid JSON passes
    assert schema.load({"query_context": '{"a": 1}'})["query_context"] == '{"a": 1}'

    # None is allowed (allow_none)
    assert schema.load({"query_context": None})["query_context"] is None

    # Invalid JSON is rejected
    with pytest.raises(ValidationError) as exc_info:
        schema.load({"query_context": "{not valid json"})
    assert "query_context" in exc_info.value.messages


def test_chart_data_prophet_options_schema_periods_range(
    app_context: None,
) -> None:
    """`periods` must be a bounded positive integer."""
    schema = ChartDataProphetOptionsSchema()
    base = {"time_grain": "P1D", "confidence_interval": 0.8}

    # Valid value passes
    assert schema.load({**base, "periods": 7})["periods"] == 7

    # Inclusive boundaries are accepted
    assert schema.load({**base, "periods": 1})["periods"] == 1
    assert schema.load({**base, "periods": 10000})["periods"] == 10000

    # Zero rejected (at least one period must be forecast)
    with pytest.raises(ValidationError) as exc_info:
        schema.load({**base, "periods": 0})
    assert "periods" in exc_info.value.messages

    # Negative value rejected
    with pytest.raises(ValidationError) as exc_info:
        schema.load({**base, "periods": -1})
    assert "periods" in exc_info.value.messages

    # Excessively large value rejected (resource-exhaustion guard)
    with pytest.raises(ValidationError) as exc_info:
        schema.load({**base, "periods": 1_000_000})
    assert "periods" in exc_info.value.messages


def test_chart_data_rolling_options_schema_window_range(
    app_context: None,
) -> None:
    """`window` must be a bounded positive integer."""
    schema = ChartDataRollingOptionsSchema()
    base = {"rolling_type": "mean"}

    # Valid value passes
    assert schema.load({**base, "window": 7})["window"] == 7

    # Inclusive boundaries are accepted
    assert schema.load({**base, "window": 1})["window"] == 1
    assert schema.load({**base, "window": 10000})["window"] == 10000

    # Zero window rejected (rolling requires window > 0)
    with pytest.raises(ValidationError) as exc_info:
        schema.load({**base, "window": 0})
    assert "window" in exc_info.value.messages

    # Excessively large window rejected
    with pytest.raises(ValidationError) as exc_info:
        schema.load({**base, "window": 1_000_000})
    assert "window" in exc_info.value.messages


def test_chart_data_query_object_schema_time_grain_sqla_validation(
    app_context: None,
) -> None:
    """Test that ChartDataQueryObjectSchema validates time_grain_sqla in extras"""
    schema = ChartDataQueryObjectSchema()

    # Valid time grain should pass (time_grain_sqla is in extras)
    valid_data = {
        "datasource": {"type": "table", "id": 1},
        "metrics": ["count"],
        "extras": {
            "time_grain_sqla": "P1W",
        },
    }
    result = schema.load(valid_data)
    assert "extras" in result
    assert result["extras"]["time_grain_sqla"] == "P1W"

    # Invalid time grain should fail
    invalid_data = {
        "datasource": {"type": "table", "id": 1},
        "metrics": ["count"],
        "extras": {
            "time_grain_sqla": "not_a_grain",
        },
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(invalid_data)
    assert "extras" in exc_info.value.messages
    assert "time_grain_sqla" in exc_info.value.messages["extras"]
    assert "Must be one of" in str(exc_info.value.messages["extras"]["time_grain_sqla"])

    # None should be allowed (allow_none=True)
    none_data = {
        "datasource": {"type": "table", "id": 1},
        "metrics": ["count"],
        "extras": {
            "time_grain_sqla": None,
        },
    }
    result = schema.load(none_data)
    assert result["extras"]["time_grain_sqla"] is None


def test_chart_data_query_object_schema_deprecated_fields_renamed(
    app_context: None,
) -> None:
    """Deprecated query object fields are renamed to their canonical names."""
    schema = ChartDataQueryObjectSchema()

    # groupby alone → becomes columns
    result = schema.load({"groupby": ["country_name"]})
    assert result.get("columns") == ["country_name"]
    assert "groupby" not in result

    # groupby overwrites columns when both are provided
    result = schema.load({"groupby": ["region"], "columns": ["country_name"]})
    assert result.get("columns") == ["region"]
    assert "groupby" not in result

    # empty groupby is discarded; existing columns is preserved
    result = schema.load({"groupby": [], "columns": ["country_name"]})
    assert result.get("columns") == ["country_name"]
    assert "groupby" not in result

    # null groupby is discarded; existing columns is preserved (allow_none=True)
    result = schema.load({"groupby": None, "columns": ["country_name"]})
    assert result.get("columns") == ["country_name"]
    assert "groupby" not in result

    # no groupby → columns passes through unchanged
    result = schema.load({"columns": ["country_name"]})
    assert result.get("columns") == ["country_name"]
    assert "groupby" not in result

    # granularity_sqla → granularity
    result = schema.load({"granularity_sqla": "ds"})
    assert result.get("granularity") == "ds"
    assert "granularity_sqla" not in result

    # timeseries_limit → series_limit
    result = schema.load({"timeseries_limit": 5})
    assert result.get("series_limit") == 5
    assert "timeseries_limit" not in result

    # timeseries_limit_metric → series_limit_metric
    result = schema.load({"timeseries_limit_metric": "count"})
    assert result.get("series_limit_metric") == "count"
    assert "timeseries_limit_metric" not in result


@pytest.mark.parametrize(
    "app",
    [{"TIME_GRAIN_ADDONS": {"PT10M": "10 minutes"}}],
    indirect=True,
)
def test_time_grain_validation_with_config_addons(app_context: None) -> None:
    """Test that validation includes TIME_GRAIN_ADDONS from config"""
    schema = ChartDataProphetOptionsSchema()

    # Custom time grain should now be valid
    custom_data = {
        "time_grain": "PT10M",
        "periods": 5,
        "confidence_interval": 0.9,
    }
    result = schema.load(custom_data)
    assert result["time_grain"] == "PT10M"


def test_prophet_periods_within_bound(app_context: None) -> None:
    """Prophet periods within the configured bound are accepted"""
    schema = ChartDataProphetOptionsSchema()
    result = schema.load(
        {
            "time_grain": "P1D",
            "periods": 7,
            "confidence_interval": 0.8,
        }
    )
    assert result["periods"] == 7


def test_prophet_periods_over_max_rejected(app_context: None) -> None:
    """Prophet periods over the configured maximum raise a ValidationError"""
    schema = ChartDataProphetOptionsSchema()
    over_max = current_app.config.get("MAX_PROPHET_PERIODS", 10000) + 1
    with pytest.raises(ValidationError) as exc_info:
        schema.load(
            {
                "time_grain": "P1D",
                "periods": over_max,
                "confidence_interval": 0.8,
            }
        )
    assert "periods" in exc_info.value.messages


def test_prophet_periods_below_min_rejected(app_context: None) -> None:
    """Prophet periods below 1 raise a ValidationError"""
    schema = ChartDataProphetOptionsSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load(
            {
                "time_grain": "P1D",
                "periods": 0,
                "confidence_interval": 0.8,
            }
        )
    assert "periods" in exc_info.value.messages


def test_get_max_prophet_periods_coerces_string(app_context: None) -> None:
    """A string override (e.g. from an env var) is coerced to int, not crashed on"""
    original = current_app.config.get("MAX_PROPHET_PERIODS")
    try:
        current_app.config["MAX_PROPHET_PERIODS"] = "500"
        assert get_max_prophet_periods() == 500
    finally:
        if original is None:
            current_app.config.pop("MAX_PROPHET_PERIODS", None)
        else:
            current_app.config["MAX_PROPHET_PERIODS"] = original


def test_get_max_prophet_periods_invalid_falls_back(app_context: None) -> None:
    """Invalid or non-positive overrides fall back to the default bound"""
    original = current_app.config.get("MAX_PROPHET_PERIODS")
    try:
        for bad in ("not-a-number", -1, 0):
            current_app.config["MAX_PROPHET_PERIODS"] = bad
            assert get_max_prophet_periods() == DEFAULT_MAX_PROPHET_PERIODS
    finally:
        if original is None:
            current_app.config.pop("MAX_PROPHET_PERIODS", None)
        else:
            current_app.config["MAX_PROPHET_PERIODS"] = original


def test_prophet_periods_with_string_config_validates(app_context: None) -> None:
    """Validation works (no TypeError) when the config bound is a string"""
    original = current_app.config.get("MAX_PROPHET_PERIODS")
    try:
        current_app.config["MAX_PROPHET_PERIODS"] = "10"
        schema = ChartDataProphetOptionsSchema()
        result = schema.load(
            {"time_grain": "P1D", "periods": 7, "confidence_interval": 0.8}
        )
        assert result["periods"] == 7
        with pytest.raises(ValidationError):
            schema.load(
                {"time_grain": "P1D", "periods": 11, "confidence_interval": 0.8}
            )
    finally:
        if original is None:
            current_app.config.pop("MAX_PROPHET_PERIODS", None)
        else:
            current_app.config["MAX_PROPHET_PERIODS"] = original


def test_chart_external_url_accepts_https(app_context: None) -> None:
    """A valid https external_url is accepted"""
    schema = ChartPostSchema()
    result = schema.load(
        {
            "slice_name": "test",
            "datasource_id": 1,
            "datasource_type": "table",
            "external_url": "https://example.com/managed",
        }
    )
    assert result["external_url"] == "https://example.com/managed"


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "vbscript:msgbox(1)",
    ],
)
def test_chart_external_url_rejects_non_http(app_context: None, url: str) -> None:
    """external_url rejects non-http(s) schemes"""
    schema = ChartPostSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load(
            {
                "slice_name": "test",
                "datasource_id": 1,
                "datasource_type": "table",
                "external_url": url,
            }
        )
    assert "external_url" in exc_info.value.messages


@pytest.mark.parametrize("url", ["https:foo", "http:bar", "https://", "//evil.com"])
def test_chart_external_url_rejects_non_absolute(app_context: None, url: str) -> None:
    """external_url rejects scheme-only / hostless / scheme-relative values"""
    schema = ChartPostSchema()
    with pytest.raises(ValidationError) as exc_info:
        schema.load(
            {
                "slice_name": "test",
                "datasource_id": 1,
                "datasource_type": "table",
                "external_url": url,
            }
        )
    assert "external_url" in exc_info.value.messages
