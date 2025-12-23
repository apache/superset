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
    ChartPostSchema,
    ChartPutSchema,
    get_time_grain_choices,
)
from superset.utils import json


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


def test_chart_post_schema_query_context_validation(app_context: None) -> None:
    """Test that ChartPostSchema validates query_context contains required metadata"""
    schema = ChartPostSchema()

    # Valid query_context with datasource and queries should pass
    valid_query_context = json.dumps(
        {
            "datasource": {"type": "table", "id": 1},
            "queries": [{"metrics": ["count"], "columns": []}],
        }
    )
    valid_data = {
        "slice_name": "Test Chart",
        "datasource_id": 1,
        "datasource_type": "table",
        "query_context": valid_query_context,
    }
    result = schema.load(valid_data)
    assert json.loads(result["query_context"]) == json.loads(valid_query_context)

    # None query_context should be allowed (allow_none=True)
    none_data = {
        "slice_name": "Test Chart",
        "datasource_id": 1,
        "datasource_type": "table",
        "query_context": None,
    }
    result = schema.load(none_data)
    assert result["query_context"] is None

    # Query context missing 'datasource' field should fail
    missing_datasource = json.dumps(
        {"queries": [{"metrics": ["count"], "columns": []}]}
    )
    invalid_data_1 = {
        "slice_name": "Test Chart",
        "datasource_id": 1,
        "datasource_type": "table",
        "query_context": missing_datasource,
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(invalid_data_1)
    assert "query_context" in exc_info.value.messages
    assert "datasource" in str(exc_info.value.messages["query_context"])

    # Query context missing 'queries' field should fail
    missing_queries = json.dumps({"datasource": {"type": "table", "id": 1}})
    invalid_data_2 = {
        "slice_name": "Test Chart",
        "datasource_id": 1,
        "datasource_type": "table",
        "query_context": missing_queries,
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(invalid_data_2)
    assert "query_context" in exc_info.value.messages
    assert "queries" in str(exc_info.value.messages["query_context"])

    # Query context missing both 'datasource' and 'queries' should fail
    empty_query_context = json.dumps({})
    invalid_data_3 = {
        "slice_name": "Test Chart",
        "datasource_id": 1,
        "datasource_type": "table",
        "query_context": empty_query_context,
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(invalid_data_3)
    assert "query_context" in exc_info.value.messages
    assert "datasource" in str(exc_info.value.messages["query_context"])
    assert "queries" in str(exc_info.value.messages["query_context"])

    # Invalid JSON should fail
    invalid_json = "not valid json"
    invalid_data_4 = {
        "slice_name": "Test Chart",
        "datasource_id": 1,
        "datasource_type": "table",
        "query_context": invalid_json,
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(invalid_data_4)
    assert "query_context" in exc_info.value.messages


def test_chart_put_schema_query_context_validation(app_context: None) -> None:
    """Test that ChartPutSchema validates query_context contains required metadata"""
    schema = ChartPutSchema()

    # Valid query_context with datasource and queries should pass
    valid_query_context = json.dumps(
        {
            "datasource": {"type": "table", "id": 1},
            "queries": [{"metrics": ["count"], "columns": []}],
        }
    )
    valid_data = {
        "slice_name": "Updated Chart",
        "query_context": valid_query_context,
    }
    result = schema.load(valid_data)
    assert json.loads(result["query_context"]) == json.loads(valid_query_context)

    # None query_context should be allowed (allow_none=True)
    none_data = {
        "slice_name": "Updated Chart",
        "query_context": None,
    }
    result = schema.load(none_data)
    assert result["query_context"] is None

    # Query context missing required fields should fail
    missing_datasource = json.dumps(
        {"queries": [{"metrics": ["count"], "columns": []}]}
    )
    invalid_data = {
        "slice_name": "Updated Chart",
        "query_context": missing_datasource,
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(invalid_data)
    assert "query_context" in exc_info.value.messages
    assert "datasource" in str(exc_info.value.messages["query_context"])

    # Query context missing 'queries' field should fail
    missing_queries = json.dumps({"datasource": {"type": "table", "id": 1}})
    invalid_data_2 = {
        "slice_name": "Updated Chart",
        "query_context": missing_queries,
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(invalid_data_2)
    assert "query_context" in exc_info.value.messages
    assert "queries" in str(exc_info.value.messages["query_context"])

    # Query context missing both 'datasource' and 'queries' should fail
    empty_query_context = json.dumps({})
    invalid_data_3 = {
        "slice_name": "Updated Chart",
        "query_context": empty_query_context,
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(invalid_data_3)
    assert "query_context" in exc_info.value.messages
    assert "datasource" in str(exc_info.value.messages["query_context"])
    assert "queries" in str(exc_info.value.messages["query_context"])

    # Invalid JSON should fail
    invalid_json = "not valid json"
    invalid_data_4 = {
        "slice_name": "Updated Chart",
        "query_context": invalid_json,
    }
    with pytest.raises(ValidationError) as exc_info:
        schema.load(invalid_data_4)
    assert "query_context" in exc_info.value.messages
