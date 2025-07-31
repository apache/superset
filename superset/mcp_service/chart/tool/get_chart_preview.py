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

from superset.mcp_service.auth import mcp_auth_hook
from superset.mcp_service.mcp_app import mcp
from superset.mcp_service.schemas.chart_schemas import (
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
from superset.mcp_service.url_utils import get_superset_base_url

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


class PreviewFormatStrategy:
    """Base class for preview format strategies."""

    def __init__(self, chart: ChartLike, request: GetChartPreviewRequest) -> None:
        self.chart = chart
        self.request = request

    def generate(self) -> ChartPreview | ChartError:
        """Generate preview in the specific format."""
        raise NotImplementedError


class URLPreviewStrategy(PreviewFormatStrategy):
    """Generate URL-based image preview."""

    def generate(self) -> URLPreview | ChartError:
        try:
            from flask import g

            from superset.mcp_service.pooled_screenshot import PooledChartScreenshot
            from superset.utils.urls import get_url_path

            chart_url = get_url_path("Superset.slice", slice_id=self.chart.id)
            screenshot = PooledChartScreenshot(chart_url, self.chart.digest)

            window_size = (self.request.width or 800, self.request.height or 600)
            image_data = screenshot.get_screenshot(user=g.user, window_size=window_size)

            if image_data:
                # Use the MCP service screenshot URL via centralized helper
                from superset.mcp_service.url_utils import get_chart_screenshot_url

                preview_url = get_chart_screenshot_url(self.chart.id)

                return URLPreview(
                    preview_url=preview_url,
                    width=self.request.width or 800,
                    height=self.request.height or 600,
                )
            else:
                return ChartError(
                    error=f"Could not generate screenshot for chart {self.chart.id}",
                    error_type="ScreenshotError",
                )
        except Exception as e:
            logger.error(f"URL preview generation failed: {e}")
            return ChartError(
                error=f"Failed to generate URL preview: {str(e)}", error_type="URLError"
            )


# Base64 preview support removed - we never return base64 data


class ASCIIPreviewStrategy(PreviewFormatStrategy):
    """Generate ASCII art preview."""

    def generate(self) -> ASCIIPreview | ChartError:
        try:
            from superset.commands.chart.data.get_data_command import ChartDataCommand
            from superset.common.query_context_factory import QueryContextFactory
            from superset.utils import json as utils_json

            form_data = utils_json.loads(self.chart.params) if self.chart.params else {}

            logger.info(f"Chart form_data keys: {list(form_data.keys())}")
            logger.info(f"Chart viz_type: {self.chart.viz_type}")

            # Build query for chart data
            x_axis_config = form_data.get("x_axis")
            groupby_columns = form_data.get("groupby", [])
            metrics = form_data.get("metrics", [])

            columns = groupby_columns.copy()
            if x_axis_config and isinstance(x_axis_config, str):
                columns.append(x_axis_config)
            elif x_axis_config and isinstance(x_axis_config, dict):
                if "column_name" in x_axis_config:
                    columns.append(x_axis_config["column_name"])

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

        except Exception as e:
            logger.error(f"ASCII preview generation failed: {e}")
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

            factory = QueryContextFactory()
            query_context = factory.create(
                datasource={
                    "id": self.chart.datasource_id,
                    "type": self.chart.datasource_type,
                },
                queries=[
                    {
                        "filters": form_data.get("filters", []),
                        "columns": form_data.get("groupby", []),
                        "metrics": form_data.get("metrics", []),
                        "row_limit": 20,
                        "order_desc": True,
                    }
                ],
                form_data=form_data,
                force=False,
            )

            command = ChartDataCommand(query_context)
            result = command.run()

            data = []
            if result and "queries" in result and len(result["queries"]) > 0:
                data = result["queries"][0].get("data", [])

            table_data = _generate_ascii_table(data, 120)

            return TablePreview(
                table_data=table_data,
                row_count=len(data),
            )

        except Exception as e:
            logger.error(f"Table preview generation failed: {e}")
            return ChartError(
                error=f"Failed to generate table preview: {str(e)}",
                error_type="TableError",
            )


class VegaLitePreviewStrategy(PreviewFormatStrategy):
    """Generate Vega-Lite specification for interactive chart preview."""

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
                        "columns": form_data.get("groupby", []),
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

        except Exception as e:
            logger.exception(
                f"Error generating Vega-Lite preview for chart {self.chart.id}"
            )
            return ChartError(
                error=f"Failed to generate Vega-Lite preview: {str(e)}",
                error_type="VegaLiteGenerationError",
            )

    def _create_vega_lite_spec(self, data: List[Any]) -> Dict[str, Any]:  # noqa: C901
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
        logger.info(f"Unknown chart type '{viz_type}', using scatter plot fallback")
        return self._scatter_chart_spec(fields, field_types)

    def _analyze_field_types(
        self, data: List[Any], fields: List[str]
    ) -> Dict[str, str]:  # noqa: C901
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

                except Exception as e:
                    logger.warning(f"Error analyzing field '{field}': {e}")
                    field_types[field] = "nominal"  # Safe default

        except Exception as e:
            logger.warning(f"Error in field type analysis: {e}")
            # Return nominal types for all fields as fallback
            return {field: "nominal" for field in fields}

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


def generate_ascii_chart(
    data: List[Any], chart_type: str, width: int = 80, height: int = 20
) -> str:
    """Generate ASCII art chart from data."""
    if not data or len(data) == 0:
        return "No data available for ASCII chart"

    try:
        logger.info(
            f"generate_ascii_chart: chart_type={chart_type}, data_rows={len(data)}"
        )

        # Generate appropriate ASCII chart based on type
        if chart_type in ["bar", "column", "echarts_timeseries_bar"]:
            logger.info("Generating bar chart")
            return _generate_ascii_bar_chart(data, width, height)
        elif chart_type in ["line", "echarts_timeseries_line"]:
            logger.info("Generating line chart")
            return _generate_ascii_line_chart(data, width, height)
        elif chart_type in ["scatter", "echarts_timeseries_scatter"]:
            logger.info("Generating scatter chart")
            return _generate_ascii_scatter_chart(data, width, height)
        else:
            # Default to table format for unsupported chart types
            logger.info(f"Unsupported chart type '{chart_type}', falling back to table")
            return _generate_ascii_table(data, width)
    except Exception as e:
        logger.error(f"ASCII chart generation failed: {e}")
        import traceback

        logger.error(f"Traceback: {traceback.format_exc()}")
        return f"ASCII chart generation failed: {str(e)}"


def _generate_ascii_bar_chart(data: List[Any], width: int, height: int) -> str:
    """Generate enhanced ASCII bar chart with horizontal and vertical options."""
    if not data:
        return "No data for bar chart"

    # Extract numeric values for bars
    values = []
    labels = []

    for row in data[:12]:  # Increased limit for better charts
        if isinstance(row, dict):
            # Find numeric and string values
            numeric_val = None
            label_val = None

            for _key, val in row.items():
                if isinstance(val, (int, float)) and numeric_val is None:
                    numeric_val = val
                elif isinstance(val, str) and label_val is None:
                    label_val = val

            if numeric_val is not None:
                values.append(numeric_val)
                labels.append(label_val or f"Item {len(values)}")

    if not values:
        return "No numeric data found for bar chart"

    # Decide between horizontal and vertical based on label lengths
    avg_label_length = sum(len(str(label)) for label in labels) / len(labels)
    use_horizontal = avg_label_length > 8 or len(values) > 8

    if use_horizontal:
        return _generate_horizontal_bar_chart(values, labels, width)
    else:
        return _generate_vertical_bar_chart(values, labels, width, height)


def _generate_horizontal_bar_chart(
    values: List[float], labels: List[str], width: int
) -> str:
    """Generate horizontal ASCII bar chart."""
    lines = []
    lines.append("📊 Horizontal Bar Chart")
    lines.append("═" * min(width, 60))

    max_val = max(values) if values else 1
    min_val = min(values) if values else 0
    max_bar_width = min(40, width - 20)  # Leave space for labels and values

    # Add scale indicator
    lines.append(f"Scale: {min_val:.1f} ────────────── {max_val:.1f}")
    lines.append("")

    for label, value in zip(labels, values, strict=False):
        # Calculate bar length
        if max_val > min_val:
            normalized = (value - min_val) / (max_val - min_val)
            bar_length = max(1, int(normalized * max_bar_width))
        else:
            bar_length = 1

        # Create bar with gradient effect
        bar = _create_gradient_bar(bar_length, value, max_val)

        # Format value
        if abs(value) >= 1000000:
            value_str = f"{value / 1000000:.1f}M"
        elif abs(value) >= 1000:
            value_str = f"{value / 1000:.1f}K"
        else:
            value_str = f"{value:.1f}"

        # Truncate label if too long
        display_label = label[:15] if len(label) > 15 else label
        lines.append(f"{display_label:>15} ▐{bar:<{max_bar_width}} {value_str}")

    return "\n".join(lines)


def _generate_vertical_bar_chart(  # noqa: C901
    values: List[float], labels: List[str], width: int, height: int
) -> str:
    """Generate vertical ASCII bar chart."""
    lines = []
    lines.append("📊 Vertical Bar Chart")
    lines.append("═" * min(width, 60))

    max_val = max(values) if values else 1
    min_val = min(values) if values else 0
    chart_height = min(15, height - 8)  # Leave space for title and labels

    # Create the chart grid
    grid = []
    for _ in range(chart_height):
        grid.append([" "] * len(values))

    # Fill the bars
    for col, value in enumerate(values):
        if max_val > min_val:
            normalized = (value - min_val) / (max_val - min_val)
            bar_height = max(1, int(normalized * chart_height))
        else:
            bar_height = 1

        # Fill from bottom up
        for row_idx in range(chart_height - bar_height, chart_height):
            if row_idx < len(grid):
                # Use different characters for height effect
                if row_idx == chart_height - bar_height:
                    grid[row_idx][col] = "▀"  # Top of bar
                elif row_idx == chart_height - 1:
                    grid[row_idx][col] = "█"  # Bottom of bar
                else:
                    grid[row_idx][col] = "█"  # Middle of bar

    # Add Y-axis scale
    for i, row_data in enumerate(grid):
        y_val = (
            max_val - (i / (chart_height - 1)) * (max_val - min_val)
            if chart_height > 1
            else max_val
        )
        if abs(y_val) >= 1000:
            y_label = f"{y_val:.0f}"
        else:
            y_label = f"{y_val:.1f}"
        lines.append(f"{y_label:>6} ┤ " + "".join(f"{cell:^3}" for cell in row_data))

    # Add X-axis
    lines.append("       └" + "───" * len(values))

    # Add labels
    label_line = "        "
    for label in labels:
        short_label = label[:3] if len(label) > 3 else label
        label_line += f"{short_label:^3}"
    lines.append(label_line)

    return "\n".join(lines)


def _create_gradient_bar(length: int, value: float, max_val: float) -> str:
    """Create a gradient bar with visual effects."""
    if length <= 0:
        return ""

    # Create gradient effect based on value intensity
    intensity = value / max_val if max_val > 0 else 0

    if intensity > 0.8:
        # High values - solid bars
        return "█" * length
    elif intensity > 0.6:
        # Medium-high values - mostly solid with some texture
        return "█" * (length - 1) + "▉" if length > 1 else "█"
    elif intensity > 0.4:
        # Medium values - mixed texture
        return "▊" * length
    elif intensity > 0.2:
        # Low-medium values - lighter texture
        return "▋" * length
    else:
        # Low values - lightest texture
        return "▌" * length


def _generate_ascii_line_chart(data: List[Any], width: int, height: int) -> str:
    """Generate enhanced ASCII line chart with trend analysis."""
    if not data:
        return "No data for line chart"

    lines = []
    lines.append("📈 Line Chart with Trend Analysis")
    lines.append("═" * min(width, 60))

    # Extract values and labels for plotting
    values, labels = _extract_time_series_data(data)

    if not values:
        return "No numeric data found for line chart"

    # Generate enhanced line chart
    if len(values) >= 3:
        lines.extend(_create_enhanced_line_chart(values, labels, width, height))
    else:
        # Fallback to sparkline for small datasets
        sparkline_data = _create_sparkline(values)
        lines.extend(sparkline_data)

    # Add trend analysis
    trend_analysis = _analyze_trend(values)
    lines.append("")
    lines.append("📊 Trend Analysis:")
    lines.extend(trend_analysis)

    return "\n".join(lines)


def _extract_time_series_data(data: List[Any]) -> tuple[List[float], List[str]]:
    """Extract time series data with labels."""
    values = []
    labels = []

    for row in data[:20]:  # Limit points for readability
        if isinstance(row, dict):
            # Find the first numeric value and first string/date value
            numeric_val = None
            label_val = None

            for key, val in row.items():
                if isinstance(val, (int, float)) and numeric_val is None:
                    numeric_val = val
                elif isinstance(val, str) and label_val is None:
                    # Use the key name if it looks like a date/time field
                    if any(
                        date_word in key.lower()
                        for date_word in ["date", "time", "month", "day", "year"]
                    ):
                        label_val = str(val)[:10]  # Truncate long dates
                    else:
                        label_val = str(val)[:8]  # Truncate long strings

            if numeric_val is not None:
                values.append(numeric_val)
                labels.append(label_val or f"P{len(values)}")

    return values, labels


def _create_enhanced_line_chart(
    values: List[float], labels: List[str], width: int, height: int
) -> List[str]:
    """Create an enhanced ASCII line chart with better visualization."""
    lines = []
    chart_width = min(50, width - 15)
    chart_height = min(12, height - 8)

    if len(values) < 2:
        return ["Insufficient data for line chart"]

    # Normalize values to chart height
    min_val = min(values)
    max_val = max(values)
    val_range = max_val - min_val if max_val != min_val else 1

    # Create chart grid
    grid = [[" " for _ in range(chart_width)] for _ in range(chart_height)]

    # Plot the line with connecting segments
    prev_x, prev_y = None, None

    for i, value in enumerate(values):
        # Map to grid coordinates
        x = int((i / (len(values) - 1)) * (chart_width - 1)) if len(values) > 1 else 0
        y = chart_height - 1 - int(((value - min_val) / val_range) * (chart_height - 1))

        # Ensure coordinates are within bounds
        x = max(0, min(x, chart_width - 1))
        y = max(0, min(y, chart_height - 1))

        # Mark the point
        grid[y][x] = "●"

        # Draw line segment to previous point
        if prev_x is not None and prev_y is not None:
            _draw_line_segment(grid, prev_x, prev_y, x, y, chart_width, chart_height)

        prev_x, prev_y = x, y

    # Render the chart with Y-axis labels
    for i, row in enumerate(grid):
        y_val = (
            max_val - (i / (chart_height - 1)) * val_range
            if chart_height > 1
            else max_val
        )
        if abs(y_val) >= 1000:
            y_label = f"{y_val:.0f}"
        else:
            y_label = f"{y_val:.1f}"
        lines.append(f"{y_label:>8} ┤ " + "".join(row))

    # Add X-axis
    lines.append("         └" + "─" * chart_width)

    # Add selected X-axis labels (show every few labels to avoid crowding)
    label_line = "          "
    step = max(1, len(labels) // 6)  # Show max 6 labels
    for i in range(0, len(labels), step):
        pos = int((i / (len(values) - 1)) * (chart_width - 1)) if len(values) > 1 else 0
        # Add spacing to position the label
        while len(label_line) - 10 < pos:
            label_line += " "
        label_line += labels[i][:8]

    lines.append(label_line)

    return lines


def _draw_line_segment(
    grid: List[List[str]], x1: int, y1: int, x2: int, y2: int, width: int, height: int
) -> None:
    """Draw a line segment between two points using Bresenham-like algorithm."""
    # Simple line drawing - connect points with line characters
    if x1 == x2:  # Vertical line
        start_y, end_y = sorted([y1, y2])
        for y in range(start_y + 1, end_y):
            if 0 <= y < height and 0 <= x1 < width:
                grid[y][x1] = "│"
    elif y1 == y2:  # Horizontal line
        start_x, end_x = sorted([x1, x2])
        for x in range(start_x + 1, end_x):
            if 0 <= y1 < height and 0 <= x < width:
                grid[y1][x] = "─"
    else:  # Diagonal line - use simple interpolation
        steps = max(abs(x2 - x1), abs(y2 - y1))
        for step in range(1, steps):
            x = x1 + int((x2 - x1) * step / steps)
            y = y1 + int((y2 - y1) * step / steps)
            if 0 <= x < width and 0 <= y < height:
                if abs(x2 - x1) > abs(y2 - y1):
                    grid[y][x] = "─"
                else:
                    grid[y][x] = "│"


def _analyze_trend(values: List[float]) -> List[str]:
    """Analyze trend in the data."""
    if len(values) < 2:
        return ["• Insufficient data for trend analysis"]

    analysis = []

    # Calculate basic statistics
    first_val = values[0]
    last_val = values[-1]
    min_val = min(values)
    max_val = max(values)
    avg_val = sum(values) / len(values)

    # Overall trend
    if last_val > first_val * 1.1:
        trend_icon = "📈"
        trend_desc = "Strong upward trend"
    elif last_val > first_val * 1.05:
        trend_icon = "📊"
        trend_desc = "Moderate upward trend"
    elif last_val < first_val * 0.9:
        trend_icon = "📉"
        trend_desc = "Strong downward trend"
    elif last_val < first_val * 0.95:
        trend_icon = "📊"
        trend_desc = "Moderate downward trend"
    else:
        trend_icon = "➡️"
        trend_desc = "Relatively stable"

    analysis.append(f"• {trend_icon} {trend_desc}")
    analysis.append(f"• Range: {min_val:.1f} to {max_val:.1f} (avg: {avg_val:.1f})")

    # Volatility
    if len(values) >= 3:
        changes = [abs(values[i] - values[i - 1]) for i in range(1, len(values))]
        avg_change = sum(changes) / len(changes)
        volatility = "High" if avg_change > (max_val - min_val) * 0.1 else "Low"
        analysis.append(f"• Volatility: {volatility}")

    return analysis


def _extract_numeric_values(data: List[Any]) -> List[float]:
    """Extract numeric values from data for line chart."""
    values = []
    for row in data[:20]:  # Limit points
        if isinstance(row, dict):
            for _key, val in row.items():
                if isinstance(val, (int, float)):
                    values.append(val)
                    break
    return values


def _create_sparkline(values: List[float]) -> List[str]:
    """Create sparkline visualization from values."""
    if len(values) <= 1:
        return []

    max_val = max(values)
    min_val = min(values)
    range_val = max_val - min_val if max_val != min_val else 1

    sparkline = ""
    for val in values:
        normalized = (val - min_val) / range_val
        if normalized < 0.2:
            sparkline += "▁"
        elif normalized < 0.4:
            sparkline += "▂"
        elif normalized < 0.6:
            sparkline += "▄"
        elif normalized < 0.8:
            sparkline += "▆"
        else:
            sparkline += "█"

    # Safe formatting to avoid NaN display
    if _is_nan_value(min_val) or _is_nan_value(max_val):
        return ["Range: Unable to calculate from data", sparkline]
    else:
        return [f"Range: {min_val:.2f} to {max_val:.2f}", sparkline]


def _is_nan_value(value: Any) -> bool:
    """Check if a value is NaN or invalid."""
    try:
        import math

        return math.isnan(float(value))
    except (ValueError, TypeError):
        return True


def _generate_ascii_scatter_chart(data: List[Any], width: int, height: int) -> str:
    """Generate ASCII scatter plot."""
    if not data:
        return "No data for scatter chart"

    lines = []
    lines.append("ASCII Scatter Plot")
    lines.append("=" * min(width, 50))

    # Extract data points
    x_values, y_values, x_column, y_column = _extract_scatter_data(data)

    # Debug info
    lines.extend(_create_debug_info(x_values, y_values, x_column, y_column, data))

    # Check if we have enough data
    if len(x_values) < 2:
        return _generate_ascii_table(data, width)

    # Add axis info
    lines.extend(_create_axis_info(x_values, y_values, x_column, y_column))

    # Create and render grid
    grid = _create_scatter_grid(x_values, y_values, width, height)
    lines.extend(_render_scatter_grid(grid, x_values, y_values, width, height))

    return "\n".join(lines)


def _extract_scatter_data(
    data: List[Any],
) -> tuple[List[float], List[float], str | None, str | None]:
    """Extract X,Y data from scatter chart data."""
    x_values = []
    y_values = []
    x_column = None
    y_column = None
    numeric_columns = []

    if data and isinstance(data[0], dict):
        # Find the first two numeric columns
        for key, val in data[0].items():
            if isinstance(val, (int, float)) and not (
                isinstance(val, float) and (val != val)
            ):  # Exclude NaN
                numeric_columns.append(key)

        if len(numeric_columns) >= 2:
            x_column = numeric_columns[0]
            y_column = numeric_columns[1]

            # Extract X,Y pairs
            for row in data[:50]:  # Limit for ASCII display
                if isinstance(row, dict):
                    x_val = row.get(x_column)
                    y_val = row.get(y_column)
                    # Check for valid numbers (not NaN)
                    if (
                        isinstance(x_val, (int, float))
                        and isinstance(y_val, (int, float))
                        and not (
                            isinstance(x_val, float) and (x_val != x_val)
                        )  # Not NaN
                        and not (isinstance(y_val, float) and (y_val != y_val))
                    ):  # Not NaN
                        x_values.append(x_val)
                        y_values.append(y_val)

    return x_values, y_values, x_column, y_column


def _create_debug_info(
    x_values: List[float],
    y_values: List[float],
    x_column: str | None,
    y_column: str | None,
    data: List[Any],
) -> List[str]:
    """Create debug information lines for scatter chart."""
    numeric_columns = []
    if data and isinstance(data[0], dict):
        for key, val in data[0].items():
            if isinstance(val, (int, float)) and not (
                isinstance(val, float) and (val != val)
            ):
                numeric_columns.append(key)

    return [
        f"DEBUG: Found {len(numeric_columns)} numeric columns: {numeric_columns}",
        f"DEBUG: X column: {x_column}, Y column: {y_column}",
        f"DEBUG: Valid X,Y pairs: {len(x_values)}",
    ]


def _create_axis_info(
    x_values: List[float],
    y_values: List[float],
    x_column: str | None,
    y_column: str | None,
) -> List[str]:
    """Create axis information lines."""
    return [
        f"X-axis: {x_column} (range: {min(x_values):.2f} to {max(x_values):.2f})",
        f"Y-axis: {y_column} (range: {min(y_values):.2f} to {max(y_values):.2f})",
        f"Showing {len(x_values)} data points",
        "",
    ]


def _create_scatter_grid(
    x_values: List[float], y_values: List[float], width: int, height: int
) -> List[List[str]]:
    """Create and populate the scatter plot grid."""
    plot_width = min(40, width - 10)
    plot_height = min(15, height - 8)

    # Normalize values to fit in grid
    x_min, x_max = min(x_values), max(x_values)
    y_min, y_max = min(y_values), max(y_values)
    x_range = x_max - x_min if x_max != x_min else 1
    y_range = y_max - y_min if y_max != y_min else 1

    # Create grid
    grid = [[" " for _ in range(plot_width)] for _ in range(plot_height)]

    # Plot points
    for x, y in zip(x_values, y_values, strict=False):
        try:
            grid_x = int(((x - x_min) / x_range) * (plot_width - 1))
            grid_y = int(((y - y_min) / y_range) * (plot_height - 1))
            grid_y = plot_height - 1 - grid_y  # Flip Y axis for display

            if 0 <= grid_x < plot_width and 0 <= grid_y < plot_height:
                if grid[grid_y][grid_x] == " ":
                    grid[grid_y][grid_x] = "•"
                else:
                    grid[grid_y][grid_x] = "█"  # Multiple points
        except (ValueError, OverflowError):
            # Skip points that can't be converted to integers (NaN, inf, etc.)
            continue

    return grid


def _render_scatter_grid(
    grid: List[List[str]],
    x_values: List[float],
    y_values: List[float],
    width: int,
    height: int,
) -> List[str]:
    """Render the scatter plot grid with axes and labels."""
    lines = []
    plot_width = min(40, width - 10)
    plot_height = min(15, height - 8)

    x_min, x_max = min(x_values), max(x_values)
    y_min, y_max = min(y_values), max(y_values)
    y_range = y_max - y_min if y_max != y_min else 1

    # Add Y-axis labels and plot
    for i, row in enumerate(grid):
        y_val = y_max - (i / (plot_height - 1)) * y_range if plot_height > 1 else y_max
        y_label = f"{y_val:.1f}" if abs(y_val) < 1000 else f"{y_val:.0f}"
        lines.append(f"{y_label:>6} |{''.join(row)}")

    # Add X-axis
    x_axis_line = " " * 7 + "+" + "-" * plot_width
    lines.append(x_axis_line)

    # Add X-axis labels
    x_left_label = f"{x_min:.1f}" if abs(x_min) < 1000 else f"{x_min:.0f}"
    x_right_label = f"{x_max:.1f}" if abs(x_max) < 1000 else f"{x_max:.0f}"
    x_labels = (
        " " * 8
        + x_left_label
        + " " * (plot_width - len(x_left_label) - len(x_right_label))
        + x_right_label
    )
    lines.append(x_labels)

    return lines


def _generate_ascii_table(data: List[Any], width: int) -> str:
    """Generate enhanced ASCII table with better formatting."""
    if not data:
        return "No data for table"

    lines = []
    lines.append("📋 Data Table")
    lines.append("═" * min(width, 70))

    # Get column headers from first row
    if isinstance(data[0], dict):
        # Select best columns to display
        all_headers = list(data[0].keys())
        headers = _select_display_columns(all_headers, data, max_cols=6)

        # Calculate optimal column widths
        col_widths = _calculate_column_widths(headers, data, width)

        # Create enhanced header
        lines.append(_create_table_header(headers, col_widths))
        lines.append(_create_table_separator(col_widths))

        # Add data rows with better formatting
        row_count = min(15, len(data))  # Show more rows
        for i, row in enumerate(data[:row_count]):
            formatted_row = _format_table_row(row, headers, col_widths)
            lines.append(formatted_row)

            # Add separator every 5 rows for readability
            if i > 0 and (i + 1) % 5 == 0 and i < row_count - 1:
                lines.append(_create_light_separator(col_widths))

        # Add footer with stats
        lines.append(_create_table_separator(col_widths))
        lines.append(f"📊 Showing {row_count} of {len(data)} rows")

        # Add column summaries for numeric columns
        numeric_summaries = _create_numeric_summaries(data, headers)
        if numeric_summaries:
            lines.append("")
            lines.append("📈 Numeric Summaries:")
            lines.extend(numeric_summaries)

    return "\n".join(lines)


def _select_display_columns(
    all_headers: List[str], data: List[Any], max_cols: int = 6
) -> List[str]:
    """Select the most interesting columns to display."""
    if len(all_headers) <= max_cols:
        return all_headers

    # Prioritize columns by interest level
    priority_scores = {}

    for header in all_headers:
        score = 0
        header_lower = header.lower()

        # Higher priority for common business fields
        if any(word in header_lower for word in ["name", "title", "id"]):
            score += 10
        if any(
            word in header_lower
            for word in ["amount", "price", "cost", "revenue", "sales"]
        ):
            score += 8
        if any(word in header_lower for word in ["date", "time", "created", "updated"]):
            score += 6
        if any(word in header_lower for word in ["count", "total", "sum", "avg"]):
            score += 5

        # Check data variety (more variety = more interesting)
        sample_values = [
            str(row.get(header, "")) for row in data[:10] if isinstance(row, dict)
        ]
        unique_values = len(set(sample_values))
        if unique_values > 1:
            score += min(unique_values, 5)

        priority_scores[header] = score

    # Return top scoring columns
    sorted_headers = sorted(
        all_headers, key=lambda h: priority_scores.get(h, 0), reverse=True
    )
    return sorted_headers[:max_cols]


def _calculate_column_widths(
    headers: List[str], data: List[Any], total_width: int
) -> List[int]:
    """Calculate optimal column widths based on content."""
    if not headers:
        return []

    # Start with minimum widths based on header lengths
    min_widths = [max(8, min(len(h) + 2, 15)) for h in headers]

    # Check actual data to adjust widths
    for row in data[:10]:  # Sample first 10 rows
        if isinstance(row, dict):
            for i, header in enumerate(headers):
                val = row.get(header, "")
                if isinstance(val, float):
                    content_len = len(f"{val:.2f}")
                elif isinstance(val, int):
                    content_len = len(str(val))
                else:
                    content_len = len(str(val))

                min_widths[i] = max(min_widths[i], min(content_len + 1, 20))

    # Distribute remaining space proportionally
    used_width = sum(min_widths) + len(headers) * 3  # Account for separators
    available_width = min(total_width - 10, 80)  # Leave margins

    if used_width < available_width:
        # Distribute extra space
        extra_space = available_width - used_width
        for i in range(len(min_widths)):
            min_widths[i] += extra_space // len(min_widths)

    return min_widths


def _create_table_header(headers: List[str], widths: List[int]) -> str:
    """Create formatted table header."""
    formatted_headers = []
    for header, width in zip(headers, widths, strict=False):
        # Truncate and center header
        display_header = header[: width - 2] if len(header) > width - 2 else header
        formatted_headers.append(f"{display_header:^{width}}")

    return (
        "┌"
        + "┬".join("─" * w for w in widths)
        + "┐\n│"
        + "│".join(formatted_headers)
        + "│"
    )


def _create_table_separator(widths: List[int]) -> str:
    """Create table separator line."""
    return "├" + "┼".join("─" * w for w in widths) + "┤"


def _create_light_separator(widths: List[int]) -> str:
    """Create light separator line."""
    return "├" + "┼".join("┈" * w for w in widths) + "┤"


def _format_table_row(
    row: Dict[str, Any], headers: List[str], widths: List[int]
) -> str:
    """Format a single table row."""
    formatted_values = []

    for header, width in zip(headers, widths, strict=False):
        val = row.get(header, "")

        # Format value based on type
        if isinstance(val, float):
            if abs(val) >= 1000000:
                formatted_val = f"{val / 1000000:.1f}M"
            elif abs(val) >= 1000:
                formatted_val = f"{val / 1000:.1f}K"
            else:
                formatted_val = f"{val:.2f}"
        elif isinstance(val, int):
            if abs(val) >= 1000000:
                formatted_val = f"{val // 1000000}M"
            elif abs(val) >= 1000:
                formatted_val = f"{val // 1000}K"
            else:
                formatted_val = str(val)
        else:
            formatted_val = str(val)

        # Truncate if too long
        if len(formatted_val) > width - 2:
            formatted_val = formatted_val[: width - 5] + "..."

        # Align numbers right, text left
        if isinstance(val, (int, float)):
            formatted_values.append(f"{formatted_val:>{width - 2}}")
        else:
            formatted_values.append(f"{formatted_val:<{width - 2}}")

    return "│ " + " │ ".join(formatted_values) + " │"


def _create_numeric_summaries(data: List[Any], headers: List[str]) -> List[str]:
    """Create summaries for numeric columns."""
    summaries = []

    for header in headers:
        # Collect numeric values
        values = []
        for row in data:
            if isinstance(row, dict):
                val = row.get(header)
                if isinstance(val, (int, float)):
                    values.append(val)

        if len(values) >= 2:
            min_val = min(values)
            max_val = max(values)
            avg_val = sum(values) / len(values)

            if abs(avg_val) >= 1000:
                avg_str = f"{avg_val / 1000:.1f}K"
            else:
                avg_str = f"{avg_val:.1f}"

            summaries.append(
                f"  {header}: avg={avg_str}, range={min_val:.1f}-{max_val:.1f}"
            )

    return summaries


def _get_chart_preview_internal(
    request: GetChartPreviewRequest,
) -> ChartPreview | ChartError:
    """
    Get a visual preview of a chart with URLs for LLM embedding.

    This tool generates or retrieves URLs for chart images that can be
    displayed directly in LLM clients. The URLs point to Superset's
    screenshot endpoints for proper image serving.

    Supports lookup by:
    - Numeric ID (e.g., 123)
    - UUID string (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

    Returns a ChartPreview with Superset URLs for the chart image or
    ChartError on error.
    """
    try:
        from superset.daos.chart import ChartDAO

        # Find the chart
        chart = None
        if isinstance(request.identifier, int) or (
            isinstance(request.identifier, str) and request.identifier.isdigit()
        ):
            chart_id = (
                int(request.identifier)
                if isinstance(request.identifier, str)
                else request.identifier
            )
            chart = ChartDAO.find_by_id(chart_id)
        else:
            # Try UUID lookup using DAO flexible method
            chart = ChartDAO.find_by_id(request.identifier, id_column="uuid")

        if not chart:
            return ChartError(
                error=f"No chart found with identifier: {request.identifier}",
                error_type="NotFound",
            )

        logger.info(
            f"Generating preview for chart {chart.id} in {request.format} format: "
            f"{chart.slice_name}"
        )

        import time

        start_time = time.time()

        # Handle different preview formats using strategy pattern
        preview_generator = PreviewFormatGenerator(chart, request)
        content = preview_generator.generate()

        if isinstance(content, ChartError):
            return content

        # Create performance and accessibility metadata
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
        if isinstance(content, URLPreview):
            result.format = "url"
            result.preview_url = content.preview_url
            result.width = content.width
            result.height = content.height
        elif isinstance(content, ASCIIPreview):
            result.format = "ascii"
            result.ascii_chart = content.ascii_content
            result.width = content.width
            result.height = content.height
        elif isinstance(content, TablePreview):
            result.format = "table"
            result.table_data = content.table_data
        # Base64 preview support removed

        return result

    except Exception as e:
        logger.error(f"Error in get_chart_preview: {e}")
        return ChartError(
            error=f"Failed to get chart preview: {str(e)}", error_type="InternalError"
        )


@mcp.tool
@mcp_auth_hook
def get_chart_preview(request: GetChartPreviewRequest) -> ChartPreview | ChartError:
    """
    Get a visual preview of a chart with URLs for LLM embedding.

    This tool generates or retrieves URLs for chart images that can be
    displayed directly in LLM clients. The URLs point to Superset's
    screenshot endpoints for proper image serving.

    IMPORTANT FOR LLM CLIENTS:
    - ALWAYS display the preview_url when format="url"
    - Embed URL previews as images: ![Chart Preview](preview_url)
    - For ASCII/table formats, display the content in a code block
    - Show the explore_url so users can edit the chart

    Supports lookup by:
    - Numeric ID (e.g., 123)
    - UUID string (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")

    Supported formats:
    - "url": Returns preview_url for image embedding
    - "ascii": Returns ASCII art representation
    - "table": Returns tabular data preview

    Returns a ChartPreview with Superset URLs for the chart image or
    ChartError on error.
    """
    return _get_chart_preview_internal(request)
