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
Column metadata is extracted dynamically from SQLAlchemy models.
"""

from typing import Any, Dict, List, Literal, Type

import sqlalchemy as sa
from pydantic import BaseModel, Field
from sqlalchemy.inspection import inspect


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


def _get_sqlalchemy_type_name(col_type: Any) -> str:
    """Convert SQLAlchemy column type to a friendly type name."""
    if isinstance(col_type, (sa.String, sa.Text)):
        return "str"
    elif isinstance(col_type, sa.Boolean):
        return "bool"
    elif isinstance(col_type, (sa.Integer, sa.SmallInteger, sa.BigInteger)):
        return "int"
    elif isinstance(col_type, (sa.Float, sa.Numeric)):
        return "float"
    elif isinstance(col_type, sa.DateTime):
        return "datetime"
    elif isinstance(col_type, sa.Date):
        return "date"
    elif isinstance(col_type, sa.Time):
        return "time"
    elif isinstance(col_type, sa.JSON):
        return "dict"
    elif isinstance(col_type, sa.ARRAY):
        return "list"
    else:
        return "str"  # Default fallback


def get_columns_from_model(
    model_cls: Type[Any],
    default_columns: List[str],
    extra_columns: Dict[str, ColumnMetadata] | None = None,
) -> List[ColumnMetadata]:
    """
    Dynamically extract column metadata from a SQLAlchemy model.

    Args:
        model_cls: The SQLAlchemy model class to inspect
        default_columns: List of column names that should be marked as defaults
        extra_columns: Additional columns not on the model (e.g., computed fields)

    Returns:
        List of ColumnMetadata objects for all columns
    """
    columns: List[ColumnMetadata] = []
    mapper = inspect(model_cls)

    for col in mapper.columns:
        col_name = col.key
        col_type = _get_sqlalchemy_type_name(col.type)
        # Get description from column doc or comment
        description = getattr(col, "doc", None) or getattr(col, "comment", None)

        columns.append(
            ColumnMetadata(
                name=col_name,
                description=description,
                type=col_type,
                is_default=col_name in default_columns,
            )
        )

    # Add extra columns (computed fields, relationships, etc.)
    if extra_columns:
        for name, metadata in extra_columns.items():
            # Check if already added from model columns
            if not any(c.name == name for c in columns):
                columns.append(metadata)

    return columns


# =============================================================================
# Model Configuration
# =============================================================================
# Only business-logic decisions that can't be derived from the model:
# - Default columns (which columns to show by default for reduced token usage)
# - Sortable columns (which columns support ORDER BY)
# - Search columns (which columns to search in)
# - Extra columns (computed/relationship fields not on the model)

# Chart configuration
CHART_DEFAULT_COLUMNS = ["id", "slice_name", "viz_type", "uuid"]
CHART_SORTABLE_COLUMNS = [
    "id",
    "slice_name",
    "viz_type",
    "description",
    "changed_on",
    "created_on",
]
CHART_SEARCH_COLUMNS = ["slice_name", "description"]
CHART_EXTRA_COLUMNS: Dict[str, ColumnMetadata] = {
    "datasource_name": ColumnMetadata(
        name="datasource_name",
        description="Data source name",
        type="str",
        is_default=False,
    ),
    "datasource_type": ColumnMetadata(
        name="datasource_type",
        description="Data source type",
        type="str",
        is_default=False,
    ),
    "url": ColumnMetadata(
        name="url", description="Chart URL", type="str", is_default=False
    ),
    "form_data": ColumnMetadata(
        name="form_data",
        description="Chart form data",
        type="dict",
        is_default=False,
    ),
    "changed_by": ColumnMetadata(
        name="changed_by",
        description="Last modifier username",
        type="str",
        is_default=False,
    ),
    "changed_by_name": ColumnMetadata(
        name="changed_by_name",
        description="Last modifier display name",
        type="str",
        is_default=False,
    ),
    "changed_on_humanized": ColumnMetadata(
        name="changed_on_humanized",
        description="Humanized modification time",
        type="str",
        is_default=False,
    ),
    "created_by": ColumnMetadata(
        name="created_by",
        description="Creator username",
        type="str",
        is_default=False,
    ),
    "created_by_name": ColumnMetadata(
        name="created_by_name",
        description="Creator display name",
        type="str",
        is_default=False,
    ),
    "created_on_humanized": ColumnMetadata(
        name="created_on_humanized",
        description="Humanized creation time",
        type="str",
        is_default=False,
    ),
    "tags": ColumnMetadata(
        name="tags", description="Chart tags", type="list", is_default=False
    ),
    "owners": ColumnMetadata(
        name="owners", description="Chart owners", type="list", is_default=False
    ),
}

# Dataset configuration
DATASET_DEFAULT_COLUMNS = ["id", "table_name", "schema", "uuid"]
DATASET_SORTABLE_COLUMNS = [
    "id",
    "table_name",
    "schema",
    "changed_on",
    "created_on",
]
DATASET_SEARCH_COLUMNS = ["table_name", "description"]
DATASET_EXTRA_COLUMNS: Dict[str, ColumnMetadata] = {
    "database_name": ColumnMetadata(
        name="database_name",
        description="Database connection name",
        type="str",
        is_default=False,
    ),
    "changed_by": ColumnMetadata(
        name="changed_by",
        description="Last modifier username",
        type="str",
        is_default=False,
    ),
    "changed_by_name": ColumnMetadata(
        name="changed_by_name",
        description="Last modifier display name",
        type="str",
        is_default=False,
    ),
    "changed_on_humanized": ColumnMetadata(
        name="changed_on_humanized",
        description="Humanized modification time",
        type="str",
        is_default=False,
    ),
    "created_by": ColumnMetadata(
        name="created_by",
        description="Creator username",
        type="str",
        is_default=False,
    ),
    "created_by_name": ColumnMetadata(
        name="created_by_name",
        description="Creator display name",
        type="str",
        is_default=False,
    ),
    "created_on_humanized": ColumnMetadata(
        name="created_on_humanized",
        description="Humanized creation time",
        type="str",
        is_default=False,
    ),
    "metrics": ColumnMetadata(
        name="metrics",
        description="Dataset metrics definitions",
        type="list",
        is_default=False,
    ),
    "columns": ColumnMetadata(
        name="columns",
        description="Dataset column definitions",
        type="list",
        is_default=False,
    ),
    "tags": ColumnMetadata(
        name="tags", description="Dataset tags", type="list", is_default=False
    ),
    "owners": ColumnMetadata(
        name="owners", description="Dataset owners", type="list", is_default=False
    ),
}

# Dashboard configuration
DASHBOARD_DEFAULT_COLUMNS = ["id", "dashboard_title", "slug", "uuid"]
DASHBOARD_SORTABLE_COLUMNS = [
    "id",
    "dashboard_title",
    "slug",
    "published",
    "changed_on",
    "created_on",
]
DASHBOARD_SEARCH_COLUMNS = ["dashboard_title", "slug"]
DASHBOARD_EXTRA_COLUMNS: Dict[str, ColumnMetadata] = {
    "url": ColumnMetadata(
        name="url", description="Dashboard URL", type="str", is_default=False
    ),
    "changed_by": ColumnMetadata(
        name="changed_by",
        description="Last modifier username",
        type="str",
        is_default=False,
    ),
    "changed_by_name": ColumnMetadata(
        name="changed_by_name",
        description="Last modifier display name",
        type="str",
        is_default=False,
    ),
    "changed_on_humanized": ColumnMetadata(
        name="changed_on_humanized",
        description="Humanized modification time",
        type="str",
        is_default=False,
    ),
    "created_by": ColumnMetadata(
        name="created_by",
        description="Creator username",
        type="str",
        is_default=False,
    ),
    "created_by_name": ColumnMetadata(
        name="created_by_name",
        description="Creator display name",
        type="str",
        is_default=False,
    ),
    "created_on_humanized": ColumnMetadata(
        name="created_on_humanized",
        description="Humanized creation time",
        type="str",
        is_default=False,
    ),
    "tags": ColumnMetadata(
        name="tags", description="Dashboard tags", type="list", is_default=False
    ),
    "owners": ColumnMetadata(
        name="owners", description="Dashboard owners", type="list", is_default=False
    ),
    "charts": ColumnMetadata(
        name="charts", description="Charts in dashboard", type="list", is_default=False
    ),
}


def get_chart_columns() -> List[ColumnMetadata]:
    """Get column metadata for Chart model dynamically."""
    from superset.models.slice import Slice

    return get_columns_from_model(Slice, CHART_DEFAULT_COLUMNS, CHART_EXTRA_COLUMNS)


def get_dataset_columns() -> List[ColumnMetadata]:
    """Get column metadata for Dataset model dynamically."""
    from superset.connectors.sqla.models import SqlaTable

    return get_columns_from_model(
        SqlaTable, DATASET_DEFAULT_COLUMNS, DATASET_EXTRA_COLUMNS
    )


def get_dashboard_columns() -> List[ColumnMetadata]:
    """Get column metadata for Dashboard model dynamically."""
    from superset.models.dashboard import Dashboard

    return get_columns_from_model(
        Dashboard, DASHBOARD_DEFAULT_COLUMNS, DASHBOARD_EXTRA_COLUMNS
    )


def get_all_column_names(columns: List[ColumnMetadata]) -> List[str]:
    """Extract all column names from column metadata list."""
    return [col.name for col in columns]


# For backwards compatibility with existing code that imports these
# These will be populated lazily when needed
CHART_ALL_COLUMNS: List[str] = []
DATASET_ALL_COLUMNS: List[str] = []
DASHBOARD_ALL_COLUMNS: List[str] = []
