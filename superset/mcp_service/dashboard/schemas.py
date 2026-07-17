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
Pydantic schemas for dashboard-related responses

This module contains Pydantic models for serializing dashboard data
in a consistent and type-safe manner.

Example usage:
    # For detailed dashboard info
    dashboard_info = DashboardInfo(
        id=1,
        dashboard_title="Sales Dashboard",
        published=True,
        editors=[SubjectInfo(id=1, label="admin", type="USER")],
        tags=[TagInfo(id=1, name="sales")],
        charts=[DashboardChartSummary(id=1, slice_name="Sales Chart")]
    )

    # For dashboard list responses
    dashboard_list = DashboardList(
        dashboards=[
            DashboardInfo(
                id=1,
                dashboard_title="Sales Dashboard",
                published=True,
                tags=[TagInfo(id=1, name="sales")]
            )
        ],
        count=1,
        total_count=1,
        page=0,
        page_size=10,
        total_pages=1,
        has_next=False,
        has_previous=False,
        columns_requested=["id", "dashboard_title"],
        columns_loaded=["id", "dashboard_title", "published"],
        filters_applied={"published": True},
        pagination=PaginationInfo(
            page=0,
            page_size=10,
            total_count=1,
            total_pages=1,
            has_next=False,
            has_previous=False
        ),
        timestamp=datetime.now(timezone.utc)
    )
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Annotated, Any, cast, Dict, List, Literal, TYPE_CHECKING

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_serializer,
    model_validator,
    PositiveInt,
)

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.common.cache_schemas import (
    CreatedByMeMixin,
    EditedByMeMixin,
    MetadataCacheControl,
)
from superset.mcp_service.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from superset.mcp_service.privacy import (
    filter_user_directory_fields,
    strip_user_directory_fields_from_schema,
    user_can_view_data_model_metadata,
)
from superset.mcp_service.system.schemas import (
    PaginationInfo,
    serialize_subject_object,
    SubjectInfo,
    TagInfo,
)
from superset.mcp_service.utils import (
    escape_llm_context_delimiters,
    sanitize_for_llm_context,
)
from superset.mcp_service.utils.response_utils import (
    humanize_timestamp,
    OmittedFieldsBuilder,
)
from superset.mcp_service.utils.sanitization import (
    sanitize_user_input,
    sanitize_user_input_with_changes,
)
from superset.mcp_service.utils.url_utils import get_superset_base_url
from superset.utils.json import loads as json_loads


class DashboardError(BaseModel):
    """Error response for dashboard operations"""

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
    def create(cls, error: str, error_type: str) -> "DashboardError":
        """Create a standardized DashboardError with timestamp."""
        return cls(
            error=error,
            error_type=error_type,
            timestamp=datetime.now(timezone.utc),
        )


def serialize_tag_object(tag: Any) -> TagInfo | None:
    """Serialize a tag object to TagInfo"""
    if not tag:
        return None

    return TagInfo(
        id=getattr(tag, "id", None),
        name=getattr(tag, "name", None),
        type=getattr(tag, "type", None),
        description=getattr(tag, "description", None),
    )


class DashboardFilter(ColumnOperator):
    """
    Filter object for dashboard listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal[  # pyright: ignore[reportIncompatibleVariableOverride]
        "dashboard_title",
        "published",
        "editor",
        "favorite",
        "created_by_fk",
        "changed_by_fk",
    ] = Field(
        ...,
        description=(
            "Column to filter on. Use "
            "get_schema(model_type='dashboard') for available "
            "filter columns. To filter by a person, first call find_users to "
            "resolve a name to a user ID, then filter by created_by_fk or "
            "changed_by_fk with that integer ID."
        ),
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. Use get_schema(model_type='dashboard') for "
        "available operators.",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class ListDashboardsRequest(EditedByMeMixin, CreatedByMeMixin, MetadataCacheControl):
    """Request schema for list_dashboards with clear, unambiguous types."""

    model_config = ConfigDict(populate_by_name=True)

    filters: Annotated[
        List[DashboardFilter],
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
            description="List of columns to select. Defaults to common columns "
            "if not specified.",
            validation_alias=AliasChoices("select_columns", "columns"),
        ),
    ]

    @field_validator("filters", mode="before")
    @classmethod
    def parse_filters(cls, v: Any) -> List[DashboardFilter]:
        """
        Parse filters from JSON string or list.

        Handles Claude Code bug where objects are double-serialized as strings.
        See: https://github.com/anthropics/claude-code/issues/5504
        """
        from superset.mcp_service.utils.schema_utils import parse_json_or_model_list

        return cast(
            List[DashboardFilter],
            parse_json_or_model_list(v, DashboardFilter, "filters"),
        )

    @field_validator("select_columns", mode="before")
    @classmethod
    def parse_select_columns(cls, v: Any) -> List[str]:
        """
        Parse select_columns from JSON string, list, or CSV string.

        Handles Claude Code bug where arrays are double-serialized as strings.
        See: https://github.com/anthropics/claude-code/issues/5504
        """
        from superset.mcp_service.utils.schema_utils import parse_json_or_list

        return parse_json_or_list(v, "select_columns")

    search: Annotated[
        str | None,
        Field(
            default=None,
            description="Text search string to match against dashboard fields. "
            "Cannot be used together with 'filters'.",
        ),
    ]
    deleted_state: Annotated[
        Literal["include", "only"] | None,
        Field(
            default=None,
            description=(
                "Surface soft-deleted (trashed) dashboards: 'only' returns "
                "just trashed dashboards, 'include' returns live and trashed "
                "together. Omit for live dashboards only (default). Trashed "
                "rows carry a non-null deleted_at and are limited to "
                "dashboards the caller owns (admins see all); requires the "
                "SOFT_DELETE feature flag to have produced trashed rows."
            ),
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

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListDashboardsRequest":
        """Prevent using both search and filters simultaneously."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


DEFAULT_GET_DASHBOARD_INFO_COLUMNS: List[str] = [
    "id",
    "dashboard_title",
    "slug",
    "description",
    "certified_by",
    "certification_details",
    "published",
    "is_managed_externally",
    "external_url",
    "created_on",
    "changed_on",
    "uuid",
    "embedded_uuid",
    "url",
    "created_on_humanized",
    "changed_on_humanized",
    "chart_count",
    "tags",
    "charts",
    "native_filters",
    "cross_filters_enabled",
    "is_permalink_state",
    "permalink_key",
]


class GetDashboardInfoRequest(MetadataCacheControl):
    """Request schema for get_dashboard_info with support for ID, UUID, or slug.

    When permalink_key is provided, the tool will retrieve the dashboard's filter
    state from the permalink, allowing you to see what filters the user has applied
    (not just the default filter state). This is useful when a user applies filters
    in a dashboard but the URL contains a permalink_key.
    """

    model_config = ConfigDict(populate_by_name=True)

    identifier: Annotated[
        int | str,
        Field(
            description=(
                "Dashboard identifier - can be numeric ID, UUID string, or slug"
            ),
            validation_alias=AliasChoices("identifier", "id", "dashboard_id"),
        ),
    ]
    permalink_key: str | None = Field(
        default=None,
        description=(
            "Optional permalink key for retrieving dashboard filter state. When a "
            "user applies filters in a dashboard, the state can be persisted in a "
            "permalink. If provided, the tool returns the filter configuration "
            "from that permalink."
        ),
    )
    select_columns: Annotated[
        List[str],
        Field(
            default_factory=lambda: list(DEFAULT_GET_DASHBOARD_INFO_COLUMNS),
            description=(
                "Top-level fields to include in the response. Defaults to a lean "
                "set that excludes 'css' (raw CSS, can be many KB) and 'filter_state' "
                "(only relevant when permalink_key is provided). Pass an explicit list "
                "to override, e.g. ['id','dashboard_title','charts'] for minimal "
                "output, or add 'css' to include raw dashboard CSS."
            ),
            validation_alias=AliasChoices("select_columns", "columns"),
        ),
    ]

    @field_validator("select_columns", mode="before")
    @classmethod
    def _parse_select_columns(cls, value: Any) -> Any:
        from superset.mcp_service.utils.schema_utils import parse_json_or_list

        if value is None:
            return list(DEFAULT_GET_DASHBOARD_INFO_COLUMNS)
        parsed = parse_json_or_list(value, "select_columns")
        return parsed if parsed else list(DEFAULT_GET_DASHBOARD_INFO_COLUMNS)


class GetDashboardLayoutRequest(BaseModel):
    """Request schema for get_dashboard_layout."""

    identifier: Annotated[
        int | str,
        Field(
            description="Dashboard identifier - can be numeric ID, UUID string, or slug"
        ),
    ]


class GetDashboardDatasetsRequest(BaseModel):
    """Request schema for get_dashboard_datasets."""

    identifier: Annotated[
        int | str,
        Field(
            description="Dashboard identifier - can be numeric ID, UUID string, or slug"
        ),
    ]


logger = logging.getLogger(__name__)


class NativeFilterSummary(BaseModel):
    """Lightweight summary of a native filter for LLM consumption.

    Extracts only the fields needed to understand what filters are
    available on a dashboard: name, type, and which columns they target.
    """

    id: str | None = Field(None, description="Filter ID")
    name: str | None = Field(None, description="Filter display name")
    filter_type: str | None = Field(
        None, description="Filter type (e.g. filter_select, filter_range)"
    )
    targets: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Filter targets (column name and dataset ID)",
    )


class DashboardChartSummary(BaseModel):
    """Lightweight chart representation for dashboard context.

    Contains only the fields needed for LLMs to understand which charts
    are on a dashboard, omitting verbose fields like form_data, tags,
    editors, and timestamps that bloat the response.
    """

    id: int | None = Field(None, description="Chart ID")
    slice_name: str | None = Field(None, description="Chart name")
    viz_type: str | None = Field(None, description="Visualization type")
    datasource_name: str | None = Field(None, description="Datasource name")
    url: str | None = Field(None, description="Chart explore page URL")
    description: str | None = Field(None, description="Chart description")


class DashboardInfo(BaseModel):
    id: int | None = None
    dashboard_title: str | None = None
    slug: str | None = None
    description: str | None = None
    css: str | None = None
    certified_by: str | None = None
    certification_details: str | None = None
    published: bool | None = None
    is_managed_externally: bool | None = None
    external_url: str | None = None
    created_on: str | datetime | None = None
    changed_on: str | datetime | None = None
    uuid: str | None = None
    deleted_at: str | datetime | None = Field(
        None,
        description=(
            "When the dashboard was moved to trash (soft-deleted); null for "
            "live dashboards. Only populated when listing with deleted_state."
        ),
    )
    embedded_uuid: str | None = Field(
        None,
        description=(
            "Embedded UUID for this dashboard. This is the UUID required when "
            "generating guest tokens for embedded dashboards "
            "(resources[].id in the guest token payload). "
            "Only present when the dashboard has been configured for embedding "
            "via the Embed Dashboard UI. Distinct from `uuid` (the internal "
            "dashboard UUID) — using the wrong one causes 403 errors in guest "
            "token validation."
        ),
    )
    url: str | None = None
    created_on_humanized: str | None = None
    changed_on_humanized: str | None = None
    chart_count: int = 0
    editors: List[SubjectInfo] = Field(default_factory=list)
    tags: List[TagInfo] = Field(default_factory=list)
    charts: List[DashboardChartSummary] = Field(
        default_factory=list,
        description=(
            "Charts on this dashboard. May be capped below chart_count "
            "(cap: MCP_RESPONSE_SIZE_CONFIG['max_list_items']) when the full "
            "response would exceed the token budget. "
            "Compare len(charts) to chart_count to detect this. For "
            "dashboards with more charts than the cap, call list_charts "
            "with filters=[{'col': 'dashboards', 'opr': 'eq', "
            "'value': <this dashboard's id>}] and page through with "
            "page/page_size to retrieve the complete list regardless of "
            "size."
        ),
    )

    # Structured filter information extracted from json_metadata
    native_filters: List[NativeFilterSummary] = Field(
        default_factory=list,
        description=(
            "Native filters configured on this dashboard. Extracted from "
            "json_metadata for LLM consumption. Includes filter name/type, "
            "and target columns only when data-model metadata is allowed. "
            "Subject to the same max_list_items cap as charts, though "
            "dashboards rarely have enough native filters to hit it; "
            "operators can raise MCP_RESPONSE_SIZE_CONFIG['max_list_items'] "
            "for tenants that do."
        ),
    )
    cross_filters_enabled: bool | None = Field(
        None,
        description="Whether cross-filtering between charts is enabled.",
    )

    # Omission metadata — tells the agent what was stripped and why
    omitted_fields: Dict[str, str] = Field(
        default_factory=dict,
        description=(
            "Fields omitted from this response to reduce size. Keys are field "
            "names, values describe what was omitted and how to access the full "
            "data. Useful filter information has been extracted into "
            "native_filters and cross_filters_enabled above."
        ),
    )

    # Fields for permalink/filter state support
    permalink_key: str | None = Field(
        default=None,
        description=(
            "Permalink key used to retrieve filter state. When present, indicates "
            "the filter_state came from a permalink rather than the default dashboard."
        ),
    )
    filter_state: Dict[str, Any] | None = Field(
        default=None,
        description=(
            "Filter state from permalink. Contains dataMask (native filter values), "
            "activeTabs, anchor, and urlParams. When present, represents the actual "
            "filters the user has applied to the dashboard. For users without "
            "data-model metadata access, dataMask and chartStates are omitted."
        ),
    )
    is_permalink_state: bool = Field(
        default=False,
        description=(
            "True if the filter_state came from a permalink rather than the default "
            "dashboard configuration. When true, the filter_state reflects what the "
            "user sees in the dashboard, not the default filter state."
        ),
    )

    model_config = ConfigDict(
        from_attributes=True,
        ser_json_timedelta="iso8601",
        json_schema_extra=strip_user_directory_fields_from_schema,
    )

    @model_serializer(mode="wrap")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> Dict[str, Any]:
        """Filter fields based on serialization context.

        If context contains 'select_columns', only include those fields.
        Otherwise, include all fields (default behavior).
        """
        # Get full serialization
        data = filter_user_directory_fields(serializer(self))

        # Check if we have a context with select_columns
        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                # Filter to only requested fields
                return {k: v for k, v in data.items() if k in select_columns}

        return data


class DashboardList(BaseModel):
    dashboards: List[DashboardInfo]
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
        description="Columns that were actually loaded for each dashboard",
    )
    columns_available: List[str] = Field(
        default_factory=list,
        description="All columns available for selection via select_columns parameter",
    )
    sortable_columns: List[str] = Field(
        default_factory=list,
        description="Columns that can be used with order_column parameter",
    )
    filters_applied: List[DashboardFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class AddChartToDashboardRequest(BaseModel):
    """Request schema for adding a chart to an existing dashboard."""

    model_config = ConfigDict(populate_by_name=True)

    dashboard_id: int = Field(
        ...,
        description="ID of the dashboard to add the chart to",
        validation_alias=AliasChoices("dashboard_id", "dashboard", "id"),
    )
    chart_id: int = Field(
        ...,
        description="ID of the chart to add to the dashboard",
        validation_alias=AliasChoices("chart_id", "chart"),
    )
    target_tab: str | None = Field(
        None,
        min_length=1,
        description=(
            "Tab to place the chart in. Accepts a tab display name "
            "(e.g. 'Sales') or a tab component ID (e.g. 'TAB-abc123'). "
            "Display-name matching is case-insensitive and strips all emoji; "
            "component ID matching is case-sensitive and exact. "
            "When not found, the error response lists all available tab names. "
            "When omitted on a tabbed dashboard the chart is placed in the "
            "first tab."
        ),
    )


class AddChartToDashboardResponse(BaseModel):
    """Response schema for adding chart to dashboard."""

    dashboard: DashboardInfo | None = Field(
        None, description="The updated dashboard info, if successful"
    )
    dashboard_url: str | None = Field(
        None, description="URL to view the updated dashboard"
    )
    position: dict[str, Any] | None = Field(
        None, description="Position information for the added chart"
    )
    error: str | None = Field(None, description="Error message, if operation failed")
    permission_denied: bool = Field(
        default=False,
        description=(
            "True when the operation failed because the current user does not "
            "have edit rights on the target dashboard. When True, inform the "
            "user and ask if they would like a new dashboard created instead. "
            "Do NOT silently create a new dashboard — always confirm first."
        ),
    )

    @field_validator("error")
    @classmethod
    def sanitize_error_for_llm_context(cls, value: str | None) -> str | None:
        """Wrap error text before it is exposed to LLM context.

        The error may echo user-supplied target_tab or dashboard-controlled tab
        labels — both must be wrapped so the LLM treats them as data, not
        instructions.
        """
        if value is None:
            return value
        return sanitize_for_llm_context(value, field_path=("error",))


class RemoveChartFromDashboardRequest(BaseModel):
    """Request schema for removing a chart from an existing dashboard."""

    dashboard_id: int = Field(
        ..., description="ID of the dashboard to remove the chart from"
    )
    chart_id: int = Field(
        ..., description="ID of the chart to remove from the dashboard"
    )


class RemoveChartFromDashboardResponse(BaseModel):
    """Response schema for removing a chart from a dashboard."""

    dashboard: DashboardInfo | None = Field(
        None, description="The updated dashboard info, if successful"
    )
    dashboard_url: str | None = Field(
        None, description="URL to view the updated dashboard"
    )
    removed_layout_keys: list[str] = Field(
        default_factory=list,
        description=(
            "Layout component IDs that were removed from position_json "
            "(the CHART components plus any ROW/COLUMN containers that "
            "became empty as a result)."
        ),
    )
    error: str | None = Field(None, description="Error message, if operation failed")
    permission_denied: bool = Field(
        default=False,
        description=(
            "True when the operation failed because the current user does not "
            "have edit rights on the target dashboard. When True, inform the "
            "user — do NOT attempt a workaround without confirming first."
        ),
    )

    @field_validator("error")
    @classmethod
    def sanitize_error_for_llm_context(cls, value: str | None) -> str | None:
        """Wrap error text before it is exposed to LLM context.

        The error may echo dashboard-controlled text (e.g. the dashboard
        title), which must be wrapped so the LLM treats it as data, not
        instructions.
        """
        if value is None:
            return value
        return sanitize_for_llm_context(value, field_path=("error",))


class GenerateDashboardRequest(BaseModel):
    """Request schema for generating a dashboard."""

    model_config = ConfigDict(populate_by_name=True)

    chart_ids: List[int] = Field(
        ..., description="List of chart IDs to include in the dashboard", min_length=1
    )
    dashboard_title: str | None = Field(
        None,
        description=(
            "Title for the new dashboard. When omitted a descriptive title "
            "is generated from the included chart names."
        ),
        validation_alias=AliasChoices("dashboard_title", "title", "name"),
    )
    description: str | None = Field(None, description="Description for the dashboard")
    published: bool = Field(
        default=False, description="Whether to publish the dashboard"
    )
    slug: str | None = Field(
        None,
        max_length=255,
        description=(
            "Optional URL slug for the dashboard. When set, the dashboard "
            "is reachable at /dashboard/<slug>/ instead of "
            "/dashboard/<id>/. Must be unique across the instance."
        ),
    )
    position_json: Dict[str, Any] | None = Field(
        None,
        description=(
            "Optional explicit dashboard layout (Superset's position_json "
            "dict). When set, replaces the auto-generated layout entirely. "
            "Pass this when you need custom row composition, MARKDOWN "
            "blocks, HEADER components, or specific chart widths/heights. "
            "Omit to let the tool auto-generate a packed grid from chart_ids."
        ),
    )
    json_metadata_overrides: Dict[str, Any] | None = Field(
        None,
        description=(
            "Optional overrides applied on top of the default "
            "json_metadata. Common fields: label_colors (per-series brand "
            "palette, e.g. {'Electronics': '#4C78A8'}), color_scheme "
            "(named Superset palette), cross_filters_enabled (bool, "
            "default False — set True for interactive dashboards), "
            "shared_label_colors (list of label names for cross-chart "
            "color consistency). Merged shallowly into the defaults; pass "
            "only the keys you want to override."
        ),
    )
    css: str | None = Field(
        None,
        max_length=50000,
        description=(
            "Optional dashboard-level CSS. Useful for hiding chart chrome "
            "(kebab menus, cross-filter chips) on print-ready dashboards, "
            "or tweaking padding/typography. Applied as-is to the "
            "dashboard's css field."
        ),
    )
    sanitization_warnings: List[str] = Field(
        default_factory=list,
        description=(
            "Internal: warnings emitted when user input was altered by "
            "sanitization. Populated by the ``mode='before'`` validator "
            "before dashboard_title is rewritten, so the tool can surface "
            "a notice to the caller instead of silently dropping content."
        ),
    )

    @model_validator(mode="before")
    @classmethod
    def _detect_dashboard_title_sanitization(cls, data: Any) -> Any:
        """Reject empty-after-sanitization titles and warn on partial strip.

        Runs before the ``dashboard_title`` field validator rewrites the
        value. If the caller supplied a non-empty title and sanitization
        would strip it entirely (XSS-only content), we raise so the caller
        gets a clear error instead of a blank-titled dashboard. When the
        sanitizer only trims part of the title, we record a warning the
        tool can return alongside the successful result.

        ``sanitization_warnings`` is a server-only field — any value the
        caller supplied is discarded here so the tool cannot be tricked
        into echoing attacker-controlled text back through the response.
        """
        if not isinstance(data, dict):
            return data
        data["sanitization_warnings"] = []
        for key in ("dashboard_title", "title", "name"):
            if key in data:
                raw = data[key]
                break
        else:
            raw = None
        if not isinstance(raw, str) or not raw.strip():
            return data
        sanitized, was_modified = sanitize_user_input_with_changes(
            raw, "Dashboard title", max_length=500, allow_empty=True
        )
        if was_modified and not sanitized:
            raise ValueError(
                "dashboard_title contained only disallowed content "
                "(HTML/script/URL schemes) and was removed entirely by "
                "sanitization. Provide a dashboard_title with plain text, "
                "or omit it to auto-generate one from chart names."
            )
        if was_modified:
            data["sanitization_warnings"].append(
                "dashboard_title was modified during sanitization to "
                "remove potentially unsafe content; the stored title "
                "differs from the input."
            )
        return data

    @field_validator("dashboard_title")
    @classmethod
    def sanitize_dashboard_title(cls, v: str | None) -> str | None:
        """Sanitize dashboard title to prevent XSS.

        Preserves an explicit empty string (caller-provided ``""``) rather
        than collapsing it to ``None``, since the tool treats ``None`` as
        "auto-generate a title from charts" but an explicit empty string
        as an intentional blank title.
        """
        if v is None or v == "":
            return v
        return sanitize_user_input(
            v, "Dashboard title", max_length=500, allow_empty=True
        )


class UpdateDashboardRequest(BaseModel):
    """Request schema for updating an existing dashboard's layout/theme/style.

    All fields are optional; only the fields explicitly passed are applied.
    Use to retroactively set a custom layout, brand palette, or CSS on a
    dashboard that was created via ``generate_dashboard`` (or earlier via
    the REST API) without a full re-create.
    """

    model_config = ConfigDict(populate_by_name=True)

    identifier: int | str = Field(
        ...,
        description=(
            "Dashboard ID (integer), UUID, or slug. Same identifier shape "
            "accepted by ``get_dashboard_info``."
        ),
    )
    dashboard_title: str | None = Field(
        None,
        max_length=500,
        description="Optional new dashboard title.",
        validation_alias=AliasChoices("dashboard_title", "title", "name"),
    )
    description: str | None = Field(
        None,
        description="Optional new dashboard description.",
    )
    slug: str | None = Field(
        None,
        max_length=255,
        description=("Optional new URL slug. Pass empty string to clear a slug."),
    )
    published: bool | None = Field(
        None,
        description="Optional published flag.",
    )
    position_json: Dict[str, Any] | None = Field(
        None,
        description=(
            "Optional replacement layout (Superset's position_json dict). "
            "When set, fully replaces the existing layout. Get the current "
            "layout via ``get_dashboard_info`` first if you want to make "
            "incremental changes."
        ),
    )
    json_metadata_overrides: Dict[str, Any] | None = Field(
        None,
        description=(
            "Optional overrides applied on top of the existing "
            "json_metadata. Merged shallowly — pass only the keys you "
            "want to change (e.g. label_colors, color_scheme, "
            "cross_filters_enabled)."
        ),
    )
    css: str | None = Field(
        None,
        max_length=50000,
        description=(
            "Optional new dashboard CSS. Pass empty string to clear existing CSS."
        ),
    )
    tags: List[int] | None = Field(
        None,
        description=(
            "Optional FULL-REPLACEMENT list of tag IDs to associate with the "
            "dashboard. Discover IDs with ``list_tags``. An empty list clears "
            "all custom tags. Omit (None) to leave tags unchanged."
        ),
    )
    cross_filters_enabled: bool | None = Field(
        None,
        description=(
            "Optional toggle for dashboard-wide cross filtering. Typed "
            "convenience for the ``cross_filters_enabled`` json_metadata key."
        ),
    )
    refresh_frequency: int | None = Field(
        None,
        ge=0,
        description=(
            "Optional auto-refresh interval in seconds (0 = off). Typed "
            "convenience for the ``refresh_frequency`` json_metadata key."
        ),
    )
    filter_bar_orientation: Literal["VERTICAL", "HORIZONTAL"] | None = Field(
        None,
        description=(
            "Optional native filter bar orientation. Typed convenience for "
            "the ``filter_bar_orientation`` json_metadata key."
        ),
    )
    sanitization_warnings: List[str] = Field(
        default_factory=list,
        description=(
            "Internal: warnings emitted when user input was altered by "
            "sanitization. Populated by the ``mode='before'`` validator "
            "before dashboard_title is rewritten."
        ),
    )

    @model_validator(mode="before")
    @classmethod
    def _detect_dashboard_title_sanitization(cls, data: Any) -> Any:
        """Reject empty-after-sanitization titles and warn on partial strip.

        Mirrors the same guard ``GenerateDashboardRequest`` applies so a
        prompt-injected LLM cannot push XSS payloads through the update
        path that the create path already rejects. Server-only
        ``sanitization_warnings`` is reset here so a caller cannot inject
        warning text.
        """
        if not isinstance(data, dict):
            return data
        data["sanitization_warnings"] = []
        # Must match every AliasChoice on ``dashboard_title`` — otherwise
        # an XSS payload supplied via a different key (e.g. ``name``)
        # would bypass this ``mode='before'`` guard and slip through to
        # Pydantic's alias resolution unsanitized.
        for key in ("dashboard_title", "title", "name"):
            if key in data:
                raw = data[key]
                break
        else:
            raw = None
        if not isinstance(raw, str) or not raw.strip():
            return data
        sanitized, was_modified = sanitize_user_input_with_changes(
            raw, "Dashboard title", max_length=500, allow_empty=True
        )
        if was_modified and not sanitized:
            raise ValueError(
                "dashboard_title contained only disallowed content "
                "(HTML/script/URL schemes) and was removed entirely by "
                "sanitization. Provide a dashboard_title with plain text."
            )
        if was_modified:
            data["sanitization_warnings"].append(
                "dashboard_title was modified during sanitization to "
                "remove potentially unsafe content; the stored title "
                "differs from the input."
            )
        return data

    @field_validator("dashboard_title")
    @classmethod
    def sanitize_dashboard_title(cls, v: str | None) -> str | None:
        """Sanitize dashboard title to prevent XSS."""
        if v is None or v == "":
            return v
        return sanitize_user_input(
            v, "Dashboard title", max_length=500, allow_empty=True
        )

    @field_validator("slug")
    @classmethod
    def normalize_slug(cls, v: str | None) -> str | None:
        """Normalize the slug to match the REST DashboardPutSchema contract.

        Mirrors ``BaseDashboardSchema.post_load``: strip, replace spaces with
        hyphens, and drop characters outside ``[\\w-]`` so the tool cannot
        persist slugs the REST update path would have cleaned.

        Whitespace-only inputs normalize to ``""`` (clears the slug), matching
        REST schema behavior. Raises ``ValueError`` when a non-whitespace input
        normalizes to empty (e.g. ``"!!!"``), preventing accidental slug clearing.
        """
        if not v:
            return v
        stripped = v.strip()
        if not stripped:
            return ""  # whitespace-only → same as empty string (clears slug)
        normalized = re.sub(r"[^\w\-]+", "", stripped.replace(" ", "-"))
        if not normalized:
            raise ValueError(
                "slug contains only characters that are removed during "
                "normalization; use letters, digits, underscores, or hyphens"
            )
        return normalized


class UpdateDashboardResponse(BaseModel):
    """Response schema for ``update_dashboard``.

    Distinct from ``GenerateDashboardResponse`` because the semantics
    differ: this response reports which fields actually changed on an
    existing dashboard, rather than describing a newly created one.
    """

    dashboard: DashboardInfo | None = Field(
        None, description="The updated dashboard info, if successful"
    )
    dashboard_url: str | None = Field(None, description="URL to view the dashboard")
    error: str | None = Field(None, description="Error message, if update failed")
    permission_denied: bool = Field(
        default=False,
        description=(
            "True when the user lacks edit rights on the target "
            "dashboard. When True, ``error`` carries the human-readable "
            "explanation and the response is otherwise empty."
        ),
    )
    changed_fields: List[str] = Field(
        default_factory=list,
        description=(
            "Names of fields that were actually applied. Empty when the "
            "request was a no-op or failed before any field was applied."
        ),
    )
    warnings: List[str] = Field(
        default_factory=list,
        description=(
            "Non-fatal advisory messages — for example, that the supplied "
            "title was altered by sanitization."
        ),
    )


class GenerateDashboardResponse(BaseModel):
    """Response schema for dashboard generation."""

    dashboard: DashboardInfo | None = Field(
        None, description="The created dashboard info, if successful"
    )
    dashboard_url: str | None = Field(None, description="URL to view the dashboard")
    error: str | None = Field(None, description="Error message, if creation failed")
    warnings: List[str] = Field(
        default_factory=list,
        description=(
            "Non-fatal advisory messages about the created dashboard — "
            "for example, that the supplied title was altered by "
            "sanitization."
        ),
    )


class DuplicateDashboardRequest(BaseModel):
    """Request schema for duplicating an existing dashboard."""

    model_config = ConfigDict(populate_by_name=True)

    dashboard_id: Annotated[
        int | str,
        Field(
            description=(
                "Source dashboard identifier - can be numeric ID, UUID string, or slug"
            )
        ),
    ]
    dashboard_title: str = Field(
        ...,
        description="Title for the new (duplicated) dashboard",
        validation_alias=AliasChoices("dashboard_title", "title", "name"),
    )
    duplicate_slices: bool = Field(
        default=False,
        description=(
            "When true, every chart on the source dashboard is deep-copied "
            "into a new chart object owned by the caller. When false "
            "(default), the new dashboard references the same charts as the "
            "source."
        ),
    )
    sanitization_warnings: List[str] = Field(
        default_factory=list,
        description=(
            "Internal: warnings emitted when user input was altered by "
            "sanitization. Populated by the ``mode='before'`` validator "
            "before dashboard_title is rewritten, so the tool can surface "
            "a notice to the caller instead of silently dropping content."
        ),
    )

    @model_validator(mode="before")
    @classmethod
    def _detect_dashboard_title_sanitization(cls, data: Any) -> Any:
        """Reject empty-after-sanitization titles and warn on partial strip.

        Runs before the ``dashboard_title`` field validator rewrites the
        value. If the caller supplied a title that sanitization would strip
        entirely (XSS-only content), we raise so the caller gets a clear
        error instead of a blank-titled dashboard. When the sanitizer only
        trims part of the title, we record a warning the tool can return
        alongside the successful result.

        ``sanitization_warnings`` is a server-only field — any value the
        caller supplied is discarded here so the tool cannot be tricked
        into echoing attacker-controlled text back through the response.
        """
        if not isinstance(data, dict):
            return data
        data["sanitization_warnings"] = []
        for key in ("dashboard_title", "title", "name"):
            if key in data:
                raw = data[key]
                break
        else:
            raw = None
        if not isinstance(raw, str) or not raw.strip():
            return data
        sanitized, was_modified = sanitize_user_input_with_changes(
            raw, "Dashboard title", max_length=500, allow_empty=True
        )
        if was_modified and not sanitized:
            raise ValueError(
                "dashboard_title contained only disallowed content "
                "(HTML/script/URL schemes) and was removed entirely by "
                "sanitization. Provide a dashboard_title with plain text."
            )
        if was_modified:
            data["sanitization_warnings"].append(
                "dashboard_title was modified during sanitization to "
                "remove potentially unsafe content; the stored title "
                "differs from the input."
            )
        return data

    @field_validator("dashboard_title")
    @classmethod
    def sanitize_dashboard_title(cls, v: str) -> str:
        """Sanitize dashboard title to prevent XSS."""
        sanitized = sanitize_user_input(
            v, "Dashboard title", max_length=500, allow_empty=True
        )
        if not sanitized:
            raise ValueError("dashboard_title cannot be empty")
        return sanitized


class DuplicateDashboardResponse(BaseModel):
    """Response schema for dashboard duplication."""

    dashboard: DashboardInfo | None = Field(
        None, description="The newly created dashboard info, if successful"
    )
    dashboard_url: str | None = Field(None, description="URL to view the new dashboard")
    duplicated_slices: bool = Field(
        default=False,
        description=(
            "True when the source dashboard's charts were deep-copied into "
            "new chart objects; False when the new dashboard references the "
            "original charts."
        ),
    )
    error: str | None = Field(None, description="Error message, if duplication failed")
    warnings: List[str] = Field(
        default_factory=list,
        description=(
            "Non-fatal advisory messages about the duplicated dashboard — "
            "for example, that the supplied title was altered by "
            "sanitization."
        ),
    )

    @field_validator("error")
    @classmethod
    def sanitize_error_for_llm_context(cls, value: str | None) -> str | None:
        """Wrap error text before it is exposed to LLM context.

        The error may echo dashboard-controlled content such as the source
        dashboard title — wrap it so the LLM treats it as data, not
        instructions.
        """
        if value is None:
            return value
        return sanitize_for_llm_context(value, field_path=("error",))


class ChartPosition(BaseModel):
    """Position and identity of a chart within a dashboard layout."""

    chart_id: int | None = Field(None, description="Chart (slice) ID")
    slice_name: str | None = Field(
        None,
        description=(
            "Display name as configured in the layout (sliceNameOverride or sliceName)"
        ),
    )
    tab_id: str | None = Field(
        None,
        description=(
            "ID of the tab that contains this chart, or None for charts not nested "
            "under any TAB component."
        ),
    )
    tab_path: List[str] = Field(
        default_factory=list,
        description=(
            "Names of ancestor tabs (outermost first) so the agent can describe "
            "where the chart lives in nested tab layouts."
        ),
    )
    width: int | None = Field(None, description="Grid column width")
    height: int | None = Field(None, description="Grid row height")


class DashboardTab(BaseModel):
    """A tab in a dashboard layout."""

    id: str = Field(..., description="Tab component ID from position_json")
    name: str | None = Field(None, description="Tab display name")
    parent_tab_id: str | None = Field(
        None,
        description=("ID of the enclosing tab when tabs are nested, otherwise None."),
    )
    chart_ids: List[int] = Field(
        default_factory=list,
        description="IDs of charts contained directly or indirectly under this tab",
    )


class DashboardLayout(BaseModel):
    """Parsed layout data for a dashboard, derived from position_json."""

    id: int | None = Field(None, description="Dashboard ID")
    dashboard_title: str | None = Field(None, description="Dashboard title")
    uuid: str | None = Field(None, description="Dashboard UUID")
    tabs: List[DashboardTab] = Field(
        default_factory=list,
        description=(
            "Tabs declared in the dashboard layout (empty for untabbed dashboards)"
        ),
    )
    charts: List[ChartPosition] = Field(
        default_factory=list,
        description="Charts placed in the dashboard layout with their tab context",
    )
    has_layout: bool = Field(
        default=False,
        description="False when position_json is missing or empty",
    )


def _parse_json_metadata(json_metadata_str: str | None) -> Dict[str, Any] | None:
    """Parse json_metadata string into a dict, returning None on any failure.

    Handles None/empty input, invalid JSON, and non-dict JSON values
    (e.g. ``"[]"``, ``"123"``) by returning None instead of raising.
    """
    if not json_metadata_str:
        return None
    try:
        metadata = json_loads(json_metadata_str)
    except (ValueError, TypeError):
        return None
    if not isinstance(metadata, dict):
        return None
    return metadata


def _extract_native_filters(
    json_metadata_str: str | None,
    *,
    include_data_model_metadata: bool = False,
) -> List[NativeFilterSummary]:
    """Extract native filter summaries from raw json_metadata string.

    Parses the json_metadata JSON blob and pulls out only the filter
    name, type, and optionally targets — dropping verbose fields like controlValues,
    defaultDataMask, scope, and cascadeParentIds. Restricted users keep filter
    names and types, but target columns and dataset IDs are data-model metadata.
    """
    metadata = _parse_json_metadata(json_metadata_str)
    if metadata is None:
        return []

    native_filters = metadata.get("native_filter_configuration", [])
    if not isinstance(native_filters, list):
        return []

    summaries: List[NativeFilterSummary] = []
    for f in native_filters:
        if not isinstance(f, dict):
            continue
        raw_targets = f.get("targets", [])
        if not isinstance(raw_targets, list):
            raw_targets = []
        targets = (
            [t for t in raw_targets if isinstance(t, dict)]
            if include_data_model_metadata
            else []
        )
        summaries.append(
            NativeFilterSummary(
                id=f.get("id"),
                name=f.get("name"),
                filter_type=f.get("filterType"),
                targets=targets,
            )
        )
    return summaries


def _extract_cross_filters_enabled(json_metadata_str: str | None) -> bool | None:
    """Extract the cross_filters_enabled flag from json_metadata."""
    metadata = _parse_json_metadata(json_metadata_str)
    if metadata is None:
        return None
    cross_filters = metadata.get("cross_filters_enabled")
    if isinstance(cross_filters, bool):
        return cross_filters
    return None


def _parse_position_json(
    position_json_str: str | None,
) -> Dict[str, Any] | None:
    """Parse position_json into a dict, returning None on any failure."""
    if not position_json_str:
        return None
    try:
        data = json_loads(position_json_str)
    except (ValueError, TypeError):
        return None
    if not isinstance(data, dict):
        return None
    return data


def _record_tab(
    node_id: str,
    meta: Dict[str, Any],
    tab_ancestry: tuple[str, ...],
    tabs_by_id: Dict[str, DashboardTab],
) -> None:
    """Register a TAB node into tabs_by_id keyed by component id."""
    raw_text = meta.get("text")
    tab_name = raw_text if isinstance(raw_text, str) else None
    tabs_by_id[node_id] = DashboardTab(
        id=node_id,
        name=tab_name,
        parent_tab_id=tab_ancestry[-1] if tab_ancestry else None,
    )


def _record_chart(
    meta: Dict[str, Any],
    tab_ancestry: tuple[str, ...],
    tabs_by_id: Dict[str, DashboardTab],
    charts: List[ChartPosition],
) -> None:
    """Record a CHART node's position and update enclosing tabs."""
    raw_chart_id = meta.get("chartId")
    chart_id = raw_chart_id if isinstance(raw_chart_id, int) else None
    display_name = meta.get("sliceNameOverride") or meta.get("sliceName")
    raw_width = meta.get("width")
    raw_height = meta.get("height")
    charts.append(
        ChartPosition(
            chart_id=chart_id,
            slice_name=display_name if isinstance(display_name, str) else None,
            tab_id=tab_ancestry[-1] if tab_ancestry else None,
            tab_path=[tabs_by_id[t].name or t for t in tab_ancestry if t in tabs_by_id],
            width=raw_width if isinstance(raw_width, int) else None,
            height=raw_height if isinstance(raw_height, int) else None,
        )
    )
    if chart_id is None:
        return
    for ancestor_id in tab_ancestry:
        tab = tabs_by_id.get(ancestor_id)
        if tab is not None and chart_id not in tab.chart_ids:
            tab.chart_ids.append(chart_id)


def _extract_layout_from_position(
    position_json_str: str | None,
) -> tuple[List[DashboardTab], List[ChartPosition]]:
    """Walk position_json and return (tabs, chart_positions).

    Traverses the component tree iteratively starting from ROOT_ID. Tab
    ancestry is tracked so chart placement and nested tab references stay
    accurate. Malformed or missing nodes are skipped silently — partial
    data is more useful than an exception here, since agents call this
    tool defensively after seeing the omitted_fields hint.
    """
    position = _parse_position_json(position_json_str)
    if not position or "ROOT_ID" not in position:
        return [], []

    tabs_by_id: Dict[str, DashboardTab] = {}
    charts: List[ChartPosition] = []

    stack: List[tuple[str, tuple[str, ...]]] = [("ROOT_ID", ())]
    visited: set[str] = set()

    while stack:
        node_id, tab_ancestry = stack.pop()
        if node_id in visited:
            continue
        visited.add(node_id)

        node = position.get(node_id)
        if not isinstance(node, dict):
            continue

        node_type = node.get("type")
        raw_meta = node.get("meta")
        meta: Dict[str, Any] = raw_meta if isinstance(raw_meta, dict) else {}
        next_ancestry = tab_ancestry

        if node_type == "TAB":
            _record_tab(node_id, meta, tab_ancestry, tabs_by_id)
            next_ancestry = tab_ancestry + (node_id,)
        elif node_type == "CHART":
            _record_chart(meta, tab_ancestry, tabs_by_id, charts)

        children = node.get("children")
        if isinstance(children, list):
            for child_id in reversed(children):
                if isinstance(child_id, str):
                    stack.append((child_id, next_ancestry))

    tab_order = [
        node_id
        for node_id in position
        if isinstance(position.get(node_id), dict)
        and position[node_id].get("type") == "TAB"
        and node_id in tabs_by_id
    ]
    tabs = [tabs_by_id[node_id] for node_id in tab_order]
    return tabs, charts


def _build_omitted_fields(
    json_metadata_str: str | None, position_json_str: str | None
) -> Dict[str, str]:
    """Build omission metadata describing which fields were stripped and why.

    Uses the shared OmittedFieldsBuilder utility so the pattern is consistent
    across all MCP tool serializers.
    """

    return (
        OmittedFieldsBuilder()
        .add_raw_field(
            "position_json",
            raw_value=position_json_str,
            reason=(
                "Internal layout tree with component positions/hierarchy. "
                "Call get_dashboard_layout(identifier) to retrieve parsed tabs "
                "and chart positions on demand."
            ),
        )
        .add_extracted_field(
            "json_metadata",
            raw_value=json_metadata_str,
            reason=(
                "native_filters and cross_filters_enabled extracted into "
                "dedicated fields above."
            ),
        )
        .build()
    )


def serialize_chart_summary(
    chart: Any,
    *,
    include_data_model_metadata: bool = False,
) -> DashboardChartSummary | None:
    """Serialize a chart to a lightweight summary for dashboard context."""
    if not chart:
        return None

    chart_id = getattr(chart, "id", None)
    chart_url = None
    if chart_id is not None:
        chart_url = f"{get_superset_base_url()}/explore/?slice_id={chart_id}"

    return DashboardChartSummary(
        id=chart_id,
        slice_name=getattr(chart, "slice_name", None),
        viz_type=getattr(chart, "viz_type", None),
        datasource_name=getattr(chart, "datasource_name", None)
        if include_data_model_metadata
        else None,
        url=chart_url,
        description=getattr(chart, "description", None),
    )


def redact_filter_state_data_model_metadata(
    filter_state: Dict[str, Any],
) -> Dict[str, Any]:
    """Remove permalink filter state fields that expose data-model metadata."""
    return {
        key: value
        for key, value in filter_state.items()
        if key not in {"dataMask", "chartStates"}
    }


def _sanitize_dashboard_info_for_llm_context(
    dashboard_info: DashboardInfo,
) -> DashboardInfo:
    """Wrap dashboard read-path descriptive fields before LLM exposure."""
    payload = dashboard_info.model_dump(mode="python")

    for field_name in (
        "dashboard_title",
        "description",
        "css",
        "certified_by",
        "certification_details",
    ):
        payload[field_name] = sanitize_for_llm_context(
            payload.get(field_name),
            field_path=(field_name,),
        )

    payload["native_filters"] = [
        {
            **native_filter,
            "name": sanitize_for_llm_context(
                native_filter.get("name"),
                field_path=("native_filters", str(index), "name"),
            ),
            "targets": sanitize_for_llm_context(
                native_filter.get("targets", []),
                field_path=("native_filters", str(index), "targets"),
                excluded_field_names=frozenset(),
            ),
        }
        for index, native_filter in enumerate(payload.get("native_filters", []))
    ]

    payload["charts"] = [
        {
            **chart,
            "slice_name": sanitize_for_llm_context(
                chart.get("slice_name"),
                field_path=("charts", str(index), "slice_name"),
            ),
            "description": sanitize_for_llm_context(
                chart.get("description"),
                field_path=("charts", str(index), "description"),
            ),
            "datasource_name": escape_llm_context_delimiters(
                chart.get("datasource_name"),
            ),
        }
        for index, chart in enumerate(payload.get("charts", []))
    ]

    if payload.get("filter_state") is not None:
        payload["filter_state"] = sanitize_for_llm_context(
            payload["filter_state"],
            field_path=("filter_state",),
            excluded_field_names=frozenset(),
        )

    payload["tags"] = [
        {
            **tag,
            "name": sanitize_for_llm_context(
                tag.get("name"),
                field_path=("tags", str(index), "name"),
            ),
            "description": sanitize_for_llm_context(
                tag.get("description"),
                field_path=("tags", str(index), "description"),
            ),
        }
        for index, tag in enumerate(payload.get("tags", []))
    ]

    return DashboardInfo.model_validate(payload)


def _safe_user_label(value: Any) -> str | None:
    """Coerce a `*_by_name` model attribute to a display string or None.

    The Dashboard model exposes ``created_by_name`` / ``changed_by_name``
    as plain strings, but some serializer call sites pass through
    objects (User instances, Mocks in tests) — defensive coercion keeps
    the response a valid string and avoids leaking ``repr(user)``.
    """
    if isinstance(value, str) and value:
        return value
    return None


def dashboard_serializer(dashboard: "Dashboard") -> DashboardInfo:
    include_data_model_metadata = user_can_view_data_model_metadata()
    base_url = get_superset_base_url()
    relative_url = dashboard.url  # e.g. "/dashboard/{slug_or_id}/"
    absolute_url = f"{base_url}{relative_url}" if relative_url else None
    json_metadata_str = getattr(dashboard, "json_metadata", None)
    position_json_str = getattr(dashboard, "position_json", None)

    return _sanitize_dashboard_info_for_llm_context(
        DashboardInfo(
            id=dashboard.id,
            dashboard_title=dashboard.dashboard_title or "Untitled",
            slug=dashboard.slug or "",
            description=dashboard.description,
            css=dashboard.css,
            certified_by=dashboard.certified_by,
            certification_details=dashboard.certification_details,
            published=dashboard.published,
            is_managed_externally=dashboard.is_managed_externally,
            external_url=dashboard.external_url,
            created_on=dashboard.created_on,
            changed_on=dashboard.changed_on,
            uuid=str(dashboard.uuid) if dashboard.uuid else None,
            embedded_uuid=str(dashboard.embedded[0].uuid)
            if dashboard.embedded
            else None,
            url=absolute_url,
            created_on_humanized=dashboard.created_on_humanized,
            changed_on_humanized=dashboard.changed_on_humanized,
            chart_count=len(dashboard.slices) if dashboard.slices else 0,
            native_filters=_extract_native_filters(
                json_metadata_str,
                include_data_model_metadata=include_data_model_metadata,
            ),
            cross_filters_enabled=_extract_cross_filters_enabled(json_metadata_str),
            omitted_fields=_build_omitted_fields(
                json_metadata_str,
                position_json_str,
            ),
            editors=[
                info
                for editor in dashboard.editors
                if (info := serialize_subject_object(editor)) is not None
            ]
            if dashboard.editors
            else [],
            tags=[
                TagInfo.model_validate(tag, from_attributes=True)
                for tag in dashboard.tags
            ]
            if dashboard.tags
            else [],
            charts=[
                summary
                for chart in dashboard.slices
                if (
                    summary := serialize_chart_summary(
                        chart,
                        include_data_model_metadata=include_data_model_metadata,
                    )
                )
                is not None
            ]
            if dashboard.slices
            else [],
        )
    )


def serialize_dashboard_object(dashboard: Any) -> DashboardInfo:
    """Simple dashboard serializer that safely handles object attributes."""

    # Construct URL from id/slug (the model's @property isn't available on
    # column-only query tuples returned by DAO.list with select_columns)
    dashboard_id = getattr(dashboard, "id", None)
    slug = getattr(dashboard, "slug", None)
    dashboard_url = None
    if dashboard_id is not None:
        dashboard_url = f"{get_superset_base_url()}/dashboard/{slug or dashboard_id}/"

    json_metadata_str = getattr(dashboard, "json_metadata", None)
    position_json_str = getattr(dashboard, "position_json", None)
    include_data_model_metadata = user_can_view_data_model_metadata()

    return _sanitize_dashboard_info_for_llm_context(
        DashboardInfo(
            id=dashboard_id,
            dashboard_title=getattr(dashboard, "dashboard_title", None),
            slug=slug or "",
            url=dashboard_url,
            published=getattr(dashboard, "published", None),
            changed_on=getattr(dashboard, "changed_on", None),
            changed_on_humanized=humanize_timestamp(
                getattr(dashboard, "changed_on", None)
            ),
            created_on=getattr(dashboard, "created_on", None),
            created_on_humanized=humanize_timestamp(
                getattr(dashboard, "created_on", None)
            ),
            description=getattr(dashboard, "description", None),
            css=getattr(dashboard, "css", None),
            certified_by=getattr(dashboard, "certified_by", None),
            certification_details=getattr(dashboard, "certification_details", None),
            deleted_at=getattr(dashboard, "deleted_at", None),
            native_filters=_extract_native_filters(
                json_metadata_str,
                include_data_model_metadata=include_data_model_metadata,
            ),
            cross_filters_enabled=_extract_cross_filters_enabled(json_metadata_str),
            omitted_fields=_build_omitted_fields(json_metadata_str, position_json_str),
            is_managed_externally=getattr(dashboard, "is_managed_externally", None),
            external_url=getattr(dashboard, "external_url", None),
            uuid=str(getattr(dashboard, "uuid", ""))
            if getattr(dashboard, "uuid", None)
            else None,
            chart_count=len(getattr(dashboard, "slices", [])),
            editors=[
                info
                for editor in getattr(dashboard, "editors", [])
                if (info := serialize_subject_object(editor)) is not None
            ]
            if getattr(dashboard, "editors", None)
            else [],
            tags=[
                TagInfo.model_validate(tag, from_attributes=True)
                for tag in getattr(dashboard, "tags", [])
            ]
            if getattr(dashboard, "tags", None)
            else [],
            charts=[
                summary
                for chart in getattr(dashboard, "slices", [])
                if (
                    summary := serialize_chart_summary(
                        chart,
                        include_data_model_metadata=include_data_model_metadata,
                    )
                )
                is not None
            ]
            if getattr(dashboard, "slices", None)
            else [],
        )
    )


def _sanitize_dashboard_layout_for_llm_context(
    layout: DashboardLayout,
) -> DashboardLayout:
    """Wrap layout text fields before LLM exposure."""
    payload = layout.model_dump(mode="python")
    payload["dashboard_title"] = sanitize_for_llm_context(
        payload.get("dashboard_title"),
        field_path=("dashboard_title",),
    )
    payload["tabs"] = [
        {
            **tab,
            "name": sanitize_for_llm_context(
                tab.get("name"),
                field_path=("tabs", str(index), "name"),
            ),
        }
        for index, tab in enumerate(payload.get("tabs", []))
    ]
    payload["charts"] = [
        {
            **chart,
            "slice_name": sanitize_for_llm_context(
                chart.get("slice_name"),
                field_path=("charts", str(index), "slice_name"),
            ),
            "tab_path": [
                sanitize_for_llm_context(
                    name,
                    field_path=("charts", str(index), "tab_path", str(part_index)),
                )
                for part_index, name in enumerate(chart.get("tab_path", []) or [])
            ],
        }
        for index, chart in enumerate(payload.get("charts", []))
    ]
    return DashboardLayout.model_validate(payload)


def dashboard_layout_serializer(dashboard: "Dashboard") -> DashboardLayout:
    """Serialize a Dashboard model to a parsed DashboardLayout."""
    position_json_str = getattr(dashboard, "position_json", None)
    tabs, charts = _extract_layout_from_position(position_json_str)
    return _sanitize_dashboard_layout_for_llm_context(
        DashboardLayout(
            id=dashboard.id,
            dashboard_title=dashboard.dashboard_title or "Untitled",
            uuid=str(dashboard.uuid) if dashboard.uuid else None,
            tabs=tabs,
            charts=charts,
            has_layout=bool(position_json_str),
        )
    )


class DeleteDashboardRequest(BaseModel):
    """Request schema for delete_dashboard."""

    identifier: int | str = Field(
        ...,
        description="Dashboard identifier - numeric ID, UUID string, or slug.",
    )

    @field_validator("identifier", mode="before")
    @classmethod
    def reject_bool_identifier(cls, value: object) -> object:
        """bool is a subclass of int, so identifier=true would coerce to
        dashboard ID 1 and delete the wrong object; reject it outright."""
        if isinstance(value, bool):
            raise ValueError("identifier must be an integer ID, UUID, or slug string")
        return value


class DeleteDashboardResponse(BaseModel):
    """Result of a delete_dashboard operation."""

    success: bool = Field(description="Whether the dashboard was deleted")
    deleted_id: int | None = Field(None, description="ID of the deleted dashboard")
    deleted_name: str | None = Field(None, description="Title of the deleted dashboard")
    soft_deleted: bool = Field(
        False,
        description=(
            "True when the dashboard was soft-deleted (moved to trash, because "
            "the SOFT_DELETE feature flag is enabled) and can be restored by an "
            "owner or Admin. False means the delete was permanent."
        ),
    )
    message: str | None = Field(None, description="Human-readable outcome message")
    error: str | None = Field(None, description="Error message if the delete failed")
    error_type: str | None = Field(None, description="Type of error if failed")
    permission_denied: bool = Field(
        False,
        description=(
            "True when the caller lacks permission to delete the dashboard (do "
            "not retry; ask the user)."
        ),
    )


# ---------------------------------------------------------------------------
# manage_native_filters schemas
# ---------------------------------------------------------------------------


class BaseNewFilterSpec(BaseModel):
    """Common fields shared by all new native filter specs."""

    name: str = Field(..., min_length=1, description="Filter display name")
    description: str = Field("", description="Optional filter description")
    scope_chart_ids: List[int] | None = Field(
        None,
        description=(
            "Chart IDs this filter should apply to. When omitted the filter "
            "applies to all charts on the dashboard. All IDs must belong to "
            "charts that are on the dashboard."
        ),
    )


class FilterSelectSpec(BaseNewFilterSpec):
    """Spec for a new dropdown (filter_select) native filter."""

    filter_type: Literal["filter_select"] = Field(
        ..., description="Discriminator - must be 'filter_select'"
    )
    dataset_id: int = Field(..., description="ID of the dataset to filter on")
    column: str = Field(
        ..., min_length=1, description="Name of the dataset column to filter on"
    )
    multi_select: bool = Field(
        True, description="Allow selecting multiple values (default True)"
    )
    default_to_first_item: bool = Field(
        False, description="Default the filter to the first item in the list"
    )
    enable_empty_filter: bool = Field(
        False, description="Require a value before the filter is applied"
    )
    sort_ascending: bool | None = Field(
        None,
        description=(
            "Sort filter values ascending (True) or descending (False). "
            "When omitted, values are not explicitly sorted."
        ),
    )
    search_all_options: bool = Field(
        False, description="Query the database on search rather than client-side"
    )


class FilterTimeSpec(BaseNewFilterSpec):
    """Spec for a new time range (filter_time) native filter."""

    filter_type: Literal["filter_time"] = Field(
        ..., description="Discriminator - must be 'filter_time'"
    )
    default_time_range: str | None = Field(
        None,
        description=(
            "Default time range value, e.g. 'Last week', 'Last month', "
            "'2024-01-01 : 2024-12-31'. When omitted the filter has no default."
        ),
    )


NewNativeFilterSpec = Annotated[
    FilterSelectSpec | FilterTimeSpec,
    Field(discriminator="filter_type"),
]


class NativeFilterUpdateSpec(BaseModel):
    """Partial update for an existing native filter.

    Only ``id`` is required; any other provided field is merged into the
    existing filter configuration. Fields that only apply to one filter
    type (e.g. ``multi_select`` for filter_select, ``default_time_range``
    for filter_time) are rejected when used on the wrong filter type.
    """

    id: str = Field(..., min_length=1, description="ID of the filter to update")
    name: str | None = Field(None, min_length=1, description="New display name")
    description: str | None = Field(None, description="New description")
    dataset_id: int | None = Field(
        None, description="New target dataset ID (filter_select only)"
    )
    column: str | None = Field(
        None, min_length=1, description="New target column name (filter_select only)"
    )
    multi_select: bool | None = Field(
        None, description="Allow multiple values (filter_select only)"
    )
    default_to_first_item: bool | None = Field(
        None, description="Default to first item (filter_select only)"
    )
    enable_empty_filter: bool | None = Field(
        None, description="Require a value (filter_select only)"
    )
    sort_ascending: bool | None = Field(
        None, description="Sort values ascending/descending (filter_select only)"
    )
    search_all_options: bool | None = Field(
        None, description="Search all options in the database (filter_select only)"
    )
    default_time_range: str | None = Field(
        None, description="Default time range (filter_time only)"
    )
    scope_chart_ids: List[int] | None = Field(
        None,
        description=(
            "Chart IDs this filter should apply to. Replaces the current "
            "scope. All IDs must belong to charts on the dashboard."
        ),
    )


class ManageNativeFiltersRequest(BaseModel):
    """Request schema for the manage_native_filters tool."""

    dashboard_id: int = Field(..., description="ID of the dashboard to modify")
    add: List[NewNativeFilterSpec] = Field(
        default_factory=list,
        description=(
            "New filters to create. Supported types: filter_select "
            "(dropdown) and filter_time (time range). Other filter types "
            "(numerical range, time column, time grain) are not yet "
            "supported by this tool."
        ),
    )
    update: List[NativeFilterUpdateSpec] = Field(
        default_factory=list,
        description="Partial updates to existing filters, addressed by filter ID",
    )
    remove: List[str] = Field(
        default_factory=list,
        description="IDs of filters to delete from the dashboard",
    )
    reorder: List[str] | None = Field(
        None,
        description=(
            "Complete ordered list of filter IDs defining the new filter "
            "order. Must include every filter that remains on the dashboard "
            "(after removals); newly added filters are appended "
            "automatically and may be omitted."
        ),
    )

    @model_validator(mode="after")
    def _require_at_least_one_operation(self) -> "ManageNativeFiltersRequest":
        """Reject requests that specify no add/update/remove/reorder operation.

        ``reorder`` is checked with ``is None`` (not falsiness) so an explicit
        empty list still counts as a reorder operation, matching how the tool's
        payload builder treats ``reorder is not None``.
        """
        if (
            not self.add
            and not self.update
            and not self.remove
            and self.reorder is None
        ):
            raise ValueError(
                "At least one operation (add, update, remove, reorder) is required"
            )
        return self


class ManageNativeFiltersResponse(BaseModel):
    """Response schema for the manage_native_filters tool."""

    dashboard_id: int | None = Field(None, description="ID of the dashboard")
    dashboard_url: str | None = Field(
        None, description="URL to view the updated dashboard"
    )
    added_filter_ids: List[str] = Field(
        default_factory=list,
        description=(
            "Server-generated IDs of the newly created filters, in request order"
        ),
    )
    updated_filter_ids: List[str] = Field(
        default_factory=list, description="IDs of the filters that were updated"
    )
    removed_filter_ids: List[str] = Field(
        default_factory=list, description="IDs of the filters that were removed"
    )
    filters: List[NativeFilterSummary] = Field(
        default_factory=list,
        description="Final native filter configuration after the operation, in order",
    )
    error: str | None = Field(None, description="Error message, if operation failed")
    permission_denied: bool = Field(
        default=False,
        description=(
            "True when the operation failed because the current user does "
            "not have edit rights on the target dashboard."
        ),
    )

    @field_validator("error")
    @classmethod
    def sanitize_error_for_llm_context(cls, value: str | None) -> str | None:
        """Wrap error text before it is exposed to LLM context.

        The error may echo user-supplied filter names or dashboard-controlled
        metadata - both must be wrapped so the LLM treats them as data, not
        instructions.
        """
        if value is None:
            return value
        return sanitize_for_llm_context(value, field_path=("error",))


# ---------------------------------------------------------------------------
# get_dashboard_datasets schemas
# ---------------------------------------------------------------------------

# Per-dataset caps keep responses small enough for LLM context: wide
# datasets can have hundreds of columns, which would dwarf the fields an
# agent actually needs to configure native filters.
MAX_DASHBOARD_DATASET_COLUMNS: int = 100
MAX_DASHBOARD_DATASET_METRICS: int = 50


class DashboardDatasetColumn(BaseModel):
    """Lean column representation for dashboard dataset context."""

    column_name: str = Field(..., description="Column name")
    verbose_name: str | None = Field(None, description="Verbose (display) name")
    type: str | None = Field(None, description="Column data type")
    is_dttm: bool | None = Field(None, description="Is datetime column")


class DashboardDatasetMetric(BaseModel):
    """Lean metric representation for dashboard dataset context."""

    metric_name: str = Field(..., description="Saved metric name")
    verbose_name: str | None = Field(None, description="Verbose (display) name")
    expression: str | None = Field(None, description="SQL expression")


class DashboardDatasetDatabaseInfo(BaseModel):
    """Database connection summary for a dashboard dataset."""

    id: int | None = Field(None, description="Database ID")
    name: str | None = Field(None, description="Database name")
    backend: str | None = Field(None, description="Database backend (engine)")


class DashboardDatasetSummary(BaseModel):
    """A dataset used by a dashboard's charts, with columns and metrics."""

    model_config = ConfigDict(populate_by_name=True)

    id: int | None = Field(None, description="Dataset ID")
    uuid: str | None = Field(None, description="Dataset UUID")
    table_name: str | None = Field(None, description="Table name")
    schema_name: str | None = Field(None, description="Schema name", alias="schema")
    database: DashboardDatasetDatabaseInfo | None = Field(
        None, description="Database the dataset belongs to"
    )
    chart_count: int = Field(
        0, description="Number of charts on the dashboard using this dataset"
    )
    columns: List[DashboardDatasetColumn] = Field(
        default_factory=list, description="Dataset columns"
    )
    metrics: List[DashboardDatasetMetric] = Field(
        default_factory=list, description="Dataset metrics"
    )
    total_column_count: int = Field(
        0, description="Total number of columns on the dataset"
    )
    total_metric_count: int = Field(
        0, description="Total number of metrics on the dataset"
    )
    columns_truncated: bool = Field(
        False,
        description=(
            "True when the columns list was truncated to keep the response small"
        ),
    )
    metrics_truncated: bool = Field(
        False,
        description=(
            "True when the metrics list was truncated to keep the response small"
        ),
    )

    @model_serializer(mode="wrap")
    def _rename_schema_field(self, serializer: Any, info: Any) -> Dict[str, Any]:
        """Serialize 'schema_name' as 'schema' to match API conventions."""
        data = serializer(self)
        if "schema_name" in data:
            data["schema"] = data.pop("schema_name")
        return data


class DashboardDatasets(BaseModel):
    """Response schema for get_dashboard_datasets."""

    id: int | None = Field(None, description="Dashboard ID")
    dashboard_title: str | None = Field(None, description="Dashboard title")
    uuid: str | None = Field(None, description="Dashboard UUID")
    dataset_count: int = Field(
        0, description="Number of accessible datasets used by the dashboard"
    )
    inaccessible_dataset_count: int = Field(
        0,
        description=(
            "Number of datasets used by the dashboard that the current user "
            "cannot access (excluded from 'datasets')"
        ),
    )
    datasets: List[DashboardDatasetSummary] = Field(
        default_factory=list,
        description="Datasets used by the dashboard's charts",
    )


def _serialize_dashboard_dataset(
    datasource: Any, chart_count: int
) -> DashboardDatasetSummary:
    """Serialize a datasource to a lean, LLM-safe dataset summary."""
    all_columns = list(getattr(datasource, "columns", None) or [])
    all_metrics = list(getattr(datasource, "metrics", None) or [])

    columns = [
        DashboardDatasetColumn(
            column_name=escape_llm_context_delimiters(
                getattr(column, "column_name", None) or ""
            ),
            verbose_name=sanitize_for_llm_context(
                getattr(column, "verbose_name", None),
                field_path=("columns", str(index), "verbose_name"),
            ),
            type=getattr(column, "type", None),
            is_dttm=getattr(column, "is_dttm", None),
        )
        for index, column in enumerate(all_columns[:MAX_DASHBOARD_DATASET_COLUMNS])
    ]
    metrics = [
        DashboardDatasetMetric(
            metric_name=escape_llm_context_delimiters(
                getattr(metric, "metric_name", None) or ""
            ),
            verbose_name=sanitize_for_llm_context(
                getattr(metric, "verbose_name", None),
                field_path=("metrics", str(index), "verbose_name"),
            ),
            expression=sanitize_for_llm_context(
                getattr(metric, "expression", None),
                field_path=("metrics", str(index), "expression"),
            ),
        )
        for index, metric in enumerate(all_metrics[:MAX_DASHBOARD_DATASET_METRICS])
    ]

    database = getattr(datasource, "database", None)
    database_info = (
        DashboardDatasetDatabaseInfo(
            id=getattr(database, "id", None),
            name=escape_llm_context_delimiters(
                getattr(database, "database_name", None)
            ),
            backend=getattr(database, "backend", None),
        )
        if database is not None
        else None
    )

    dataset_uuid = getattr(datasource, "uuid", None)
    return DashboardDatasetSummary(
        id=getattr(datasource, "id", None),
        uuid=str(dataset_uuid) if dataset_uuid else None,
        table_name=escape_llm_context_delimiters(
            getattr(datasource, "table_name", None)
        ),
        schema_name=escape_llm_context_delimiters(getattr(datasource, "schema", None)),
        database=database_info,
        chart_count=chart_count,
        columns=columns,
        metrics=metrics,
        total_column_count=len(all_columns),
        total_metric_count=len(all_metrics),
        columns_truncated=len(all_columns) > MAX_DASHBOARD_DATASET_COLUMNS,
        metrics_truncated=len(all_metrics) > MAX_DASHBOARD_DATASET_METRICS,
    )


def dashboard_datasets_serializer(dashboard: "Dashboard") -> DashboardDatasets:
    """Serialize a Dashboard model to the datasets used by its charts.

    Groups the dashboard's charts by datasource (mirroring
    ``Dashboard.datasets_trimmed_for_slices``) but keeps the full column and
    metric lists (capped) since native-filter configuration regularly needs
    columns that no chart references. Datasets the current user cannot
    access are excluded and only counted.
    """
    from superset.mcp_service.auth import has_dataset_access

    slices_by_datasource: Dict[tuple[int, str], List[Any]] = {}
    for slc in getattr(dashboard, "slices", None) or []:
        datasource_id = getattr(slc, "datasource_id", None)
        datasource_type = getattr(slc, "datasource_type", None) or ""
        if datasource_id is None:
            continue
        slices_by_datasource.setdefault((datasource_id, datasource_type), []).append(
            slc
        )

    datasets: List[DashboardDatasetSummary] = []
    inaccessible_count: int = 0
    for slices in slices_by_datasource.values():
        datasource = next(
            (
                getattr(slc, "datasource", None)
                for slc in slices
                if getattr(slc, "datasource", None) is not None
            ),
            None,
        )
        if datasource is None:
            continue
        if not has_dataset_access(datasource):
            inaccessible_count += 1
            continue
        datasets.append(_serialize_dashboard_dataset(datasource, len(slices)))

    datasets.sort(key=lambda dataset: dataset.id or 0)

    return DashboardDatasets(
        id=dashboard.id,
        dashboard_title=sanitize_for_llm_context(
            dashboard.dashboard_title or "Untitled",
            field_path=("dashboard_title",),
        ),
        uuid=str(dashboard.uuid) if dashboard.uuid else None,
        dataset_count=len(datasets),
        inaccessible_dataset_count=inaccessible_count,
        datasets=datasets,
    )


# ---------------------------------------------------------------------------
# restore_dashboard schemas
# ---------------------------------------------------------------------------


class RestoreDashboardRequest(BaseModel):
    """Request schema for restore_dashboard."""

    identifier: int | str = Field(
        ...,
        description="Dashboard identifier - numeric ID or UUID string.",
    )

    @field_validator("identifier", mode="before")
    @classmethod
    def reject_bool_identifier(cls, value: object) -> object:
        """bool is a subclass of int, so identifier=true would coerce to
        dashboard ID 1 and target the wrong object; reject it outright."""
        if isinstance(value, bool):
            raise ValueError("identifier must be an integer ID or UUID string")
        return value


class RestoreDashboardResponse(BaseModel):
    """Result of a restore_dashboard operation."""

    success: bool = Field(description="Whether the dashboard was restored from trash")
    restored_id: int | None = Field(None, description="ID of the restored dashboard")
    restored_name: str | None = Field(
        None, description="Title of the restored dashboard"
    )
    message: str | None = Field(None, description="Human-readable outcome message")
    error: str | None = Field(None, description="Error message if the restore failed")
    error_type: str | None = Field(None, description="Type of error if failed")
    permission_denied: bool = Field(
        False,
        description=(
            "True when the caller lacks permission to restore the dashboard (do "
            "not retry; ask the user)."
        ),
    )
