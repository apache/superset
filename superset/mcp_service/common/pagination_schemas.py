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

"""Shared base schemas for MCP list-tool request/response pairs.

Every `list_*` tool follows the same envelope: a request with
filters/select_columns/search/order/pagination fields, and a response with
pagination and column metadata plus one entity-specific list field. These
bases capture that shared shape so domain schemas only declare what's
actually domain-specific (the filter `Literal["col", ...]` type and the
entity list field).
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Generic, get_args, List, Literal, TypeVar

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
    PositiveInt,
)

from superset.mcp_service.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from superset.mcp_service.system.schemas import PaginationInfo
from superset.mcp_service.utils.schema_utils import (
    parse_json_or_list,
    parse_json_or_model_list,
)

FilterT = TypeVar("FilterT", bound=BaseModel)


class PaginatedListRequest(BaseModel, Generic[FilterT]):
    """Shared base for `List<Entity>Request` schemas.

    Subclasses parametrize the filter model, e.g.
    `class ListTagsRequest(PaginatedListRequest[TagFilter])`, and may
    redeclare `order_direction`/`page_size` when a domain needs a different
    default (e.g. `list_queries` defaults `page_size` to 25).
    """

    model_config = ConfigDict(populate_by_name=True)

    filters: Annotated[
        List[FilterT],
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
            description="List of columns to select. Defaults to common columns if not "
            "specified.",
            validation_alias=AliasChoices("select_columns", "columns"),
        ),
    ]
    search: Annotated[
        str | None,
        Field(
            default=None,
            description="Text search string to match against relevant fields. Cannot "
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
    def parse_filters(cls, v: Any) -> Any:
        """Accept both JSON string and list of objects.

        Handles Claude Code bug where objects are double-serialized as
        strings. See: https://github.com/anthropics/claude-code/issues/5504
        """
        filter_type = get_args(cls.model_fields["filters"].annotation)[0]
        return parse_json_or_model_list(v, filter_type, "filters")

    @field_validator("select_columns", mode="before")
    @classmethod
    def parse_select_columns(cls, v: Any) -> List[str]:
        """Accept JSON array, list, or comma-separated string.

        Handles Claude Code bug where arrays are double-serialized as
        strings. See: https://github.com/anthropics/claude-code/issues/5504
        """
        return parse_json_or_list(v, "select_columns")

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "PaginatedListRequest[FilterT]":
        """Prevent using both search and filters simultaneously."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


class PaginatedResponse(BaseModel, Generic[FilterT]):
    """Shared base for `<Entity>List` response schemas.

    Subclasses add the entity-specific list field, e.g.
    `class TagList(PaginatedResponse[TagFilter]): tags: List[TagInfo]`.
    """

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
        description="Columns that were actually loaded",
    )
    columns_available: List[str] = Field(
        default_factory=list,
        description="All columns available for selection via select_columns parameter",
    )
    sortable_columns: List[str] = Field(
        default_factory=list,
        description="Columns that can be used with order_column parameter",
    )
    filters_applied: List[FilterT] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")
