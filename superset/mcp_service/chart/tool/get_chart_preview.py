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
MCP tool: get_chart_preview
"""

import logging
from typing import Any, Dict, List, Protocol

from fastmcp import Context
from sqlalchemy.exc import SQLAlchemyError
from superset_core.mcp.decorators import tool, ToolAnnotations

from superset.commands.exceptions import CommandException
from superset.exceptions import OAuth2Error, OAuth2RedirectError, SupersetException
from superset.extensions import event_logger
from superset.mcp_service.chart.ascii_charts import (
    generate_ascii_chart,
    generate_ascii_table,
)
from superset.mcp_service.chart.chart_helpers import find_chart_by_identifier
from superset.mcp_service.chart.chart_utils import validate_chart_dataset
from superset.mcp_service.chart.schemas import (
    AccessibilityMetadata,
    ASCIIPreview,
    ChartError,
    ChartPreview,
    GetChartPreviewRequest,
    InteractivePreview,
    PerformanceMetadata,
    TablePreview,
    URLPreview,
    VegaLitePreview,
)
from superset.mcp_service.utils.oauth2_utils import (
    build_oauth2_redirect_message,
    OAUTH2_CONFIG_ERROR_MESSAGE,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url

logger = logging.getLogger(__name__)


class ChartLike(Protocol):
    """Protocol for chart-like objects with required attributes for preview."""

    id: int
    slice_name: str | None
    viz_type: str | None
    datasource_id: int
    datasource_type: str
    params: str | None
    digest: str
    uuid: Any


def _build_query_columns(form_data: Dict[str, Any]) -> list[str]:
    """Build query columns list from form_data, including both x_axis and groupby."""
    x_axis_config = form_data.get("x_axis")
    groupby_columns: list[str] = form_data.get("groupby") or []

    columns = groupby_columns.copy()
    if x_axis_config and isinstance(x_axis_config, str):
        if x_axis_config not in columns:
            columns.insert(0, x_axis_config)
    elif x_axis_config and isinstance(x_axis_config, dict):
        col_name = x_axis_config.get("column_name")
        if col_name and col_name not in columns:
            columns.insert(0, col_name)
    return columns


class PreviewFormatStrategy:
    """Base class for preview format strategies."""

    def __init__(self, chart: ChartLike, request: GetChartPreviewRequest) -> None:
        self.chart = chart
        self.request = request

    def generate(self) -> ChartPreview | ChartError:
        """Generate preview in the specific format."""
        raise NotImplementedError


class URLPreviewStrategy(PreviewFormatStrategy):
    """Generate URL-based preview with explore link."""

    def generate(self) -> URLPreview | ChartError:
        chart = self.chart
        if not chart.id:
            return ChartError(
                error="URL preview not available for transient charts without an ID",
                error_type="UnsupportedFormat",
            )
        explore_url = f"{get_superset_base_url()}/explore/?slice_id={chart.id}"
        return URLPreview(
            preview_url=explore_url,
            width=self.request.width or 800,
            height=self.request.height or 600,
        )


class ASCIIPreviewStrategy(PreviewFormatStrategy):
    """Generate ASCII art preview."""

    def generate(self) -> ASCIIPreview | ChartError:
        try:
            from superset.commands.chart.data.get_data_command import ChartDataCommand
            from superset.common.query_context_factory import QueryContextFactory
            from superset.utils import json as utils_json

            form_data = utils_json.loads(self.chart.params) if self.chart.params else {}

            logger.info("Chart form_data keys: %s", list(form_data.keys()))
            logger.info("Chart viz_type: %s", self.chart.viz_type)
            logger.info("Chart datasource_id: %s", self.chart.datasource_id)
            logger.info("Chart datasource_type: %s", self.chart.datasource_type)

            # Check if datasource_id is None
            if self.chart.datasource_id is None:
                return ChartError(
                    error="Chart has no datasource_id - cannot generate preview",
                    error_type="InvalidChart",
                )

            # Build query for chart data
            x_axis_config = form_data.get("x_axis")
            groupby_columns = form_data.get("groupby", [])
            metrics = form_data.get("metrics", [])

            # Table charts in raw mode use all_columns or columns
            all_columns = form_data.get("all_columns", [])
            raw_columns = form_data.get("columns", [])
            if form_data.get("query_mode") == "raw" and (all_columns or raw_columns):
                columns = list(all_columns or raw_columns)
            else:
                columns = groupby_columns.copy()
                if x_axis_config and isinstance(x_axis_config, str):
                    columns.append(x_axis_config)
                elif x_axis_config and isinstance(x_axis_config, dict):
                    if "column_name" in x_axis_config:
                        columns.append(x_axis_config["column_name"])

            if not columns and not metrics:
                return ChartError(
                    error=(
                        "Cannot generate ASCII preview: chart has no columns or "
                        "metrics in its configuration. This chart type may not "
                        "support ASCII preview."
                    ),
                    error_type="UnsupportedChart",
                )

            factory = QueryContextFactory()
            query_context = factory.create(
                datasource={
                    "id": self.chart.datasource_id,
                    "type": self.chart.datasource_type,
                },
                queries=[
                    {
                        "filters": form_data.get("filters", []),
                        "columns": columns,
                        "metrics": metrics,
                        "row_limit": 50,
                        "order_desc": True,
                    }
                ],
                form_data=form_data,
                force=False,
            )

            command = ChartDataCommand(query_context)
            command.validate()
            result = command.run()

            data = []
            if result and "queries" in result and len(result["queries"]) > 0:
                data = result["queries"][0].get("data", [])

            ascii_chart = generate_ascii_chart(
                data,
                self.chart.viz_type or "table",
                self.request.ascii_width or 80,
                self.request.ascii_height or 20,
            )

            return ASCIIPreview(
                ascii_content=ascii_chart,
                width=self.request.ascii_width or 80,
                height=self.request.ascii_height or 20,
            )

        except (
            CommandException,
            SupersetException,
            ValueError,
            KeyError,
            AttributeError,
            TypeError,
        ) as e:
            logger.error("ASCII preview generation failed: %s", e)
            return ChartError(
                error=f"Failed to generate ASCII preview: {str(e)}",
                error_type="ASCIIError",
            )


class TablePreviewStrategy(PreviewFormatStrategy):
    """Generate table preview of chart data."""

    def generate(self) -> TablePreview | ChartError:
        try:
            from superset.commands.chart.data.get_data_command import ChartDataCommand
            from superset.common.query_context_factory import QueryContextFactory
            from superset.utils import json as utils_json

            form_data = utils_json.loads(self.chart.params) if self.chart.params else {}

            # Check if datasource_id is None
            if self.chart.datasource_id is None:
                return ChartError(
                    error="Chart has no datasource_id - cannot generate table preview",
                    error_type="InvalidChart",
                )

            columns = _build_query_columns(form_data)

            factory = QueryContextFactory()
            query_context = factory.create(
                datasource={
                    "id": self.chart.datasource_id,
                    "type": self.chart.datasource_type,
                },
                queries=[
                    {
                        "filters": form_data.get("filters", []),
                        "columns": columns,
                        "metrics": form_data.get("metrics", []),
                        "row_limit": 20,
                        "order_desc": True,
                    }
                ],
                form_data=form_data,
                force=False,
            )

            command = ChartDataCommand(query_context)
            command.validate()
            result = command.run()

            data = []
            if result and "queries" in result and len(result["queries"]) > 0:
                data = result["queries"][0].get("data", [])

            table_data = generate_ascii_table(data, 120)

            return TablePreview(
                table_data=table_data,
                row_count=len(data),
            )

        except (
            CommandException,
            SupersetException,
            ValueError,
            KeyError,
            AttributeError,
            TypeError,
        ) as e:
            logger.error("Table preview generation failed: %s", e)
            return ChartError(
                error=f"Failed to generate table preview: {str(e)}",
                error_type="TableError",
            )


class VegaLitePreviewStrategy(PreviewFormatStrategy):
    """Generate Vega-Lite specification for interactive chart preview."""

    def _get_form_data(self) -> Dict[str, Any] | None:
        """Extract form_data from chart params."""
        try:
            if hasattr(self.chart, "params") and self.chart.params:
                from superset.utils import json as utils_json

                return utils_json.loads(self.chart.params)
            return None
        except (ValueError, TypeError):
            return None

    def generate(self) -> VegaLitePreview | ChartError:
        """Generate Vega-Lite JSON specification from chart data."""
        try:
            # Get chart data directly using the same logic as get_chart_data tool
            # but without calling the MCP tool wrapper
            from superset.commands.chart.data.get_data_command import ChartDataCommand
            from superset.common.query_context_factory import QueryContextFactory
            from superset.daos.chart import ChartDAO
            from superset.utils import json as utils_json

            # Get the chart object if we don't have form_data access
            if not hasattr(self.chart, "params") or not self.chart.params:
                # Fetch full chart details
                chart_obj = None
                if self.chart.id is None:
                    return ChartError(
                        error="Chart has no ID - cannot generate Vega-Lite preview",
                        error_type="InvalidChart",
                    )

                if isinstance(self.chart.id, int):
                    chart_obj = ChartDAO.find_by_id(self.chart.id)
                else:
                    chart_obj = ChartDAO.find_by_id(self.chart.id, id_column="uuid")

                if not chart_obj:
                    return ChartError(
                        error=f"Chart {self.chart.id} not found for data retrieval",
                        error_type="ChartNotFound",
                    )

                form_data = (
                    utils_json.loads(chart_obj.params) if chart_obj.params else {}
                )
            else:
                form_data = (
                    utils_json.loads(self.chart.params) if self.chart.params else {}
                )

            # Build columns list: include both x_axis and groupby
            columns = _build_query_columns(form_data)

            # Create query context for data retrieval
            factory = QueryContextFactory()
            query_context = factory.create(
                datasource={
                    "id": self.chart.datasource_id,
                    "type": self.chart.datasource_type,
                },
                queries=[
                    {
                        "filters": form_data.get("filters", []),
                        "columns": columns,
                        "metrics": form_data.get("metrics", []),
                        "row_limit": 1000,  # More data for visualization
                        "order_desc": True,
                    }
                ],
                form_data=form_data,
                force=self.request.force_refresh,
            )

            # Execute the query
            command = ChartDataCommand(query_context)
            command.validate()
            result = command.run()

            # Extract data from result
            chart_data = []
            if result and "queries" in result and len(result["queries"]) > 0:
                chart_data = result["queries"][0].get("data", [])

            if not chart_data or not isinstance(chart_data, list):
                return ChartError(
                    error="No data available for Vega-Lite visualization",
                    error_type="NoDataError",
                )

            # Convert Superset chart type to Vega-Lite specification
            vega_spec = self._create_vega_lite_spec(chart_data)

            return VegaLitePreview(
                type="vega_lite",
                specification=vega_spec,
                supports_streaming=False,
            )

        except (
            CommandException,
            SupersetException,
            ValueError,
            KeyError,
            AttributeError,
            TypeError,
        ) as e:
            logger.exception(
                "Error generating Vega-Lite preview for chart %s", self.chart.id
            )
            return ChartError(
                error=f"Failed to generate Vega-Lite preview: {str(e)}",
                error_type="VegaLiteGenerationError",
            )

    def _create_vega_lite_spec(self, data: List[Any]) -> Dict[str, Any]:
        """Create Vega-Lite specification from chart data."""
        if not data:
            return {"data": {"values": []}, "mark": "point"}

        # Get data fields and analyze types
        first_row = data[0] if data else {}
        fields = list(first_row.keys()) if first_row else []
        field_types = self._analyze_field_types(data, fields)

        # Determine chart type based on Superset viz_type
        viz_type = getattr(self.chart, "viz_type", "table") or "table"

        # Basic Vega-Lite specification
        spec = {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "description": (
                f"Chart preview for "
                f"{getattr(self.chart, 'slice_name', 'Untitled Chart')}"
            ),
            "data": {"values": data},
            "width": self.request.width or 400,
            "height": self.request.height or 300,
        }

        # Configure visualization based on chart type
        chart_spec = self._get_chart_spec_for_type(viz_type, fields, field_types)
        spec.update(chart_spec)

        return spec

    def _get_chart_spec_for_type(
        self, viz_type: str, fields: List[str], field_types: Dict[str, str]
    ) -> Dict[str, Any]:
        """Get chart specification based on visualization type."""
        chart_type_mapping = {
            "line": [
                "echarts_timeseries_line",
                "echarts_timeseries",
                "echarts_timeseries_smooth",
                "echarts_timeseries_step",
                "line",
            ],
            "bar": [
                "echarts_timeseries_bar",
                "echarts_timeseries_column",
                "bar",
                "column",
            ],
            "area": ["echarts_area", "area"],
            "scatter": ["echarts_timeseries_scatter", "scatter"],
            "pie": ["pie"],
            "big_number": ["big_number", "big_number_total"],
            "histogram": ["histogram"],
            "box_plot": ["box_plot"],
            "heatmap": ["heatmap", "heatmap_v2", "cal_heatmap"],
            "funnel": ["funnel"],
            "gauge": ["gauge_chart"],
            "mixed": ["mixed_timeseries"],
            "table": ["table"],
        }

        # Find matching chart type
        for chart_type, viz_types in chart_type_mapping.items():
            if viz_type in viz_types:
                method_name = f"_{chart_type}_chart_spec"
                if hasattr(self, method_name):
                    return getattr(self, method_name)(fields, field_types)

        # Default fallback
        logger.info("Unknown chart type '%s', using scatter plot fallback", viz_type)
        return self._scatter_chart_spec(fields, field_types)

    def _analyze_field_types(
        self, data: List[Any], fields: List[str]
    ) -> Dict[str, str]:
        """Analyze data fields to determine appropriate Vega-Lite types."""
        field_types: Dict[str, str] = {}

        if not data or not fields:
            return field_types

        try:
            # Sample a few rows to determine types
            sample_size = min(10, len(data))

            for field in fields:
                field_type = "nominal"  # default

                try:
                    # Collect sample values
                    sample_values = self._get_sample_values(data, field, sample_size)

                    if not sample_values:
                        field_types[field] = "nominal"
                        continue

                    # Determine field type based on sample values
                    field_type = self._determine_field_type(sample_values)
                    field_types[field] = field_type

                except (TypeError, ValueError, KeyError, AttributeError) as e:
                    logger.warning("Error analyzing field '%s': %s", field, e)
                    field_types[field] = "nominal"  # Safe default

        except (TypeError, ValueError, KeyError, AttributeError) as e:
            logger.warning("Error in field type analysis: %s", e)
            # Return nominal types for all fields as fallback
            return dict.fromkeys(fields, "nominal")

        return field_types

    def _get_sample_values(
        self, data: List[Any], field: str, sample_size: int
    ) -> List[Any]:
        """Get sample values for a field from the data."""
        sample_values = []
        for row in data[:sample_size]:
            if isinstance(row, dict) and field in row:
                val = row[field]
                if val is not None:
                    sample_values.append(val)
        return sample_values

    def _determine_field_type(self, sample_values: List[Any]) -> str:
        """Determine the field type based on sample values."""
        # Check for temporal fields (dates)
        if any(
            isinstance(val, str) and self._looks_like_date(val) for val in sample_values
        ):
            return "temporal"
        # Check for numeric fields
        elif all(
            isinstance(val, (int, float)) and not isinstance(val, bool)
            for val in sample_values
        ):
            return "quantitative"
        # Check for ordinal fields (limited unique values)
        elif len({str(val) for val in sample_values}) <= 10:
            # Could be ordinal or nominal, default to nominal for safety
            return "nominal"
        else:
            return "nominal"

    def _looks_like_date(self, value: str) -> bool:
        """Quick heuristic to detect date-like strings."""
        if not isinstance(value, str):
            return False

        # Common date patterns
        date_indicators = [
            "-",
            "/",
            "T",
            ":",
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ]

        value_lower = value.lower()
        return any(indicator in value_lower for indicator in date_indicators)

    def _line_chart_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create line chart specification."""
        field_types = field_types or {}

        # Try to get original field mappings from chart form_data
        form_data = self._get_form_data()

        # Extract original x/y field mappings
        x_field = form_data.get("x_axis") if form_data else None
        if not x_field:
            # Fallback to guessing from aggregated fields
            x_field = fields[0] if fields else "x"

        # For y-axis, we need to use the aggregated field name from data
        y_field = fields[1] if len(fields) > 1 else fields[0] if fields else "y"

        # Better type detection for x-axis
        x_type = field_types.get(x_field, "nominal")
        # Override if we know it's the x_axis from form_data (likely temporal)
        if form_data and x_field == form_data.get("x_axis"):
            if any(
                kw in x_field.lower() for kw in ["date", "time", "year", "month", "day"]
            ):
                x_type = "temporal"

        y_type = field_types.get(y_field, "quantitative")

        return {
            "mark": {"type": "line", "point": True, "tooltip": True},
            "encoding": {
                "x": {"field": x_field, "type": x_type, "title": x_field},
                "y": {"field": y_field, "type": y_type, "title": y_field},
                "tooltip": [
                    {"field": f, "type": field_types.get(f, "nominal")}
                    for f in fields[:5]
                ],
            },
        }

    def _bar_chart_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create bar chart specification."""
        field_types = field_types or {}
        x_field = fields[0] if fields else "x"
        y_field = fields[1] if len(fields) > 1 else fields[0] if fields else "y"

        x_type = field_types.get(x_field, "nominal")
        y_type = field_types.get(y_field, "quantitative")

        return {
            "mark": {"type": "bar", "tooltip": True},
            "encoding": {
                "x": {"field": x_field, "type": x_type, "title": x_field},
                "y": {"field": y_field, "type": y_type, "title": y_field},
                "tooltip": [
                    {"field": f, "type": field_types.get(f, "nominal")}
                    for f in fields[:5]
                ],
            },
        }

    def _area_chart_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create area chart specification."""
        field_types = field_types or {}
        x_field = fields[0] if fields else "x"
        y_field = fields[1] if len(fields) > 1 else fields[0] if fields else "y"

        x_type = field_types.get(
            x_field,
            "temporal"
            if "date" in x_field.lower() or "time" in x_field.lower()
            else "nominal",
        )
        y_type = field_types.get(y_field, "quantitative")

        return {
            "mark": {"type": "area", "tooltip": True},
            "encoding": {
                "x": {"field": x_field, "type": x_type, "title": x_field},
                "y": {"field": y_field, "type": y_type, "title": y_field},
                "tooltip": [
                    {"field": f, "type": field_types.get(f, "nominal")}
                    for f in fields[:5]
                ],
            },
        }

    def _scatter_chart_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create scatter plot specification."""
        field_types = field_types or {}
        x_field = fields[0] if fields else "x"
        y_field = fields[1] if len(fields) > 1 else fields[0] if fields else "y"

        x_type = field_types.get(x_field, "quantitative")
        y_type = field_types.get(y_field, "quantitative")

        return {
            "mark": {"type": "circle", "size": 100, "tooltip": True},
            "encoding": {
                "x": {"field": x_field, "type": x_type, "title": x_field},
                "y": {"field": y_field, "type": y_type, "title": y_field},
                "tooltip": [
                    {"field": f, "type": field_types.get(f, "nominal")}
                    for f in fields[:5]
                ],
            },
        }

    def _table_chart_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create table-like visualization (using text marks)."""
        field_types = field_types or {}
        # For table data, create a simple dot plot
        y_field = fields[0] if fields else "index"

        return {
            "mark": {"type": "circle", "size": 50},
            "encoding": {
                "y": {
                    "field": y_field,
                    "type": field_types.get(y_field, "nominal"),
                    "title": y_field,
                },
                "tooltip": [
                    {"field": f, "type": field_types.get(f, "nominal")}
                    for f in fields[:10]
                ],
            },
        }

    def _pie_chart_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create pie chart specification using arc marks."""
        field_types = field_types or {}
        category_field = fields[0] if fields else "category"
        value_field = fields[1] if len(fields) > 1 else fields[0] if fields else "value"

        return {
            "mark": {"type": "arc", "tooltip": True},
            "encoding": {
                "theta": {
                    "field": value_field,
                    "type": field_types.get(value_field, "quantitative"),
                },
                "color": {
                    "field": category_field,
                    "type": field_types.get(category_field, "nominal"),
                    "title": category_field,
                },
                "tooltip": [
                    {"field": f, "type": field_types.get(f, "nominal")}
                    for f in fields[:5]
                ],
            },
        }

    def _big_number_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create big number visualization using text mark."""
        field_types = field_types or {}
        value_field = fields[0] if fields else "value"

        return {
            "mark": {
                "type": "text",
                "fontSize": 48,
                "fontWeight": "bold",
                "align": "center",
                "baseline": "middle",
                "tooltip": True,
            },
            "encoding": {
                "text": {
                    "field": value_field,
                    "type": field_types.get(value_field, "quantitative"),
                    "format": ",.0f",
                },
                "tooltip": [
                    {"field": f, "type": field_types.get(f, "nominal")}
                    for f in fields[:3]
                ],
            },
        }

    def _histogram_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create histogram using bar marks with binned data."""
        x_field = fields[0] if fields else "value"

        return {
            "mark": {"type": "bar", "tooltip": True},
            "encoding": {
                "x": {
                    "field": x_field,
                    "type": "quantitative",
                    "bin": {"maxbins": 20},
                    "title": x_field,
                },
                "y": {"aggregate": "count", "type": "quantitative", "title": "Count"},
                "tooltip": [{"field": f, "type": "nominal"} for f in fields[:3]],
            },
        }

    def _box_plot_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create box plot approximation using error bars."""
        x_field = fields[0] if fields else "category"
        y_field = fields[1] if len(fields) > 1 else fields[0] if fields else "value"

        return {
            "mark": {"type": "boxplot", "tooltip": True},
            "encoding": {
                "x": {"field": x_field, "type": "nominal", "title": x_field},
                "y": {"field": y_field, "type": "quantitative", "title": y_field},
                "tooltip": [{"field": f, "type": "nominal"} for f in fields[:5]],
            },
        }

    def _heatmap_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create heatmap using rect marks."""
        x_field = fields[0] if fields else "x"
        y_field = fields[1] if len(fields) > 1 else "y"
        color_field = (
            fields[2] if len(fields) > 2 else fields[1] if len(fields) > 1 else "value"
        )

        return {
            "mark": {"type": "rect", "tooltip": True},
            "encoding": {
                "x": {"field": x_field, "type": "nominal", "title": x_field},
                "y": {"field": y_field, "type": "nominal", "title": y_field},
                "color": {
                    "field": color_field,
                    "type": "quantitative",
                    "scale": {"scheme": "blues"},
                    "title": color_field,
                },
                "tooltip": [{"field": f, "type": "nominal"} for f in fields[:5]],
            },
        }

    def _funnel_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create funnel chart using horizontal bars."""
        stage_field = fields[0] if fields else "stage"
        value_field = fields[1] if len(fields) > 1 else fields[0] if fields else "value"

        return {
            "mark": {"type": "bar", "tooltip": True},
            "encoding": {
                "y": {
                    "field": stage_field,
                    "type": "nominal",
                    "sort": "-x",
                    "title": stage_field,
                },
                "x": {
                    "field": value_field,
                    "type": "quantitative",
                    "title": value_field,
                },
                "color": {
                    "field": value_field,
                    "type": "quantitative",
                    "scale": {"scheme": "viridis"},
                },
                "tooltip": [{"field": f, "type": "nominal"} for f in fields[:5]],
            },
        }

    def _gauge_chart_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create gauge chart using arc marks."""
        value_field = fields[0] if fields else "value"

        return {
            "mark": {
                "type": "arc",
                "innerRadius": 50,
                "outerRadius": 80,
                "tooltip": True,
            },
            "encoding": {
                "theta": {
                    "field": value_field,
                    "type": "quantitative",
                    "scale": {"range": [0, 6.28]},
                },
                "color": {
                    "field": value_field,
                    "type": "quantitative",
                    "scale": {"scheme": "redyellowgreen"},
                },
                "tooltip": [{"field": f, "type": "nominal"} for f in fields[:3]],
            },
        }

    def _mixed_chart_spec(
        self, fields: List[str], field_types: Dict[str, str] | None = None
    ) -> Dict[str, Any]:
        """Create mixed timeseries using layered marks."""
        x_field = fields[0] if fields else "date"
        y_field = fields[1] if len(fields) > 1 else fields[0] if fields else "value"

        return {
            "layer": [
                {
                    "mark": {"type": "line", "tooltip": True},
                    "encoding": {
                        "x": {"field": x_field, "type": "temporal", "title": x_field},
                        "y": {
                            "field": y_field,
                            "type": "quantitative",
                            "title": y_field,
                        },
                        "tooltip": [
                            {"field": f, "type": "nominal"} for f in fields[:5]
                        ],
                    },
                },
                {
                    "mark": {"type": "point", "filled": True, "size": 50},
                    "encoding": {
                        "x": {"field": x_field, "type": "temporal"},
                        "y": {"field": y_field, "type": "quantitative"},
                    },
                },
            ]
        }


class PreviewFormatGenerator:
    """Factory for generating different preview formats."""

    STRATEGIES = {
        "url": URLPreviewStrategy,
        "ascii": ASCIIPreviewStrategy,
        "table": TablePreviewStrategy,
        "vega_lite": VegaLitePreviewStrategy,
    }

    def __init__(self, chart: ChartLike, request: GetChartPreviewRequest) -> None:
        self.chart = chart
        self.request = request

    def generate(
        self,
    ) -> (
        URLPreview
        | InteractivePreview
        | ASCIIPreview
        | VegaLitePreview
        | TablePreview
        | ChartError
    ):
        """Generate preview using the appropriate strategy."""
        strategy_class = self.STRATEGIES.get(self.request.format)

        if not strategy_class:
            return ChartError(
                error=f"Unsupported preview format: {self.request.format}",
                error_type="UnsupportedFormat",
            )

        strategy = strategy_class(self.chart, self.request)
        return strategy.generate()


async def _get_chart_preview_internal(  # noqa: C901
    request: GetChartPreviewRequest,
    ctx: Context,
) -> ChartPreview | ChartError:
    """
    Get a preview of a chart in the requested format.

    This tool can return text previews for direct LLM responses, Explore URLs
    for interactive inspection, tabular data, or Vega-Lite specifications.

    Supports lookup by:
    - Numeric ID (e.g., 123)
    - UUID string (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

    Returns a ChartPreview in the requested format or ChartError on error.
    """
    try:
        await ctx.report_progress(1, 3, "Looking up chart")

        # Find the chart
        with event_logger.log_context(action="mcp.get_chart_preview.chart_lookup"):
            chart: Any = None

            # Handle unsaved chart (form_data_key only, no identifier)
            if not request.identifier and request.form_data_key:
                with event_logger.log_context(
                    action="mcp.get_chart_preview.unsaved_chart_from_cache"
                ):
                    await ctx.info(
                        "No chart identifier - creating transient chart from "
                        "form_data_key=%s" % (request.form_data_key,)
                    )
                    from superset.commands.explore.form_data.get import (
                        GetFormDataCommand,
                    )
                    from superset.commands.explore.form_data.parameters import (
                        CommandParameters,
                    )
                    from superset.utils import json as utils_json

                    try:
                        cmd_params = CommandParameters(key=request.form_data_key)
                        form_data_json = GetFormDataCommand(cmd_params).run()
                        if form_data_json:
                            form_data = utils_json.loads(form_data_json)

                            class TransientChartFromKey:
                                def __init__(self, fd: Dict[str, Any]):
                                    self.id = 0
                                    self.slice_name = "Unsaved Chart Preview"
                                    self.viz_type = fd.get("viz_type", "table")
                                    ds = fd.get("datasource", "")
                                    parts = str(ds).split("__") if ds else []
                                    self.datasource_id = (
                                        int(parts[0])
                                        if len(parts) == 2
                                        else fd.get("datasource_id")
                                    )
                                    self.datasource_type = (
                                        parts[1]
                                        if len(parts) == 2
                                        else fd.get("datasource_type", "table")
                                    )
                                    self.params = utils_json.dumps(fd)
                                    self.form_data = fd
                                    self.uuid = None

                            chart = TransientChartFromKey(form_data)
                    except (
                        CommandException,
                        ValueError,
                        KeyError,
                        AttributeError,
                        TypeError,
                    ) as e:
                        logger.warning(
                            "Failed to get form data for key %s: %s",
                            request.form_data_key,
                            e,
                        )
                        return ChartError(
                            error="No cached chart data found for form_data_key. "
                            "The cache may have expired.",
                            error_type="NotFound",
                        )

            else:
                await ctx.debug(
                    "Looking up chart: identifier=%s" % (request.identifier,)
                )
                if request.identifier is None:
                    return ChartError(
                        error="Chart identifier is required",
                        error_type="ValidationError",
                    )
                chart = find_chart_by_identifier(request.identifier)

                # If not found and looks like a form_data_key, try transient
                if (
                    not chart
                    and isinstance(request.identifier, str)
                    and len(request.identifier) > 8
                ):
                    # This might be a form_data_key
                    from superset.commands.explore.form_data.get import (
                        GetFormDataCommand,
                    )
                    from superset.commands.explore.form_data.parameters import (
                        CommandParameters,
                    )

                    try:
                        cmd_params = CommandParameters(key=request.identifier)
                        cmd = GetFormDataCommand(cmd_params)
                        form_data_json = cmd.run()
                        if form_data_json:
                            from superset.utils import json as utils_json

                            form_data = utils_json.loads(form_data_json)

                            # Create a transient chart object from form data
                            class TransientChart:
                                def __init__(self, form_data: Dict[str, Any]):
                                    self.id = 0
                                    self.slice_name = "Unsaved Chart Preview"
                                    self.viz_type = form_data.get("viz_type", "table")
                                    self.datasource_id = None
                                    self.datasource_type = "table"
                                    self.params = utils_json.dumps(form_data)
                                    self.form_data = form_data
                                    self.uuid = None

                            chart = TransientChart(form_data)
                    except (
                        CommandException,
                        ValueError,
                        KeyError,
                        AttributeError,
                        TypeError,
                    ) as e:
                        # Form data key not found or invalid
                        logger.debug(
                            "Failed to get form data for key %s: %s",
                            request.identifier,
                            e,
                        )

        if not chart:
            await ctx.warning("Chart not found: identifier=%s" % (request.identifier,))
            return ChartError(
                error=f"No chart found with identifier: {request.identifier}",
                error_type="NotFound",
            )

        await ctx.info(
            "Chart found successfully: chart_id=%s, chart_name=%s, viz_type=%s"
            % (
                getattr(chart, "id", None),
                getattr(chart, "slice_name", None),
                getattr(chart, "viz_type", None),
            )
        )

        # Log all chart attributes for debugging
        logger.info(
            "Chart object type: %s, id value: %s, id type: %s",
            type(chart).__name__,
            getattr(chart, "id", "NO_ID"),
            type(getattr(chart, "id", None)),
        )
        logger.info("Generating preview for chart %s", getattr(chart, "id", "NO_ID"))
        logger.info("Chart datasource_id: %s", getattr(chart, "datasource_id", "NONE"))

        # Validate the chart's dataset is accessible before generating preview
        # Skip validation for transient charts (no ID) - different data sources
        if getattr(chart, "id", None) is not None:
            validation_result = validate_chart_dataset(chart, check_access=True)
            if not validation_result.is_valid:
                await ctx.warning(
                    "Chart found but dataset is not accessible: %s"
                    % (validation_result.error,)
                )
                return ChartError(
                    error=validation_result.error
                    or "Chart's dataset is not accessible. Dataset may be deleted.",
                    error_type="DatasetNotAccessible",
                )
            # Log any warnings (e.g., virtual dataset warnings)
            for warning in validation_result.warnings:
                await ctx.warning("Dataset warning: %s" % (warning,))

        # If form_data_key is provided, override chart.params with cached
        # form_data so the preview reflects what the user actually sees
        if request.form_data_key and getattr(chart, "id", None) is not None:
            with event_logger.log_context(
                action="mcp.get_chart_preview.unsaved_state_override"
            ):
                await ctx.info(
                    "Retrieving unsaved chart state from cache: form_data_key=%s"
                    % (request.form_data_key,)
                )
                from superset.commands.explore.form_data.get import (
                    GetFormDataCommand,
                )
                from superset.commands.explore.form_data.parameters import (
                    CommandParameters,
                )

                try:
                    cmd_params = CommandParameters(key=request.form_data_key)
                    cached_form_data = GetFormDataCommand(cmd_params).run()
                    if cached_form_data:
                        chart.params = cached_form_data
                        from superset.utils import json as utils_json

                        parsed = utils_json.loads(cached_form_data)
                        if isinstance(parsed, dict) and "viz_type" in parsed:
                            chart.viz_type = parsed["viz_type"]
                        await ctx.info(
                            "Chart params overridden with unsaved state from cache"
                        )
                    else:
                        await ctx.warning(
                            "form_data_key provided but no cached data found. "
                            "The cache may have expired. Using saved chart "
                            "configuration."
                        )
                except (CommandException, ValueError, KeyError) as e:
                    await ctx.warning(
                        "Failed to retrieve cached form_data: %s. "
                        "Using saved chart configuration." % (str(e),)
                    )

        import time

        start_time = time.time()

        await ctx.report_progress(2, 3, f"Generating {request.format} preview")
        await ctx.debug(
            "Preview generation parameters: chart_id=%s, viz_type=%s, "
            "datasource_id=%s, width=%s, height=%s"
            % (
                chart.id,
                chart.viz_type,
                chart.datasource_id,
                request.width,
                request.height,
            )
        )

        # Handle different preview formats using strategy pattern
        with event_logger.log_context(
            action="mcp.get_chart_preview.preview_generation"
        ):
            preview_generator = PreviewFormatGenerator(chart, request)
            content = preview_generator.generate()

        if isinstance(content, ChartError):
            await ctx.error(
                "Preview generation failed: chart_id=%s, format=%s, error=%s, "
                "error_type=%s"
                % (
                    chart.id,
                    request.format,
                    content.error,
                    content.error_type,
                )
            )
            return content

        await ctx.report_progress(3, 3, "Building response")

        # Create performance and accessibility metadata
        with event_logger.log_context(action="mcp.get_chart_preview.metadata"):
            execution_time = int((time.time() - start_time) * 1000)
            performance = PerformanceMetadata(
                query_duration_ms=execution_time,
                cache_status="miss",
                optimization_suggestions=[],
            )

            accessibility = AccessibilityMetadata(
                color_blind_safe=True,
                alt_text=f"Preview of {chart.slice_name or f'Chart {chart.id}'}",
                high_contrast_available=False,
            )

        await ctx.debug(
            "Preview generation completed: execution_time_ms=%s, content_type=%s"
            % (
                execution_time,
                type(content).__name__,
            )
        )

        # Create backward-compatible response with enhanced metadata
        result = ChartPreview(
            chart_id=chart.id,
            chart_name=chart.slice_name or f"Chart {chart.id}",
            chart_type=chart.viz_type or "unknown",
            explore_url=f"{get_superset_base_url()}/explore/?slice_id={chart.id}",
            content=content,
            chart_description=(
                f"Preview of {chart.viz_type or 'chart'}: "
                f"{chart.slice_name or f'Chart {chart.id}'}"
            ),
            accessibility=accessibility,
            performance=performance,
        )

        # Add format-specific fields for backward compatibility
        if isinstance(content, ASCIIPreview):
            result.format = "ascii"
            result.ascii_chart = content.ascii_content
            result.width = content.width
            result.height = content.height
        elif isinstance(content, TablePreview):
            result.format = "table"
            result.table_data = content.table_data
        elif isinstance(content, VegaLitePreview):
            result.format = "vega_lite"
        elif isinstance(content, URLPreview):
            result.format = "url"
            result.width = content.width
            result.height = content.height

        return result

    except (
        CommandException,
        SupersetException,
        ValueError,
        KeyError,
        AttributeError,
        TypeError,
    ) as e:
        await ctx.error(
            "Chart preview generation failed: identifier=%s, format=%s, error=%s, "
            "error_type=%s"
            % (
                request.identifier,
                request.format,
                str(e),
                type(e).__name__,
            )
        )
        logger.error("Error in get_chart_preview: %s", e)
        return ChartError(
            error=f"Failed to get chart preview: {str(e)}", error_type="InternalError"
        )


@tool(
    tags=["data"],
    class_permission_name="Chart",
    annotations=ToolAnnotations(
        title="Get chart preview",
        readOnlyHint=True,
        destructiveHint=False,
    ),
)
async def get_chart_preview(
    request: GetChartPreviewRequest, ctx: Context
) -> ChartPreview | ChartError:
    """Get chart preview by ID or UUID.

    Returns preview URL or formatted content (ascii, table, vega_lite).
    """
    await ctx.info(
        "Starting chart preview generation: identifier=%s, format=%s, width=%s, "
        "height=%s"
        % (
            request.identifier,
            request.format,
            request.width,
            request.height,
        )
    )
    await ctx.debug(
        "Cache control settings: use_cache=%s, force_refresh=%s, cache_timeout=%s"
        % (
            request.use_cache,
            request.force_refresh,
            request.cache_timeout,
        )
    )

    try:
        result = await _get_chart_preview_internal(request, ctx)

        if isinstance(result, ChartPreview):
            await ctx.info(
                "Chart preview generated successfully: chart_id=%s, format=%s, "
                "has_preview_url=%s"
                % (
                    getattr(result, "chart_id", None),
                    result.format,
                    bool(getattr(result, "preview_url", None)),
                )
            )
        else:
            await ctx.warning(
                "Chart preview generation failed: error_type=%s, error=%s"
                % (result.error_type, result.error)
            )

        return result
    except OAuth2RedirectError as ex:
        await ctx.warning(
            "Chart preview requires OAuth authentication: identifier=%s"
            % request.identifier
        )
        return ChartError(
            error=build_oauth2_redirect_message(ex),
            error_type="OAUTH2_REDIRECT",
        )
    except OAuth2Error:
        await ctx.error(
            "OAuth2 configuration error: identifier=%s" % request.identifier
        )
        return ChartError(
            error=OAUTH2_CONFIG_ERROR_MESSAGE,
            error_type="OAUTH2_REDIRECT_ERROR",
        )
    except (
        SupersetException,
        CommandException,
        SQLAlchemyError,
        KeyError,
        ValueError,
        TypeError,
        AttributeError,
    ) as e:
        await ctx.error(
            "Chart preview generation failed: identifier=%s, error=%s, error_type=%s"
            % (
                request.identifier,
                str(e),
                type(e).__name__,
            )
        )
        return ChartError(
            error=f"Failed to generate chart preview: {str(e)}",
            error_type="InternalError",
        )
