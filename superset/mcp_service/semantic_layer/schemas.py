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

"""Pydantic schemas for semantic layer MCP tools."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from superset.mcp_service.chart.schemas import DataColumn, PerformanceMetadata
from superset.mcp_service.common.cache_schemas import CacheStatus
from superset.mcp_service.common.error_schemas import MCPBaseError

# ---------------------------------------------------------------------------
# Shared error schema
# ---------------------------------------------------------------------------


class SemanticLayerError(MCPBaseError):
    """Error response returned by semantic layer tools."""

    success: Literal[False] = False

    @classmethod
    def create(cls, *, error: str, error_type: str) -> "SemanticLayerError":
        return cls(error=error, error_type=error_type)


# ---------------------------------------------------------------------------
# Dimension info (returned inside MetricInfo.compatible_dimensions)
# ---------------------------------------------------------------------------


class DimensionInfo(BaseModel):
    """Metadata for a single dimension / column."""

    name: str
    verbose_name: str | None = None
    description: str | None = None
    type: str | None = None
    is_dttm: bool = False
    groupby: bool = True
    filterable: bool = True
    source: Literal["builtin", "external"] = "builtin"


# ---------------------------------------------------------------------------
# Metric info
# ---------------------------------------------------------------------------


class MetricInfo(BaseModel):
    """Metadata for a single metric, including compatible dimensions."""

    name: str
    verbose_name: str | None = None
    description: str | None = None
    expression: str | None = None
    d3format: str | None = None
    warning_text: str | None = None
    source: Literal["builtin", "external"] = "builtin"
    dataset_id: int | None = None
    dataset_name: str | None = None
    view_id: int | None = None
    view_name: str | None = None
    compatible_dimensions: list[DimensionInfo] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# list_metrics
# ---------------------------------------------------------------------------


class ListMetricsRequest(BaseModel):
    """Request schema for list_metrics."""

    search: str | None = Field(
        default=None,
        description="Optional search string to filter metrics by name or description.",
    )
    dataset_id: int | None = Field(
        default=None,
        description="Filter to metrics from a specific built-in dataset.",
    )
    view_id: int | None = Field(
        default=None,
        description="Filter to metrics from a specific semantic view.",
    )
    include_compatible_dimensions: bool = Field(
        default=True,
        description=(
            "When True, each metric includes its list of compatible dimensions. "
            "Set to False to reduce response size when dimensions aren't needed."
        ),
    )
    page: int = Field(default=1, ge=1, description="1-based page number.")
    page_size: int = Field(
        default=50, ge=1, le=500, description="Number of metrics per page."
    )


class MetricList(BaseModel):
    """Response schema for list_metrics."""

    metrics: list[MetricInfo]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    success: Literal[True] = True


# ---------------------------------------------------------------------------
# get_table
# ---------------------------------------------------------------------------


class GetTableFilter(BaseModel):
    """A single filter clause for get_table."""

    col: str = Field(..., description="Column or dimension name to filter on.")
    op: str = Field(
        default="==",
        description=(
            "Filter operator. Common values: '==', '!=', '>', '<', '>=', '<=', "
            "'IN', 'NOT IN', 'LIKE', 'ILIKE', 'TEMPORAL_RANGE'."
        ),
    )
    val: Any = Field(
        default=None,
        description="Filter value. Use a list for 'IN'/'NOT IN' operators.",
    )


class GetTableRequest(BaseModel):
    """Request schema for get_table."""

    dataset_id: int | None = Field(
        default=None,
        description=(
            "Built-in dataset ID to query. Obtained from list_metrics response "
            "when source='builtin'. Provide either this or view_id."
        ),
    )
    view_id: int | None = Field(
        default=None,
        description=(
            "External semantic view ID to query. Obtained from list_metrics "
            "response when source='external'. Provide either this or dataset_id."
        ),
    )
    metrics: list[str] = Field(
        default_factory=list,
        description=(
            "Metric names to compute. All metrics must come from the same "
            "data source (dataset or semantic view)."
        ),
    )
    dimensions: list[str] = Field(
        default_factory=list,
        description="Dimension or column names to group by.",
    )
    filters: list[GetTableFilter] = Field(
        default_factory=list,
        description="Optional filters to apply.",
    )
    time_range: str | None = Field(
        default=None,
        description=(
            "Optional time range string, e.g. 'Last 7 days', 'Last 30 days', "
            "'2024-01-01 : 2024-12-31'. Requires a datetime dimension."
        ),
    )
    time_column: str | None = Field(
        default=None,
        description=(
            "Name of the datetime column/dimension to apply time_range to. "
            "Inferred from the dataset's main_dttm_col when omitted."
        ),
    )
    row_limit: int = Field(
        default=1000,
        ge=1,
        le=50000,
        description="Maximum number of rows to return.",
    )
    order_by: list[str] = Field(
        default_factory=list,
        description="Column/metric names to sort by.",
    )
    order_desc: bool = Field(
        default=True,
        description="Sort descending when True (default).",
    )
    use_cache: bool = Field(default=True, description="Use query cache when available.")
    force_refresh: bool = Field(
        default=False,
        description="Force a cache refresh even when cached results exist.",
    )


class GetTableResponse(BaseModel):
    """Response schema for get_table."""

    columns: list[DataColumn]
    data: list[dict[str, Any]]
    row_count: int
    total_rows: int | None = None
    summary: str
    source: Literal["builtin", "external"]
    dataset_id: int | None = None
    dataset_name: str | None = None
    view_id: int | None = None
    view_name: str | None = None
    performance: PerformanceMetadata | None = None
    cache_status: CacheStatus | None = None
    warnings: list[str] = Field(default_factory=list)
    success: Literal[True] = True


# ---------------------------------------------------------------------------
# get_compatible_dimensions
# ---------------------------------------------------------------------------


class GetCompatibleDimensionsRequest(BaseModel):
    """Request schema for get_compatible_dimensions."""

    selected_metrics: list[str] = Field(
        default_factory=list,
        description="Metric names already selected.",
    )
    selected_dimensions: list[str] = Field(
        default_factory=list,
        description="Dimension names already selected.",
    )
    dataset_id: int | None = Field(
        default=None,
        description="Built-in dataset ID to query. Provide either this or view_id.",
    )
    view_id: int | None = Field(
        default=None,
        description="Semantic view ID to query. Provide either this or dataset_id.",
    )


class CompatibleDimensionsResponse(BaseModel):
    """Response schema for get_compatible_dimensions."""

    compatible_dimensions: list[DimensionInfo]
    source: Literal["builtin", "external"]
    success: Literal[True] = True


# ---------------------------------------------------------------------------
# get_compatible_metrics
# ---------------------------------------------------------------------------


class GetCompatibleMetricsRequest(BaseModel):
    """Request schema for get_compatible_metrics."""

    selected_metrics: list[str] = Field(
        default_factory=list,
        description="Metric names already selected.",
    )
    selected_dimensions: list[str] = Field(
        default_factory=list,
        description="Dimension names already selected.",
    )
    dataset_id: int | None = Field(
        default=None,
        description="Built-in dataset ID to query. Provide either this or view_id.",
    )
    view_id: int | None = Field(
        default=None,
        description="Semantic view ID to query. Provide either this or dataset_id.",
    )


class CompatibleMetricsResponse(BaseModel):
    """Response schema for get_compatible_metrics."""

    compatible_metrics: list[MetricInfo]
    source: Literal["builtin", "external"]
    success: Literal[True] = True
