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
Pydantic schemas for theme-related responses
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
from superset.mcp_service.common.cache_schemas import MetadataCacheControl
from superset.mcp_service.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from superset.mcp_service.system.schemas import PaginationInfo
from superset.mcp_service.utils.sanitization import sanitize_for_llm_context
from superset.mcp_service.utils.schema_utils import (
    parse_json_or_list,
    parse_json_or_model_list,
)
from superset.utils import json as superset_json


class ThemeFilter(ColumnOperator):
    """
    Filter object for theme listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal[
        "theme_name",
        "is_system",
        "is_system_default",
        "is_system_dark",
        "created_by_fk",
    ] = Field(
        ...,
        description="Column to filter on. Use get_schema(model_type='theme') for "
        "available filter columns. To filter by creator, first call find_users "
        "to resolve a name to a user ID, then filter by created_by_fk with "
        "that integer ID.",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use.",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class ThemeInfo(BaseModel):
    id: int | None = Field(None, description="Theme ID")
    uuid: str | None = Field(None, description="Theme UUID")
    theme_name: str | None = Field(None, description="Theme display name")
    json_data: Dict[str, Any] | None = Field(
        None,
        description="Theme token configuration as a parsed dictionary",
    )
    is_system: bool | None = Field(None, description="Whether this is a system theme")
    is_system_default: bool | None = Field(
        None, description="Whether this is the default system theme"
    )
    is_system_dark: bool | None = Field(
        None, description="Whether this is the dark system theme"
    )
    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
    created_on: str | datetime | None = Field(None, description="Creation timestamp")

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
        data = serializer(self)

        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                requested_fields = set(select_columns)
                return {k: v for k, v in data.items() if k in requested_fields}

        return data


class ThemeList(BaseModel):
    themes: List[ThemeInfo]
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
        description="Columns that were actually loaded for each theme",
    )
    columns_available: List[str] = Field(
        default_factory=list,
        description="All columns available for selection via select_columns parameter",
    )
    sortable_columns: List[str] = Field(
        default_factory=list,
        description="Columns that can be used with order_column parameter",
    )
    filters_applied: List[ThemeFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class ListThemesRequest(MetadataCacheControl):
    """Request schema for list_themes."""

    filters: Annotated[
        List[ThemeFilter],
        Field(
            default_factory=list,
            description="List of filter objects (column, operator, value). Cannot be "
            "used together with 'search'.",
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
            description="Text search string to match against theme fields. "
            "Cannot be used together with 'filters'.",
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
    def parse_filters(cls, v: Any) -> List[ThemeFilter]:
        """Accept both JSON string and list of objects."""
        return parse_json_or_model_list(v, ThemeFilter, "filters")

    @field_validator("select_columns", mode="before")
    @classmethod
    def parse_columns(cls, v: Any) -> List[str]:
        """Accept JSON array, list, or comma-separated string."""
        return parse_json_or_list(v, "select_columns")

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListThemesRequest":
        """Prevent using both search and filters simultaneously."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


class ThemeError(BaseModel):
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
    def create(cls, error: str, error_type: str) -> "ThemeError":
        """Create a standardized ThemeError with timestamp."""
        from datetime import datetime, timezone

        return cls(
            error=error, error_type=error_type, timestamp=datetime.now(timezone.utc)
        )


class GetThemeInfoRequest(MetadataCacheControl):
    """Request schema for get_theme_info with support for ID or UUID."""

    identifier: Annotated[
        int | str,
        Field(description="Theme identifier - can be numeric ID or UUID string"),
    ]


def _sanitize_theme_info_for_llm_context(
    theme_info: ThemeInfo,
) -> ThemeInfo:
    """Wrap theme user-controlled fields before LLM exposure."""
    payload = theme_info.model_dump(mode="python")
    payload["theme_name"] = sanitize_for_llm_context(
        payload.get("theme_name"),
        field_path=("theme_name",),
    )
    if payload.get("json_data") is not None:
        payload["json_data"] = sanitize_for_llm_context(
            payload["json_data"],
            field_path=("json_data",),
        )
    return ThemeInfo.model_validate(payload)


def serialize_theme_object(obj: Any) -> ThemeInfo | None:
    if not obj:
        return None

    parsed_json_data: Dict[str, Any] | None = None
    if (raw_json_data := getattr(obj, "json_data", None)) is not None:
        if isinstance(raw_json_data, dict):
            parsed_json_data = raw_json_data
        elif isinstance(raw_json_data, str):
            try:
                parsed_json_data = superset_json.loads(raw_json_data)
            except (TypeError, ValueError):
                pass

    return _sanitize_theme_info_for_llm_context(
        ThemeInfo(
            id=getattr(obj, "id", None),
            uuid=str(getattr(obj, "uuid", "")) if getattr(obj, "uuid", None) else None,
            theme_name=getattr(obj, "theme_name", None),
            json_data=parsed_json_data,
            is_system=getattr(obj, "is_system", None),
            is_system_default=getattr(obj, "is_system_default", None),
            is_system_dark=getattr(obj, "is_system_dark", None),
            changed_on=getattr(obj, "changed_on", None),
            created_on=getattr(obj, "created_on", None),
        )
    )
