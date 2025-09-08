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
Schema definitions for explore-related MCP tools and responses.

This module defines the Pydantic schemas that will be used for:
- Interactive data exploration link generation
- Explore URL creation with chart configurations
- Dynamic chart parameter adjustments
- Preview capabilities before saving charts

These schemas establish the contract for explore-related MCP tools.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class ExploreVisualizationType(str, Enum):
    """Explore visualization types."""

    TABLE = "table"
    LINE = "line"
    BAR = "bar"
    AREA = "area"
    SCATTER = "scatter"
    PIE = "pie"
    # Additional types will be added


class ExploreAxisConfig(BaseModel):
    """Axis configuration for explore charts."""

    title: Optional[str] = Field(None, description="Axis title")
    format: Optional[str] = Field(None, description="Value format")
    scale: Optional[str] = Field("linear", description="Axis scale (linear/log)")


class ExploreLegendConfig(BaseModel):
    """Legend configuration for explore charts."""

    show: bool = Field(True, description="Whether to show legend")
    position: str = Field("right", description="Legend position")


class ExploreColumnRef(BaseModel):
    """Column reference for explore configurations."""

    name: str = Field(..., description="Column name")
    aggregate: Optional[str] = Field(None, description="Aggregation function")
    label: Optional[str] = Field(None, description="Display label")


class ExploreFilterConfig(BaseModel):
    """Filter configuration for explore."""

    column: str = Field(..., description="Column to filter on")
    operator: str = Field(..., description="Filter operator")
    value: Union[str, int, float, List[Union[str, int, float]]] = Field(
        ..., description="Filter value(s)"
    )


class ExploreChartConfig(BaseModel):
    """Chart configuration for explore."""

    chart_type: ExploreVisualizationType = Field(..., description="Chart type")
    x_axis: Optional[ExploreColumnRef] = Field(None, description="X-axis column")
    y_axis: Optional[List[ExploreColumnRef]] = Field(None, description="Y-axis columns")
    group_by: Optional[List[ExploreColumnRef]] = Field(
        None, description="Group by columns"
    )
    filters: Optional[List[ExploreFilterConfig]] = Field(
        None, description="Chart filters"
    )
    x_axis_config: Optional[ExploreAxisConfig] = Field(
        None, description="X-axis configuration"
    )
    y_axis_config: Optional[ExploreAxisConfig] = Field(
        None, description="Y-axis configuration"
    )
    legend_config: Optional[ExploreLegendConfig] = Field(
        None, description="Legend configuration"
    )
    # Additional configuration fields will be added


class GenerateExploreLinkRequest(BaseModel):
    """Request schema for generating explore links."""

    dataset_id: Union[int, str] = Field(..., description="Dataset identifier")
    chart_config: ExploreChartConfig = Field(..., description="Chart configuration")
    form_data_key: Optional[str] = Field(None, description="Existing form data key")
    cache_form_data: bool = Field(True, description="Whether to cache form data")


class GenerateExploreLinkResponse(BaseModel):
    """Response schema for explore link generation."""

    explore_url: str = Field(..., description="Generated explore URL")
    form_data_key: Optional[str] = Field(None, description="Form data cache key")
    chart_config: ExploreChartConfig = Field(
        ..., description="Chart configuration used"
    )
    status: str = Field(..., description="Generation status")


class ExplorePreviewRequest(BaseModel):
    """Request schema for explore preview."""

    dataset_id: Union[int, str] = Field(..., description="Dataset identifier")
    chart_config: ExploreChartConfig = Field(..., description="Chart configuration")
    limit: int = Field(1000, description="Data limit for preview")


class ExplorePreviewResponse(BaseModel):
    """Response schema for explore preview."""

    preview_url: Optional[str] = Field(None, description="Preview image URL")
    data_summary: Dict[str, Any] = Field(..., description="Data summary")
    row_count: int = Field(..., description="Number of rows")
    status: str = Field(..., description="Preview generation status")


class ExploreValidationError(BaseModel):
    """Schema for explore validation errors."""

    field: str = Field(..., description="Field with validation error")
    message: str = Field(..., description="Validation error message")
    error_type: str = Field(..., description="Type of validation error")


class ExploreValidationResponse(BaseModel):
    """Response schema for explore validation."""

    is_valid: bool = Field(..., description="Whether configuration is valid")
    errors: List[ExploreValidationError] = Field(..., description="Validation errors")
    warnings: List[str] = Field([], description="Validation warnings")
