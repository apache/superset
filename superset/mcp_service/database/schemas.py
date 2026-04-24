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
Pydantic schemas for database-related responses
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal

import humanize
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
from superset.mcp_service.common.cache_schemas import MetadataCacheControl
from superset.mcp_service.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from superset.mcp_service.privacy import filter_user_directory_fields
from superset.mcp_service.system.schemas import PaginationInfo
from superset.mcp_service.utils.schema_utils import (
    parse_json_or_list,
    parse_json_or_model_list,
)
from superset.utils import json


class DatabaseFilter(ColumnOperator):
    """
    Filter object for database listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal[
        "database_name",
        "expose_in_sqllab",
        "allow_file_upload",
        "created_by_fk",
    ] = Field(
        ...,
        description="Column to filter on. Use get_schema(model_type='database') for "
        "available filter columns. For created_by_fk, any value is accepted — "
        "the system automatically substitutes the authenticated user's ID.",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. Use get_schema(model_type='database') for "
        "available operators.",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class DatabaseInfo(BaseModel):
    id: int | None = Field(None, description="Database ID")
    uuid: str | None = Field(None, description="Database UUID")
    database_name: str | None = Field(None, description="Database connection name")
    backend: str | None = Field(None, description="Database backend (e.g., postgresql)")
    expose_in_sqllab: bool | None = Field(
        None, description="Whether exposed in SQL Lab"
    )
    allow_ctas: bool | None = Field(
        None, description="Whether CREATE TABLE AS is allowed"
    )
    allow_cvas: bool | None = Field(
        None, description="Whether CREATE VIEW AS is allowed"
    )
    allow_dml: bool | None = Field(
        None, description="Whether DML statements are allowed"
    )
    allow_file_upload: bool | None = Field(
        None, description="Whether file upload is allowed"
    )
    allow_run_async: bool | None = Field(
        None, description="Whether async query execution is allowed"
    )
    cache_timeout: int | None = Field(
        None, description="Cache timeout override in seconds"
    )
    configuration_method: str | None = Field(
        None, description="Configuration method (sqlalchemy_form or dynamic_form)"
    )
    force_ctas_schema: str | None = Field(
        None, description="Schema to force for CTAS queries"
    )
    impersonate_user: bool | None = Field(
        None, description="Whether to impersonate the logged-in user"
    )
    is_managed_externally: bool | None = Field(
        None, description="Whether managed by an external system"
    )
    external_url: str | None = Field(
        None, description="URL of the external management system"
    )
    extra: Dict[str, Any | None] | None = Field(None, description="Extra configuration")
    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
    changed_on_humanized: str | None = Field(
        None, description="Humanized modification time"
    )
    created_on: str | datetime | None = Field(None, description="Creation timestamp")
    created_on_humanized: str | None = Field(
        None, description="Humanized creation time"
    )
    model_config = ConfigDict(
        from_attributes=True,
        ser_json_timedelta="iso8601",
        populate_by_name=True,
    )

    @model_serializer(mode="wrap")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> Dict[str, Any]:
        """Filter fields based on serialization context.

        If context contains 'select_columns', only include those fields.
        Otherwise, include all fields (default behavior).
        """
        data = filter_user_directory_fields(serializer(self))

        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                requested_fields = set(select_columns)
                return {k: v for k, v in data.items() if k in requested_fields}

        return data


class DatabaseList(BaseModel):
    databases: List[DatabaseInfo]
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
        description="Columns that were actually loaded for each database",
    )
    columns_available: List[str] = Field(
        default_factory=list,
        description="All columns available for selection via select_columns parameter",
    )
    sortable_columns: List[str] = Field(
        default_factory=list,
        description="Columns that can be used with order_column parameter",
    )
    filters_applied: List[DatabaseFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class ListDatabasesRequest(MetadataCacheControl):
    """Request schema for list_databases with clear, unambiguous types."""

    filters: Annotated[
        List[DatabaseFilter],
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
            description="Text search string to match against database fields. Cannot "
            "be used together with 'filters'.",
        ),
    ]
    order_column: Annotated[
        str | None, Field(default=None, description="Column to order results by")
    ]
    order_direction: Annotated[
        Literal["asc", "desc"],
        Field(
            default="desc", description="Direction to order results ('asc' or 'desc')"
        ),
    ]
    page: Annotated[
        PositiveInt,
        Field(default=1, description="Page number for pagination (1-based)"),
    ]
    page_size: Annotated[
        int,
        Field(
            default=DEFAULT_PAGE_SIZE,
            gt=0,
            le=MAX_PAGE_SIZE,
            description=f"Number of items per page (max {MAX_PAGE_SIZE})",
        ),
    ]

    @field_validator("filters", mode="before")
    @classmethod
    def parse_filters(cls, v: Any) -> List[DatabaseFilter]:
        """Accept both JSON string and list of objects."""
        return parse_json_or_model_list(v, DatabaseFilter, "filters")

    @field_validator("select_columns", mode="before")
    @classmethod
    def parse_columns(cls, v: Any) -> List[str]:
        """Accept JSON array, list, or comma-separated string."""
        return parse_json_or_list(v, "select_columns")

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListDatabasesRequest":
        """Prevent using both search and filters simultaneously to avoid query
        conflicts."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


class DatabaseError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create(cls, error: str, error_type: str) -> "DatabaseError":
        """Create a standardized DatabaseError with timestamp."""
        from datetime import datetime, timezone

        return cls(
            error=error, error_type=error_type, timestamp=datetime.now(timezone.utc)
        )


class GetDatabaseInfoRequest(MetadataCacheControl):
    """Request schema for get_database_info with support for ID or UUID."""

    identifier: Annotated[
        int | str,
        Field(description="Database identifier - can be numeric ID or UUID string"),
    ]


def _parse_json_field(obj: Any, field_name: str) -> Dict[str, Any] | None:
    """Parse a field that may be stored as a JSON string into a dict."""
    value = getattr(obj, field_name, None)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except (ValueError, TypeError):
            pass
        return None
    return value


def _humanize_timestamp(dt: datetime | None) -> str | None:
    """Convert a datetime to a humanized string like '2 hours ago'."""
    if dt is None:
        return None
    now = datetime.now(dt.tzinfo) if dt.tzinfo else datetime.now()
    return humanize.naturaltime(now - dt)


def _get_backend(database: Any) -> str | None:
    """Safely get backend from a Database object or row proxy.

    backend is a @property that decrypts sqlalchemy_uri, which fails on
    row proxies returned by column-only DAO list queries. Fall back to None
    when the property raises.
    """
    try:
        return database.backend
    except (AttributeError, TypeError):
        return None


def serialize_database_object(database: Any) -> DatabaseInfo | None:
    if not database:
        return None

    return DatabaseInfo(
        id=getattr(database, "id", None),
        uuid=str(getattr(database, "uuid", ""))
        if getattr(database, "uuid", None)
        else None,
        database_name=getattr(database, "database_name", None),
        backend=_get_backend(database),
        expose_in_sqllab=getattr(database, "expose_in_sqllab", None),
        allow_ctas=getattr(database, "allow_ctas", None),
        allow_cvas=getattr(database, "allow_cvas", None),
        allow_dml=getattr(database, "allow_dml", None),
        allow_file_upload=getattr(database, "allow_file_upload", None),
        allow_run_async=getattr(database, "allow_run_async", None),
        cache_timeout=getattr(database, "cache_timeout", None),
        configuration_method=getattr(database, "configuration_method", None),
        force_ctas_schema=getattr(database, "force_ctas_schema", None),
        impersonate_user=getattr(database, "impersonate_user", None),
        is_managed_externally=getattr(database, "is_managed_externally", None),
        external_url=getattr(database, "external_url", None),
        extra=_parse_json_field(database, "extra"),
        changed_on=getattr(database, "changed_on", None),
        changed_on_humanized=_humanize_timestamp(getattr(database, "changed_on", None)),
        created_on=getattr(database, "created_on", None),
        created_on_humanized=_humanize_timestamp(getattr(database, "created_on", None)),
    )
