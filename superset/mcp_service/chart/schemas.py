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
Schema definitions for chart-related MCP tools and responses.

This module defines the Pydantic schemas that will be used for:
- Chart creation requests and responses
- Chart data retrieval
- Chart filtering and search
- Chart preview and rendering

These schemas establish the contract for chart-related MCP tools.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class ChartType(str, Enum):
    """Supported chart types."""

    TABLE = "table"
    XY = "xy"
    # Additional chart types will be added in subsequent PRs


class ChartVisualizationType(str, Enum):
    """Chart visualization subtypes."""

    LINE = "line"
    BAR = "bar"
    AREA = "area"
    SCATTER = "scatter"
    # Additional visualization types will be added


class ColumnOperator(str, Enum):
    """Operators for column filtering."""

    EQ = "eq"
    NE = "ne"
    GT = "gt"
    GTE = "gte"
    LT = "lt"
    LTE = "lte"
    LIKE = "like"
    IN = "in"
    IS_NULL = "is_null"


class ColumnRef(BaseModel):
    """Reference to a column with optional aggregation."""

    name: str = Field(..., description="Column name")
    aggregate: Optional[str] = Field(None, description="Aggregation function")
    label: Optional[str] = Field(None, description="Display label")


class FilterConfig(BaseModel):
    """Chart filter configuration."""

    column: str = Field(..., description="Column to filter on")
    operator: ColumnOperator = Field(..., description="Filter operator")
    value: Union[str, int, float, List[Union[str, int, float]]] = Field(
        ..., description="Filter value(s)"
    )


class ChartCreateRequest(BaseModel):
    """Request schema for creating a chart."""

    dataset_id: Union[int, str] = Field(..., description="Dataset identifier")
    chart_type: ChartType = Field(..., description="Type of chart to create")
    chart_name: Optional[str] = Field(None, description="Chart name")
    # Additional fields will be added in implementation PRs


class ChartResponse(BaseModel):
    """Response schema for chart operations."""

    chart_id: Union[int, str] = Field(..., description="Chart identifier")
    chart_name: str = Field(..., description="Chart name")
    chart_type: str = Field(..., description="Chart type")
    status: str = Field(..., description="Operation status")
    # Additional fields will be added


class ChartDataRequest(BaseModel):
    """Request schema for retrieving chart data."""

    chart_id: Union[int, str] = Field(..., description="Chart identifier")
    limit: Optional[int] = Field(100, description="Maximum rows to return")
    # Additional fields will be added


class ChartDataResponse(BaseModel):
    """Response schema for chart data."""

    data: List[Dict[str, Any]] = Field(..., description="Chart data rows")
    columns: List[str] = Field(..., description="Column names")
    row_count: int = Field(..., description="Number of rows returned")
    # Additional fields will be added


class ChartListRequest(BaseModel):
    """Request schema for listing charts."""

    page: int = Field(1, description="Page number")
    page_size: int = Field(100, description="Items per page")
    search: Optional[str] = Field(None, description="Search term")
    # Additional fields will be added


class ChartListResponse(BaseModel):
    """Response schema for chart listing."""

    charts: List[Dict[str, Any]] = Field(..., description="List of charts")
    total_count: int = Field(..., description="Total number of charts")
    page: int = Field(..., description="Current page")
    page_size: int = Field(..., description="Items per page")


class ErrorResponse(BaseModel):
    """Schema for error responses."""

    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Error type")
    details: Optional[Dict[str, Any]] = Field(
        None, description="Additional error details"
    )
