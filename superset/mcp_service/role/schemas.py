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

"""Pydantic schemas for role-related MCP tool responses."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, List, Literal

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
from superset.mcp_service.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from superset.mcp_service.system.schemas import PaginationInfo
from superset.mcp_service.utils import sanitize_for_llm_context
from superset.mcp_service.utils.schema_utils import (
    parse_json_or_list,
    parse_json_or_model_list,
)

DEFAULT_ROLE_COLUMNS = ["id", "name"]

ROLE_ALL_COLUMNS = ["id", "name"]

ROLE_SORTABLE_COLUMNS = ["id", "name"]


class RoleFilter(ColumnOperator):
    """Filter object for role listing.

    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal["name"] = Field(
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


class RoleInfo(BaseModel):
    id: int | None = Field(None, description="Role ID")
    name: str | None = Field(None, description="Role name")
    permissions: list[str] | None = Field(
        None,
        description=(
            "Permission names assigned to this role "
            "(only populated by get_role_info, not list_roles)"
        ),
    )
    model_config = ConfigDict(
        from_attributes=True,
        ser_json_timedelta="iso8601",
        populate_by_name=True,
    )

    @model_serializer(mode="wrap")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> dict[str, Any]:
        data = serializer(self)
        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                return {k: v for k, v in data.items() if k in select_columns}
        return data


class RoleList(BaseModel):
    roles: List[RoleInfo]
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
        description="Columns that were actually loaded for each role",
    )
    columns_available: List[str] = Field(
        default_factory=list,
        description="All columns available for selection via select_columns parameter",
    )
    sortable_columns: List[str] = Field(
        default_factory=list,
        description="Columns that can be used with order_column parameter",
    )
    filters_applied: List[RoleFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class ListRolesRequest(BaseModel):
    """Request schema for list_roles."""

    filters: Annotated[
        List[RoleFilter],
        Field(
            default_factory=list,
            description="List of filter objects (column, operator, value). Each "
            "filter is an object with 'col', 'opr', and 'value' properties. "
            "Cannot be used together with 'search'.",
        ),
    ]
    select_columns: Annotated[
        List[str],
        Field(
            default_factory=list,
            description="List of columns to select. Defaults to common columns if "
            "not specified.",
        ),
    ]
    search: Annotated[
        str | None,
        Field(
            default=None,
            description="Text search string to match against role name. Cannot be "
            "used together with 'filters'.",
        ),
    ]
    order_column: Annotated[
        str | None, Field(default=None, description="Column to order results by")
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
    def parse_filters(cls, v: Any) -> List[RoleFilter]:
        """Accept both JSON string and list of objects."""
        return parse_json_or_model_list(v, RoleFilter, "filters")

    @field_validator("select_columns", mode="before")
    @classmethod
    def parse_columns(cls, v: Any) -> List[str]:
        """Accept JSON array, list, or comma-separated string."""
        return parse_json_or_list(v, "select_columns")

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListRolesRequest":
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching or 'filters' for "
                "precise column-based filtering, but not both."
            )
        return self


class RoleError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @field_validator("error")
    @classmethod
    def sanitize_error_for_llm_context(cls, value: str) -> str:
        """Wrap error text before it is exposed to LLM context."""
        return sanitize_for_llm_context(value, field_path=("error",))

    @classmethod
    def create(cls, error: str, error_type: str) -> "RoleError":
        """Create a standardized RoleError with timestamp."""
        return cls(
            error=error, error_type=error_type, timestamp=datetime.now(timezone.utc)
        )


class GetRoleInfoRequest(BaseModel):
    """Request schema for get_role_info."""

    identifier: Annotated[
        int,
        Field(description="Role ID (integer)"),
    ]


def serialize_role_object(
    role: Any, include_permissions: bool = False
) -> RoleInfo | None:
    """Serialize a FAB Role object into a RoleInfo schema.

    Set include_permissions=True for get_role_info; leave False for list_roles
    to avoid a per-role N+1 permissions lazy-load.
    """
    if not role:
        return None
    permissions: list[str] | None = None
    if include_permissions:
        raw_perms = getattr(role, "permissions", None)
        if raw_perms is not None:
            try:
                permissions = [p.name for p in raw_perms if hasattr(p, "name")]
            except (AttributeError, TypeError):
                permissions = None
    return RoleInfo(
        id=getattr(role, "id", None),
        name=sanitize_for_llm_context(
            getattr(role, "name", None), field_path=("name",)
        ),
        permissions=[
            sanitize_for_llm_context(p, field_path=("permissions",))
            for p in permissions
        ]
        if permissions is not None
        else None,
    )
