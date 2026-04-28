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
Pydantic schemas for dataset-related responses
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
from superset.mcp_service.chart.schemas import DataColumn, PerformanceMetadata
from superset.mcp_service.common.cache_schemas import (
    CacheStatus,
    CreatedByMeMixin,
    MetadataCacheControl,
    OwnedByMeMixin,
    QueryCacheControl,
)
from superset.mcp_service.constants import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from superset.mcp_service.privacy import filter_user_directory_fields
from superset.mcp_service.system.schemas import (
    PaginationInfo,
    TagInfo,
)
from superset.mcp_service.utils import (
    escape_llm_context_delimiters,
    sanitize_for_llm_context,
)
from superset.utils import json


class DatasetFilter(ColumnOperator):
    """
    Filter object for dataset listing.
    col: The column to filter on. Must be one of the allowed filter fields.
    opr: The operator to use. Must be one of the supported operators.
    value: The value to filter by (type depends on col and opr).
    """

    col: Literal[
        "table_name",
        "schema",
        "database_name",
    ] = Field(
        ...,
        description="Column to filter on. Use get_schema(model_type='dataset') for "
        "available filter columns.",
    )
    opr: ColumnOperatorEnum = Field(
        ...,
        description="Operator to use. Use get_schema(model_type='dataset') for "
        "available operators.",
    )
    value: str | int | float | bool | List[str | int | float | bool] = Field(
        ..., description="Value to filter by (type depends on col and opr)"
    )


class TableColumnInfo(BaseModel):
    column_name: str = Field(..., description="Column name")
    verbose_name: str | None = Field(None, description="Verbose name")
    type: str | None = Field(None, description="Column type")
    is_dttm: bool | None = Field(None, description="Is datetime column")
    groupby: bool | None = Field(None, description="Is groupable")
    filterable: bool | None = Field(None, description="Is filterable")
    description: str | None = Field(None, description="Column description")


class SqlMetricInfo(BaseModel):
    metric_name: str = Field(
        ...,
        description="Saved metric name. In chart configs, reference as "
        '{"name": "<metric_name>", "saved_metric": true}.',
    )
    verbose_name: str | None = Field(None, description="Verbose name")
    expression: str | None = Field(None, description="SQL expression")
    description: str | None = Field(None, description="Metric description")
    d3format: str | None = Field(None, description="D3 format string")


class DatasetInfo(BaseModel):
    id: int | None = Field(None, description="Dataset ID")
    table_name: str | None = Field(None, description="Table name")
    schema_name: str | None = Field(None, description="Schema name", alias="schema")
    database_name: str | None = Field(None, description="Database name")
    description: str | None = Field(None, description="Dataset description")
    certified_by: str | None = Field(
        None, description="Name of the person or team who certified this dataset"
    )
    certification_details: str | None = Field(
        None, description="Certification details or reason"
    )
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
    tags: List[TagInfo] = Field(default_factory=list, description="Dataset tags")
    is_virtual: bool | None = Field(
        None, description="Whether the dataset is virtual (uses SQL)"
    )
    database_id: int | None = Field(None, description="Database ID")
    uuid: str | None = Field(None, description="Dataset UUID")
    schema_perm: str | None = Field(None, description="Schema permission string")
    url: str | None = Field(None, description="Dataset URL")
    sql: str | None = Field(None, description="SQL for virtual datasets")
    main_dttm_col: str | None = Field(None, description="Main datetime column")
    offset: int | None = Field(None, description="Offset")
    cache_timeout: int | None = Field(None, description="Cache timeout")
    params: Dict[str, Any | None] | None = Field(None, description="Extra params")
    template_params: Dict[str, Any | None] | None = Field(
        None, description="Template params"
    )
    extra: Dict[str, Any | None] | None = Field(None, description="Extra metadata")
    columns: List[TableColumnInfo] = Field(
        default_factory=list, description="Columns in the dataset"
    )
    metrics: List[SqlMetricInfo] = Field(
        default_factory=list,
        description="Saved metrics (pre-defined aggregations). "
        "NOT columns — use saved_metric=true in chart configs.",
    )
    is_favorite: bool | None = Field(
        None, description="Whether this dataset is favorited by the current user"
    )
    model_config = ConfigDict(
        from_attributes=True,
        ser_json_timedelta="iso8601",
        populate_by_name=True,  # Allow both 'schema' (alias) and 'schema_name' (field)
    )

    @model_serializer(mode="wrap")
    def _filter_fields_by_context(self, serializer: Any, info: Any) -> Dict[str, Any]:
        """Filter fields based on serialization context.

        If context contains 'select_columns', only include those fields.
        Otherwise, include all fields (default behavior).
        """
        # Get full serialization
        data = filter_user_directory_fields(serializer(self))

        # Normalize alias: Pydantic serializes as 'schema_name' (field name)
        # but the DAO column and API convention is 'schema'
        if "schema_name" in data:
            data["schema"] = data.pop("schema_name")

        # Check if we have a context with select_columns
        if info.context and isinstance(info.context, dict):
            select_columns = info.context.get("select_columns")
            if select_columns:
                requested_fields = set(select_columns)

                # Filter to only requested fields
                return {k: v for k, v in data.items() if k in requested_fields}

        # No filtering - return all fields
        return data


class DatasetList(BaseModel):
    datasets: List[DatasetInfo]
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
        description="Columns that were actually loaded for each dataset",
    )
    columns_available: List[str] = Field(
        default_factory=list,
        description="All columns available for selection via select_columns parameter",
    )
    sortable_columns: List[str] = Field(
        default_factory=list,
        description="Columns that can be used with order_column parameter",
    )
    filters_applied: List[DatasetFilter] = Field(
        default_factory=list,
        description="List of advanced filter dicts applied to the query.",
    )
    pagination: PaginationInfo | None = None
    timestamp: datetime | None = None
    model_config = ConfigDict(ser_json_timedelta="iso8601")


class ListDatasetsRequest(OwnedByMeMixin, CreatedByMeMixin, MetadataCacheControl):
    """Request schema for list_datasets with clear, unambiguous types."""

    filters: Annotated[
        List[DatasetFilter],
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
            description="Text search string to match against dataset fields. Cannot "
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

    @model_validator(mode="after")
    def validate_search_and_filters(self) -> "ListDatasetsRequest":
        """Prevent using both search and filters simultaneously."""
        if self.search and self.filters:
            raise ValueError(
                "Cannot use both 'search' and 'filters' parameters simultaneously. "
                "Use either 'search' for text-based searching across multiple fields, "
                "or 'filters' for precise column-based filtering, but not both."
            )
        return self


class DatasetError(BaseModel):
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
    def create(cls, error: str, error_type: str) -> "DatasetError":
        """Create a standardized DatasetError with timestamp."""
        from datetime import datetime, timezone

        return cls(
            error=error,
            error_type=error_type,
            timestamp=datetime.now(timezone.utc),
        )


class GetDatasetInfoRequest(MetadataCacheControl):
    """Request schema for get_dataset_info with support for ID or UUID."""

    identifier: Annotated[
        int | str,
        Field(description="Dataset identifier - can be numeric ID or UUID string"),
    ]


class CreateVirtualDatasetRequest(BaseModel):
    """Request schema for create_virtual_dataset."""

    model_config = ConfigDict(populate_by_name=True)

    database_id: int = Field(
        ...,
        description="ID of the database connection to use. "
        "Use list_databases to find valid IDs.",
    )
    sql: str = Field(
        ...,
        description="SQL query to save as a virtual dataset. "
        "Can be a JOIN, CTE, aggregation, or any valid SELECT.",
    )
    dataset_name: str = Field(
        ...,
        min_length=1,
        max_length=250,
        description="Name for the new virtual dataset.",
    )
    schema_name: str | None = Field(
        None,
        alias="schema",
        description="Schema to associate with the dataset (optional).",
    )
    catalog: str | None = Field(
        None,
        description="Catalog to associate with the dataset (optional).",
    )
    description: str | None = Field(
        None,
        description="Human-readable description of the dataset (optional).",
    )

    @field_validator("sql")
    @classmethod
    def sql_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("sql must not be empty")
        return v.strip()

    @field_validator("dataset_name")
    @classmethod
    def dataset_name_must_not_be_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("dataset_name must not be empty")
        return v.strip()


class CreateVirtualDatasetResponse(BaseModel):
    """Response schema for create_virtual_dataset."""

    id: int | None = Field(
        None,
        description="Dataset ID. Pass this as dataset_id to generate_chart "
        "or generate_explore_link. None if creation failed.",
    )
    dataset_name: str = Field(..., description="Name of the created dataset.")
    sql: str = Field(..., description="SQL query stored in the dataset.")
    database_id: int = Field(..., description="Database ID used.")
    columns: List[str] = Field(
        default_factory=list,
        description="Column names available for charting. "
        "Use these when building chart configs.",
    )
    url: str | None = Field(
        None,
        description="URL to view/edit the dataset in Superset. None if failed.",
    )
    error: str | None = Field(
        None,
        description="Error message if creation failed, otherwise null.",
    )


class QueryDatasetFilter(BaseModel):
    """A single filter condition for dataset queries."""

    col: str = Field(..., description="Column name to filter on")
    op: str = Field(
        ...,
        description=(
            "Filter operator. Supported: =, !=, >, <, >=, <=, "
            "IN, NOT_IN, LIKE, IS_NULL, IS_NOT_NULL, TEMPORAL_RANGE"
        ),
    )
    val: Any = Field(
        default=None,
        description="Filter value (omit for IS_NULL/IS_NOT_NULL)",
    )


class QueryDatasetRequest(QueryCacheControl):
    """Request schema for query_dataset tool."""

    dataset_id: int | str = Field(
        ...,
        description="Dataset identifier — numeric ID or UUID string.",
    )
    metrics: List[str] = Field(
        default_factory=list,
        description=(
            "Saved metric names to compute (e.g. ['count', 'avg_revenue']). "
            "Use get_dataset_info to discover available metrics."
        ),
    )
    columns: List[str] = Field(
        default_factory=list,
        description=(
            "Column/dimension names for GROUP BY or SELECT "
            "(e.g. ['category', 'region']). "
            "Use get_dataset_info to discover available columns."
        ),
    )
    filters: List[QueryDatasetFilter] = Field(
        default_factory=list,
        description=(
            'Filter conditions (e.g. [{"col": "status", "op": "=", "val": "active"}]).'
        ),
    )
    time_range: str | None = Field(
        default=None,
        description=(
            "Time range filter (e.g. 'Last 7 days', 'Last month', "
            "'2024-01-01 : 2024-12-31'). Requires a temporal column "
            "on the dataset."
        ),
    )
    time_column: str | None = Field(
        default=None,
        description=(
            "Temporal column to apply time_range to. "
            "Defaults to the dataset's main datetime column."
        ),
    )
    order_by: List[str] | None = Field(
        default=None,
        description="Column or metric names to sort results by.",
    )
    order_desc: bool = Field(
        default=True,
        description="Sort descending (True) or ascending (False).",
    )
    row_limit: int = Field(
        default=1000,
        ge=1,
        le=50000,
        description="Maximum number of rows to return (default 1000, max 50000).",
    )

    @model_validator(mode="after")
    def validate_metrics_or_columns(self) -> "QueryDatasetRequest":
        """At least one of metrics or columns must be provided."""
        if not self.metrics and not self.columns:
            raise ValueError(
                "At least one of 'metrics' or 'columns' must be provided. "
                "Use get_dataset_info to discover available metrics and columns."
            )
        return self


class QueryDatasetResponse(BaseModel):
    """Response schema for query_dataset tool."""

    model_config = ConfigDict(ser_json_timedelta="iso8601")

    dataset_id: int = Field(..., description="Dataset ID")
    dataset_name: str = Field(..., description="Dataset name")
    columns: List[DataColumn] = Field(
        default_factory=list, description="Column metadata for returned data"
    )
    data: List[Dict[str, Any]] = Field(
        default_factory=list, description="Query result rows"
    )
    row_count: int = Field(0, description="Number of rows returned")
    total_rows: int | None = Field(
        None, description="Total row count from the query engine"
    )
    summary: str = Field("", description="Human-readable summary of the results")
    performance: PerformanceMetadata | None = Field(
        None, description="Query performance metadata"
    )
    cache_status: CacheStatus | None = Field(
        None, description="Cache hit/miss information"
    )
    applied_filters: List[QueryDatasetFilter] = Field(
        default_factory=list, description="Filters that were applied to the query"
    )
    warnings: List[str] = Field(
        default_factory=list, description="Any warnings encountered during execution"
    )


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
    return humanize.naturaltime(datetime.now() - dt)


def _sanitize_dataset_info_for_llm_context(dataset_info: DatasetInfo) -> DatasetInfo:
    """Wrap dataset read-path descriptive fields before LLM exposure."""
    payload = dataset_info.model_dump(mode="python")

    for field_name in ("description", "certified_by", "certification_details", "sql"):
        payload[field_name] = sanitize_for_llm_context(
            payload.get(field_name),
            field_path=(field_name,),
        )

    for field_name in ("table_name", "schema_name", "database_name", "schema_perm"):
        payload[field_name] = escape_llm_context_delimiters(payload.get(field_name))

    payload["extra"] = sanitize_for_llm_context(
        payload.get("extra"),
        field_path=("extra",),
        excluded_field_names=frozenset(),
    )

    for field_name in ("params", "template_params"):
        payload[field_name] = sanitize_for_llm_context(
            payload.get(field_name),
            field_path=(field_name,),
            excluded_field_names=frozenset(),
        )

    payload["columns"] = [
        {
            **column,
            "column_name": escape_llm_context_delimiters(
                column.get("column_name"),
            ),
            "description": sanitize_for_llm_context(
                column.get("description"),
                field_path=("columns", str(index), "description"),
            ),
            "verbose_name": sanitize_for_llm_context(
                column.get("verbose_name"),
                field_path=("columns", str(index), "verbose_name"),
            ),
        }
        for index, column in enumerate(payload.get("columns", []))
    ]

    payload["metrics"] = [
        {
            **metric,
            "metric_name": escape_llm_context_delimiters(
                metric.get("metric_name"),
            ),
            "expression": sanitize_for_llm_context(
                metric.get("expression"),
                field_path=("metrics", str(index), "expression"),
            ),
            "description": sanitize_for_llm_context(
                metric.get("description"),
                field_path=("metrics", str(index), "description"),
            ),
            "verbose_name": sanitize_for_llm_context(
                metric.get("verbose_name"),
                field_path=("metrics", str(index), "verbose_name"),
            ),
        }
        for index, metric in enumerate(payload.get("metrics", []))
    ]

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

    return DatasetInfo.model_validate(payload)


def serialize_dataset_object(dataset: Any) -> DatasetInfo | None:
    if not dataset:
        return None

    from superset.mcp_service.utils.url_utils import get_superset_base_url

    params = getattr(dataset, "params", None)
    if isinstance(params, str):
        try:
            params = json.loads(params)
        except Exception:
            params = None
    columns = [
        TableColumnInfo(
            column_name=getattr(col, "column_name", None),
            verbose_name=getattr(col, "verbose_name", None),
            type=getattr(col, "type", None),
            is_dttm=getattr(col, "is_dttm", None),
            groupby=getattr(col, "groupby", None),
            filterable=getattr(col, "filterable", None),
            description=getattr(col, "description", None),
        )
        for col in getattr(dataset, "columns", [])
    ]
    metrics = [
        SqlMetricInfo(
            metric_name=getattr(metric, "metric_name", None),
            verbose_name=getattr(metric, "verbose_name", None),
            expression=getattr(metric, "expression", None),
            description=getattr(metric, "description", None),
            d3format=getattr(metric, "d3format", None),
        )
        for metric in getattr(dataset, "metrics", [])
    ]
    return _sanitize_dataset_info_for_llm_context(
        DatasetInfo(
            id=getattr(dataset, "id", None),
            table_name=getattr(dataset, "table_name", None),
            schema_name=getattr(dataset, "schema", None),
            database_name=getattr(dataset.database, "database_name", None)
            if getattr(dataset, "database", None)
            else None,
            description=getattr(dataset, "description", None),
            certified_by=getattr(dataset, "certified_by", None),
            certification_details=getattr(dataset, "certification_details", None),
            changed_on=getattr(dataset, "changed_on", None),
            changed_on_humanized=_humanize_timestamp(
                getattr(dataset, "changed_on", None)
            ),
            created_on=getattr(dataset, "created_on", None),
            created_on_humanized=_humanize_timestamp(
                getattr(dataset, "created_on", None)
            ),
            tags=[
                TagInfo.model_validate(tag, from_attributes=True)
                for tag in getattr(dataset, "tags", [])
            ]
            if getattr(dataset, "tags", None)
            else [],
            is_virtual=getattr(dataset, "is_virtual", None),
            database_id=getattr(dataset, "database_id", None),
            uuid=str(getattr(dataset, "uuid", ""))
            if getattr(dataset, "uuid", None)
            else None,
            schema_perm=getattr(dataset, "schema_perm", None),
            url=(
                f"{get_superset_base_url()}/tablemodelview/edit/"
                f"{getattr(dataset, 'id', None)}"
                if getattr(dataset, "id", None)
                else None
            ),
            sql=getattr(dataset, "sql", None),
            main_dttm_col=getattr(dataset, "main_dttm_col", None),
            offset=getattr(dataset, "offset", None),
            cache_timeout=getattr(dataset, "cache_timeout", None),
            params=params,
            template_params=_parse_json_field(dataset, "template_params"),
            extra=_parse_json_field(dataset, "extra"),
            columns=columns,
            metrics=metrics,
            is_favorite=getattr(dataset, "is_favorite", None),
        )
    )
