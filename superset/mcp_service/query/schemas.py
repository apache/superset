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
Pydantic schemas for query history-related responses
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_serializer,
    model_validator,
    PositiveInt,
)

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.constants import MAX_PAGE_SIZE
from superset.mcp_service.privacy import filter_user_directory_fields
from superset.mcp_service.system.schemas import PaginationInfo
from superset.mcp_service.utils.schema_utils import (
    parse_json_or_list,
    parse_json_or_model_list,
)

DEFAULT_QUERY_COLUMNS = ["id", "status", "start_time", "database_id", "schema"]
SORTABLE_QUERY_COLUMNS = [
    "id",
    "start_time",
    "end_time",
    "status",
    "database_id",
    "changed_on",
]
ALL_QUERY_COLUMNS = [
    "id",
    "sql",
    "executed_sql",
    "status",
    "start_time",
    "end_time",
    "rows",
    "database_id",
    "schema",
    "catalog",
    "tab_name",
    "error_message",
    "client_id",
    "limit",
    "progress",
    "changed_on",
    "user_id",
]

DEFAULT_QUERY_PAGE_SIZE = 25


class QueryFilter(ColumnOperator):
    """
    Filter object for query history listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal["status", "database_id", "schema", "user_id", "start_time"] = Field(
        ...,
        description="Column to filter on.",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use.",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class QueryInfo(BaseModel):
    id: int | None = Field(None, description="Query ID")
    sql: str | None = Field(None, description="SQL query text as submitted")
    executed_sql: str | None = Field(
        None, description="Actual SQL executed after templating/CTAS rewriting"
    )
    status: str | None = Field(None, description="Query execution status")
    start_time: float | None = Field(
        None, description="Query start time (seconds since epoch)"
    )
    end_time: float | None = Field(
        None, description="Query end time (seconds since epoch)"
    )
    rows: int | None = Field(None, description="Number of rows returned or affected")
    database_id: int | None = Field(None, description="Database connection ID")
    schema: str | None = Field(None, description="Database schema name")
    catalog: str | None = Field(None, description="Database catalog name")
    tab_name: str | None = Field(None, description="SQL Lab tab name")
    error_message: str | None = Field(None, description="Error message if query failed")
    client_id: str | None = Field(None, description="Client-assigned query identifier")
    limit: int | None = Field(None, description="Row limit applied to the query")
    progress: int | None = Field(None, description="Query execution progress (0-100)")
    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
    user_id: int | None = Field(None, description="ID of the user who ran the query")
    model_config = ConfigDict(
        from_attributes=True,
        ser_json_timedelta="iso8601",
        populate_by_name=True,
    )

    @model_serializer(mode="wrap")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> Dict[str, Any]:
        data = filter_user_directory_fields(serializer(self))

        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                requested_fields = set(select_columns)
                return {k: v for k, v in data.items() if k in requested_fields}

        return data


class QueryList(BaseModel):
    queries: List[QueryInfo]
    count: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_previous: bool
    has_next: bool
    columns_requested: List[str] = Field(
        default_factory=list,
        description="Requested columns for the response",
    )
    columns_loaded: List[str] = Field(
        default_factory=list,
        description="Columns that were actually loaded for each query",
    )
    columns_available: List[str] = Field(
        default_factory=list,
        description="All columns available for selection via select_columns parameter",
    )
    sortable_columns: List[str] = Field(
        default_factory=list,
        description="Columns that can be used with order_column parameter",
    )
    filters_applied: List[QueryFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class ListQueriesRequest(BaseModel):
    """Request schema for list_queries."""

    filters: Annotated[
        List[QueryFilter],
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
            default_factory=list,
            description="List of columns to select. Defaults to common columns if not "
            "specified.",
        ),
    ]
    search: Annotated[
        str | None,
        Field(
            default=None,
            description="Text search string to match against query fields. "
            "Cannot be used together with 'filters'.",
        ),
    ]
    order_column: Annotated[
        str | None,
        Field(default=None, description="Column to order results by"),
    ]
    order_direction: Annotated[
        Literal["asc", "desc"],
        Field(
            default="desc",
            description="Direction to order results ('asc' or 'desc')",
        ),
    ]
    page: Annotated[
        PositiveInt,
        Field(default=1, description="Page number for pagination (1-based)"),
    ]
    page_size: Annotated[
        int,
        Field(
            default=DEFAULT_QUERY_PAGE_SIZE,
            gt=0,
            le=MAX_PAGE_SIZE,
            description=f"Number of items per page (max {MAX_PAGE_SIZE})",
        ),
    ]

    @field_validator("filters", mode="before")
    @classmethod
    def parse_filters(cls, v: Any) -> List[QueryFilter]:
        """Accept both JSON string and list of objects."""
        return parse_json_or_model_list(v, QueryFilter, "filters")

    @field_validator("select_columns", mode="before")
    @classmethod
    def parse_columns(cls, v: Any) -> List[str]:
        """Accept JSON array, list, or comma-separated string."""
        return parse_json_or_list(v, "select_columns")

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListQueriesRequest":
        """Prevent using both search and filters simultaneously."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


class QueryError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class GetQueryInfoRequest(BaseModel):
    """Request schema for get_query_info with support for numeric ID only."""

    identifier: Annotated[
        int,
        Field(description="Query ID (numeric)"),
    ]


def serialize_query_object(query: Any) -> QueryInfo | None:
    if not query:
        return None

    return QueryInfo(
        id=getattr(query, "id", None),
        sql=getattr(query, "sql", None),
        executed_sql=getattr(query, "executed_sql", None),
        status=getattr(query, "status", None),
        start_time=getattr(query, "start_time", None),
        end_time=getattr(query, "end_time", None),
        rows=getattr(query, "rows", None),
        database_id=getattr(query, "database_id", None),
        schema=getattr(query, "schema", None),
        catalog=getattr(query, "catalog", None),
        tab_name=getattr(query, "tab_name", None),
        error_message=getattr(query, "error_message", None),
        client_id=getattr(query, "client_id", None),
        limit=getattr(query, "limit", None),
        progress=getattr(query, "progress", None),
        changed_on=getattr(query, "changed_on", None),
        user_id=getattr(query, "user_id", None),
    )
