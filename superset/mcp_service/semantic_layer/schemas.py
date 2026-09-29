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

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from superset.mcp_service.chart.schemas import DataColumn, PerformanceMetadata
from superset.mcp_service.common.cache_schemas import CacheStatus
from superset.mcp_service.common.error_schemas import MCPBaseError
from superset.mcp_service.common.time_range_validation import validate_time_range
from superset.mcp_service.utils.serialization import (
    JsonSafeRows,
    OptionalRowCount,
    RowCount,
)

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


# Measured with get_response_size_bytes on this schema, 40 dimensions per
# metric: with short descriptive text on every metric and dimension,
# page_size=4 serializes to ~39 KB, 5 to ~48 KB, 6 to ~58 KB and 8 to ~77 KB
# (about ~27 / ~34 / ~41 / ~55 KB with names only), against the
# response-size guard's default MCP_RESPONSE_SIZE_CONFIG['max_bytes'] of
# 50,000 bytes. 4 is the largest page size with real margin in both variants;
# 8 (the old cap) already exceeds the default even with no descriptions at
# all. The fixed page cap is not a guarantee for every payload or
# operator-configured limit.
EMBEDDED_DIMENSIONS_MAX_PAGE_SIZE: int = 4


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
        default=False,
        description=(
            "Embed compatible dimensions only when explicitly requested. "
            "Use get_compatible_dimensions for the full per-metric list. "
            "When True, set page_size to at most 8, including built-in datasets."
        ),
    )
    page: int = Field(default=1, ge=1, description="1-based page number.")
    page_size: int = Field(
        default=25, ge=1, le=500, description="Number of metrics per page."
    )

    @model_validator(mode="after")
    def validate_embedded_dimensions_page_size(self) -> "ListMetricsRequest":
        """Reject embedded pages that risk exceeding the MCP response guard."""
        if (
            self.include_compatible_dimensions
            and self.page_size > EMBEDDED_DIMENSIONS_MAX_PAGE_SIZE
        ):
            raise ValueError(
                "Embedded compatible dimensions require "
                f"page_size <= {EMBEDDED_DIMENSIONS_MAX_PAGE_SIZE}: each "
                "metric's dimension list can consume several KB or more, "
                "and the MCP response guard uses "
                "MCP_RESPONSE_SIZE_CONFIG['max_bytes'] (~50k by default). "
                "This fixed page cap does not guarantee that every response fits. "
                "Reduce page_size or use include_compatible_dimensions=false "
                "and get_compatible_dimensions for the chosen metric."
            )
        return self


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

    @model_validator(mode="after")
    def _validate_temporal_range_val(self) -> "GetTableFilter":
        """Hold a TEMPORAL_RANGE filter to the same grammar as ``time_range``.

        This operator resolves through ``get_since_until()`` exactly like the
        dedicated ``time_range`` field does, so an unparseable value here
        produces the same silent full-table match.
        """
        if self.op == "TEMPORAL_RANGE" and isinstance(self.val, str):
            self.val = validate_time_range(self.val)
        return self


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
            "Optional time range string. Use Superset relative shorthands "
            "like 'Last 7 days', 'Last 30 days', 'Last year', 'Current "
            "week', 'previous calendar year', or an ISO-8601 range like "
            "'2024-01-01 : 2024-12-31'. Requires a temporal dimension. "
            "Bracket shorthands like '[year]' or '[quarter]' are also "
            "accepted and normalized to the equivalent 'Last <unit>' form."
        ),
    )
    time_column: str | None = Field(
        default=None,
        description=(
            "Name of the temporal column/dimension to apply time_range to. "
            "Inferred from the dataset's main_dttm_col when omitted."
        ),
    )
    time_grain: str | None = Field(
        default=None,
        description=(
            "Optional time grain for the temporal dimension, as an ISO-8601 "
            "duration (P1D, P1W, P1M, P3M, P1Y, PT1H, PT1M, PT1S) or its name "
            "(day, week, month, quarter, year, hour, minute, second). Applies "
            "to time_column when set, otherwise to the single temporal "
            "dimension in dimensions. Semantic views only; a view's "
            "queryable grains are listed in get_table validation errors."
        ),
    )

    @field_validator("time_grain")
    @classmethod
    def normalize_time_grain(cls, value: str | None) -> str | None:
        """Normalize grain names while leaving durations for view validation."""
        from superset_core.semantic_layers.types import Grain, Grains

        if value is None or not value.strip():
            return None
        value = value.strip()
        names: dict[str, str] = {
            grain.name.casefold(): grain.representation
            for grain in vars(Grains).values()
            if isinstance(grain, Grain)
        }
        return names.get(value.casefold(), value)

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

    @field_validator("time_range")
    @classmethod
    def _validate_time_range(cls, v: str | None) -> str | None:
        return validate_time_range(v)


class GetTableResponse(BaseModel):
    """Response schema for get_table."""

    columns: list[DataColumn]
    data: JsonSafeRows
    row_count: RowCount
    total_rows: OptionalRowCount = None
    from_dttm: datetime | None = Field(
        None,
        description=(
            "Resolved inclusive start of the query engine's primary time range. "
            "Null means no primary lower bound is available. ISO 8601; naive "
            "values are in Superset's logical time coordinates, not necessarily UTC. "
            "On cache hits, these are current-request bounds; cached rows can reflect "
            "an earlier relative range. Check cache_status.cache_hit."
        ),
    )
    to_dttm: datetime | None = Field(
        None,
        description=(
            "Resolved exclusive end of the query engine's primary time range. "
            "Null means no primary upper bound is available. Report these bounds when "
            "describing results; do not infer dates from relative expressions. "
            "Additional filters and datasource timezone adjustments still apply. "
            "On cache hits, these are current-request bounds; cached rows can reflect "
            "an earlier relative range. Check cache_status.cache_hit."
        ),
    )
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
