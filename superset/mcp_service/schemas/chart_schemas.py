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
Pydantic schemas for chart-related responses
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional, Protocol

from pydantic import BaseModel, ConfigDict, Field, model_validator, PositiveInt

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.schemas.cache_schemas import (
    CacheStatus,
    FormDataCacheControl,
    MetadataCacheControl,
    QueryCacheControl,
)
from superset.mcp_service.schemas.system_schemas import (
    PaginationInfo,
    TagInfo,
    UserInfo,
)


class ChartLike(Protocol):
    """Protocol for chart-like objects with expected attributes."""

    id: int
    slice_name: Optional[str]
    viz_type: Optional[str]
    datasource_name: Optional[str]
    datasource_type: Optional[str]
    url: Optional[str]
    description: Optional[str]
    cache_timeout: Optional[int]
    form_data: Optional[Dict[str, Any]]
    query_context: Optional[Any]
    changed_by: Optional[Any]  # User object
    changed_by_name: Optional[str]
    changed_on: Optional[str | datetime]
    changed_on_humanized: Optional[str]
    created_by: Optional[Any]  # User object
    created_by_name: Optional[str]
    created_on: Optional[str | datetime]
    created_on_humanized: Optional[str]
    uuid: Optional[str]
    tags: Optional[List[Any]]
    owners: Optional[List[Any]]


class ChartInfo(BaseModel):
    """Full chart model with all possible attributes."""

    id: int = Field(..., description="Chart ID")
    slice_name: str = Field(..., description="Chart name")
    viz_type: Optional[str] = Field(None, description="Visualization type")
    datasource_name: Optional[str] = Field(None, description="Datasource name")
    datasource_type: Optional[str] = Field(None, description="Datasource type")
    url: Optional[str] = Field(None, description="Chart URL")
    description: Optional[str] = Field(None, description="Chart description")
    cache_timeout: Optional[int] = Field(None, description="Cache timeout")
    form_data: Optional[Dict[str, Any]] = Field(None, description="Chart form data")
    query_context: Optional[Any] = Field(None, description="Query context")
    changed_by: Optional[str] = Field(None, description="Last modifier (username)")
    changed_by_name: Optional[str] = Field(
        None, description="Last modifier (display name)"
    )
    changed_on: Optional[str | datetime] = Field(
        None, description="Last modification timestamp"
    )
    changed_on_humanized: Optional[str] = Field(
        None, description="Humanized modification time"
    )
    created_by: Optional[str] = Field(None, description="Chart creator (username)")
    created_on: Optional[str | datetime] = Field(None, description="Creation timestamp")
    created_on_humanized: Optional[str] = Field(
        None, description="Humanized creation time"
    )
    uuid: Optional[str] = Field(None, description="Chart UUID")
    tags: List[TagInfo] = Field(default_factory=list, description="Chart tags")
    owners: List[UserInfo] = Field(default_factory=list, description="Chart owners")
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")


class GetChartAvailableFiltersRequest(BaseModel):
    """
    Request schema for get_chart_available_filters tool.

    Currently has no parameters but provides consistent API for future extensibility.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )


class ChartAvailableFiltersResponse(BaseModel):
    column_operators: Dict[str, Any] = Field(
        ..., description="Available filter operators and metadata for each column"
    )


class ChartError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: Optional[str | datetime] = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create(cls, error: str, error_type: str) -> "ChartError":
        """Create a standardized ChartError with timestamp."""
        from datetime import datetime

        return cls(error=error, error_type=error_type, timestamp=datetime.now())


class ChartCapabilities(BaseModel):
    """Describes what the chart can do for LLM understanding."""

    supports_interaction: bool = Field(description="Chart supports user interaction")
    supports_real_time: bool = Field(description="Chart supports live data updates")
    supports_drill_down: bool = Field(
        description="Chart supports drill-down navigation"
    )
    supports_export: bool = Field(description="Chart can be exported to other formats")
    optimal_formats: List[str] = Field(description="Recommended preview formats")
    data_types: List[str] = Field(
        description="Types of data shown (time_series, categorical, etc)"
    )


class ChartSemantics(BaseModel):
    """Semantic information for LLM reasoning."""

    primary_insight: str = Field(
        description="Main insight or pattern the chart reveals"
    )
    data_story: str = Field(description="Narrative description of what the data shows")
    recommended_actions: List[str] = Field(
        description="Suggested next steps based on data"
    )
    anomalies: List[str] = Field(description="Notable outliers or unusual patterns")
    statistical_summary: Dict[str, Any] = Field(
        description="Key statistics (mean, median, trends)"
    )


class PerformanceMetadata(BaseModel):
    """Performance information for LLM cost understanding."""

    query_duration_ms: int = Field(description="Query execution time")
    estimated_cost: Optional[str] = Field(None, description="Resource cost estimate")
    cache_status: str = Field(description="Cache hit/miss status")
    optimization_suggestions: List[str] = Field(
        default_factory=list, description="Performance improvement tips"
    )


class AccessibilityMetadata(BaseModel):
    """Accessibility information for inclusive visualization."""

    color_blind_safe: bool = Field(description="Uses colorblind-safe palette")
    alt_text: str = Field(description="Screen reader description")
    high_contrast_available: bool = Field(description="High contrast version available")


class VersionedResponse(BaseModel):
    """Base class for versioned API responses."""

    schema_version: str = Field("2.0", description="Response schema version")
    api_version: str = Field("v1", description="MCP API version")


class GetChartInfoRequest(BaseModel):
    """Request schema for get_chart_info with support for ID or UUID."""

    identifier: Annotated[
        int | str,
        Field(description="Chart identifier - can be numeric ID or UUID string"),
    ]


def serialize_chart_object(chart: ChartLike | None) -> ChartInfo | None:
    if not chart:
        return None

    # Generate MCP service screenshot URL instead of chart's native URL
    from superset.mcp_service.url_utils import get_chart_screenshot_url

    chart_id = getattr(chart, "id", None)
    screenshot_url = None
    if chart_id:
        screenshot_url = get_chart_screenshot_url(chart_id)

    return ChartInfo(
        id=chart_id,
        slice_name=getattr(chart, "slice_name", None),
        viz_type=getattr(chart, "viz_type", None),
        datasource_name=getattr(chart, "datasource_name", None),
        datasource_type=getattr(chart, "datasource_type", None),
        url=screenshot_url,
        description=getattr(chart, "description", None),
        cache_timeout=getattr(chart, "cache_timeout", None),
        form_data=getattr(chart, "form_data", None),
        query_context=getattr(chart, "query_context", None),
        changed_by=getattr(chart, "changed_by_name", None)
        or (str(chart.changed_by) if getattr(chart, "changed_by", None) else None),
        changed_by_name=getattr(chart, "changed_by_name", None),
        changed_on=getattr(chart, "changed_on", None),
        changed_on_humanized=getattr(chart, "changed_on_humanized", None),
        created_by=getattr(chart, "created_by_name", None)
        or (str(chart.created_by) if getattr(chart, "created_by", None) else None),
        created_on=getattr(chart, "created_on", None),
        created_on_humanized=getattr(chart, "created_on_humanized", None),
        uuid=str(getattr(chart, "uuid", "")) if getattr(chart, "uuid", None) else None,
        tags=[
            TagInfo.model_validate(tag, from_attributes=True)
            for tag in getattr(chart, "tags", [])
        ]
        if getattr(chart, "tags", None)
        else [],
        owners=[
            UserInfo.model_validate(owner, from_attributes=True)
            for owner in getattr(chart, "owners", [])
        ]
        if getattr(chart, "owners", None)
        else [],
    )


class GenerateChartResponse(BaseModel):
    """Comprehensive chart creation response with rich metadata."""

    # Core chart information
    chart: Optional[ChartInfo] = Field(None, description="Complete chart metadata")

    # Multiple preview formats available
    previews: Dict[str, ChartPreviewContent] = Field(
        default_factory=dict,
        description="Available preview formats keyed by format type",
    )

    # LLM-friendly capabilities
    capabilities: Optional[ChartCapabilities] = Field(
        None, description="Chart interaction capabilities"
    )
    semantics: Optional[ChartSemantics] = Field(
        None, description="Semantic chart understanding"
    )

    # Navigation and context
    explore_url: Optional[str] = Field(None, description="Edit chart in Superset")
    embed_code: Optional[str] = Field(None, description="HTML embed snippet")
    api_endpoints: Dict[str, str] = Field(
        default_factory=dict, description="Related API endpoints for data/updates"
    )

    # Performance and accessibility
    performance: Optional[PerformanceMetadata] = Field(
        None, description="Performance metrics"
    )
    accessibility: Optional[AccessibilityMetadata] = Field(
        None, description="Accessibility info"
    )

    # Success/error handling
    success: bool = Field(True, description="Whether chart creation succeeded")
    error: Optional[ChartError] = Field(
        None, description="Error details if creation failed"
    )
    warnings: List[str] = Field(default_factory=list, description="Non-fatal warnings")

    # Inherit versioning
    schema_version: str = Field("2.0", description="Response schema version")
    api_version: str = Field("v1", description="MCP API version")


class ChartFilter(ColumnOperator):
    """
    Filter object for chart listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal[
        "slice_name",
        "viz_type",
        "datasource_name",
    ] = Field(
        ...,
        description="Column to filter on. See get_chart_available_filters for "
        "allowed values.",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. See get_chart_available_filters for "
        "allowed values.",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class ChartList(BaseModel):
    charts: List[ChartInfo]
    count: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_previous: bool
    has_next: bool
    columns_requested: Optional[List[str]] = None
    columns_loaded: Optional[List[str]] = None
    filters_applied: List[ChartFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: Optional[PaginationInfo] = None
    timestamp: Optional[datetime] = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


# --- Simplified schemas for generate_chart tool ---


# Common pieces
class ColumnRef(BaseModel):
    name: str = Field(..., description="Column name")
    label: Optional[str] = Field(None, description="Display label for the column")
    dtype: Optional[str] = Field(None, description="Data type hint")
    aggregate: Optional[str] = Field(
        None, description="SQL aggregation function (SUM, COUNT, AVG, MIN, MAX, etc.)"
    )


class AxisConfig(BaseModel):
    title: Optional[str] = Field(None, description="Axis title")
    scale: Optional[Literal["linear", "log"]] = Field(
        "linear", description="Axis scale type"
    )
    format: Optional[str] = Field(None, description="Format string (e.g. '$,.2f')")


class LegendConfig(BaseModel):
    show: bool = Field(True, description="Whether to show legend")
    position: Optional[Literal["top", "bottom", "left", "right"]] = Field(
        "right", description="Legend position"
    )


class FilterConfig(BaseModel):
    column: str = Field(..., description="Column to filter on")
    op: Literal["=", ">", "<", ">=", "<=", "!="] = Field(
        ..., description="Filter operator"
    )
    value: str | int | float | bool = Field(..., description="Filter value")


# Actual chart types
class TableChartConfig(BaseModel):
    chart_type: Literal["table"] = Field("table", description="Chart type")
    columns: List[ColumnRef] = Field(..., description="Columns to display")
    filters: Optional[List[FilterConfig]] = Field(None, description="Filters to apply")
    sort_by: Optional[List[str]] = Field(None, description="Columns to sort by")


class XYChartConfig(BaseModel):
    chart_type: Literal["xy"] = Field("xy", description="Chart type")
    x: ColumnRef = Field(..., description="X-axis column")
    y: List[ColumnRef] = Field(..., description="Y-axis columns")
    kind: Literal["line", "bar", "area", "scatter"] = Field(
        "line", description="Chart visualization type"
    )
    group_by: Optional[ColumnRef] = Field(None, description="Column to group by")
    x_axis: Optional[AxisConfig] = Field(None, description="X-axis configuration")
    y_axis: Optional[AxisConfig] = Field(None, description="Y-axis configuration")
    legend: Optional[LegendConfig] = Field(None, description="Legend configuration")
    filters: Optional[List[FilterConfig]] = Field(None, description="Filters to apply")


# Discriminated union entry point
ChartConfig = TableChartConfig | XYChartConfig


class ListChartsRequest(MetadataCacheControl):
    """Request schema for list_charts with clear, unambiguous types."""

    filters: Annotated[
        List[ChartFilter],
        Field(
            default_factory=list,
            description="List of filter objects (column, operator, value). Each "
            "filter is an object with 'col', 'opr', and 'value' "
            "properties. Cannot be used together with 'search'.",
        ),
    ]
    select_columns: Annotated[
        List[str],
        Field(
            default_factory=lambda: [
                "id",
                "slice_name",
                "viz_type",
                "datasource_name",
                "description",
                "changed_by_name",
                "created_by_name",
                "changed_on",
                "created_on",
                "uuid",
            ],
            description="List of columns to select. Defaults to common columns if not "
            "specified.",
        ),
    ]
    search: Annotated[
        Optional[str],
        Field(
            default=None,
            description="Text search string to match against chart fields. Cannot be "
            "used together with 'filters'.",
        ),
    ]
    order_column: Annotated[
        Optional[str], Field(default=None, description="Column to order results by")
    ]
    order_direction: Annotated[
        Literal["asc", "desc"],
        Field(
            default="asc", description="Direction to order results ('asc' or 'desc')"
        ),
    ]
    page: Annotated[
        PositiveInt,
        Field(default=1, description="Page number for pagination (1-based)"),
    ]
    page_size: Annotated[
        PositiveInt, Field(default=100, description="Number of items per page")
    ]

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListChartsRequest":
        """Prevent using both search and filters simultaneously to avoid query
        conflicts."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


# The tool input models
class GenerateChartRequest(QueryCacheControl):
    dataset_id: int | str = Field(..., description="Dataset identifier (ID, UUID)")
    config: ChartConfig = Field(..., description="Chart configuration")
    save_chart: bool = Field(
        default=True,
        description="Whether to permanently save the chart in Superset",
    )
    generate_preview: bool = Field(
        default=True,
        description="Whether to generate a preview image",
    )
    preview_formats: List[
        Literal["url", "interactive", "ascii", "vega_lite", "table", "base64"]
    ] = Field(
        default_factory=lambda: ["url"],
        description="List of preview formats to generate",
    )


class GenerateExploreLinkRequest(FormDataCacheControl):
    dataset_id: int | str = Field(..., description="Dataset identifier (ID, UUID)")
    config: ChartConfig = Field(..., description="Chart configuration")


class UpdateChartRequest(QueryCacheControl):
    identifier: int | str = Field(..., description="Chart identifier (ID, UUID)")
    config: ChartConfig = Field(..., description="New chart configuration")
    chart_name: Optional[str] = Field(
        None,
        description="New chart name (optional, will auto-generate if not provided)",
    )
    generate_preview: bool = Field(
        default=True,
        description="Whether to generate a preview after updating",
    )
    preview_formats: List[
        Literal["url", "interactive", "ascii", "vega_lite", "table", "base64"]
    ] = Field(
        default_factory=lambda: ["url"],
        description="List of preview formats to generate",
    )


class UpdateChartPreviewRequest(FormDataCacheControl):
    form_data_key: str = Field(..., description="Existing form_data_key to update")
    dataset_id: int | str = Field(..., description="Dataset identifier (ID, UUID)")
    config: ChartConfig = Field(..., description="New chart configuration")
    generate_preview: bool = Field(
        default=True,
        description="Whether to generate a preview after updating",
    )
    preview_formats: List[
        Literal["url", "interactive", "ascii", "vega_lite", "table", "base64"]
    ] = Field(
        default_factory=lambda: ["url"],
        description="List of preview formats to generate",
    )


class GetChartDataRequest(QueryCacheControl):
    """Request for chart data with cache control."""

    identifier: int | str = Field(description="Chart identifier (ID, UUID)")
    limit: Optional[int] = Field(
        default=100, description="Maximum number of data rows to return"
    )
    format: Literal["json", "csv", "excel"] = Field(
        default="json", description="Data export format"
    )


class DataColumn(BaseModel):
    """Enhanced column metadata with semantic information."""

    name: str = Field(..., description="Column name")
    display_name: str = Field(..., description="Human-readable column name")
    data_type: str = Field(..., description="Inferred data type")
    sample_values: List[Any] = Field(description="Representative sample values")
    null_count: int = Field(description="Number of null values")
    unique_count: int = Field(description="Number of unique values")
    statistics: Optional[Dict[str, Any]] = Field(
        None, description="Column statistics if numeric"
    )
    semantic_type: Optional[str] = Field(
        None, description="Semantic type (currency, percentage, etc)"
    )


class ChartData(BaseModel):
    """Rich chart data response with statistical insights."""

    # Basic information
    chart_id: int
    chart_name: str
    chart_type: str

    # Enhanced data description
    columns: List[DataColumn] = Field(description="Rich column metadata")
    data: List[Dict[str, Any]] = Field(description="Actual data rows")

    # Data insights
    row_count: int = Field(description="Rows returned")
    total_rows: Optional[int] = Field(description="Total available rows")
    data_freshness: Optional[datetime] = Field(description="When data was last updated")

    # LLM-friendly summaries
    summary: str = Field(description="Human-readable data summary")
    insights: List[str] = Field(description="Key patterns discovered in the data")
    data_quality: Dict[str, Any] = Field(description="Data quality assessment")
    recommended_visualizations: List[str] = Field(
        description="Suggested chart types for this data"
    )

    # Performance and metadata
    performance: PerformanceMetadata = Field(description="Query performance metrics")
    cache_status: Optional[CacheStatus] = Field(
        None, description="Cache usage information"
    )

    # Export format fields
    csv_data: Optional[str] = Field(None, description="CSV content when format='csv'")
    excel_data: Optional[str] = Field(
        None, description="Base64-encoded Excel content when format='excel'"
    )
    format: Optional[str] = Field(
        None, description="Export format used (json, csv, excel)"
    )

    # Inherit versioning
    schema_version: str = Field("2.0", description="Response schema version")
    api_version: str = Field("v1", description="MCP API version")


class GetChartPreviewRequest(QueryCacheControl):
    """Request for chart preview with cache control."""

    identifier: int | str = Field(description="Chart identifier (ID, UUID)")
    format: Literal["url", "ascii", "table", "base64", "vega_lite"] = Field(
        default="url",
        description=(
            "Preview format: 'url' for image URL, 'ascii' for text art, "
            "'table' for data table, 'base64' for embedded image, "
            "'vega_lite' for interactive JSON specification"
        ),
    )
    width: Optional[int] = Field(
        default=800,
        description="Preview image width in pixels (for url/base64 formats)",
    )
    height: Optional[int] = Field(
        default=600,
        description="Preview image height in pixels (for url/base64 formats)",
    )
    ascii_width: Optional[int] = Field(
        default=80, description="ASCII chart width in characters (for ascii format)"
    )
    ascii_height: Optional[int] = Field(
        default=20, description="ASCII chart height in lines (for ascii format)"
    )


# Discriminated union preview formats for type safety
class URLPreview(BaseModel):
    """URL-based image preview format."""

    type: Literal["url"] = "url"
    preview_url: str = Field(..., description="Direct image URL")
    width: int = Field(..., description="Image width in pixels")
    height: int = Field(..., description="Image height in pixels")
    supports_interaction: bool = Field(
        False, description="Static image, no interaction"
    )


class InteractivePreview(BaseModel):
    """Interactive HTML preview with JavaScript controls."""

    type: Literal["interactive"] = "interactive"
    html_content: str = Field(..., description="Embeddable HTML with Plotly/D3")
    preview_url: str = Field(..., description="Iframe-compatible URL")
    width: int = Field(..., description="Viewport width")
    height: int = Field(..., description="Viewport height")
    supports_pan: bool = Field(True, description="Supports pan interaction")
    supports_zoom: bool = Field(True, description="Supports zoom interaction")
    supports_hover: bool = Field(True, description="Supports hover details")


class ASCIIPreview(BaseModel):
    """ASCII art text representation."""

    type: Literal["ascii"] = "ascii"
    ascii_content: str = Field(..., description="Unicode art representation")
    width: int = Field(..., description="Character width")
    height: int = Field(..., description="Line height")
    supports_color: bool = Field(False, description="Uses ANSI color codes")


class VegaLitePreview(BaseModel):
    """Vega-Lite grammar of graphics specification."""

    type: Literal["vega_lite"] = "vega_lite"
    specification: Dict[str, Any] = Field(..., description="Vega-Lite JSON spec")
    data_url: Optional[str] = Field(None, description="External data URL")
    supports_streaming: bool = Field(False, description="Supports live data updates")


class TablePreview(BaseModel):
    """Tabular data preview format."""

    type: Literal["table"] = "table"
    table_data: str = Field(..., description="Formatted table content")
    row_count: int = Field(..., description="Number of rows displayed")
    supports_sorting: bool = Field(False, description="Table supports sorting")


# Modern discriminated union using | syntax
ChartPreviewContent = Annotated[
    URLPreview | InteractivePreview | ASCIIPreview | VegaLitePreview | TablePreview,
    Field(discriminator="type"),
]


class ChartPreview(BaseModel):
    """Enhanced chart preview with discriminated union content."""

    chart_id: int
    chart_name: str
    chart_type: str = Field(description="Type of chart visualization")
    explore_url: str = Field(description="URL to open chart in Superset for editing")

    # Type-safe preview content
    content: ChartPreviewContent = Field(
        description="Preview content in requested format"
    )

    # Rich metadata
    chart_description: str = Field(
        description="Human-readable description of the chart"
    )
    accessibility: AccessibilityMetadata = Field(
        description="Accessibility information"
    )
    performance: PerformanceMetadata = Field(description="Performance metrics")

    # Backward compatibility fields (populated based on content type)
    format: Optional[str] = Field(
        None, description="Format of the preview (url, ascii, table, base64)"
    )
    preview_url: Optional[str] = Field(None, description="Image URL for 'url' format")
    ascii_chart: Optional[str] = Field(
        None, description="ASCII art chart for 'ascii' format"
    )
    table_data: Optional[str] = Field(
        None, description="Formatted table for 'table' format"
    )
    width: Optional[int] = Field(
        None, description="Width (pixels for images, characters for ASCII)"
    )
    height: Optional[int] = Field(
        None, description="Height (pixels for images, lines for ASCII)"
    )

    # Inherit versioning
    schema_version: str = Field("2.0", description="Response schema version")
    api_version: str = Field("v1", description="MCP API version")
