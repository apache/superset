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
Schema discovery models for MCP tools.

These schemas provide comprehensive metadata about available columns,
filters, and sorting options for each model type (chart, dataset, dashboard).
This enables LLM clients to discover valid parameters without guessing.
"""

from typing import Dict, List, Literal

from pydantic import BaseModel, Field


class ColumnMetadata(BaseModel):
    """Metadata for a selectable column."""

    name: str = Field(..., description="Column name to use in select_columns")
    description: str | None = Field(None, description="Column description")
    type: str | None = Field(None, description="Data type (str, int, datetime, etc.)")
    is_default: bool = Field(
        False, description="Whether this column is included by default"
    )


class ModelSchemaInfo(BaseModel):
    """
    Comprehensive schema information for a model type.

    Provides all metadata needed for LLM clients to construct valid queries:
    - Which columns can be selected
    - Which columns can be used for filtering (with operators)
    - Which columns can be used for sorting
    - Default values for each
    """

    model_type: Literal["chart", "dataset", "dashboard"] = Field(
        ..., description="The model type this schema describes"
    )
    select_columns: List[ColumnMetadata] = Field(
        ..., description="All columns available for selection via select_columns"
    )
    filter_columns: Dict[str, List[str]] = Field(
        ..., description="Filterable columns mapped to their supported operators"
    )
    sortable_columns: List[str] = Field(
        ..., description="Columns that can be used with order_column"
    )
    default_select: List[str] = Field(
        ..., description="Columns returned when select_columns is not specified"
    )
    default_sort: str = Field(
        ..., description="Default column used for sorting when order_column is not set"
    )
    default_sort_direction: Literal["asc", "desc"] = Field(
        "desc", description="Default sort direction"
    )
    search_columns: List[str] = Field(
        default_factory=list,
        description="Columns searched when using the search parameter",
    )


class GetSchemaRequest(BaseModel):
    """Request schema for unified get_schema tool."""

    model_type: Literal["chart", "dataset", "dashboard"] = Field(
        ..., description="Model type to get schema for"
    )


class GetSchemaResponse(BaseModel):
    """Response for unified get_schema tool."""

    schema_info: ModelSchemaInfo = Field(
        ..., description="Comprehensive schema information"
    )


# Column definitions for each model type
# These are the source of truth for available columns

CHART_SELECT_COLUMNS: List[ColumnMetadata] = [
    # Minimal defaults: id, slice_name, viz_type, uuid
    ColumnMetadata(name="id", description="Chart ID", type="int", is_default=True),
    ColumnMetadata(
        name="slice_name", description="Chart name", type="str", is_default=True
    ),
    ColumnMetadata(
        name="viz_type", description="Visualization type", type="str", is_default=True
    ),
    ColumnMetadata(name="uuid", description="Chart UUID", type="str", is_default=True),
    # Additional columns available on request
    ColumnMetadata(name="datasource_name", description="Data source name", type="str"),
    ColumnMetadata(name="datasource_type", description="Data source type", type="str"),
    ColumnMetadata(name="description", description="Chart description", type="str"),
    ColumnMetadata(name="url", description="Chart URL", type="str"),
    ColumnMetadata(
        name="cache_timeout", description="Cache timeout seconds", type="int"
    ),
    ColumnMetadata(name="form_data", description="Chart form data", type="dict"),
    ColumnMetadata(name="query_context", description="Query context", type="dict"),
    ColumnMetadata(name="changed_by", description="Last modifier username", type="str"),
    ColumnMetadata(
        name="changed_by_name", description="Last modifier display name", type="str"
    ),
    ColumnMetadata(
        name="changed_on", description="Last modification timestamp", type="datetime"
    ),
    ColumnMetadata(
        name="changed_on_humanized",
        description="Humanized modification time",
        type="str",
    ),
    ColumnMetadata(name="created_by", description="Creator username", type="str"),
    ColumnMetadata(
        name="created_by_name", description="Creator display name", type="str"
    ),
    ColumnMetadata(
        name="created_on", description="Creation timestamp", type="datetime"
    ),
    ColumnMetadata(
        name="created_on_humanized", description="Humanized creation time", type="str"
    ),
    ColumnMetadata(name="tags", description="Chart tags", type="list"),
    ColumnMetadata(name="owners", description="Chart owners", type="list"),
]

DATASET_SELECT_COLUMNS: List[ColumnMetadata] = [
    # Minimal defaults: id, table_name, schema, uuid
    ColumnMetadata(name="id", description="Dataset ID", type="int", is_default=True),
    ColumnMetadata(
        name="table_name", description="Table name", type="str", is_default=True
    ),
    ColumnMetadata(
        name="schema", description="Schema name", type="str", is_default=True
    ),
    ColumnMetadata(
        name="uuid", description="Dataset UUID", type="str", is_default=True
    ),
    # Additional columns available on request
    ColumnMetadata(
        name="database_name", description="Database connection name", type="str"
    ),
    ColumnMetadata(name="description", description="Dataset description", type="str"),
    ColumnMetadata(name="changed_by", description="Last modifier username", type="str"),
    ColumnMetadata(
        name="changed_by_name", description="Last modifier display name", type="str"
    ),
    ColumnMetadata(
        name="changed_on", description="Last modification timestamp", type="datetime"
    ),
    ColumnMetadata(
        name="changed_on_humanized",
        description="Humanized modification time",
        type="str",
    ),
    ColumnMetadata(name="created_by", description="Creator username", type="str"),
    ColumnMetadata(
        name="created_by_name", description="Creator display name", type="str"
    ),
    ColumnMetadata(
        name="created_on", description="Creation timestamp", type="datetime"
    ),
    ColumnMetadata(
        name="created_on_humanized", description="Humanized creation time", type="str"
    ),
    ColumnMetadata(
        name="metrics", description="Dataset metrics definitions", type="list"
    ),
    ColumnMetadata(
        name="columns", description="Dataset column definitions", type="list"
    ),
    ColumnMetadata(name="tags", description="Dataset tags", type="list"),
    ColumnMetadata(name="owners", description="Dataset owners", type="list"),
]

DASHBOARD_SELECT_COLUMNS: List[ColumnMetadata] = [
    # Minimal defaults: id, dashboard_title, slug, uuid
    ColumnMetadata(name="id", description="Dashboard ID", type="int", is_default=True),
    ColumnMetadata(
        name="dashboard_title",
        description="Dashboard title",
        type="str",
        is_default=True,
    ),
    ColumnMetadata(
        name="slug", description="Dashboard URL slug", type="str", is_default=True
    ),
    ColumnMetadata(
        name="uuid", description="Dashboard UUID", type="str", is_default=True
    ),
    # Additional columns available on request
    ColumnMetadata(
        name="published", description="Whether dashboard is published", type="bool"
    ),
    ColumnMetadata(name="url", description="Dashboard URL", type="str"),
    ColumnMetadata(
        name="json_metadata", description="Dashboard JSON metadata", type="dict"
    ),
    ColumnMetadata(
        name="position_json", description="Layout position JSON", type="dict"
    ),
    ColumnMetadata(name="css", description="Custom CSS", type="str"),
    ColumnMetadata(name="changed_by", description="Last modifier username", type="str"),
    ColumnMetadata(
        name="changed_by_name", description="Last modifier display name", type="str"
    ),
    ColumnMetadata(
        name="changed_on", description="Last modification timestamp", type="datetime"
    ),
    ColumnMetadata(
        name="changed_on_humanized",
        description="Humanized modification time",
        type="str",
    ),
    ColumnMetadata(name="created_by", description="Creator username", type="str"),
    ColumnMetadata(
        name="created_by_name", description="Creator display name", type="str"
    ),
    ColumnMetadata(
        name="created_on", description="Creation timestamp", type="datetime"
    ),
    ColumnMetadata(
        name="created_on_humanized", description="Humanized creation time", type="str"
    ),
    ColumnMetadata(name="tags", description="Dashboard tags", type="list"),
    ColumnMetadata(name="owners", description="Dashboard owners", type="list"),
    ColumnMetadata(name="charts", description="Charts in dashboard", type="list"),
]


def get_default_columns(columns: List[ColumnMetadata]) -> List[str]:
    """Extract default column names from column metadata list."""
    return [col.name for col in columns if col.is_default]


def get_all_column_names(columns: List[ColumnMetadata]) -> List[str]:
    """Extract all column names from column metadata list."""
    return [col.name for col in columns]


# Pre-computed default column lists for performance
CHART_DEFAULT_COLUMNS = get_default_columns(CHART_SELECT_COLUMNS)
DATASET_DEFAULT_COLUMNS = get_default_columns(DATASET_SELECT_COLUMNS)
DASHBOARD_DEFAULT_COLUMNS = get_default_columns(DASHBOARD_SELECT_COLUMNS)

# All available column names
CHART_ALL_COLUMNS = get_all_column_names(CHART_SELECT_COLUMNS)
DATASET_ALL_COLUMNS = get_all_column_names(DATASET_SELECT_COLUMNS)
DASHBOARD_ALL_COLUMNS = get_all_column_names(DASHBOARD_SELECT_COLUMNS)

# Sortable columns (subset of selectable columns that support ORDER BY)
CHART_SORTABLE_COLUMNS = [
    "id",
    "slice_name",
    "viz_type",
    "datasource_name",
    "description",
    "changed_on",
    "created_on",
]

DATASET_SORTABLE_COLUMNS = [
    "id",
    "table_name",
    "schema",
    "changed_on",
    "created_on",
]

DASHBOARD_SORTABLE_COLUMNS = [
    "id",
    "dashboard_title",
    "slug",
    "published",
    "changed_on",
    "created_on",
]

# Search columns (columns used for text search)
CHART_SEARCH_COLUMNS = ["slice_name", "description"]
DATASET_SEARCH_COLUMNS = ["table_name", "description"]
DASHBOARD_SEARCH_COLUMNS = ["dashboard_title", "slug"]
