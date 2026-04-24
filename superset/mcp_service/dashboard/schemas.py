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
from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, TYPE_CHECKING

import humanize
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
from superset.mcp_service.common.cache_schemas import MetadataCacheControl
from superset.mcp_service.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from superset.mcp_service.privacy import filter_user_directory_fields
from superset.mcp_service.system.schemas import (
    PaginationInfo,
    RoleInfo,
    TagInfo,
)
from superset.mcp_service.utils.sanitization import (
    sanitize_user_input,
    sanitize_user_input_with_changes,
)
from superset.utils.json import loads as json_loads


class DashboardError(BaseModel):
    """Error response for dashboard operations"""

    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")

    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create(cls, error: str, error_type: str) -> "DashboardError":
        """Create a standardized DashboardError with timestamp."""
        from datetime import datetime

        return cls(error=error, error_type=error_type, timestamp=datetime.now())


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


def serialize_role_object(role: Any) -> RoleInfo | None:
    """Serialize a role object to RoleInfo"""
    if not role:
        return None

    return RoleInfo(
        id=getattr(role, "id", None),
        name=getattr(role, "name", None),
        permissions=[perm.name for perm in getattr(role, "permissions", [])]
        if hasattr(role, "permissions")
        else None,
    )


class DashboardFilter(ColumnOperator):
    """
    Filter object for dashboard listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal[
        "dashboard_title",
        "published",
        "favorite",
    ] = Field(
        ...,
        description=(
            "Column to filter on. Use "
            "get_schema(model_type='dashboard') for available "
            "filter columns."
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


class ListDashboardsRequest(MetadataCacheControl):
    """Request schema for list_dashboards with clear, unambiguous types."""

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

        return parse_json_or_model_list(v, DashboardFilter, "filters")

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
        """Prevent using both search and filters simultaneously to avoid query
        conflicts."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


class GetDashboardInfoRequest(MetadataCacheControl):
    """Request schema for get_dashboard_info with support for ID, UUID, or slug.

    When permalink_key is provided, the tool will retrieve the dashboard's filter
    state from the permalink, allowing you to see what filters the user has applied
    (not just the default filter state). This is useful when a user applies filters
    in a dashboard but the URL contains a permalink_key.
    """

    identifier: Annotated[
        int | str,
        Field(
            description="Dashboard identifier - can be numeric ID, UUID string, or slug"
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
    owners, and timestamps that bloat the response.
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
    url: str | None = None
    created_on_humanized: str | None = None
    changed_on_humanized: str | None = None
    chart_count: int = 0
    tags: List[TagInfo] = Field(default_factory=list)
    charts: List[DashboardChartSummary] = Field(default_factory=list)

    # Structured filter information extracted from json_metadata
    native_filters: List[NativeFilterSummary] = Field(
        default_factory=list,
        description=(
            "Native filters configured on this dashboard. Extracted from "
            "json_metadata for LLM consumption — includes filter name, type, "
            "and target columns."
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
        None,
        description=(
            "Permalink key used to retrieve filter state. When present, indicates "
            "the filter_state came from a permalink rather than the default dashboard."
        ),
    )
    filter_state: Dict[str, Any] | None = Field(
        None,
        description=(
            "Filter state from permalink. Contains dataMask (native filter values), "
            "activeTabs, anchor, and urlParams. When present, represents the actual "
            "filters the user has applied to the dashboard."
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

    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")

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

    dashboard_id: int = Field(
        ..., description="ID of the dashboard to add the chart to"
    )
    chart_id: int = Field(..., description="ID of the chart to add to the dashboard")
    target_tab: str | None = Field(
        None, description="Target tab name (if dashboard has tabs)"
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
        raw = data.get("dashboard_title")
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


def _extract_native_filters(json_metadata_str: str | None) -> List[NativeFilterSummary]:
    """Extract native filter summaries from raw json_metadata string.

    Parses the json_metadata JSON blob and pulls out only the filter
    name, type, and targets — dropping verbose fields like controlValues,
    defaultDataMask, scope, and cascadeParentIds.
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
        targets = [t for t in raw_targets if isinstance(t, dict)]
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


def _build_omitted_fields(
    json_metadata_str: str | None, position_json_str: str | None
) -> Dict[str, str]:
    """Build omission metadata describing which fields were stripped and why.

    Uses the shared OmittedFieldsBuilder utility so the pattern is consistent
    across all MCP tool serializers.
    """
    from superset.mcp_service.utils.response_utils import OmittedFieldsBuilder

    return (
        OmittedFieldsBuilder()
        .add_raw_field(
            "position_json",
            raw_value=position_json_str,
            reason=(
                "Internal layout tree with component positions/hierarchy. "
                "Not useful for analysis or LLM context."
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


def serialize_chart_summary(chart: Any) -> DashboardChartSummary | None:
    """Serialize a chart to a lightweight summary for dashboard context."""
    if not chart:
        return None
    from superset.mcp_service.utils.url_utils import get_superset_base_url

    chart_id = getattr(chart, "id", None)
    chart_url = None
    if chart_id is not None:
        chart_url = f"{get_superset_base_url()}/explore/?slice_id={chart_id}"

    return DashboardChartSummary(
        id=chart_id,
        slice_name=getattr(chart, "slice_name", None),
        viz_type=getattr(chart, "viz_type", None),
        datasource_name=getattr(chart, "datasource_name", None),
        url=chart_url,
        description=getattr(chart, "description", None),
    )


def dashboard_serializer(dashboard: "Dashboard") -> DashboardInfo:
    from superset.mcp_service.utils.url_utils import get_superset_base_url

    base_url = get_superset_base_url()
    relative_url = dashboard.url  # e.g. "/superset/dashboard/{slug_or_id}/"
    absolute_url = f"{base_url}{relative_url}" if relative_url else None

    return DashboardInfo(
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
        url=absolute_url,
        created_on_humanized=dashboard.created_on_humanized,
        changed_on_humanized=dashboard.changed_on_humanized,
        chart_count=len(dashboard.slices) if dashboard.slices else 0,
        native_filters=_extract_native_filters(
            getattr(dashboard, "json_metadata", None)
        ),
        cross_filters_enabled=_extract_cross_filters_enabled(
            getattr(dashboard, "json_metadata", None)
        ),
        omitted_fields=_build_omitted_fields(
            getattr(dashboard, "json_metadata", None),
            getattr(dashboard, "position_json", None),
        ),
        tags=[
            TagInfo.model_validate(tag, from_attributes=True) for tag in dashboard.tags
        ]
        if dashboard.tags
        else [],
        charts=[
            summary
            for chart in dashboard.slices
            if (summary := serialize_chart_summary(chart)) is not None
        ]
        if dashboard.slices
        else [],
    )


def _humanize_timestamp(dt: datetime | None) -> str | None:
    """Convert a datetime to a humanized string like '2 hours ago'."""
    if dt is None:
        return None
    return humanize.naturaltime(datetime.now() - dt)


def serialize_dashboard_object(dashboard: Any) -> DashboardInfo:
    """Simple dashboard serializer that safely handles object attributes."""
    from superset.mcp_service.utils.url_utils import get_superset_base_url

    # Construct URL from id/slug (the model's @property isn't available on
    # column-only query tuples returned by DAO.list with select_columns)
    dashboard_id = getattr(dashboard, "id", None)
    slug = getattr(dashboard, "slug", None)
    dashboard_url = None
    if dashboard_id is not None:
        dashboard_url = (
            f"{get_superset_base_url()}/superset/dashboard/{slug or dashboard_id}/"
        )

    json_metadata_str = getattr(dashboard, "json_metadata", None)
    position_json_str = getattr(dashboard, "position_json", None)

    return DashboardInfo(
        id=dashboard_id,
        dashboard_title=getattr(dashboard, "dashboard_title", None),
        slug=slug or "",
        url=dashboard_url,
        published=getattr(dashboard, "published", None),
        changed_on=getattr(dashboard, "changed_on", None),
        changed_on_humanized=_humanize_timestamp(
            getattr(dashboard, "changed_on", None)
        ),
        created_on=getattr(dashboard, "created_on", None),
        created_on_humanized=_humanize_timestamp(
            getattr(dashboard, "created_on", None)
        ),
        description=getattr(dashboard, "description", None),
        css=getattr(dashboard, "css", None),
        certified_by=getattr(dashboard, "certified_by", None),
        certification_details=getattr(dashboard, "certification_details", None),
        native_filters=_extract_native_filters(json_metadata_str),
        cross_filters_enabled=_extract_cross_filters_enabled(json_metadata_str),
        omitted_fields=_build_omitted_fields(json_metadata_str, position_json_str),
        is_managed_externally=getattr(dashboard, "is_managed_externally", None),
        external_url=getattr(dashboard, "external_url", None),
        uuid=str(getattr(dashboard, "uuid", ""))
        if getattr(dashboard, "uuid", None)
        else None,
        chart_count=len(getattr(dashboard, "slices", [])),
        tags=[
            TagInfo.model_validate(tag, from_attributes=True)
            for tag in getattr(dashboard, "tags", [])
        ]
        if getattr(dashboard, "tags", None)
        else [],
        charts=[
            summary
            for chart in getattr(dashboard, "slices", [])
            if (summary := serialize_chart_summary(chart)) is not None
        ]
        if getattr(dashboard, "slices", None)
        else [],
    )
