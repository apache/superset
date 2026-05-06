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
Unified schema validation for chart configurations.
Consolidates pre-validation, schema validation, and error enhancement.
"""

import logging
from typing import Any, Dict, Tuple

from pydantic import ValidationError as PydanticValidationError

from superset.mcp_service.chart.schemas import (
    GenerateChartRequest,
)
from superset.mcp_service.common.error_schemas import ChartGenerationError

logger = logging.getLogger(__name__)


class SchemaValidator:
    """Unified schema validator with pre-validation and enhanced error messages."""

    @staticmethod
    def validate_request(
        request_data: Dict[str, Any],
    ) -> Tuple[bool, GenerateChartRequest | None, ChartGenerationError | None]:
        """
        Validate request data with pre-validation and enhanced error handling.

        Returns:
            Tuple of (is_valid, parsed_request, error)
        """
        # Pre-validate to catch common issues early
        is_valid, error = SchemaValidator._pre_validate(request_data)
        if not is_valid:
            return False, None, error

        # Try Pydantic validation
        try:
            request = GenerateChartRequest(**request_data)
            return True, request, None
        except PydanticValidationError as e:
            # Enhance the error message
            error = SchemaValidator._enhance_validation_error(e, request_data)
            return False, None, error

    @staticmethod
    def _pre_validate(
        data: Dict[str, Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Pre-validate request data before Pydantic processing."""
        if not isinstance(data, dict):
            return False, ChartGenerationError(
                error_type="invalid_request_format",
                message="Request must be a JSON object",
                details="The request body must be a valid JSON object, not a string "
                "or array",
                suggestions=[
                    "Ensure you're sending a JSON object with 'dataset_id' and "
                    "'config' fields",
                    "Check that Content-Type header is set to 'application/json'",
                ],
                error_code="INVALID_REQUEST_FORMAT",
            )

        # Check for required top-level fields
        if "dataset_id" not in data:
            return False, ChartGenerationError(
                error_type="missing_dataset_id",
                message="Missing required field: dataset_id",
                details="The 'dataset_id' field is required to identify which dataset "
                "to use",
                suggestions=[
                    "Add 'dataset_id' field with the ID of your dataset",
                    "Use list_datasets tool to find available dataset IDs",
                    "Example: {'dataset_id': 1, 'config': {...}}",
                ],
                error_code="MISSING_DATASET_ID",
            )

        if "config" not in data:
            return False, ChartGenerationError(
                error_type="missing_config",
                message="Missing required field: config",
                details="The 'config' field is required to specify chart configuration",
                suggestions=[
                    "Add 'config' field with chart type and settings",
                    "Example: {'dataset_id': 1, 'config': {'chart_type': 'xy', ...}}",
                ],
                error_code="MISSING_CONFIG",
            )

        config = data.get("config", {})
        if not isinstance(config, dict):
            return False, ChartGenerationError(
                error_type="invalid_config_format",
                message="Config must be a JSON object",
                details="The 'config' field must be a valid JSON object with chart "
                "settings",
                suggestions=[
                    "Ensure config is an object, not a string or array",
                    "Example: 'config': {'chart_type': 'xy', 'x': {...}, 'y': [...]}",
                ],
                error_code="INVALID_CONFIG_FORMAT",
            )

        # Check chart_type early
        chart_type = config.get("chart_type")
        if not chart_type:
            return False, ChartGenerationError(
                error_type="missing_chart_type",
                message="Missing required field: chart_type",
                details="Chart configuration must specify 'chart_type'",
                suggestions=[
                    "Add 'chart_type': 'xy' for line/bar/area/scatter charts",
                    "Add 'chart_type': 'table' for table visualizations",
                    "Add 'chart_type': 'pie' for pie or donut charts",
                    "Add 'chart_type': 'pivot_table' for interactive pivot tables",
                    "Add 'chart_type': 'mixed_timeseries' for dual-series time charts",
                    "Add 'chart_type': 'handlebars' for custom HTML template charts",
                    "Add 'chart_type': 'big_number' for big number display",
                    "Example: 'config': {'chart_type': 'xy', ...}",
                ],
                error_code="MISSING_CHART_TYPE",
            )

        return SchemaValidator._pre_validate_chart_type(chart_type, config)

    @staticmethod
    def _pre_validate_chart_type(
        chart_type: str,
        config: Dict[str, Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Validate chart type and dispatch to plugin pre-validation."""
        from superset.mcp_service.chart.registry import get_registry

        registry = get_registry()

        if not isinstance(chart_type, str) or not registry.is_registered(chart_type):
            valid_types = ", ".join(registry.all_types())
            return False, ChartGenerationError(
                error_type="invalid_chart_type",
                message=f"Invalid chart_type: '{chart_type}'",
                details=f"Chart type '{chart_type}' is not supported. "
                f"Must be one of: {valid_types}",
                suggestions=[
                    "Use 'chart_type': 'xy' for line, bar, area, or scatter charts",
                    "Use 'chart_type': 'table' for tabular data display",
                    "Use 'chart_type': 'pie' for pie or donut charts",
                    "Use 'chart_type': 'pivot_table' for interactive pivot tables",
                    "Use 'chart_type': 'mixed_timeseries' for dual-series time charts",
                    "Use 'chart_type': 'handlebars' for custom HTML template charts",
                    "Use 'chart_type': 'big_number' for big number display",
                    "Check spelling and ensure lowercase",
                ],
                error_code="INVALID_CHART_TYPE",
            )

        plugin = registry.get(chart_type)
        if plugin is None:
            return False, ChartGenerationError(
                error_type="invalid_chart_type",
                message=f"Chart type '{chart_type}' has no registered plugin",
                details="Internal error: chart type is listed but has no plugin",
                suggestions=["Use a supported chart_type"],
                error_code="INVALID_CHART_TYPE",
            )

        if (error := plugin.pre_validate(config)) is not None:
            return False, error
        return True, None

    @staticmethod
    def _pre_validate_xy_config(
        config: Dict[str, Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Pre-validate XY chart configuration."""
        # x is optional — defaults to dataset's main_dttm_col in map_xy_config
        if "y" not in config:
            return False, ChartGenerationError(
                error_type="missing_xy_fields",
                message="XY chart missing required field: 'y' (Y-axis metrics)",
                details="XY charts require Y-axis (metrics) specifications. "
                "X-axis is optional and defaults to the dataset's primary "
                "datetime column when omitted.",
                suggestions=[
                    "Add 'y' field: [{'name': 'metric_column', 'aggregate': 'SUM'}] "
                    "for Y-axis",
                    "Example: {'chart_type': 'xy', 'x': {'name': 'date'}, "
                    "'y': [{'name': 'sales', 'aggregate': 'SUM'}]}",
                ],
                error_code="MISSING_XY_FIELDS",
            )

        # Validate Y is a list
        if not isinstance(config.get("y", []), list):
            return False, ChartGenerationError(
                error_type="invalid_y_format",
                message="Y-axis must be a list of metrics",
                details="The 'y' field must be an array of metric specifications",
                suggestions=[
                    "Wrap Y-axis metric in array: 'y': [{'name': 'column', "
                    "'aggregate': 'SUM'}]",
                    "Multiple metrics supported: 'y': [metric1, metric2, ...]",
                ],
                error_code="INVALID_Y_FORMAT",
            )

        return True, None

    @staticmethod
    def _pre_validate_table_config(
        config: Dict[str, Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Pre-validate table chart configuration."""
        if "columns" not in config:
            return False, ChartGenerationError(
                error_type="missing_columns",
                message="Table chart missing required field: columns",
                details="Table charts require a 'columns' array to specify which "
                "columns to display",
                suggestions=[
                    "Add 'columns' field with array of column specifications",
                    "Example: 'columns': [{'name': 'product'}, {'name': 'sales', "
                    "'aggregate': 'SUM'}]",
                    "Each column can have optional 'aggregate' for metrics",
                ],
                error_code="MISSING_COLUMNS",
            )

        if not isinstance(config.get("columns", []), list):
            return False, ChartGenerationError(
                error_type="invalid_columns_format",
                message="Columns must be a list",
                details="The 'columns' field must be an array of column specifications",
                suggestions=[
                    "Ensure columns is an array: 'columns': [...]",
                    "Each column should be an object with 'name' field",
                ],
                error_code="INVALID_COLUMNS_FORMAT",
            )

        return True, None

    @staticmethod
    def _pre_validate_pie_config(
        config: Dict[str, Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Pre-validate pie chart configuration."""
        missing_fields = []

        if "dimension" not in config:
            missing_fields.append("'dimension' (category column for slices)")
        if "metric" not in config:
            missing_fields.append("'metric' (value metric for slice sizes)")

        if missing_fields:
            return False, ChartGenerationError(
                error_type="missing_pie_fields",
                message=f"Pie chart missing required "
                f"fields: {', '.join(missing_fields)}",
                details="Pie charts require a dimension (categories) and a metric "
                "(values)",
                suggestions=[
                    "Add 'dimension' field: {'name': 'category_column'}",
                    "Add 'metric' field: {'name': 'value_column', 'aggregate': 'SUM'}",
                    "Example: {'chart_type': 'pie', 'dimension': {'name': "
                    "'product'}, 'metric': {'name': 'revenue', 'aggregate': 'SUM'}}",
                ],
                error_code="MISSING_PIE_FIELDS",
            )

        return True, None

    @staticmethod
    def _pre_validate_handlebars_config(
        config: Dict[str, Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Pre-validate handlebars chart configuration."""
        if "handlebars_template" not in config:
            return False, ChartGenerationError(
                error_type="missing_handlebars_template",
                message="Handlebars chart missing required field: handlebars_template",
                details="Handlebars charts require a 'handlebars_template' string "
                "containing Handlebars HTML template markup",
                suggestions=[
                    "Add 'handlebars_template' with a Handlebars HTML template",
                    "Data is available as {{data}} array in the template",
                    "Example: '<ul>{{#each data}}<li>{{this.name}}: "
                    "{{this.value}}</li>{{/each}}</ul>'",
                ],
                error_code="MISSING_HANDLEBARS_TEMPLATE",
            )

        template = config.get("handlebars_template")
        if not isinstance(template, str) or not template.strip():
            return False, ChartGenerationError(
                error_type="invalid_handlebars_template",
                message="Handlebars template must be a non-empty string",
                details="The 'handlebars_template' field must be a non-empty string "
                "containing valid Handlebars HTML template markup",
                suggestions=[
                    "Ensure handlebars_template is a non-empty string",
                    "Example: '<ul>{{#each data}}<li>{{this.name}}</li>{{/each}}</ul>'",
                ],
                error_code="INVALID_HANDLEBARS_TEMPLATE",
            )

        query_mode = config.get("query_mode", "aggregate")
        if query_mode not in ("aggregate", "raw"):
            return False, ChartGenerationError(
                error_type="invalid_query_mode",
                message="Invalid query_mode for handlebars chart",
                details="query_mode must be either 'aggregate' or 'raw'",
                suggestions=[
                    "Use 'aggregate' for aggregated data (default)",
                    "Use 'raw' for individual rows",
                ],
                error_code="INVALID_QUERY_MODE",
            )

        if query_mode == "raw" and not config.get("columns"):
            return False, ChartGenerationError(
                error_type="missing_raw_columns",
                message="Handlebars chart in 'raw' mode requires 'columns'",
                details="When query_mode is 'raw', you must specify which columns "
                "to include in the query results",
                suggestions=[
                    "Add 'columns': [{'name': 'column_name'}] for raw mode",
                    "Or use query_mode='aggregate' with 'metrics' "
                    "and optional 'groupby'",
                ],
                error_code="MISSING_RAW_COLUMNS",
            )

        if query_mode == "aggregate" and not config.get("metrics"):
            return False, ChartGenerationError(
                error_type="missing_aggregate_metrics",
                message="Handlebars chart in 'aggregate' mode requires 'metrics'",
                details="When query_mode is 'aggregate' (default), you must specify "
                "at least one metric with an aggregate function",
                suggestions=[
                    "Add 'metrics': [{'name': 'column', 'aggregate': 'SUM'}]",
                    "Or use query_mode='raw' with 'columns' for individual rows",
                ],
                error_code="MISSING_AGGREGATE_METRICS",
            )

        return True, None

    @staticmethod
    def _pre_validate_big_number_config(
        config: Dict[str, Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Pre-validate big number chart configuration."""
        if "metric" not in config:
            return False, ChartGenerationError(
                error_type="missing_metric",
                message="Big Number chart missing required field: metric",
                details="Big Number charts require a 'metric' field "
                "specifying the value to display",
                suggestions=[
                    "Add 'metric' with name and aggregate: "
                    "{'name': 'revenue', 'aggregate': 'SUM'}",
                    "The aggregate function is required (SUM, COUNT, AVG, MIN, MAX)",
                    "Example: {'chart_type': 'big_number', "
                    "'metric': {'name': 'sales', 'aggregate': 'SUM'}}",
                ],
                error_code="MISSING_BIG_NUMBER_METRIC",
            )

        metric = config.get("metric", {})
        if not isinstance(metric, dict):
            return False, ChartGenerationError(
                error_type="invalid_metric_type",
                message="Big Number metric must be a dict with 'name' and 'aggregate'",
                details="The 'metric' field must be an object, "
                f"got {type(metric).__name__}",
                suggestions=[
                    "Use a dict: {'name': 'col', 'aggregate': 'SUM'}",
                    "Valid aggregates: SUM, COUNT, AVG, MIN, MAX",
                ],
                error_code="INVALID_BIG_NUMBER_METRIC_TYPE",
            )
        if (
            not metric.get("aggregate")
            and not metric.get("saved_metric")
            and not metric.get("sql_expression")
        ):
            return False, ChartGenerationError(
                error_type="missing_metric_aggregate",
                message="Big Number metric must include an aggregate function, "
                "a saved metric reference, or a SQL expression",
                details="The metric must have an 'aggregate' field, "
                "'saved_metric': true, or 'sql_expression'",
                suggestions=[
                    "Add 'aggregate' to your metric: "
                    "{'name': 'col', 'aggregate': 'SUM'}",
                    "Or use a saved metric: "
                    "{'name': 'total_sales', 'saved_metric': true}",
                    "Or a custom SQL metric: "
                    "{'sql_expression': 'SUM(a)/SUM(b)', 'label': 'Ratio'}",
                    "Valid aggregates: SUM, COUNT, AVG, MIN, MAX",
                ],
                error_code="MISSING_BIG_NUMBER_AGGREGATE",
            )
        # ``label`` may be any JSON type here (pre-Pydantic), so test the
        # string-ness explicitly before calling ``.strip()``.
        label = metric.get("label")
        if metric.get("sql_expression") and not (
            isinstance(label, str) and label.strip()
        ):
            return False, ChartGenerationError(
                error_type="missing_sql_metric_label",
                message="Big Number metric with sql_expression requires a label",
                details=(
                    "Custom SQL metrics have no column name to derive a label "
                    "from, so 'label' is required for display."
                ),
                suggestions=[
                    "Add a 'label': "
                    "{'sql_expression': 'SUM(a)/SUM(b)', 'label': 'Ratio'}",
                ],
                error_code="MISSING_SQL_METRIC_LABEL",
            )

        show_trendline = config.get("show_trendline", False)
        temporal_column = config.get("temporal_column")
        if show_trendline and not temporal_column:
            return False, ChartGenerationError(
                error_type="missing_temporal_column",
                message="Trendline requires a temporal column",
                details="When 'show_trendline' is True, a "
                "'temporal_column' must be specified",
                suggestions=[
                    "Add 'temporal_column': 'date_column_name'",
                    "Or set 'show_trendline': false for number only",
                    "Use get_dataset_info to find temporal columns",
                ],
                error_code="MISSING_TEMPORAL_COLUMN",
            )

        return True, None

    @staticmethod
    def _pre_validate_pivot_table_config(
        config: Dict[str, Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Pre-validate pivot table configuration."""
        missing_fields = []

        if "rows" not in config:
            missing_fields.append("'rows' (row grouping columns)")
        if "metrics" not in config:
            missing_fields.append("'metrics' (aggregation metrics)")

        if missing_fields:
            return False, ChartGenerationError(
                error_type="missing_pivot_fields",
                message=f"Pivot table missing required "
                f"fields: {', '.join(missing_fields)}",
                details="Pivot tables require row groupings and metrics",
                suggestions=[
                    "Add 'rows' field: [{'name': 'category'}]",
                    "Add 'metrics' field: [{'name': 'sales', 'aggregate': 'SUM'}]",
                    "Optional 'columns' for cross-tabulation: [{'name': 'region'}]",
                ],
                error_code="MISSING_PIVOT_FIELDS",
            )

        if not isinstance(config.get("rows", []), list):
            return False, ChartGenerationError(
                error_type="invalid_rows_format",
                message="Rows must be a list of columns",
                details="The 'rows' field must be an array of column specifications",
                suggestions=[
                    "Wrap row columns in array: 'rows': [{'name': 'category'}]",
                ],
                error_code="INVALID_ROWS_FORMAT",
            )

        if not isinstance(config.get("metrics", []), list):
            return False, ChartGenerationError(
                error_type="invalid_metrics_format",
                message="Metrics must be a list",
                details="The 'metrics' field must be an array of metric specifications",
                suggestions=[
                    "Wrap metrics in array: 'metrics': [{'name': 'sales', "
                    "'aggregate': 'SUM'}]",
                ],
                error_code="INVALID_METRICS_FORMAT",
            )

        return True, None

    @staticmethod
    def _pre_validate_mixed_timeseries_config(
        config: Dict[str, Any],
    ) -> Tuple[bool, ChartGenerationError | None]:
        """Pre-validate mixed timeseries configuration."""
        missing_fields = []

        if "x" not in config:
            missing_fields.append("'x' (X-axis temporal column)")
        if "y" not in config:
            missing_fields.append("'y' (primary Y-axis metrics)")
        if "y_secondary" not in config:
            missing_fields.append("'y_secondary' (secondary Y-axis metrics)")

        if missing_fields:
            return False, ChartGenerationError(
                error_type="missing_mixed_timeseries_fields",
                message=f"Mixed timeseries chart missing required "
                f"fields: {', '.join(missing_fields)}",
                details="Mixed timeseries charts require an x-axis, primary metrics, "
                "and secondary metrics",
                suggestions=[
                    "Add 'x' field: {'name': 'date_column'}",
                    "Add 'y' field: [{'name': 'revenue', 'aggregate': 'SUM'}]",
                    "Add 'y_secondary' field: [{'name': 'orders', "
                    "'aggregate': 'COUNT'}]",
                    "Optional: 'primary_kind' and 'secondary_kind' for chart types",
                ],
                error_code="MISSING_MIXED_TIMESERIES_FIELDS",
            )

        for field_name in ["y", "y_secondary"]:
            if not isinstance(config.get(field_name, []), list):
                return False, ChartGenerationError(
                    error_type=f"invalid_{field_name}_format",
                    message=f"'{field_name}' must be a list of metrics",
                    details=f"The '{field_name}' field must be an array of metric "
                    "specifications",
                    suggestions=[
                        f"Wrap in array: '{field_name}': "
                        "[{'name': 'col', 'aggregate': 'SUM'}]",
                    ],
                    error_code=f"INVALID_{field_name.upper()}_FORMAT",
                )

        return True, None

    # Per-chart-type error details used by _enhance_validation_error.
    # Keyed by chart_type discriminator value.
    _CHART_TYPE_ERROR_HINTS: Dict[str, Dict[str, Any]] = {
        "xy": {
            "error_type": "xy_validation_error",
            "message": "XY chart configuration validation failed",
            "details": "The XY chart configuration is missing required "
            "fields or has invalid structure",
            "suggestions": [
                "Ensure 'x' field exists with {'name': 'column_name'}",
                "Ensure 'y' is an array: [{'name': 'metric', 'aggregate': 'SUM'}]",
                "Check that all column names are strings",
                "Verify aggregate functions are valid: SUM, COUNT, AVG, MIN, MAX",
            ],
            "error_code": "XY_VALIDATION_ERROR",
        },
        "table": {
            "error_type": "table_validation_error",
            "message": "Table chart configuration validation failed",
            "details": "The table chart configuration is missing required "
            "fields or has invalid structure",
            "suggestions": [
                "Ensure 'columns' field is an array of column specifications",
                "Each column needs {'name': 'column_name'}",
                "Optional: add 'aggregate' for metrics",
                "Example: 'columns': [{'name': 'product'}, "
                "{'name': 'sales', 'aggregate': 'SUM'}]",
            ],
            "error_code": "TABLE_VALIDATION_ERROR",
        },
        "pie": {
            "error_type": "pie_validation_error",
            "message": "Pie chart configuration validation failed",
            "details": "The pie chart configuration is missing required "
            "fields or has invalid structure",
            "suggestions": [
                "Ensure 'dimension' field has 'name' for the slice label",
                "Ensure 'metric' field has 'name' and 'aggregate'",
                "Example: {'chart_type': 'pie', 'dimension': {'name': 'category'}, "
                "'metric': {'name': 'revenue', 'aggregate': 'SUM'}}",
            ],
            "error_code": "PIE_VALIDATION_ERROR",
        },
        "pivot_table": {
            "error_type": "pivot_table_validation_error",
            "message": "Pivot table configuration validation failed",
            "details": "The pivot table configuration is missing required "
            "fields or has invalid structure",
            "suggestions": [
                "Ensure 'rows' field is an array of column specs",
                "Ensure 'metrics' field is an array with aggregate funcs",
                "Optional: add 'columns' for column grouping",
                "Example: {'chart_type': 'pivot_table', 'rows': [{'name': 'region'}], "
                "'metrics': [{'name': 'revenue', 'aggregate': 'SUM'}]}",
            ],
            "error_code": "PIVOT_TABLE_VALIDATION_ERROR",
        },
        "mixed_timeseries": {
            "error_type": "mixed_timeseries_validation_error",
            "message": "Mixed timeseries chart configuration validation failed",
            "details": "The mixed timeseries configuration is missing "
            "required fields or has invalid structure",
            "suggestions": [
                "Ensure 'x' field has 'name' for the time axis column",
                "Ensure 'y' is an array of primary-axis metrics",
                "Ensure 'y_secondary' is an array of secondary-axis metrics",
                "Example: {'chart_type': 'mixed_timeseries', "
                "'x': {'name': 'order_date'}, "
                "'y': [{'name': 'revenue', 'aggregate': 'SUM'}], "
                "'y_secondary': [{'name': 'orders', 'aggregate': 'COUNT'}]}",
            ],
            "error_code": "MIXED_TIMESERIES_VALIDATION_ERROR",
        },
        "handlebars": {
            "error_type": "handlebars_validation_error",
            "message": "Handlebars chart configuration validation failed",
            "details": "The handlebars chart configuration is missing "
            "required fields or has invalid structure",
            "suggestions": [
                "Ensure 'handlebars_template' is a non-empty string",
                "For aggregate mode: add 'metrics' with aggregate functions",
                "For raw mode: set 'query_mode': 'raw' and add 'columns'",
                "Example: {'chart_type': 'handlebars', "
                "'handlebars_template': '<ul>{{#each data}}<li>"
                "{{this.name}}</li>{{/each}}</ul>', "
                "'metrics': [{'name': 'sales', 'aggregate': 'SUM'}]}",
            ],
            "error_code": "HANDLEBARS_VALIDATION_ERROR",
        },
        "big_number": {
            "error_type": "big_number_validation_error",
            "message": "Big Number chart configuration validation failed",
            "details": "The Big Number chart configuration is missing required "
            "fields or has invalid structure",
            "suggestions": [
                "Ensure 'metric' field has 'name' and 'aggregate'",
                "Example: 'metric': {'name': 'revenue', 'aggregate': 'SUM'}",
                "For trendline: add show_trendline=true and temporal_column='col'",
                "Without trendline: just provide the metric",
            ],
            "error_code": "BIG_NUMBER_VALIDATION_ERROR",
        },
    }

    @staticmethod
    def _enhance_validation_error(
        error: PydanticValidationError, request_data: Dict[str, Any]
    ) -> ChartGenerationError:
        """Convert Pydantic validation errors to user-friendly messages."""
        errors = error.errors()

        # Check for discriminated union errors (generic "'table' was expected")
        for err in errors:
            if err.get("type") == "union_tag_invalid" or "discriminator" in str(
                err.get("ctx", {})
            ):
                chart_type = request_data.get("config", {}).get("chart_type", "")
                hint = SchemaValidator._CHART_TYPE_ERROR_HINTS.get(chart_type)
                if hint:
                    return ChartGenerationError(**hint)

        # Default enhanced error
        error_details = []
        for err in errors[:3]:  # Show first 3 errors
            loc = " -> ".join(str(location) for location in err.get("loc", []))
            msg = err.get("msg", "Validation failed")
            error_details.append(f"{loc}: {msg}" if loc else msg)

        return ChartGenerationError(
            error_type="validation_error",
            message="Chart configuration validation failed",
            details="; ".join(error_details) or "Invalid chart configuration structure",
            suggestions=[
                "Check that all required fields are present",
                "Ensure field types match the schema",
                "Use get_dataset_info to verify column names",
                "Refer to the API documentation for field requirements",
            ],
            error_code="VALIDATION_ERROR",
        )
