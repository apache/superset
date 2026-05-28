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
Pydantic schemas for CSS template-related responses
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


class CssTemplateFilter(ColumnOperator):
    """
    Filter object for CSS template listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal["template_name", "created_by_fk"] = Field(
        ...,
        description="Column to filter on. Use get_schema(model_type='css_template') "
        "for available filter columns. To filter by creator, first call find_users "
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


class CssTemplateInfo(BaseModel):
    id: int | None = Field(None, description="CSS template ID")
    uuid: str | None = Field(None, description="CSS template UUID")
    template_name: str | None = Field(None, description="CSS template name")
    css: str | None = Field(
        None,
        description="CSS content (can be large; request via select_columns=['css'])",
    )
    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
    created_on: str | datetime | None = Field(None, description="Creation timestamp")
    created_by_name: str | None = Field(None, description="Username of the creator")
    changed_by_name: str | None = Field(
        None, description="Username of the last modifier"
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
        data = serializer(self)

        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                requested_fields = set(select_columns)
                return {k: v for k, v in data.items() if k in requested_fields}

        return data


class CssTemplateList(BaseModel):
    css_templates: List[CssTemplateInfo]
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
        description="Columns that were actually loaded for each CSS template",
    )
    columns_available: List[str] = Field(
        default_factory=list,
        description="All columns available for selection via select_columns parameter",
    )
    sortable_columns: List[str] = Field(
        default_factory=list,
        description="Columns that can be used with order_column parameter",
    )
    filters_applied: List[CssTemplateFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class ListCssTemplatesRequest(MetadataCacheControl):
    """Request schema for list_css_templates."""

    filters: Annotated[
        List[CssTemplateFilter],
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
            "specified. Use select_columns=['css'] to include the CSS content.",
        ),
    ]
    search: Annotated[
        str | None,
        Field(
            default=None,
            description="Text search string to match against CSS template fields. "
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
    def parse_filters(cls, v: Any) -> List[CssTemplateFilter]:
        """Accept both JSON string and list of objects."""
        return parse_json_or_model_list(v, CssTemplateFilter, "filters")

    @field_validator("select_columns", mode="before")
    @classmethod
    def parse_columns(cls, v: Any) -> List[str]:
        """Accept JSON array, list, or comma-separated string."""
        return parse_json_or_list(v, "select_columns")

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListCssTemplatesRequest":
        """Prevent using both search and filters simultaneously."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


class CssTemplateError(BaseModel):
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
    def create(cls, error: str, error_type: str) -> "CssTemplateError":
        """Create a standardized CssTemplateError with timestamp."""
        from datetime import datetime, timezone

        return cls(
            error=error, error_type=error_type, timestamp=datetime.now(timezone.utc)
        )


class GetCssTemplateInfoRequest(MetadataCacheControl):
    """Request schema for get_css_template_info with support for ID or UUID."""

    identifier: Annotated[
        int | str,
        Field(description="CSS template identifier - can be numeric ID or UUID string"),
    ]


def _sanitize_css_template_info_for_llm_context(
    css_template_info: CssTemplateInfo,
) -> CssTemplateInfo:
    """Wrap CSS template user-controlled fields before LLM exposure."""
    payload = css_template_info.model_dump(mode="python")
    for field_name in ("template_name", "css", "created_by_name", "changed_by_name"):
        payload[field_name] = sanitize_for_llm_context(
            payload.get(field_name),
            field_path=(field_name,),
        )
    return CssTemplateInfo.model_validate(payload)


def serialize_css_template_object(obj: Any) -> CssTemplateInfo | None:
    if not obj:
        return None

    return _sanitize_css_template_info_for_llm_context(
        CssTemplateInfo(
            id=getattr(obj, "id", None),
            uuid=str(getattr(obj, "uuid", "")) if getattr(obj, "uuid", None) else None,
            template_name=getattr(obj, "template_name", None),
            css=getattr(obj, "css", None),
            changed_on=getattr(obj, "changed_on", None),
            created_on=getattr(obj, "created_on", None),
            created_by_name=getattr(obj, "created_by_name", None) or None,
            changed_by_name=getattr(obj, "changed_by_name", None) or None,
        )
    )
