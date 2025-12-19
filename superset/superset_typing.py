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
from __future__ import annotations

from collections.abc import Hashable, Sequence
from datetime import datetime
from typing import Any, Literal, TYPE_CHECKING, TypeAlias, TypedDict

from sqlalchemy.sql.type_api import TypeEngine
from typing_extensions import NotRequired
from werkzeug.wrappers import Response

if TYPE_CHECKING:
    from superset.utils.core import GenericDataType, QueryObjectFilterClause

SQLType: TypeAlias = TypeEngine | type[TypeEngine]


class LegacyMetric(TypedDict):
    label: str | None


class AdhocMetricColumn(TypedDict, total=False):
    column_name: str | None
    description: str | None
    expression: str | None
    filterable: bool
    groupby: bool
    id: int
    is_dttm: bool
    python_date_format: str | None
    type: str
    type_generic: "GenericDataType"
    verbose_name: str | None


class AdhocMetric(TypedDict, total=False):
    aggregate: str
    column: AdhocMetricColumn | None
    expressionType: Literal["SIMPLE", "SQL"]
    hasCustomLabel: bool | None
    label: str | None
    sqlExpression: str | None


class AdhocColumn(TypedDict, total=False):
    hasCustomLabel: bool | None
    label: str
    sqlExpression: str
    isColumnReference: bool | None
    columnType: Literal["BASE_AXIS", "SERIES"] | None
    timeGrain: str | None


class SQLAColumnType(TypedDict):
    name: str
    type: str | None
    is_dttm: bool


class ResultSetColumnType(TypedDict):
    """
    Superset virtual dataset column interface
    """

    name: str  # legacy naming convention keeping this for backwards compatibility
    column_name: str
    type: SQLType | str | None
    is_dttm: bool | None
    type_generic: NotRequired["GenericDataType" | None]

    nullable: NotRequired[Any]
    default: NotRequired[Any]
    comment: NotRequired[Any]
    precision: NotRequired[Any]
    scale: NotRequired[Any]
    max_length: NotRequired[Any]

    query_as: NotRequired[Any]


CacheConfig: TypeAlias = dict[str, Any]
DbapiDescriptionRow: TypeAlias = tuple[
    str | bytes,
    str,
    str | None,
    str | None,
    int | None,
    int | None,
    bool,
]
DbapiDescription: TypeAlias = (
    list[DbapiDescriptionRow] | tuple[DbapiDescriptionRow, ...]
)
DbapiResult: TypeAlias = Sequence[list[Any] | tuple[Any, ...]]
FilterValue: TypeAlias = bool | datetime | float | int | str
FilterValues: TypeAlias = FilterValue | list[FilterValue] | tuple[FilterValue]
FormData: TypeAlias = dict[str, Any]
Granularity: TypeAlias = str | dict[str, str | float]
Column: TypeAlias = AdhocColumn | str
Metric: TypeAlias = AdhocMetric | str
OrderBy: TypeAlias = tuple[Metric | Column, bool]


class QueryObjectDict(TypedDict, total=False):
    """
    TypedDict representation of query objects used throughout Superset.

    This represents the dictionary output from QueryObject.to_dict() and is used
    in datasource query methods throughout Superset.

    Core fields from QueryObject.to_dict():
        apply_fetch_values_predicate: Whether to apply fetch values predicate
        columns: List of columns to include
        extras: Additional options and parameters
        filter: List of filter clauses
        from_dttm: Start datetime for time range
        granularity: Time grain/granularity
        inner_from_dttm: Inner start datetime for nested queries
        inner_to_dttm: Inner end datetime for nested queries
        is_rowcount: Whether this is a row count query
        is_timeseries: Whether this is a timeseries query
        metrics: List of metrics to compute
        order_desc: Whether to order descending
        orderby: List of order by clauses
        row_limit: Maximum number of rows
        row_offset: Number of rows to skip
        series_columns: Columns to use for series
        series_limit: Maximum number of series
        series_limit_metric: Metric to use for series limiting
        group_others_when_limit_reached: Whether to group remaining items as "Others"
        to_dttm: End datetime for time range
        time_shift: Time shift specification

    Additional fields used throughout the codebase:
        time_range: Human-readable time range string
        datasource: BaseDatasource instance
        extra_cache_keys: Additional keys for caching
        rls: Row level security filters
        changed_on: Last modified timestamp

    Deprecated fields (still in use):
        groupby: Columns to group by (use columns instead)
        timeseries_limit: Series limit (use series_limit instead)
        timeseries_limit_metric: Series limit metric (use series_limit_metric instead)
    """

    # Core fields from QueryObject.to_dict()
    apply_fetch_values_predicate: bool
    columns: list[Column]
    extras: dict[str, Any]
    filter: list["QueryObjectFilterClause"]
    from_dttm: datetime | None
    granularity: str | None
    inner_from_dttm: datetime | None
    inner_to_dttm: datetime | None
    is_rowcount: bool
    is_timeseries: bool
    metrics: list[Metric] | None
    order_desc: bool
    orderby: list[OrderBy]
    row_limit: int | None
    row_offset: int
    series_columns: list[Column]
    series_limit: int
    series_limit_metric: Metric | None
    group_others_when_limit_reached: bool
    to_dttm: datetime | None
    time_shift: str | None
    post_processing: list[dict[str, Any]]

    # Additional fields used throughout the codebase
    time_range: str | None
    datasource: Any  # BaseDatasource instance
    extra_cache_keys: list[Hashable]
    rls: list[Any]
    changed_on: datetime | None

    # Deprecated fields (still in use)
    groupby: list[Column]
    timeseries_limit: int
    timeseries_limit_metric: Metric | None


class ExplorableData(TypedDict, total=False):
    """
    TypedDict for explorable data returned to the frontend.

    This represents the structure of the dictionary returned from the `data` property
    of any Explorable (BaseDatasource, Query, etc.). It provides datasource/query
    information to the frontend for visualization and querying.

    All fields are optional (total=False) since different explorable types provide
    different subsets of these fields. Query objects provide a minimal subset while
    SqlaTable provides the full set.

    Core fields:
        id: Unique identifier for the datasource
        uid: Unique identifier including type (e.g., "1__table")
        column_formats: D3 format strings for columns
        description: Human-readable description
        database: Database connection information
        default_endpoint: Default URL endpoint for this datasource
        filter_select: Whether filter select is enabled (deprecated)
        filter_select_enabled: Whether filter select is enabled
        name: Display name of the datasource
        datasource_name: Name of the underlying table/query
        table_name: Table name (same as datasource_name)
        type: Datasource type (e.g., "table", "query")
        catalog: Catalog name if applicable
        schema: Schema name if applicable
        offset: Default row offset
        cache_timeout: Cache timeout in seconds
        params: Additional parameters as JSON string
        perm: Permission string
        edit_url: URL to edit this datasource
        sql: SQL query for virtual datasets
        columns: List of column definitions
        metrics: List of metric definitions
        folders: Folder structure (JSON field)
        order_by_choices: Available ordering options
        owners: List of owner IDs or owner details
        verbose_map: Mapping of column/metric names to verbose names
        select_star: SELECT * query for this datasource

    Additional fields from SqlaTable and data_for_slices:
        column_types: List of column data types
        column_names: Set of column names
        granularity_sqla: Available time granularities
        time_grain_sqla: Available time grains
        main_dttm_col: Main datetime column
        fetch_values_predicate: Predicate for fetching filter values
        template_params: Template parameters for Jinja
        is_sqllab_view: Whether this is a SQL Lab view
        health_check_message: Health check status message
        extra: Extra configuration as JSON string
        always_filter_main_dttm: Whether to always filter on main datetime
        normalize_columns: Whether to normalize column names
    """

    # Core fields from BaseDatasource.data
    id: int
    uid: str
    column_formats: dict[str, str | None]
    description: str | None
    database: dict[str, Any]
    default_endpoint: str | None
    filter_select: bool
    filter_select_enabled: bool
    name: str
    datasource_name: str
    table_name: str
    type: str
    catalog: str | None
    schema: str | None
    offset: int
    cache_timeout: int | None
    params: str | None
    perm: str | None
    edit_url: str
    sql: str | None
    columns: list[dict[str, Any]]
    metrics: list[dict[str, Any]]
    folders: Any  # JSON field, can be list or dict
    order_by_choices: list[tuple[str, str]]
    owners: list[int] | list[dict[str, Any]]  # Can be either format
    verbose_map: dict[str, str]
    select_star: str | None

    # Additional fields from SqlaTable and data_for_slices
    column_types: list[Any]
    column_names: set[str] | set[Any]
    granularity_sqla: list[tuple[Any, Any]]
    time_grain_sqla: list[tuple[Any, Any]]
    main_dttm_col: str | None
    fetch_values_predicate: str | None
    template_params: str | None
    is_sqllab_view: bool
    health_check_message: str | None
    extra: str | None
    always_filter_main_dttm: bool
    normalize_columns: bool


VizData: TypeAlias = list[Any] | dict[Any, Any] | None
VizPayload: TypeAlias = dict[str, Any]

# Flask response.
Base: TypeAlias = bytes | str
Status: TypeAlias = int | str
Headers: TypeAlias = dict[str, Any]
FlaskResponse: TypeAlias = (
    Response
    | Base
    | tuple[Base, Status]
    | tuple[Base, Status, Headers]
    | tuple[Response, Status]
)


class OAuth2ClientConfig(TypedDict):
    """
    Configuration for an OAuth2 client.
    """

    # The client ID and secret.
    id: str
    secret: str

    # The scopes requested; this is usually a space separated list of URLs.
    scope: str

    # The URI where the user is redirected to after authorizing the client; by default
    # this points to `/api/v1/databases/oauth2/`, but it can be overridden by the admin.
    redirect_uri: str

    # The URI used to getting a code.
    authorization_request_uri: str

    # The URI used when exchaing the code for an access token, or when refreshing an
    # expired access token.
    token_request_uri: str

    # Not all identity providers expect json. Keycloak expects a form encoded request,
    # which in the `requests` package context means using the `data` param, not `json`.
    request_content_type: str


class OAuth2TokenResponse(TypedDict, total=False):
    """
    Type for an OAuth2 response when exchanging or refreshing tokens.
    """

    access_token: str
    expires_in: int
    scope: str
    token_type: str

    # only present when exchanging code for refresh/access tokens
    refresh_token: str


class OAuth2State(TypedDict):
    """
    Type for the state passed during OAuth2.
    """

    database_id: int
    user_id: int
    default_redirect_uri: str
    tab_id: str
