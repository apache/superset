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
Pydantic schemas for chart-related responses
"""

from __future__ import annotations

import difflib
import logging
import re
from datetime import datetime
from typing import Annotated, Any, cast, Dict, List, Literal, Protocol

from pydantic import (
    AliasChoices,
    AliasPath,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_serializer,
    model_validator,
    PositiveInt,
    ValidationError,
)
from typing_extensions import Self

from superset.constants import TimeGrain
from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.common.cache_schemas import (
    CacheStatus,
    CreatedByMeMixin,
    EditedByMeMixin,
    FormDataCacheControl,
    MetadataCacheControl,
    QueryCacheControl,
)
from superset.mcp_service.common.error_schemas import ChartGenerationError, MCPBaseError
from superset.mcp_service.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from superset.mcp_service.privacy import (
    filter_user_directory_fields,
    strip_user_directory_fields_from_schema,
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
from superset.mcp_service.utils.response_utils import humanize_timestamp
from superset.mcp_service.utils.sanitization import (
    sanitize_filter_value,
    sanitize_sql_expression,
    sanitize_user_input,
    sanitize_user_input_with_changes,
)

logger = logging.getLogger(__name__)


class ChartLike(Protocol):
    """Protocol for chart-like objects with expected attributes."""

    id: int
    slice_name: str | None
    viz_type: str | None
    datasource_name: str | None
    datasource_type: str | None
    url: str | None
    description: str | None
    cache_timeout: int | None
    form_data: Dict[str, Any] | None
    query_context: Any | None
    certified_by: str | None
    certification_details: str | None
    changed_by: Any | None  # User object
    changed_by_name: str | None
    changed_on: str | datetime | None
    changed_on_humanized: str | None
    created_by: Any | None  # User object
    created_by_name: str | None
    created_on: str | datetime | None
    created_on_humanized: str | None
    uuid: str | None
    tags: List[Any] | None
    editors: List[Any] | None


class ChartInfo(BaseModel):
    """Full chart model with all possible attributes."""

    id: int | None = Field(None, description="Chart ID")
    slice_name: str | None = Field(None, description="Chart name")
    viz_type: str | None = Field(None, description="Visualization type (internal ID)")
    chart_type_display_name: str | None = Field(
        None,
        description=(
            "User-friendly chart type name (e.g. 'Line Chart', 'Pivot Table'). "
            "Prefer this field when referring to chart types; "
            "fall back to viz_type when this field is null."
        ),
    )
    datasource_name: str | None = Field(None, description="Datasource name")
    datasource_type: str | None = Field(None, description="Datasource type")
    url: str | None = Field(None, description="Chart explore page URL")
    description: str | None = Field(None, description="Chart description")
    cache_timeout: int | None = Field(None, description="Cache timeout")
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
    certified_by: str | None = Field(
        None, description="Name of the person or team who certified this chart"
    )
    certification_details: str | None = Field(
        None, description="Certification details or reason"
    )
    uuid: str | None = Field(None, description="Chart UUID")
    deleted_at: str | datetime | None = Field(
        None,
        description=(
            "When the chart was moved to trash (soft-deleted); null for live "
            "charts. Only populated when listing with deleted_state."
        ),
    )
    tags: List[TagInfo] = Field(default_factory=list, description="Chart tags")
    editors: List[SubjectInfo] = Field(
        default_factory=list, description="Chart editors"
    )

    # Filters extracted from form_data for easy inspection
    filters: ChartFiltersInfo | None = Field(
        None,
        description=(
            "Structured representation of all filters applied to this chart, "
            "extracted from form_data. Includes adhoc filters, time range, "
            "extra filters, and custom WHERE/HAVING clauses."
        ),
    )

    # Fields for unsaved state support
    form_data: Dict[str, Any] | None = Field(
        None,
        description=(
            "The chart's form_data configuration. When form_data_key is provided, "
            "this contains the unsaved (cached) configuration rather than the "
            "saved version."
        ),
    )
    form_data_key: str | None = Field(
        default=None,
        description=(
            "Cache key used to retrieve unsaved form_data. When present, indicates "
            "the form_data came from cache (unsaved edits) rather than the saved chart."
        ),
    )
    is_unsaved_state: bool = Field(
        default=False,
        description=(
            "True if the form_data came from cache (unsaved edits) rather than the "
            "saved chart configuration. When true, the data reflects what the user "
            "sees in the Explore view, not the saved version."
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


class ChartError(MCPBaseError):
    @field_validator("message")
    @classmethod
    def sanitize_error_for_llm_context(cls, value: str) -> str:
        """Wrap error text before it is exposed to LLM context."""
        return sanitize_for_llm_context(value, field_path=("error",))


class ChartCapabilities(BaseModel):
    """Describes what the chart can do for LLM understanding."""

    supports_interaction: bool = Field(description="Chart supports user interaction")
    supports_real_time: bool = Field(description="Chart supports live data updates")
    supports_drill_down: bool = Field(
        description="Chart supports drill-down navigation"
    )
    supports_export: bool = Field(description="Chart can be exported to other formats")
    optimal_formats: List[str] = Field(description="Recommended preview formats")
    data_types: List[str] = Field(
        description="Types of data shown (time_series, categorical, etc)"
    )


class ChartSemantics(BaseModel):
    """Semantic information for LLM reasoning."""

    primary_insight: str = Field(
        description="Main insight or pattern the chart reveals"
    )
    data_story: str = Field(description="Narrative description of what the data shows")
    recommended_actions: List[str] = Field(
        description="Suggested next steps based on data"
    )
    anomalies: List[str] = Field(description="Notable outliers or unusual patterns")
    statistical_summary: Dict[str, Any] = Field(
        description="Key statistics (mean, median, trends)"
    )


class PerformanceMetadata(BaseModel):
    """Performance information for LLM cost understanding."""

    query_duration_ms: int = Field(description="Query execution time")
    estimated_cost: str | None = Field(None, description="Resource cost estimate")
    cache_status: str = Field(description="Cache hit/miss status")
    optimization_suggestions: List[str] = Field(
        default_factory=list, description="Performance improvement tips"
    )


class AccessibilityMetadata(BaseModel):
    """Accessibility information for inclusive visualization."""

    color_blind_safe: bool = Field(description="Uses colorblind-safe palette")
    alt_text: str = Field(description="Screen reader description")
    high_contrast_available: bool = Field(description="High contrast version available")


class VersionedResponse(BaseModel):
    """Base class for versioned API responses."""

    schema_version: str = Field("2.0", description="Response schema version")
    api_version: str = Field("v1", description="MCP API version")


DEFAULT_GET_CHART_INFO_COLUMNS: List[str] = [
    "id",
    "slice_name",
    "viz_type",
    "datasource_name",
    "datasource_type",
    "url",
    "description",
    "cache_timeout",
    "changed_on",
    "changed_on_humanized",
    "created_on",
    "created_on_humanized",
    "certified_by",
    "certification_details",
    "uuid",
    "tags",
    "filters",
    "form_data_key",
    "is_unsaved_state",
]


class GetChartInfoRequest(BaseModel):
    """Request schema for get_chart_info with support for ID, UUID, or form_data_key.

    When form_data_key is provided, the tool will retrieve the unsaved chart state
    from cache, allowing you to explain what the user actually sees (not the saved
    version). This is useful when a user edits a chart in Explore but hasn't saved yet.

    For unsaved charts (no chart ID), provide only form_data_key to retrieve the
    current chart configuration from cache.
    """

    model_config = ConfigDict(populate_by_name=True)

    identifier: Annotated[
        int | str | None,
        Field(
            default=None,
            description=(
                "Chart identifier - can be numeric ID or UUID string. "
                "Optional when form_data_key is provided (for unsaved charts)."
            ),
            validation_alias=AliasChoices("identifier", "id", "chart_id"),
        ),
    ]
    form_data_key: str | None = Field(
        default=None,
        description=(
            "Cache key for retrieving unsaved chart state. When a user "
            "edits a chart in Explore but hasn't saved, the current state is stored "
            "with this key. If provided, the tool returns the current unsaved "
            "configuration instead of the saved version. "
            "Can be used alone (without identifier) for unsaved charts."
        ),
    )
    dashboard_id: int | None = Field(
        default=None,
        description=(
            "When provided, resolves dashboard-level native filters that are in "
            "scope for this chart on the given dashboard and returns them under "
            "filters.dashboard_filters. Requires the chart to be on the dashboard "
            "and the caller to have dashboard access."
        ),
    )
    select_columns: Annotated[
        List[str],
        Field(
            default_factory=lambda: list(DEFAULT_GET_CHART_INFO_COLUMNS),
            description=(
                "Top-level fields to include in the response. Defaults to a lean "
                "set that excludes 'form_data' (the full chart config, can be 50KB+). "
                "Add 'form_data' explicitly when you need the raw chart configuration."
            ),
            validation_alias=AliasChoices("select_columns", "columns"),
        ),
    ]

    @model_validator(mode="after")
    def validate_identifier_or_form_data_key(self) -> "GetChartInfoRequest":
        if not self.identifier and not self.form_data_key:
            raise ValueError(
                "At least one of 'identifier' or 'form_data_key' must be provided."
            )
        return self

    @field_validator("select_columns", mode="before")
    @classmethod
    def _parse_select_columns(cls, value: Any) -> Any:
        from superset.mcp_service.utils.schema_utils import parse_json_or_list

        if value is None:
            return list(DEFAULT_GET_CHART_INFO_COLUMNS)
        parsed = parse_json_or_list(value, "select_columns")
        return parsed if parsed else list(DEFAULT_GET_CHART_INFO_COLUMNS)


def extract_filters_from_form_data(
    form_data: Dict[str, Any] | None,
) -> ChartFiltersInfo | None:
    """Extract structured filter information from a chart's form_data.

    Parses adhoc_filters, time_range, extra_filters, and custom
    WHERE/HAVING clauses into a structured ChartFiltersInfo object.
    Returns None if form_data is empty, not a dict, or has no filter-related fields.
    """
    if not form_data or not isinstance(form_data, dict):
        return None

    raw_adhoc = form_data.get("adhoc_filters", [])
    adhoc_filters: List[AdhocFilter] = []
    for f in raw_adhoc or []:
        if not isinstance(f, dict):
            continue
        try:
            adhoc_filters.append(
                AdhocFilter(
                    clause=f.get("clause"),
                    expression_type=f.get("expressionType"),
                    subject=f.get("subject"),
                    operator=f.get("operator"),
                    comparator=f.get("comparator"),
                    sql_expression=f.get("sqlExpression"),
                )
            )
        except (TypeError, ValueError, ValidationError):
            # Skip malformed filter entries (e.g. non-string fields in
            # corrupted cached state, legacy payloads, or Pydantic
            # validation failures from unexpected field types)
            continue

    time_range = form_data.get("time_range")
    granularity_sqla = form_data.get("granularity_sqla")
    raw_extra = form_data.get("extra_filters", [])
    extra_filters: List[Dict[str, Any]] = [
        item
        for item in (raw_extra if isinstance(raw_extra, list) else [])
        if isinstance(item, dict)
        and isinstance(item.get("col"), str)
        and item.get("col")
    ]
    # Legacy top-level "filters" payload (older/simpler charts use this
    # instead of adhoc_filters).
    raw_filters = form_data.get("filters", [])
    filters: List[Dict[str, Any]] = [
        item
        for item in (raw_filters if isinstance(raw_filters, list) else [])
        if isinstance(item, dict)
        and isinstance(item.get("col"), str)
        and item.get("col")
    ]
    where = form_data.get("where")
    having = form_data.get("having")

    # Only return if there is at least one meaningful filter field
    has_content = (
        adhoc_filters
        or time_range
        or granularity_sqla
        or extra_filters
        or filters
        or where
        or having
    )
    if not has_content:
        return None

    return ChartFiltersInfo(
        adhoc_filters=adhoc_filters,
        time_range=time_range,
        granularity_sqla=granularity_sqla,
        extra_filters=extra_filters,
        filters=filters,
        where=where,
        having=having,
    )


CHART_FORM_DATA_EXCLUDED_FIELD_NAMES = frozenset(
    {
        "all_columns",
        "columns",
        "datasource",
        "datasource_id",
        "datasource_name",
        "datasource_type",
        "entity",
        "form_data_key",
        "groupby",
        "metric",
        "metrics",
        "series",
        "slice_id",
        "viz_type",
        "x",
        "y",
        "size",
    }
)


def wrap_sql_adhoc_metrics(form_data: Any) -> None:
    """Wrap LLM-controlled SQL adhoc metric strings in-place.

    ``metric``/``metrics`` are in ``CHART_FORM_DATA_EXCLUDED_FIELD_NAMES`` so
    SIMPLE-metric content (bounded scalars) doesn't get wrapped. SQL adhoc
    dicts carry up to 2000 chars of LLM-controlled SQL plus a 500-char label
    that still need ``<UNTRUSTED-CONTENT>`` delimiters when echoed back.
    """
    if not isinstance(form_data, dict):
        return
    metrics = form_data.get("metrics")
    if isinstance(metrics, list):
        for index, metric in enumerate(metrics):
            if isinstance(metric, dict) and metric.get("expressionType") == "SQL":
                for key in ("sqlExpression", "label"):
                    if isinstance(metric.get(key), str):
                        metric[key] = sanitize_for_llm_context(
                            metric[key],
                            field_path=("form_data", "metrics", str(index), key),
                        )
    metric_singular = form_data.get("metric")
    if (
        isinstance(metric_singular, dict)
        and metric_singular.get("expressionType") == "SQL"
    ):
        for key in ("sqlExpression", "label"):
            if isinstance(metric_singular.get(key), str):
                metric_singular[key] = sanitize_for_llm_context(
                    metric_singular[key],
                    field_path=("form_data", "metric", key),
                )


def sanitize_chart_info_for_llm_context(chart_info: ChartInfo) -> ChartInfo:  # noqa: C901
    """Wrap chart read-path descriptive fields before LLM exposure."""
    payload = chart_info.model_dump(mode="python")

    for field_name in (
        "slice_name",
        "description",
        "certified_by",
        "certification_details",
    ):
        payload[field_name] = sanitize_for_llm_context(
            payload.get(field_name),
            field_path=(field_name,),
        )

    payload["datasource_name"] = escape_llm_context_delimiters(
        payload.get("datasource_name")
    )

    if payload.get("filters") is not None:
        payload["filters"] = sanitize_for_llm_context(
            payload["filters"],
            field_path=("filters",),
            excluded_field_names=frozenset(),
        )

    if payload.get("form_data") is not None:
        payload["form_data"] = sanitize_for_llm_context(
            payload["form_data"],
            field_path=("form_data",),
            excluded_field_names=(
                CHART_FORM_DATA_EXCLUDED_FIELD_NAMES
                | frozenset({"cache_key", "database", "database_name", "schema"})
            ),
        )
        wrap_sql_adhoc_metrics(payload["form_data"])

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

    return ChartInfo.model_validate(payload)


def serialize_chart_object(chart: ChartLike | None) -> ChartInfo | None:
    if not chart:
        return None

    from superset.mcp_service.utils.url_utils import get_superset_base_url
    from superset.utils import json as utils_json

    chart_id = getattr(chart, "id", None)
    chart_url = None
    if chart_id:
        chart_url = f"{get_superset_base_url()}/explore/?slice_id={chart_id}"

    # Parse form_data from the chart's params JSON string
    chart_params = getattr(chart, "params", None)
    chart_form_data = None
    if chart_params and isinstance(chart_params, str):
        try:
            chart_form_data = utils_json.loads(chart_params)
        except (TypeError, ValueError):
            pass
    elif isinstance(chart_params, dict):
        chart_form_data = chart_params

    # Extract structured filter information
    filters_info = extract_filters_from_form_data(chart_form_data)

    _viz_type = getattr(chart, "viz_type", None)
    _display_name = None
    if _viz_type:
        try:
            from superset.mcp_service.chart.registry import display_name_for_viz_type
        except ImportError:
            pass
        else:
            try:
                _display_name = display_name_for_viz_type(_viz_type)
            except Exception as exc:  # noqa: BLE001 — third-party plugins may raise
                logger.debug(
                    "Failed to resolve display name for viz_type=%r: %s", _viz_type, exc
                )

    return sanitize_chart_info_for_llm_context(
        ChartInfo(
            id=chart_id,
            slice_name=getattr(chart, "slice_name", None),
            viz_type=_viz_type,
            chart_type_display_name=_display_name,
            datasource_name=getattr(chart, "datasource_name", None),
            datasource_type=getattr(chart, "datasource_type", None),
            url=chart_url,
            description=getattr(chart, "description", None),
            certified_by=getattr(chart, "certified_by", None),
            certification_details=getattr(chart, "certification_details", None),
            cache_timeout=getattr(chart, "cache_timeout", None),
            form_data=chart_form_data,
            filters=filters_info,
            changed_on=getattr(chart, "changed_on", None),
            changed_on_humanized=humanize_timestamp(getattr(chart, "changed_on", None)),
            created_on=getattr(chart, "created_on", None),
            created_on_humanized=humanize_timestamp(getattr(chart, "created_on", None)),
            uuid=str(getattr(chart, "uuid", ""))
            if getattr(chart, "uuid", None)
            else None,
            deleted_at=getattr(chart, "deleted_at", None),
            tags=[
                TagInfo.model_validate(tag, from_attributes=True)
                for tag in getattr(chart, "tags", [])
            ]
            if getattr(chart, "tags", None)
            else [],
            editors=[
                info
                for editor in getattr(chart, "editors", [])
                if (info := serialize_subject_object(editor)) is not None
            ]
            if getattr(chart, "editors", None)
            else [],
        )
    )


class ChartFilter(ColumnOperator):
    """
    Filter object for chart listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal[  # pyright: ignore[reportIncompatibleVariableOverride]
        "slice_name",
        "viz_type",
        "datasource_name",
        "editor",
        "created_by_fk",
        "changed_by_fk",
        "dashboards",
    ] = Field(
        ...,
        description="Column to filter on. Use get_schema(model_type='chart') for "
        "available filter columns. To filter by a person, first call find_users "
        "to resolve a name to a user ID, then filter by created_by_fk or "
        "changed_by_fk with that integer ID. To find charts attached to a "
        "specific dashboard, filter by 'dashboards' with an integer "
        "dashboard ID using opr='eq' (other supported operators on "
        "'dashboards': ne, in, nin, is_null, is_not_null — like/sw/gt are "
        "rejected because they don't apply to a collection relationship).",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. Use get_schema(model_type='chart') for "
        "available operators.",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class ChartList(BaseModel):
    charts: List[ChartInfo]
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
        description="Columns that were actually loaded for each chart",
    )
    columns_available: List[str] = Field(
        default_factory=list,
        description="All columns available for selection via select_columns parameter",
    )
    sortable_columns: List[str] = Field(
        default_factory=list,
        description="Columns that can be used with order_column parameter",
    )
    filters_applied: List[ChartFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


# --- Simplified schemas for generate_chart tool ---


# Common pieces


def _normalize_group_by_input(v: Any) -> Any:
    """Accept a single ColumnRef/dict/str and normalize to list of dicts."""
    if isinstance(v, str):
        return [{"name": v}]
    if isinstance(v, (dict, ColumnRef)):
        return [v]
    if isinstance(v, list):
        return [{"name": item} if isinstance(item, str) else item for item in v]
    return v


def _top_level_key(alias: str | AliasPath) -> str | None:
    """Extract the top-level dict key from a str or AliasPath."""
    if isinstance(alias, str):
        return alias
    if isinstance(alias, AliasPath) and alias.path and isinstance(alias.path[0], str):
        return alias.path[0]
    return None


def _get_known_fields(model_class: type[BaseModel]) -> set[str]:
    """Collect all valid field names including validation aliases."""
    known: set[str] = set()
    for field_name, field_info in model_class.model_fields.items():
        known.add(field_name)
        alias = field_info.validation_alias
        if isinstance(alias, AliasChoices):
            for choice in alias.choices:
                key = _top_level_key(choice)
                if key:
                    known.add(key)
        elif alias is not None:
            key = _top_level_key(alias)
            if key:
                known.add(key)
    return known


def _check_unknown_fields(data: Any, model_class: type[BaseModel]) -> Any:
    """Raise ValueError for unrecognized fields with 'did you mean?' suggestions.

    Catches fields that would be silently dropped by extra='ignore' and provides
    actionable error messages to help LLMs self-correct parameter names.
    """
    if not isinstance(data, dict):
        return data
    known = _get_known_fields(model_class)
    unknown = set(data.keys()) - known
    if not unknown:
        return data

    messages = []
    for field in sorted(unknown):
        matches = difflib.get_close_matches(field, sorted(known), n=1, cutoff=0.6)
        if matches:
            messages.append(f"Unknown field '{field}' — did you mean '{matches[0]}'?")
        else:
            messages.append(
                f"Unknown field '{field}'. Valid fields: {', '.join(sorted(known))}"
            )
    raise ValueError(" | ".join(messages))


class UnknownFieldCheckMixin(BaseModel):
    """Mixin that rejects unknown fields with 'did you mean?' suggestions."""

    @model_validator(mode="before")
    @classmethod
    def check_unknown_fields(cls, data: Any) -> Any:
        return _check_unknown_fields(data, cls)


class ColumnRef(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(
        None,
        min_length=1,
        max_length=255,
        validation_alias=AliasChoices("name", "column_name"),
    )
    label: str | None = Field(None, max_length=500)
    dtype: str | None = None
    aggregate: (
        Literal[
            "SUM",
            "COUNT",
            "AVG",
            "MIN",
            "MAX",
            "COUNT_DISTINCT",
            "STDDEV",
            "VAR",
            "MEDIAN",
            "PERCENTILE",
        ]
        | None
    ) = Field(None, description="SQL aggregate function")
    saved_metric: bool = Field(
        False,
        description="If true, 'name' refers to a saved metric from the dataset "
        "(use get_dataset_info to see available metrics). "
        "When set, 'aggregate' is ignored.",
    )
    sql_expression: str | None = Field(
        None,
        max_length=2000,
        description=(
            "Custom SQL aggregate expression for an adhoc metric, e.g. "
            "'COUNT(CASE WHEN closed_won THEN 1 END)::numeric / "
            "NULLIF(COUNT(*),0)'. Metric-only — mutually exclusive with "
            "'name', 'aggregate', and 'saved_metric'. Requires 'label'."
        ),
    )

    @property
    def is_metric(self) -> bool:
        """Whether this ref acts as a metric (aggregate, saved, or SQL)."""
        return bool(self.aggregate) or self.saved_metric or bool(self.sql_expression)

    # Must run before ``clear_aggregate_for_saved_metric`` (Pydantic v2 runs
    # ``mode="after"`` validators in source order) so the aggregate/saved
    # conflict surfaces before the cleanup nulls ``aggregate`` out.
    @model_validator(mode="after")
    def validate_metric_shape(self) -> "ColumnRef":
        """Require exactly one of ``name`` or ``sql_expression``; the SQL form
        is mutually exclusive with ``aggregate`` / ``saved_metric`` and
        requires a ``label``.
        """
        if self.sql_expression:
            if self.name is not None:
                raise ValueError(
                    "ColumnRef cannot set both 'name' and 'sql_expression'. "
                    "Use 'sql_expression' alone for a custom SQL metric, or "
                    "'name' (plus optional 'aggregate' / 'saved_metric') for "
                    "a column-based metric."
                )
            if self.aggregate is not None:
                raise ValueError(
                    "ColumnRef cannot combine 'sql_expression' with "
                    "'aggregate' — the SQL expression already includes the "
                    "aggregation."
                )
            if self.saved_metric:
                raise ValueError(
                    "ColumnRef cannot combine 'sql_expression' with "
                    "'saved_metric=True' — use the saved metric's name "
                    "directly instead."
                )
            if not self.label:
                raise ValueError(
                    "ColumnRef with 'sql_expression' requires a 'label' "
                    "(used as the metric's display name)."
                )
        elif self.name is None:
            raise ValueError(
                "ColumnRef requires either 'name' (column / dimension / "
                "saved metric) or 'sql_expression' (custom SQL metric)."
            )
        return self

    @model_validator(mode="after")
    def clear_aggregate_for_saved_metric(self) -> "ColumnRef":
        """Clear aggregate when saved_metric is True since it's ignored."""
        if self.saved_metric and self.aggregate is not None:
            self.aggregate = None
        return self

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, v: str | None) -> str | None:
        """Sanitize column name to prevent XSS and SQL injection."""
        if v is None:
            return None
        return sanitize_user_input(
            v, "Column name", max_length=255, check_sql_keywords=True
        )

    @field_validator("label")
    @classmethod
    def sanitize_label(cls, v: str | None) -> str | None:
        """Sanitize display label to prevent XSS attacks."""
        return sanitize_user_input(v, "Label", max_length=500, allow_empty=True)

    @field_validator("sql_expression")
    @classmethod
    def sanitize_sql(cls, v: str | None) -> str | None:
        """Sanitize a custom SQL aggregate expression (XSS, DDL/DML, etc.)."""
        return sanitize_sql_expression(
            v, "SQL expression", max_length=2000, allow_empty=True
        )


class AxisConfig(BaseModel):
    title: str | None = Field(None, max_length=200)
    scale: Literal["linear", "log"] | None = "linear"
    format: str | None = Field(None, description="e.g. '$,.2f'", max_length=50)


class LegendConfig(BaseModel):
    show: bool = True
    position: Literal["top", "bottom", "left", "right"] | None = "right"


class CurrencyFormat(BaseModel):
    """Currency symbol and placement applied to numeric values."""

    model_config = ConfigDict(populate_by_name=True)

    symbol: str = Field(
        ...,
        description="Currency code or symbol (e.g. 'USD', 'EUR', '$', '€')",
        max_length=20,
    )
    symbol_position: Literal["prefix", "suffix"] = Field(
        "prefix",
        description="Whether to render the symbol before or after the value",
        validation_alias=AliasChoices("symbol_position", "symbolPosition"),
    )

    def to_form_data(self) -> Dict[str, str]:
        return {"symbol": self.symbol, "symbolPosition": self.symbol_position}


LEGEND_POSITION_LITERAL = Literal["top", "bottom", "left", "right"]


class FilterConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    column: str = Field(
        ...,
        min_length=1,
        max_length=255,
        validation_alias=AliasChoices("column", "col"),
    )
    op: Literal[
        "=",
        ">",
        "<",
        ">=",
        "<=",
        "!=",
        "LIKE",
        "ILIKE",
        "NOT LIKE",
        "IN",
        "NOT IN",
    ] = Field(
        ...,
        description="LIKE/ILIKE use % wildcards. IN/NOT IN take a list.",
        validation_alias=AliasChoices("op", "operator", "opr"),
    )
    value: str | int | float | bool | list[str | int | float | bool] = Field(
        ...,
        description="For IN/NOT IN, provide a list.",
        validation_alias=AliasChoices("value", "val"),
    )

    @field_validator("column")
    @classmethod
    def sanitize_column(cls, v: str) -> str:
        """Sanitize filter column name to prevent injection attacks."""
        # sanitize_user_input raises ValueError when allow_empty=False (default)
        # so the return value is guaranteed to be a non-None str
        return sanitize_user_input(
            v, "Filter column", max_length=255, check_sql_keywords=True
        )  # type: ignore[return-value]

    @field_validator("value")
    @classmethod
    def sanitize_value(
        cls, v: str | int | float | bool | list[str | int | float | bool]
    ) -> str | int | float | bool | list[str | int | float | bool]:
        """Sanitize filter value to prevent XSS and SQL injection attacks."""
        if isinstance(v, list):
            return [sanitize_filter_value(item, max_length=1000) for item in v]
        return sanitize_filter_value(v, max_length=1000)

    @model_validator(mode="after")
    def validate_value_type_matches_operator(self) -> FilterConfig:
        """Validate that value type matches the operator requirements."""
        if self.op in ("IN", "NOT IN"):
            if not isinstance(self.value, list):
                raise ValueError(
                    f"Operator '{self.op}' requires a list of values, "
                    f"got {type(self.value).__name__}"
                )
        elif isinstance(self.value, list):
            raise ValueError(
                f"Operator '{self.op}' requires a single value, not a list"
            )
        return self


class SortByConfig(BaseModel):
    """Sort specification with explicit direction.

    Accepts either this object or a bare column-name string in `sort_by`
    lists. Bare strings default to descending, which matches the
    sort-by-metric "top N" pattern most commonly used for tables.
    """

    model_config = ConfigDict(populate_by_name=True)

    column: str = Field(
        ...,
        min_length=1,
        max_length=255,
        validation_alias=AliasChoices("column", "col"),
        description="Column to sort by",
    )
    ascending: bool = Field(
        False,
        description="Sort ascending. Defaults to False (descending) to match "
        "the typical sort-by-metric top-N use case.",
    )


# Actual chart types
class PieChartConfig(UnknownFieldCheckMixin):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    chart_type: Literal["pie"] = "pie"
    dimension: ColumnRef = Field(
        ...,
        description="Category column for slices",
        validation_alias=AliasChoices("dimension", "groupby"),
    )
    metric: ColumnRef = Field(
        ...,
        description="Value metric (use aggregate e.g. SUM, COUNT for ad-hoc, "
        "or set saved_metric=True for a saved dataset metric)",
    )
    donut: bool = False
    show_labels: bool = True
    label_type: Literal[
        "key",
        "value",
        "percent",
        "key_value",
        "key_percent",
        "key_value_percent",
        "value_percent",
    ] = "key_value_percent"
    sort_by_metric: bool = True
    show_legend: bool = True
    filters: List[FilterConfig] | None = Field(
        None,
        description="Structured filters (column/op/value). "
        "Do NOT use adhoc_filters or raw SQL expressions.",
    )
    row_limit: int = Field(100, description="Max slices", ge=1, le=10000)
    number_format: str = Field("SMART_NUMBER", max_length=50)
    date_format: str = Field(
        "smart_date",
        description="Date format for date dimension labels (e.g. 'smart_date', "
        "'%Y-%m-%d')",
        max_length=50,
    )
    currency_format: CurrencyFormat | None = Field(
        None,
        description="Currency symbol applied to the metric value",
    )
    color_scheme: str | None = Field(
        None,
        description=(
            "Superset color scheme ID (e.g. 'supersetColors', 'lyftColors', "
            "'googleCategory10c', 'd3Category10'). Defaults to 'supersetColors'."
        ),
        max_length=100,
    )
    legend_orientation: LEGEND_POSITION_LITERAL = Field(
        "top", description="Legend placement around the chart"
    )
    show_total: bool = Field(False, description="Show total in center")
    labels_outside: bool = True
    outer_radius: int = Field(70, description="Outer radius % (1-100)", ge=1, le=100)
    inner_radius: int = Field(
        30, description="Donut inner radius % (1-100)", ge=1, le=100
    )

    @model_validator(mode="after")
    def reject_sql_expression_on_dimensions(self) -> "PieChartConfig":
        """sql_expression and saved_metric are metric-only; reject on the dimension."""
        _reject_sql_expression_on_dimension(self.dimension, "dimension")
        if self.dimension and self.dimension.saved_metric:
            raise ValueError(
                "dimension cannot use saved_metric=True; "
                "saved metrics belong in the 'metric' field"
            )
        return self


class PivotTableChartConfig(UnknownFieldCheckMixin):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    chart_type: Literal["pivot_table"] = "pivot_table"
    rows: List[ColumnRef] = Field(
        ...,
        min_length=1,
        description="Row grouping columns",
        validation_alias=AliasChoices("rows", "groupby", "dimension"),
    )
    columns: List[ColumnRef] | None = Field(
        None, description="Column groups for cross-tabulation"
    )
    metrics: List[ColumnRef] = Field(
        ...,
        min_length=1,
        description="Metrics (use aggregate e.g. SUM, COUNT, AVG for ad-hoc, "
        "or set saved_metric=True for saved dataset metrics)",
    )
    aggregate_function: Literal[
        "Sum",
        "Average",
        "Median",
        "Sample Variance",
        "Sample Standard Deviation",
        "Minimum",
        "Maximum",
        "Count",
        "Count Unique Values",
        "First",
        "Last",
    ] = "Sum"
    show_row_totals: bool = True
    show_column_totals: bool = True
    transpose: bool = False
    combine_metric: bool = Field(False, description="Metrics side by side in columns")
    filters: List[FilterConfig] | None = Field(
        None,
        description="Structured filters (column/op/value). "
        "Do NOT use adhoc_filters or raw SQL expressions.",
    )
    row_limit: int = Field(10000, description="Max cells", ge=1, le=50000)
    value_format: str = Field("SMART_NUMBER", max_length=50)
    date_format: str | None = Field(
        None,
        description="Date format for date columns (e.g. 'smart_date', '%Y-%m-%d')",
        max_length=50,
    )
    currency_format: CurrencyFormat | None = Field(
        None,
        description="Currency symbol applied to numeric metric values",
    )

    @model_validator(mode="after")
    def reject_sql_expression_on_dimensions(self) -> "PivotTableChartConfig":
        """sql_expression is metric-only; reject it on rows and columns."""
        for i, col in enumerate(self.rows):
            _reject_sql_expression_on_dimension(col, f"rows[{i}]")
        if self.columns:
            for i, col in enumerate(self.columns):
                _reject_sql_expression_on_dimension(col, f"columns[{i}]")
        return self


class MixedTimeseriesChartConfig(UnknownFieldCheckMixin):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    chart_type: Literal["mixed_timeseries"] = "mixed_timeseries"
    x: ColumnRef = Field(
        ...,
        description="Shared temporal X-axis column",
        validation_alias=AliasChoices("x", "x_axis"),
    )
    time_grain: TimeGrain | None = Field(
        None,
        description="PT1H, P1D, P1W, P1M, P1Y",
        validation_alias=AliasChoices("time_grain", "time_grain_sqla"),
    )
    # Primary series (Query A)
    y: List[ColumnRef] = Field(
        ...,
        min_length=1,
        description="Primary Y-axis metrics",
        validation_alias=AliasChoices("y", "metrics"),
    )
    primary_kind: Literal["line", "bar", "area", "scatter"] = "line"
    group_by: List[ColumnRef] | None = Field(
        None,
        description="Primary series group by",
        validation_alias=AliasChoices("group_by", "groupby", "series", "dimension"),
    )
    # Secondary series (Query B)
    y_secondary: List[ColumnRef] = Field(
        ...,
        min_length=1,
        description="Secondary Y-axis metrics",
        validation_alias=AliasChoices("y_secondary", "metrics_b"),
    )
    secondary_kind: Literal["line", "bar", "area", "scatter"] = "bar"
    group_by_secondary: List[ColumnRef] | None = Field(
        None,
        description="Secondary series group by",
        validation_alias=AliasChoices(
            "group_by_secondary", "groupby_b", "groupby_secondary"
        ),
    )
    # Display options
    show_legend: bool = True
    legend_orientation: LEGEND_POSITION_LITERAL = Field(
        "top", description="Legend placement around the chart"
    )
    show_value: bool = Field(False, description="Show data labels on each data point")
    x_axis: AxisConfig | None = None
    y_axis: AxisConfig | None = None
    y_axis_secondary: AxisConfig | None = None
    color_scheme: str | None = Field(
        None,
        description=(
            "Superset color scheme ID (e.g. 'supersetColors', 'lyftColors'). "
            "When omitted, Superset's default scheme is used."
        ),
        max_length=100,
    )
    currency_format: CurrencyFormat | None = Field(
        None,
        description="Currency symbol applied to primary metric values",
    )
    currency_format_secondary: CurrencyFormat | None = Field(
        None,
        description="Currency symbol applied to secondary metric values",
    )
    filters: List[FilterConfig] | None = Field(
        None,
        description="Structured filters (column/op/value). "
        "Do NOT use adhoc_filters or raw SQL expressions.",
    )
    row_limit: int = Field(10000, description="Max data points", ge=1, le=50000)

    @field_validator("group_by", "group_by_secondary", mode="before")
    @classmethod
    def wrap_single_group_by(cls, v: Any) -> Any:
        return _normalize_group_by_input(v)

    @model_validator(mode="after")
    def reject_sql_expression_on_dimensions(self) -> "MixedTimeseriesChartConfig":
        """sql_expression is metric-only; reject it on x and group_by lists."""
        _reject_sql_expression_on_dimension(self.x, "x")
        for field_name, group in (
            ("group_by", self.group_by),
            ("group_by_secondary", self.group_by_secondary),
        ):
            if group:
                for i, col in enumerate(group):
                    _reject_sql_expression_on_dimension(col, f"{field_name}[{i}]")
        return self


class HandlebarsChartConfig(UnknownFieldCheckMixin):
    model_config = ConfigDict(extra="ignore")

    chart_type: Literal["handlebars"] = Field(
        ...,
        description=(
            "Chart type discriminator - MUST be 'handlebars' for custom HTML "
            "template charts. Handlebars charts render query results using "
            "Handlebars templates, enabling fully custom layouts like KPI cards, "
            "leaderboards, and formatted reports."
        ),
    )
    handlebars_template: str = Field(
        ...,
        description=(
            "Handlebars HTML template string. Data is available as {{data}} array. "
            "Built-in helpers: {{dateFormat val format='YYYY-MM-DD'}}, "
            "{{formatNumber val}}, {{stringify obj}}. "
            "Example: '<ul>{{#each data}}<li>{{this.name}}: {{this.value}}</li>"
            "{{/each}}</ul>'"
        ),
        min_length=1,
        max_length=50000,
    )
    query_mode: Literal["aggregate", "raw"] = Field(
        "aggregate",
        description=(
            "Query mode: 'aggregate' groups data with metrics, "
            "'raw' returns individual rows"
        ),
    )
    columns: list[ColumnRef] | None = Field(
        None,
        description=(
            "Columns to display in raw mode (query_mode='raw'). "
            "Each column specifies a column name to include in the query results."
        ),
    )
    groupby: list[ColumnRef] | None = Field(
        None,
        description=(
            "Columns to group by in aggregate mode (query_mode='aggregate'). "
            "These become the dimensions for aggregation."
        ),
        validation_alias=AliasChoices("groupby", "group_by"),
    )
    metrics: list[ColumnRef] | None = Field(
        None,
        description=(
            "Metrics to aggregate in aggregate mode. "
            "Each must have an aggregate function (e.g., SUM, COUNT)."
        ),
    )
    filters: list[FilterConfig] | None = Field(None, description="Filters to apply")
    row_limit: int = Field(
        1000,
        description="Maximum number of rows",
        ge=1,
        le=50000,
    )
    order_desc: bool = Field(True, description="Sort in descending order")
    style_template: str | None = Field(
        None,
        description="Optional CSS styles to apply to the rendered template",
        max_length=10000,
    )

    @model_validator(mode="after")
    def reject_sql_expression_on_dimensions(self) -> "HandlebarsChartConfig":
        """sql_expression is metric-only; reject it on raw columns and groupby."""
        if self.columns:
            for i, col in enumerate(self.columns):
                _reject_sql_expression_on_dimension(col, f"columns[{i}]")
        if self.groupby:
            for i, col in enumerate(self.groupby):
                _reject_sql_expression_on_dimension(col, f"groupby[{i}]")
        return self

    @model_validator(mode="after")
    def validate_query_fields(self) -> "HandlebarsChartConfig":
        """Validate that the right fields are provided for the query mode."""
        if self.query_mode == "raw":
            if not self.columns:
                raise ValueError(
                    "Handlebars chart in 'raw' query mode requires 'columns' field. "
                    "Specify which columns to include in the query results."
                )
            if self.metrics:
                raise ValueError(
                    "Handlebars chart in 'raw' query mode does not use 'metrics'. "
                    "Remove 'metrics' or switch to 'aggregate' query mode."
                )
            if self.groupby:
                raise ValueError(
                    "Handlebars chart in 'raw' query mode does not use 'groupby'. "
                    "Remove 'groupby' or switch to 'aggregate' query mode."
                )
        if self.query_mode == "aggregate":
            if not self.metrics:
                raise ValueError(
                    "Handlebars chart in 'aggregate' query mode requires 'metrics' "
                    "field. Specify at least one metric with an aggregate function."
                )
            # SQL metrics are filtered out by ``is_metric``, so every entry in
            # ``missing_agg`` is a name-bearing column ref.
            missing_agg = [m.name or "" for m in self.metrics if not m.is_metric]
            if missing_agg:
                raise ValueError(
                    f"Handlebars chart in 'aggregate' query mode requires an "
                    f"aggregate function on every metric. Missing aggregate for: "
                    f"{', '.join(missing_agg)}. "
                    f"Use one of: SUM, COUNT, AVG, MIN, MAX, COUNT_DISTINCT, etc."
                )
        return self


class BigNumberChartConfig(UnknownFieldCheckMixin):
    model_config = ConfigDict(extra="ignore")

    chart_type: Literal["big_number"] = Field(
        ...,
        description=(
            "Chart type discriminator - MUST be 'big_number'. "
            "Creates Big Number charts that display a single prominent "
            "metric value. Set show_trendline=True with a temporal_column "
            "for a number with trendline, or leave show_trendline=False "
            "for a standalone number."
        ),
    )
    metric: ColumnRef = Field(
        ...,
        description=(
            "The metric to display as a big number. "
            "Must include an aggregate function (e.g., SUM, COUNT)."
        ),
    )
    temporal_column: str | None = Field(
        None,
        description=(
            "Temporal column for the trendline x-axis. Required when "
            "show_trendline is True. Also used (whether or not a trendline is "
            "shown) to bind the chart's dashboard time-range filter; when "
            "omitted, the dataset's main temporal column is used instead."
        ),
        min_length=1,
        max_length=255,
    )
    time_grain: TimeGrain | None = Field(
        None,
        description=(
            "Time granularity for trendline data. "
            "Common values: PT1H (hour), P1D (day), P1W (week), "
            "P1M (month), P1Y (year)."
        ),
    )
    show_trendline: bool = Field(
        False,
        description=(
            "Show a trendline below the big number. "
            "Requires 'temporal_column' to be set."
        ),
    )
    subheader: str | None = Field(
        None,
        description="Subtitle text displayed below the big number",
        max_length=500,
    )
    y_axis_format: str | None = Field(
        None,
        description=(
            "Number format string for the metric value "
            "(e.g., '$,.2f' for currency, ',.0f' for integers, "
            "'.2%' for percentages)"
        ),
        max_length=50,
    )
    time_format: str | None = Field(
        None,
        description=(
            "Date format string for trendline x-axis labels "
            "(e.g. 'smart_date', '%Y-%m-%d'). Only applies when "
            "show_trendline=True."
        ),
        max_length=50,
    )
    currency_format: CurrencyFormat | None = Field(
        None,
        description="Currency symbol applied to the metric value",
    )
    color_scheme: str | None = Field(
        None,
        description=(
            "Superset color scheme ID for the trendline (e.g. 'supersetColors'). "
            "When omitted, Superset's default scheme is used."
        ),
        max_length=100,
    )
    start_y_axis_at_zero: bool = Field(
        True,
        description="Anchor trendline y-axis at zero",
    )
    compare_lag: int | None = Field(
        None,
        description=(
            "Number of time periods to compare against. "
            "Displays a percentage change vs the prior period."
        ),
        ge=1,
    )
    aggregation: (
        Literal["LAST_VALUE", "sum", "mean", "min", "max", "median", "raw"] | None
    ) = Field(
        None,
        description=(
            "How the single big-number value is computed from the trendline "
            "data points. Only applies when show_trendline=True. "
            "Options: "
            "'sum' = Total (Sum) — add all data points; use for all-time totals. "
            "'LAST_VALUE' = most recent data point "
            "(frontend default when this field is absent). "
            "'mean' = Average (Mean). "
            "'min' = Minimum. "
            "'max' = Maximum. "
            "'median' = Median. "
            "'raw' = Overall value — single aggregate across the full period; best for "
            "non-additive metrics like ratios, averages, or distinct counts. "
            "DIAGNOSIS: if a Big Number with Trendline shows an unexpectedly low value "
            "(e.g. yesterday's revenue instead of all-time total), "
            "inspect form_data['aggregation'] "
            "— when absent or 'LAST_VALUE' the chart shows only the last data point. "
            "Fix by setting aggregation='sum'. "
            "IMPORTANT: when updating aggregation, always include "
            "show_trendline=True and temporal_column to preserve the trendline."
        ),
    )
    filters: list[FilterConfig] | None = Field(
        None,
        description="Filters to apply",
    )

    @field_validator("temporal_column")
    @classmethod
    def sanitize_temporal_column(cls, v: str | None) -> str | None:
        """Sanitize temporal column name to prevent SQL injection."""
        return sanitize_user_input(
            v,
            "Temporal column",
            max_length=255,
            check_sql_keywords=True,
            allow_empty=True,
        )

    @model_validator(mode="after")
    def validate_trendline_fields(self) -> Self:
        """Validate trendline requires temporal column."""
        if self.show_trendline and not self.temporal_column:
            raise ValueError(
                "Big Number chart with show_trendline=True requires "
                "'temporal_column'. Specify a date/time column for "
                "the trendline x-axis."
            )
        if self.compare_lag and not self.show_trendline:
            raise ValueError(
                "compare_lag requires show_trendline=True. "
                "Period comparison is only available for "
                "trendline charts."
            )
        if self.aggregation and not self.show_trendline:
            raise ValueError(
                "aggregation requires show_trendline=True. "
                "The aggregation field only applies to Big Number with "
                "Trendline charts. Set show_trendline=True and provide "
                "a temporal_column, or omit aggregation."
            )
        return self

    @model_validator(mode="after")
    def validate_metric_aggregate(self) -> Self:
        """Ensure metric resolves to a metric expression (aggregate, saved,
        or sql_expression)."""
        if not self.metric.is_metric:
            raise ValueError(
                "Big Number metric must include an aggregate function, "
                "reference a saved metric, or carry a sql_expression. "
                "Set 'aggregate' (e.g., SUM, COUNT, AVG), 'saved_metric': true, "
                "or 'sql_expression' (with a 'label')."
            )
        return self


class TableChartConfig(UnknownFieldCheckMixin):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    chart_type: Literal["table"] = "table"
    viz_type: Literal["table", "ag-grid-table"] = Field(
        "table", description="'ag-grid-table' for interactive features"
    )
    query_mode: Literal["aggregate", "raw"] | None = Field(
        None,
        description=(
            "Query mode: 'raw' returns individual rows without aggregation, "
            "'aggregate' groups data using metrics. "
            "When set to 'raw', all columns are treated as plain columns regardless "
            "of any aggregate settings. "
            "Defaults to auto-detection: 'raw' if no column has an aggregate "
            "function, 'aggregate' otherwise."
        ),
    )
    columns: List[ColumnRef] = Field(
        ...,
        min_length=1,
        description="Columns with unique labels",
        validation_alias=AliasChoices("columns", "all_columns", "groupby"),
    )
    filters: List[FilterConfig] | None = Field(
        None,
        description="Structured filters (column/op/value). "
        "Do NOT use adhoc_filters or raw SQL expressions.",
    )
    sort_by: List[str | SortByConfig] | None = Field(
        None,
        description="Columns to sort by. Each entry is either a column-name "
        "string (defaults to descending) or a SortByConfig object with "
        "explicit `ascending`. Descending matches the sort-by-metric "
        "top-N pattern most common for tables.",
        validation_alias=AliasChoices("sort_by", "order_by_cols", "order_by"),
    )
    row_limit: int = Field(1000, description="Max rows returned", ge=1, le=50000)
    color_scheme: str | None = Field(
        None,
        description=(
            "Superset color scheme ID applied to conditional/cell formatting "
            "(e.g. 'supersetColors')."
        ),
        max_length=100,
    )

    @model_validator(mode="after")
    def reject_sql_expression_in_raw_mode(self) -> "TableChartConfig":
        """In raw mode every column is a plain selection, so a SQL metric
        there would yield ``None`` in ``form_data['all_columns']``."""
        if self.query_mode == "raw":
            for i, col in enumerate(self.columns):
                if col.sql_expression:
                    raise ValueError(
                        f"sql_expression is not allowed on columns[{i}] when "
                        f"query_mode='raw'. Switch to query_mode='aggregate' "
                        f"(or omit query_mode) to use a SQL metric."
                    )
        return self

    @model_validator(mode="after")
    def validate_unique_column_labels(self) -> "TableChartConfig":
        """Ensure all column labels are unique."""
        # Key is (saved_metric, label) so a saved metric and a regular column
        # with the same input name are not flagged as duplicates — saved metrics
        # resolve to their actual casing from the dataset during normalization.
        labels_seen: dict[tuple[bool, str], str] = {}
        duplicates = []

        for i, col in enumerate(self.columns):
            # Generate the label that will be used (same logic as create_metric_object)
            if col.sql_expression:
                # SQL metrics carry a required label; use it verbatim.
                label = col.label or ""
            elif col.saved_metric:
                label = col.label or col.name or ""
            elif col.aggregate:
                label = col.label or f"{col.aggregate}({col.name})"
            else:
                label = col.label or col.name or ""

            key = (col.saved_metric, label)
            if key in labels_seen:
                duplicates.append(f"columns[{i}]: '{label}'")
            else:
                labels_seen[key] = f"columns[{i}]"

        if duplicates:
            raise ValueError(
                f"Duplicate column/metric labels: {', '.join(duplicates)}. "
                f"Please make sure all columns and metrics have a unique label. "
                f"Use the 'label' field to provide custom names for columns."
            )

        return self


def _reject_sql_expression_on_dimension(col: ColumnRef | None, position: str) -> None:
    """Raise if a dimension-position ColumnRef carries ``sql_expression``;
    SQL adhoc metrics belong on metric positions only."""
    if col is not None and col.sql_expression:
        raise ValueError(
            f"sql_expression is only supported on metrics, not on '{position}' "
            f"(which is a dimension). Use 'name' for dimension columns."
        )


def _metric_display_label(col: ColumnRef) -> str:
    """Return the display label for a metric column reference."""
    if col.sql_expression:
        return col.label or ""
    if col.saved_metric:
        return col.label or col.name or ""
    if col.aggregate:
        return col.label or f"{col.aggregate}({col.name})"
    return col.label or col.name or ""


class XYChartConfig(UnknownFieldCheckMixin):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    chart_type: Literal["xy"] = "xy"
    x: ColumnRef | None = Field(
        None,
        description=(
            "X-axis column. If omitted, defaults to the dataset's "
            "primary datetime column (main_dttm_col)."
        ),
        validation_alias=AliasChoices("x", "x_axis", "x_column"),
    )
    y: List[ColumnRef] = Field(
        ...,
        min_length=1,
        description="Y-axis metrics (unique labels)",
        validation_alias=AliasChoices("y", "metrics"),
    )
    kind: Literal["line", "bar", "area", "scatter"] = "line"
    time_grain: TimeGrain | None = Field(
        None,
        description="PT1S, PT1M, PT1H, P1D, P1W, P1M, P3M, P1Y",
        validation_alias=AliasChoices("time_grain", "time_grain_sqla"),
    )
    orientation: Literal["vertical", "horizontal"] | None = Field(
        None,
        description="Bar orientation (only for kind='bar')",
        validation_alias=AliasChoices("orientation", "chart_orientation"),
    )
    stacked: bool = Field(
        False,
        validation_alias=AliasChoices("stacked", "stack"),
    )
    group_by: List[ColumnRef] | None = Field(
        None,
        description="Series breakdown columns",
        validation_alias=AliasChoices(
            "group_by", "groupby", "series", "breakdown", "dimension"
        ),
    )
    x_axis: AxisConfig | None = None
    y_axis: AxisConfig | None = None
    legend: LegendConfig | None = Field(
        None,
        validation_alias=AliasChoices("legend", "show_legend"),
    )
    x_axis_time_format: str | None = Field(
        None,
        description=(
            "Date format for temporal x-axis labels (e.g. 'smart_date', "
            "'%Y-%m-%d'). Only applies when the x-axis column is temporal."
        ),
        max_length=50,
    )
    show_value: bool = Field(False, description="Show data labels on each data point")
    currency_format: CurrencyFormat | None = Field(
        None,
        description="Currency symbol applied to metric values",
    )
    color_scheme: str | None = Field(
        None,
        description=(
            "Superset color scheme ID (e.g. 'supersetColors', 'lyftColors', "
            "'googleCategory10c', 'd3Category10'). When omitted, Superset's "
            "default scheme is used."
        ),
        max_length=100,
    )
    filters: List[FilterConfig] | None = Field(
        None,
        description="Structured filters (column/op/value). "
        "Do NOT use adhoc_filters or raw SQL expressions.",
    )
    row_limit: int = Field(10000, description="Max data points", ge=1, le=50000)
    series_limit: int | None = Field(
        None,
        description=(
            "Max number of series to show when group_by is set. "
            "Limits the distinct values rendered as separate lines/bars. "
            "Only applies when group_by is specified."
        ),
        ge=1,
        le=10000,
    )

    @field_validator("group_by", mode="before")
    @classmethod
    def wrap_single_group_by(cls, v: Any) -> Any:
        return _normalize_group_by_input(v)

    @field_validator("x", mode="before")
    @classmethod
    def coerce_x_column_name(cls, v: Any) -> Any:
        """Accept a bare column name string for the x-axis."""
        return {"name": v} if isinstance(v, str) else v

    @field_validator("y", mode="before")
    @classmethod
    def coerce_y_column_names(cls, v: Any) -> Any:
        """Accept bare strings or a single entry for the y-axis metrics."""
        return _normalize_group_by_input(v)

    @field_validator("legend", mode="before")
    @classmethod
    def coerce_legend_flag(cls, v: Any) -> Any:
        """Accept the form_data-style show_legend boolean."""
        return {"show": v} if isinstance(v, bool) else v

    @model_validator(mode="after")
    def reject_sql_expression_on_dimensions(self) -> "XYChartConfig":
        """sql_expression is metric-only; reject it on x and group_by."""
        _reject_sql_expression_on_dimension(self.x, "x")
        if self.group_by:
            for i, col in enumerate(self.group_by):
                _reject_sql_expression_on_dimension(col, f"group_by[{i}]")
        return self

    @model_validator(mode="after")
    def validate_unique_column_labels(self) -> "XYChartConfig":
        """Ensure all column labels are unique across x, y, and group_by."""
        # Key is (saved_metric, label) so a saved metric and a regular column
        # with the same input name are not flagged as duplicates — saved metrics
        # resolve to their actual casing from the dataset during normalization.
        labels_seen: dict[tuple[bool, str], str] = {}
        duplicates: list[str] = []

        # Add x-axis label if present (x may be None, resolved later).
        # The dimension validator rejects sql_expression on x, so name is set.
        if self.x is not None:
            x_label = self.x.label or self.x.name or ""
            labels_seen[(self.x.saved_metric, x_label)] = "x"

        # Check Y-axis labels
        for i, col in enumerate(self.y):
            label = _metric_display_label(col)
            key = (col.saved_metric, label)
            if key in labels_seen:
                duplicates.append(
                    f"y[{i}]: '{label}' (conflicts with {labels_seen[key]})"
                )
            else:
                labels_seen[key] = f"y[{i}]"

        # Check group_by labels if present
        if self.group_by:
            for i, col in enumerate(self.group_by):
                if self.x is not None and col.name == self.x.name:
                    # map_xy_config() strips group_by entries that match x
                    # to prevent Superset "duplicate label" errors, so
                    # we allow them through validation.
                    continue
                group_label = col.label or col.name or ""
                group_key = (col.saved_metric, group_label)
                if group_key in labels_seen:
                    duplicates.append(
                        f"group_by[{i}]: '{group_label}' "
                        f"(conflicts with {labels_seen[group_key]})"
                    )
                else:
                    labels_seen[group_key] = f"group_by[{i}]"

        if duplicates:
            raise ValueError(
                f"Duplicate column/metric labels: {', '.join(duplicates)}. "
                f"Please make sure all columns and metrics have a unique label. "
                f"Use the 'label' field to provide custom names for columns."
            )

        return self


class HistogramChartConfig(UnknownFieldCheckMixin):
    """Config for histogram charts (viz_type ``histogram_v2``)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    chart_type: Literal["histogram"] = "histogram"
    column: ColumnRef = Field(
        ...,
        description="Numeric column to bin (a physical dataset column)",
    )
    groupby: List[ColumnRef] | None = Field(
        None,
        description="Optional dimensions to split the distribution into series",
    )
    bins: int = Field(5, description="Number of histogram bins", ge=1, le=1000)
    normalize: bool = Field(False, description="Normalize bin counts to proportions")
    cumulative: bool = Field(False, description="Accumulate bin counts left to right")
    filters: List[FilterConfig] | None = Field(
        None,
        description="Structured filters (column/op/value). "
        "Do NOT use adhoc_filters or raw SQL expressions.",
    )
    row_limit: int = Field(10000, description="Max rows sampled", ge=1, le=100000)

    @model_validator(mode="after")
    def reject_metric_style_column(self) -> "HistogramChartConfig":
        """The binned column is a physical column, not a metric."""
        _reject_sql_expression_on_dimension(self.column, "column")
        if self.column and self.column.saved_metric:
            raise ValueError(
                "column cannot use saved_metric=True; histograms bin a "
                "physical numeric column"
            )
        for i, col in enumerate(self.groupby or []):
            _reject_sql_expression_on_dimension(col, f"groupby[{i}]")
            if col.saved_metric:
                raise ValueError(
                    f"groupby[{i}] cannot use saved_metric=True; "
                    "saved metrics are not dimensions"
                )
        return self


class BoxPlotChartConfig(UnknownFieldCheckMixin):
    """Config for box plot charts (viz_type ``box_plot``)."""

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    chart_type: Literal["box_plot"] = "box_plot"
    metrics: List[ColumnRef] = Field(
        ...,
        min_length=1,
        description="Metrics whose distributions are plotted (use aggregate "
        "e.g. AVG, SUM for ad-hoc, or saved_metric=True for saved metrics)",
    )
    distribute_across: List[ColumnRef] = Field(
        ...,
        min_length=1,
        validation_alias=AliasChoices("distribute_across", "columns"),
        description="Columns whose distinct values form the SAMPLES inside "
        "each box (typically a temporal column such as month) — the "
        "distribution is computed across these values; maps to the "
        "frontend's 'Distribute across' control (form_data 'columns'). "
        "This does NOT split boxes; use 'dimensions' for that.",
    )
    dimensions: List[ColumnRef] | None = Field(
        None,
        validation_alias=AliasChoices("dimensions", "groupby"),
        description="Columns whose values split the chart into boxes — one "
        "box per value on the x-axis (form_data 'groupby'). Omit for a "
        "single box showing each metric's overall distribution.",
    )
    whisker_type: Literal["tukey", "min_max", "percentile"] = Field(
        "tukey",
        description="Whisker algorithm: 'tukey' (1.5 IQR), 'min_max' (no "
        "outliers), or 'percentile' (requires percentile_low/percentile_high)",
    )
    percentile_low: int | None = Field(
        None, description="Lower whisker percentile (0-100)", ge=0, le=100
    )
    percentile_high: int | None = Field(
        None, description="Upper whisker percentile (0-100)", ge=0, le=100
    )
    filters: List[FilterConfig] | None = Field(
        None,
        description="Structured filters (column/op/value). "
        "Do NOT use adhoc_filters or raw SQL expressions.",
    )
    row_limit: int = Field(
        10000,
        description="Max grouped rows (frontend shared default)",
        ge=1,
        le=50000,
    )
    number_format: str = Field("SMART_NUMBER", max_length=50)
    date_format: str = Field("smart_date", max_length=50)

    @model_validator(mode="before")
    @classmethod
    def accept_frontend_whisker_options(cls, data: Any) -> Any:
        """Translate the frontend's whiskerOptions strings ('Tukey',
        'Min/max (no outliers)', '<low>/<high> percentiles') so configs
        copied from existing Superset form_data are accepted rather than
        refused."""
        if isinstance(data, dict) and "whiskerOptions" in data:
            raw = str(data.pop("whiskerOptions"))
            if "whisker_type" in data:
                # Explicit whisker_type wins; the alias is consumed so the
                # unknown-field check doesn't reject the request.
                return data
            if raw == "Tukey":
                data["whisker_type"] = "tukey"
            elif raw == "Min/max (no outliers)":
                data["whisker_type"] = "min_max"
            else:
                match = re.fullmatch(r"(\d{1,3})/(\d{1,3}) percentiles", raw)
                if not match:
                    raise ValueError(
                        f"Unsupported whiskerOptions value: {raw!r}. Use "
                        "whisker_type ('tukey'|'min_max'|'percentile') instead."
                    )
                data["whisker_type"] = "percentile"
                data.setdefault("percentile_low", int(match.group(1)))
                data.setdefault("percentile_high", int(match.group(2)))
        return data

    @model_validator(mode="after")
    def validate_percentiles_and_dimensions(self) -> "BoxPlotChartConfig":
        if self.whisker_type == "percentile":
            if self.percentile_low is None or self.percentile_high is None:
                raise ValueError(
                    "whisker_type='percentile' requires both percentile_low "
                    "and percentile_high"
                )
            if self.percentile_low >= self.percentile_high:
                raise ValueError("percentile_low must be less than percentile_high")
        elif self.percentile_low is not None or self.percentile_high is not None:
            raise ValueError(
                "percentile_low/percentile_high only apply when "
                "whisker_type='percentile'"
            )
        for i, col in enumerate(self.distribute_across):
            _reject_sql_expression_on_dimension(col, f"distribute_across[{i}]")
            if col.saved_metric:
                raise ValueError(
                    f"distribute_across[{i}] cannot use saved_metric=True; "
                    "saved metrics belong in the 'metrics' field"
                )
        for i, col in enumerate(self.dimensions or []):
            _reject_sql_expression_on_dimension(col, f"dimensions[{i}]")
            if col.saved_metric:
                raise ValueError(
                    f"dimensions[{i}] cannot use saved_metric=True; "
                    "saved metrics belong in the 'metrics' field"
                )
        return self


# Discriminated union for runtime validation (not exposed in JSON Schema)
ChartConfig = Annotated[
    XYChartConfig
    | TableChartConfig
    | PieChartConfig
    | PivotTableChartConfig
    | MixedTimeseriesChartConfig
    | HandlebarsChartConfig
    | BigNumberChartConfig
    | HistogramChartConfig
    | BoxPlotChartConfig,
    Field(
        discriminator="chart_type",
        description=(
            "Chart configuration - specify chart_type as 'xy', 'table', "
            "'pie', 'pivot_table', 'mixed_timeseries', 'handlebars', "
            "'big_number', 'histogram', or 'box_plot'"
        ),
    ),
]


# Compact description for JSON Schema — keeps tool inputSchema small while
# giving LLMs enough context to construct valid configs.


# Superset viz_type values that LLM clients routinely send where this API
# expects its chart_type discriminator. Extend this observed-pattern map when
# recurring session traces show additional unambiguous aliases. Each maps to
# (chart_type, kind); kind is only meaningful for the xy family.
_VIZ_TYPE_TO_CHART_TYPE: dict[str, tuple[str, str | None]] = {
    "bar": ("xy", "bar"),
    "dist_bar": ("xy", "bar"),
    "echarts_timeseries_bar": ("xy", "bar"),
    "line": ("xy", "line"),
    "echarts_timeseries_line": ("xy", "line"),
    "echarts_timeseries_smooth": ("xy", "line"),
    "area": ("xy", "area"),
    "echarts_area": ("xy", "area"),
    "scatter": ("xy", "scatter"),
    "echarts_timeseries_scatter": ("xy", "scatter"),
    "ag-grid-table": ("table", None),
    "big_number_total": ("big_number", None),
    "pivot_table_v2": ("pivot_table", None),
    "histogram_v2": ("histogram", None),
}


def _normalize_chart_request_input(data: Any) -> Any:
    """Accept common Superset REST/form_data vocabulary in chart requests.

    LLM clients reliably reach for Superset's public field names —
    ``datasource_id``, ``viz_type``, and concrete viz plugin names such as
    ``echarts_timeseries_bar`` — before consulting this API's schema. Each
    rejection costs the client a model round trip, so the unambiguous
    synonyms are translated instead of refused.
    """
    if not isinstance(data, dict):
        return data
    if "dataset_id" not in data and "datasource_id" in data:
        data["dataset_id"] = data.pop("datasource_id")
    config = data.get("config")
    if isinstance(config, dict):
        viz_type = config.get("viz_type")
        if isinstance(viz_type, str) and "chart_type" not in config:
            config["chart_type"] = viz_type
        chart_type = config.get("chart_type")
        if isinstance(chart_type, str) and chart_type in _VIZ_TYPE_TO_CHART_TYPE:
            mapped_type, kind = _VIZ_TYPE_TO_CHART_TYPE[chart_type]
            config["chart_type"] = mapped_type
            if kind is not None:
                config.setdefault("kind", kind)
            if mapped_type == "table":
                config.setdefault("viz_type", chart_type)
            else:
                config.pop("viz_type", None)
        elif config.get("chart_type") != "table":
            config.pop("viz_type", None)
    return data


class ChartRequestNormalizerMixin(BaseModel):
    """Mixin translating Superset-vocabulary synonyms before validation."""

    @model_validator(mode="before")
    @classmethod
    def _normalize_request_vocabulary(cls, data: Any) -> Any:
        """Normalize Superset-style request keys before Pydantic validation."""
        return _normalize_chart_request_input(data)


class ListChartsRequest(EditedByMeMixin, CreatedByMeMixin, MetadataCacheControl):
    """Request schema for list_charts with clear, unambiguous types."""

    model_config = ConfigDict(populate_by_name=True)

    filters: Annotated[
        List[ChartFilter],
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
            validation_alias=AliasChoices("select_columns", "columns"),
        ),
    ]

    @field_validator("filters", mode="before")
    @classmethod
    def parse_filters(cls, v: Any) -> List[ChartFilter]:
        """
        Parse filters from JSON string or list.

        Handles Claude Code bug where objects are double-serialized as strings.
        See: https://github.com/anthropics/claude-code/issues/5504
        """
        from superset.mcp_service.utils.schema_utils import parse_json_or_model_list

        return cast(
            List[ChartFilter],
            parse_json_or_model_list(v, ChartFilter, "filters"),
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
            description="Text search string to match against chart fields. Cannot be "
            "used together with 'filters'.",
        ),
    ]
    deleted_state: Annotated[
        Literal["include", "only"] | None,
        Field(
            default=None,
            description=(
                "Surface soft-deleted (trashed) charts: 'only' returns just "
                "trashed charts, 'include' returns live and trashed charts "
                "together. Omit for live charts only (default). Trashed rows "
                "carry a non-null deleted_at and are limited to charts the "
                "caller owns (admins see all); requires the SOFT_DELETE "
                "feature flag to have produced trashed rows."
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
    def validate_search_and_filters(self) -> "ListChartsRequest":
        """Prevent using both search and filters simultaneously."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


# The tool input models
class GenerateChartRequest(ChartRequestNormalizerMixin, QueryCacheControl):
    model_config = ConfigDict(populate_by_name=True)

    dataset_id: int | str = Field(..., description="Dataset identifier (ID, UUID)")
    config: ChartConfig = Field(..., description="Chart configuration")
    chart_name: str | None = Field(
        None,
        description="Auto-generates if omitted",
        max_length=255,
        validation_alias=AliasChoices("chart_name", "name", "title", "slice_name"),
    )
    save_chart: bool = Field(default=False, description="Save permanently in Superset")
    generate_preview: bool = True
    preview_formats: List[Literal["url", "ascii", "vega_lite", "table"]] = Field(
        default_factory=lambda: ["url"],
    )
    sanitization_warnings: List[str] = Field(
        default_factory=list,
        description=(
            "Internal: warnings emitted when user input was altered by "
            "sanitization. Populated by the ``mode='before'`` validator "
            "before chart_name is rewritten, so the tool can surface a "
            "notice to the caller instead of silently dropping content."
        ),
    )

    @model_validator(mode="before")
    @classmethod
    def _detect_chart_name_sanitization(cls, data: Any) -> Any:
        """Record a warning when chart_name sanitization alters user input.

        Runs before the ``chart_name`` field validator strips HTML, so we
        can compare the caller's raw input against the sanitizer output
        and tell the tool whether to notify the caller. Empty-after-
        sanitization is rejected with a ValueError so the caller gets a
        clear error instead of a silently auto-generated name.

        ``sanitization_warnings`` is a server-only field — any value the
        caller supplied is discarded here so the tool cannot be tricked
        into echoing attacker-controlled text back through the response.
        """
        if not isinstance(data, dict):
            return data
        data["sanitization_warnings"] = []
        for key in ("chart_name", "name", "title", "slice_name"):
            if key in data:
                raw = data[key]
                break
        else:
            raw = None
        if not isinstance(raw, str) or not raw.strip():
            return data
        sanitized, was_modified = sanitize_user_input_with_changes(
            raw, "Chart name", max_length=255, allow_empty=True
        )
        if was_modified and not sanitized:
            raise ValueError(
                "chart_name contained only disallowed content "
                "(HTML/script/URL schemes) and was removed entirely by "
                "sanitization. Provide a chart_name with plain text, or "
                "omit it to auto-generate one."
            )
        if was_modified:
            data["sanitization_warnings"].append(
                "chart_name was modified during sanitization to remove "
                "potentially unsafe content; the stored name differs "
                "from the input."
            )
        return data

    @field_validator("chart_name")
    @classmethod
    def sanitize_chart_name(cls, v: str | None) -> str | None:
        """Sanitize chart name to prevent XSS attacks."""
        return sanitize_user_input(v, "Chart name", max_length=255, allow_empty=True)

    @model_validator(mode="after")
    def validate_cache_timeout(self) -> "GenerateChartRequest":
        """Validate cache timeout is non-negative."""
        if (
            hasattr(self, "cache_timeout")
            and self.cache_timeout is not None
            and self.cache_timeout < 0
        ):
            raise ValueError(
                "cache_timeout must be non-negative (0 or positive integer)"
            )
        return self

    @model_validator(mode="after")
    def validate_save_or_preview(self) -> "GenerateChartRequest":
        """Ensure at least one of save_chart or generate_preview is enabled."""
        if not self.save_chart and not self.generate_preview:
            raise ValueError(
                "At least one of 'save_chart' or 'generate_preview' must be True. "
                "A request with both set to False would be a no-op."
            )
        return self


class GenerateExploreLinkRequest(ChartRequestNormalizerMixin, FormDataCacheControl):
    model_config = ConfigDict(populate_by_name=True)

    dataset_id: int | str = Field(..., description="Dataset identifier (ID, UUID)")
    config: ChartConfig | None = Field(
        None,
        description=(
            "Chart configuration. Optional; omit to get a default "
            "explore URL that opens the dataset in Superset without a "
            "preconfigured chart."
        ),
    )


class UpdateChartRequest(ChartRequestNormalizerMixin, QueryCacheControl):
    model_config = ConfigDict(populate_by_name=True)

    identifier: int | str = Field(
        ...,
        description="Chart ID or UUID",
        validation_alias=AliasChoices("identifier", "id", "chart_id"),
    )
    config: ChartConfig | None = Field(
        None,
        description="Chart configuration. Optional; omit to only update chart_name.",
    )
    chart_name: str | None = Field(
        None,
        description="Auto-generates if omitted",
        max_length=255,
        validation_alias=AliasChoices("chart_name", "name", "title", "slice_name"),
    )
    dataset_id: int | None = Field(
        None,
        description=(
            "Target dataset ID to rebind the chart to a different dataset. "
            "When omitted, the chart retains its existing dataset. "
            "Can be combined with config to simultaneously change the dataset "
            "and visualization, or used alone to rebind without altering the config."
        ),
    )
    generate_preview: bool = Field(
        default=True,
        description=(
            "When True (default), returns a preview explore URL so the user "
            "can review changes before saving. When False, persists the "
            "update immediately."
        ),
    )
    preview_formats: list[Literal["url", "ascii", "vega_lite", "table"]] = Field(
        default_factory=lambda: ["url"],
        description=(
            "Extra preview formats to render after saving. Only used when "
            "generate_preview=False. When generate_preview=True, the preview "
            "is always an explore URL."
        ),
    )

    @field_validator("chart_name")
    @classmethod
    def sanitize_chart_name(cls, v: str | None) -> str | None:
        """Sanitize chart name to prevent XSS attacks."""
        return sanitize_user_input(v, "Chart name", max_length=255, allow_empty=True)


class UpdateChartPreviewRequest(ChartRequestNormalizerMixin, FormDataCacheControl):
    model_config = ConfigDict(populate_by_name=True)

    form_data_key: str | None = Field(
        None,
        description=(
            "Existing form_data_key to update"
            " (omit for fresh preview from config + dataset_id)"
        ),
    )
    dataset_id: int | str = Field(..., description="Dataset ID or UUID")
    config: ChartConfig = Field(..., description="Chart configuration")
    generate_preview: bool = True
    preview_formats: List[Literal["url", "ascii", "vega_lite", "table"]] = Field(
        default_factory=lambda: ["url"],
    )


class GetChartDataRequest(QueryCacheControl):
    """Request for chart data with cache control.

    When form_data_key is provided, the tool will use the unsaved chart configuration
    from cache to query data, allowing you to get data for what the user actually sees
    (not the saved version). This is useful when a user edits a chart in Explore but
    hasn't saved yet.

    For unsaved charts (no chart ID), provide only form_data_key to query data using
    the current chart configuration from cache.
    """

    model_config = ConfigDict(populate_by_name=True)

    identifier: int | str | None = Field(
        default=None,
        description=(
            "Chart identifier (ID, UUID). "
            "Optional when form_data_key is provided (for unsaved charts)."
        ),
        validation_alias=AliasChoices("identifier", "id", "chart_id"),
    )
    form_data_key: str | None = Field(
        default=None,
        description=(
            "Cache key for retrieving unsaved chart state. When a user "
            "edits a chart in Explore but hasn't saved, the current state is stored "
            "with this key. If provided, the tool uses this configuration to query "
            "data instead of the saved chart configuration. "
            "Can be used alone (without identifier) for unsaved charts."
        ),
    )

    @model_validator(mode="after")
    def validate_identifier_or_form_data_key(self) -> "GetChartDataRequest":
        if not self.identifier and not self.form_data_key:
            raise ValueError(
                "At least one of 'identifier' or 'form_data_key' must be provided."
            )
        return self

    limit: int | None = Field(
        default=None,
        description=(
            "Maximum number of data rows to return. If not specified, uses the "
            "chart's configured row limit."
        ),
    )
    extra_form_data: dict[str, Any] | None = Field(
        default=None,
        description=(
            "Extra form data to merge into the chart query, typically from "
            "dashboard native filters. Format: "
            '{"filters": [{"col": "country", "op": "IN", "val": ["US"]}]}'
        ),
    )
    format: Literal["json", "csv", "excel"] = Field(
        default="json", description="Data export format"
    )


class DataColumn(BaseModel):
    """Enhanced column metadata with semantic information."""

    name: str = Field(..., description="Column name")
    display_name: str = Field(..., description="Human-readable column name")
    data_type: str = Field(..., description="Inferred data type")
    sample_values: List[Any] = Field(description="Representative sample values")
    null_count: int = Field(
        description="Number of null values. Approximate — see 'statistics.sampled_rows'"
        " if the source result set was larger than the row cap used to compute it."
    )
    unique_count: int = Field(
        description="Number of unique values. Approximate — see "
        "'statistics.sampled_rows' if the source result set was larger than the "
        "row cap used to compute it."
    )
    statistics: Dict[str, Any] | None = Field(
        None,
        description="Additional column statistics, when available. May include "
        "'sampled_rows' (any column type) when null_count/unique_count were "
        "computed on a row-capped sample rather than the full result set.",
    )
    semantic_type: str | None = Field(
        None, description="Semantic type (currency, percentage, etc)"
    )


class ChartData(BaseModel):
    """Rich chart data response with statistical insights."""

    # Basic information
    chart_id: int
    chart_name: str
    chart_type: str

    # Enhanced data description
    columns: List[DataColumn] = Field(description="Rich column metadata")
    data: List[Dict[str, Any]] = Field(description="Actual data rows")

    # Data insights
    row_count: int = Field(description="Rows returned")
    total_rows: int | None = Field(description="Total available rows")
    data_freshness: datetime | None = Field(description="When data was last updated")

    # LLM-friendly summaries
    summary: str = Field(description="Human-readable data summary")
    insights: List[str] = Field(description="Key patterns discovered in the data")
    data_quality: Dict[str, Any] = Field(description="Data quality assessment")
    recommended_visualizations: List[str] = Field(
        description="Suggested chart types for this data"
    )

    # Performance and metadata
    performance: PerformanceMetadata = Field(description="Query performance metrics")
    cache_status: CacheStatus | None = Field(
        None, description="Cache usage information"
    )

    # Export format fields
    csv_data: str | None = Field(None, description="CSV content when format='csv'")
    excel_data: str | None = Field(
        None, description="Base64-encoded Excel content when format='excel'"
    )
    format: str | None = Field(
        None, description="Export format used (json, csv, excel)"
    )

    # Inherit versioning
    schema_version: str = Field("2.0", description="Response schema version")
    api_version: str = Field("v1", description="MCP API version")


class GetChartPreviewRequest(QueryCacheControl):
    """Request for chart preview with cache control.

    When form_data_key is provided, the tool will render a preview using the unsaved
    chart configuration from cache, allowing you to preview what the user actually sees
    (not the saved version). This is useful when a user edits a chart in Explore but
    hasn't saved yet.

    For unsaved charts (no chart ID), provide only form_data_key to render a preview
    using the current chart configuration from cache.
    """

    model_config = ConfigDict(populate_by_name=True)

    identifier: int | str | None = Field(
        default=None,
        description=(
            "Chart identifier (ID, UUID). "
            "Optional when form_data_key is provided (for unsaved charts)."
        ),
        validation_alias=AliasChoices("identifier", "id", "chart_id"),
    )
    form_data_key: str | None = Field(
        default=None,
        description=(
            "Cache key for retrieving unsaved chart state. When a user "
            "edits a chart in Explore but hasn't saved, the current state is stored "
            "with this key. If provided, the tool renders a preview using this "
            "configuration instead of the saved chart configuration. "
            "Can be used alone (without identifier) for unsaved charts."
        ),
    )

    @model_validator(mode="after")
    def validate_identifier_or_form_data_key(self) -> "GetChartPreviewRequest":
        if not self.identifier and not self.form_data_key:
            raise ValueError(
                "At least one of 'identifier' or 'form_data_key' must be provided."
            )
        return self

    format: Literal["url", "ascii", "table", "vega_lite"] = Field(
        default="ascii",
        description=(
            "Preview format: 'ascii' for text art (default), "
            "'url' for explore link, "
            "'table' for data table, "
            "'vega_lite' for interactive JSON specification"
        ),
    )
    width: int | None = Field(
        default=800,
        description="Preview width in pixels (for url and vega_lite formats)",
    )
    height: int | None = Field(
        default=600,
        description="Preview height in pixels (for url and vega_lite formats)",
    )
    ascii_width: int | None = Field(
        default=80, description="ASCII chart width in characters (for ascii format)"
    )
    ascii_height: int | None = Field(
        default=20, description="ASCII chart height in lines (for ascii format)"
    )


# Discriminated union preview formats for type safety
class URLPreview(BaseModel):
    """URL-based preview format."""

    type: Literal["url"] = "url"
    preview_url: str = Field(
        ...,
        description=(
            "Explore URL for opening the chart. "
            "The scheme matches the configured instance URL "
            "(HTTPS in production/staging, HTTP in local development)."
        ),
    )
    width: int = Field(..., description="Requested Explore viewport width in pixels")
    height: int = Field(..., description="Requested Explore viewport height in pixels")
    supports_interaction: bool = Field(
        True, description="Explore URL supports chart interaction"
    )


class InteractivePreview(BaseModel):
    """Interactive HTML preview with JavaScript controls."""

    type: Literal["interactive"] = "interactive"
    html_content: str = Field(..., description="Embeddable HTML with Plotly/D3")
    preview_url: str = Field(..., description="Iframe-compatible URL")
    width: int = Field(..., description="Viewport width")
    height: int = Field(..., description="Viewport height")
    supports_pan: bool = Field(True, description="Supports pan interaction")
    supports_zoom: bool = Field(True, description="Supports zoom interaction")
    supports_hover: bool = Field(True, description="Supports hover details")


class ASCIIPreview(BaseModel):
    """ASCII art text representation."""

    type: Literal["ascii"] = "ascii"
    ascii_content: str = Field(..., description="Unicode art representation")
    width: int = Field(..., description="Character width")
    height: int = Field(..., description="Line height")
    supports_color: bool = Field(False, description="Uses ANSI color codes")


class VegaLitePreview(BaseModel):
    """Vega-Lite grammar of graphics specification."""

    type: Literal["vega_lite"] = "vega_lite"
    specification: Dict[str, Any] = Field(..., description="Vega-Lite JSON spec")
    data_url: str | None = Field(None, description="External data URL")
    supports_streaming: bool = Field(False, description="Supports live data updates")


class TablePreview(BaseModel):
    """Tabular data preview format."""

    type: Literal["table"] = "table"
    table_data: str = Field(..., description="Formatted table content")
    row_count: int = Field(..., description="Number of rows displayed")
    supports_sorting: bool = Field(False, description="Table supports sorting")


# Modern discriminated union using | syntax
ChartPreviewContent = Annotated[
    URLPreview | InteractivePreview | ASCIIPreview | VegaLitePreview | TablePreview,
    Field(discriminator="type"),
]


class GenerateChartResponse(BaseModel):
    """Comprehensive chart creation response with rich metadata."""

    # Core chart information
    chart: ChartInfo | None = Field(None, description="Complete chart metadata")

    # Multiple preview formats available
    previews: Dict[str, ChartPreviewContent] = Field(
        default_factory=dict,
        description="Available preview formats keyed by format type",
    )

    # LLM-friendly capabilities
    capabilities: ChartCapabilities | None = Field(
        None, description="Chart interaction capabilities"
    )
    semantics: ChartSemantics | None = Field(
        None, description="Semantic chart understanding"
    )

    # Navigation and context
    explore_url: str | None = Field(None, description="Edit chart in Superset")
    chart_type_label: str | None = Field(
        None,
        description=(
            "User-facing chart type label derived from the rendered visualization type"
        ),
    )
    embed_code: str | None = Field(None, description="HTML embed snippet")
    api_endpoints: Dict[str, str] = Field(
        default_factory=dict, description="Related API endpoints for data/updates"
    )

    # Form data for rendering charts in external clients (chatbot rendering)
    form_data: Dict[str, Any] = Field(
        default_factory=dict,
        description="Complete form_data configuration for rendering the chart",
    )
    form_data_key: str | None = Field(
        None,
        description="Cache key for the form_data, used in explore URLs",
    )

    # Performance and accessibility
    performance: PerformanceMetadata | None = Field(
        None, description="Performance metrics"
    )
    accessibility: AccessibilityMetadata | None = Field(
        None, description="Accessibility info"
    )

    # Success/error handling
    success: bool = Field(True, description="Whether chart creation succeeded")
    error: ChartGenerationError | None = Field(
        None, description="Error details if creation failed"
    )
    warnings: List[str] = Field(default_factory=list, description="Non-fatal warnings")

    # Inherit versioning
    schema_version: str = Field("2.0", description="Response schema version")
    api_version: str = Field("v1", description="MCP API version")


class ChartPreview(BaseModel):
    """Enhanced chart preview with discriminated union content."""

    chart_id: int
    chart_name: str
    chart_type: str = Field(description="Type of chart visualization")
    explore_url: str = Field(description="URL to open chart in Superset for editing")

    # Type-safe preview content
    content: ChartPreviewContent = Field(
        description="Preview content in requested format"
    )

    # Rich metadata
    chart_description: str = Field(
        description="Human-readable description of the chart"
    )
    accessibility: AccessibilityMetadata = Field(
        description="Accessibility information"
    )
    performance: PerformanceMetadata = Field(description="Performance metrics")

    # Inherit versioning
    schema_version: str = Field("2.0", description="Response schema version")
    api_version: str = Field("v1", description="MCP API version")


class GetChartSqlRequest(BaseModel):
    """Request schema for get_chart_sql.

    Returns the rendered SQL query that a chart would execute, without actually
    running it. Useful for understanding what SQL a chart generates.

    Provide a chart identifier (ID or UUID). Optionally provide form_data_key
    to get the SQL for the unsaved chart state from the Explore view.
    """

    model_config = ConfigDict(populate_by_name=True)

    identifier: int | str | None = Field(
        default=None,
        description=(
            "Chart identifier - can be numeric ID or UUID string. "
            "Optional when form_data_key is provided (for unsaved charts)."
        ),
        validation_alias=AliasChoices("identifier", "id", "chart_id"),
    )
    form_data_key: str | None = Field(
        default=None,
        description=(
            "Cache key for retrieving unsaved chart state. When a user "
            "edits a chart in Explore but hasn't saved, the current state is stored "
            "with this key. If provided, the tool returns the SQL for the unsaved "
            "configuration instead of the saved version. "
            "Can be used alone (without identifier) for unsaved charts."
        ),
    )

    @model_validator(mode="after")
    def validate_identifier_or_form_data_key(self) -> "GetChartSqlRequest":
        if not self.identifier and not self.form_data_key:
            raise ValueError(
                "At least one of 'identifier' or 'form_data_key' must be provided."
            )
        return self


class ChartSql(BaseModel):
    """Response containing the rendered SQL for a chart."""

    chart_id: int | None = Field(None, description="Chart ID (null for unsaved charts)")
    chart_name: str | None = Field(
        None, description="Chart name (null for unsaved charts)"
    )
    sql: str = Field(..., description="The rendered SQL query for this chart")
    language: str | None = Field(None, description="Query language (e.g. 'sql')")
    datasource_name: str | None = Field(
        None, description="Name of the datasource the chart queries"
    )
    error: str | None = Field(
        None,
        description=(
            "Validation or parse error if the SQL could not be fully generated. "
            "When present, 'sql' may still contain a partial query."
        ),
    )


class AdhocFilter(BaseModel):
    """A single adhoc filter configured on a chart."""

    clause: str | None = Field(None, description="SQL clause: WHERE or HAVING")
    expression_type: str | None = Field(
        None,
        description=(
            "Filter expression type: SIMPLE for column-based filters, "
            "SQL for free-form SQL expressions"
        ),
    )
    subject: str | None = Field(
        None, description="Column name the filter applies to (SIMPLE filters)"
    )
    operator: str | None = Field(
        None,
        description="Filter operator (e.g. '==', '!=', 'IN', 'NOT IN', 'LIKE', '>')",
    )
    comparator: Any | None = Field(
        None, description="Filter value(s) to compare against"
    )
    sql_expression: str | None = Field(
        None,
        description="Free-form SQL expression (SQL expression type filters only)",
    )

    model_config = ConfigDict(extra="ignore")


class AppliedDashboardFilter(BaseModel):
    """A dashboard-level native filter resolved against a specific chart.

    Returned when get_chart_info is called with a dashboard_id. Values come
    from the filter's default state on the saved dashboard (not a permalink).
    """

    id: str | None = Field(None, description="Native filter ID")
    name: str | None = Field(None, description="Filter display name")
    filter_type: str | None = Field(
        None, description="Native filter type (e.g. filter_select, filter_range)"
    )
    column: str | None = Field(None, description="Target column the filter applies to")
    operator: str | None = Field(
        None,
        description=(
            "Filter operator as stored in extra_form_data (e.g. 'IN', '==', 'LIKE', "
            "or 'TIME_RANGE' for temporal filters with no target column)"
        ),
    )
    value: Any | None = Field(
        None, description="Filter value(s) from the default data mask"
    )
    status: str = Field(
        ...,
        description=(
            "Whether the filter contributes to the chart query: 'applied', "
            "'not_applied', or 'not_applied_uses_default_to_first_item_prequery'"
        ),
    )


class ChartFiltersInfo(BaseModel):
    """Structured representation of all filters applied to a chart."""

    adhoc_filters: List[AdhocFilter] = Field(
        default_factory=list,
        description=(
            "Adhoc filters configured on the chart. These are the primary "
            "filters visible in the chart's filter panel."
        ),
    )
    time_range: str | None = Field(
        None,
        description=(
            "Time range filter applied to the chart "
            "(e.g. 'Last 7 days', 'No filter', '2024-01-01 : 2024-12-31')"
        ),
    )
    granularity_sqla: str | None = Field(
        None,
        description="Temporal column used for time-based filtering",
    )
    extra_filters: List[Dict[str, Any]] = Field(
        default_factory=list,
        description=("Extra filters applied from dashboard context or URL parameters"),
    )
    filters: List[Dict[str, Any]] = Field(
        default_factory=list,
        description=(
            "Legacy top-level filters payload (older/simpler charts). "
            "These are plain column-operator-value dicts, distinct from "
            "adhoc_filters which use the newer expressionType format."
        ),
    )
    where: str | None = Field(
        None,
        description="Custom WHERE clause applied to the chart query",
    )
    having: str | None = Field(
        None,
        description="Custom HAVING clause applied to the chart query",
    )
    dashboard_filters: List[AppliedDashboardFilter] = Field(
        default_factory=list,
        description=(
            "Dashboard-level native filters in scope for this chart on the "
            "dashboard passed via get_chart_info's dashboard_id argument. Empty "
            "when no dashboard_id was provided or no native filter targets this "
            "chart."
        ),
    )


class RestoreChartRequest(BaseModel):
    """Request schema for restore_chart."""

    identifier: int | str = Field(
        ...,
        description=(
            "Chart identifier - numeric ID or UUID string (charts have no slug)."
        ),
    )

    @field_validator("identifier", mode="before")
    @classmethod
    def reject_bool_identifier(cls, value: object) -> object:
        """bool is a subclass of int, so identifier=true would coerce to
        chart ID 1 and target the wrong object; reject it outright."""
        if isinstance(value, bool):
            raise ValueError("identifier must be an integer ID or UUID string")
        return value


class RestoreChartResponse(BaseModel):
    """Result of a restore_chart operation."""

    success: bool = Field(description="Whether the chart was restored from trash")
    restored_id: int | None = Field(None, description="ID of the restored chart")
    restored_name: str | None = Field(None, description="Name of the restored chart")
    message: str | None = Field(None, description="Human-readable outcome message")
    error: str | None = Field(None, description="Error message if the restore failed")
    error_type: str | None = Field(None, description="Type of error if failed")
    permission_denied: bool = Field(
        False,
        description=(
            "True when the caller lacks permission to restore the chart (do not "
            "retry; ask the user)."
        ),
    )


# Rebuild ChartInfo so Pydantic can resolve the ChartFiltersInfo forward reference.
ChartInfo.model_rebuild()


class DeleteChartRequest(BaseModel):
    """Request schema for delete_chart."""

    identifier: int | str = Field(
        ...,
        description=(
            "Chart identifier - numeric ID or UUID string (charts have no slug)."
        ),
    )

    @field_validator("identifier", mode="before")
    @classmethod
    def reject_bool_identifier(cls, value: object) -> object:
        """bool is a subclass of int, so identifier=true would coerce to
        chart ID 1 and delete the wrong object; reject it outright."""
        if isinstance(value, bool):
            raise ValueError("identifier must be an integer ID or UUID string")
        return value


class DeleteChartResponse(BaseModel):
    """Result of a delete_chart operation."""

    success: bool = Field(description="Whether the chart was deleted")
    deleted_id: int | None = Field(None, description="ID of the deleted chart")
    deleted_name: str | None = Field(None, description="Name of the deleted chart")
    soft_deleted: bool = Field(
        False,
        description=(
            "True when the chart was soft-deleted (moved to trash, because the "
            "SOFT_DELETE feature flag is enabled) and can be restored by an "
            "owner or Admin. False means the delete was permanent."
        ),
    )
    message: str | None = Field(None, description="Human-readable outcome message")
    error: str | None = Field(None, description="Error message if the delete failed")
    error_type: str | None = Field(None, description="Type of error if failed")
    permission_denied: bool = Field(
        False,
        description=(
            "True when the caller lacks permission to delete the chart (do not "
            "retry; ask the user)."
        ),
    )
