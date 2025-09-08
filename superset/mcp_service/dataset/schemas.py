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
Schema definitions for dataset-related MCP tools and responses.

This module defines the Pydantic schemas that will be used for:
- Dataset discovery and listing
- Dataset metadata retrieval
- Dataset column information
- Dataset filtering and search

These schemas establish the contract for dataset-related MCP tools.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field


class DatasetType(str, Enum):
    """Dataset types."""

    TABLE = "table"
    VIEW = "view"
    QUERY = "query"
    # Additional types will be added


class ColumnType(str, Enum):
    """Column data types."""

    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    DATE = "date"
    DATETIME = "datetime"
    # Additional types will be added


class DatasetColumn(BaseModel):
    """Dataset column information."""

    name: str = Field(..., description="Column name")
    type: ColumnType = Field(..., description="Column data type")
    is_nullable: bool = Field(..., description="Whether column allows null values")
    description: Optional[str] = Field(None, description="Column description")
    is_temporal: bool = Field(False, description="Whether column represents time")
    is_numeric: bool = Field(False, description="Whether column is numeric")


class DatasetMetric(BaseModel):
    """Dataset metric information."""

    name: str = Field(..., description="Metric name")
    expression: str = Field(..., description="SQL expression")
    description: Optional[str] = Field(None, description="Metric description")
    is_certified: bool = Field(False, description="Whether metric is certified")


class DatasetInfo(BaseModel):
    """Detailed dataset information."""

    id: Union[int, str] = Field(..., description="Dataset identifier")
    name: str = Field(..., description="Dataset name")
    table_name: str = Field(..., description="Physical table name")
    database_schema: Optional[str] = Field(None, description="Database schema")
    database_name: str = Field(..., description="Database name")
    dataset_type: DatasetType = Field(..., description="Dataset type")
    columns: List[DatasetColumn] = Field(..., description="Dataset columns")
    metrics: List[DatasetMetric] = Field(..., description="Dataset metrics")
    row_count: Optional[int] = Field(None, description="Estimated row count")
    created_on: Optional[str] = Field(None, description="Creation timestamp")
    changed_on: Optional[str] = Field(None, description="Last modified timestamp")


class DatasetListRequest(BaseModel):
    """Request schema for listing datasets."""

    page: int = Field(1, description="Page number")
    page_size: int = Field(100, description="Items per page")
    search: Optional[str] = Field(None, description="Search term")
    database_schema: Optional[str] = Field(None, description="Filter by schema")
    database_id: Optional[int] = Field(None, description="Filter by database")
    # Additional fields will be added


class DatasetListResponse(BaseModel):
    """Response schema for dataset listing."""

    datasets: List[DatasetInfo] = Field(..., description="List of datasets")
    total_count: int = Field(..., description="Total number of datasets")
    page: int = Field(..., description="Current page")
    page_size: int = Field(..., description="Items per page")


class DatasetFilter(BaseModel):
    """Dataset filter configuration."""

    column: str = Field(..., description="Column name")
    operator: str = Field(..., description="Filter operator")
    value: Union[str, int, float, List[Union[str, int, float]]] = Field(
        ..., description="Filter value(s)"
    )


class DatasetAvailableFiltersResponse(BaseModel):
    """Response schema for available dataset filters."""

    columns: List[str] = Field(..., description="Available filter columns")
    operators: Dict[str, List[str]] = Field(
        ..., description="Available operators per column type"
    )


class DatasetSample(BaseModel):
    """Dataset sample data."""

    columns: List[str] = Field(..., description="Column names")
    data: List[List[Any]] = Field(..., description="Sample data rows")
    row_count: int = Field(..., description="Number of sample rows")
    total_rows: Optional[int] = Field(None, description="Total rows in dataset")
