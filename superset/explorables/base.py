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
Base protocol for explorable data sources in Superset.

An "explorable" is any data source that can be explored to create charts,
including SQL datasets, saved queries, and semantic layer views.
"""

from __future__ import annotations

from collections.abc import Hashable
from datetime import datetime
from typing import Any, Protocol, runtime_checkable, TYPE_CHECKING, TypedDict

if TYPE_CHECKING:
    from superset.common.query_object import QueryObject
    from superset.models.helpers import QueryResult
    from superset.superset_typing import ExplorableData, QueryObjectDict


class TimeGrainDict(TypedDict):
    """
    TypedDict for time grain options returned by get_time_grains.

    Represents a time granularity option that can be used for grouping
    temporal data. Each time grain specifies how to bucket timestamps.

    Attributes:
        name: Display name for the time grain (e.g., "Hour", "Day", "Week")
        function: Implementation-specific expression for applying the grain.
            For SQL datasources, this is typically a SQL expression template
            like "DATE_TRUNC('hour', {col})".
        duration: ISO 8601 duration string (e.g., "PT1H", "P1D", "P1W")
    """

    name: str
    function: str
    duration: str | None


@runtime_checkable
class Explorable(Protocol):
    """
    Protocol for objects that can be explored to create charts.

    This protocol defines the minimal interface required for a data source
    to be visualizable in Superset. It is implemented by:
    - BaseDatasource (SQL datasets and queries)
    - SemanticView (semantic layer views)
    - Future: Other data source types

    The protocol focuses on the essential methods and properties needed
    for query execution, caching, and security.
    """

    # =========================================================================
    # Core Query Interface
    # =========================================================================

    def get_query_result(self, query_object: QueryObject) -> QueryResult:
        """
        Execute a query and return results.

        This is the primary method for data retrieval. It takes a query
        object describing what data to fetch (columns, metrics, filters, time range,
        etc.) and returns a QueryResult containing a pandas DataFrame with the results.

        :param query_obj: QueryObject describing the query

        :return: QueryResult containing:
            - df: pandas DataFrame with query results
            - query: string representation of the executed query
            - duration: query execution time
            - status: QueryStatus (SUCCESS/FAILED)
            - error_message: error details if query failed
        """

    def get_query_str(self, query_obj: QueryObjectDict) -> str:
        """
        Get the query string without executing.

        Returns a string representation of the query that would be executed
        for the given query object. This is used for display in the UI
        and debugging.

        :param query_obj: Dictionary describing the query
        :return: String representation of the query (SQL, GraphQL, etc.)
        """

    # =========================================================================
    # Identity & Metadata
    # =========================================================================

    @property
    def uid(self) -> str:
        """
        Unique identifier for this explorable.

        Used as part of cache keys and for tracking. Should be stable
        across application restarts but change when the explorable's
        data or structure changes.

        Format convention: "{type}_{id}" (e.g., "table_123", "semantic_view_abc")

        :return: Unique identifier string
        """

    @property
    def type(self) -> str:
        """
        Type discriminator for this explorable.

        Identifies the kind of data source (e.g., 'table', 'query', 'semantic_view').
        Used for routing and type-specific behavior.

        :return: Type identifier string
        """

    @property
    def metrics(self) -> list[Any]:
        """
        List of metric metadata objects.

        Each object should provide at minimum:
        - metric_name: str - the metric's name
        - expression: str - the metric's calculation expression

        Used for validation, autocomplete, and query building.

        :return: List of metric metadata objects
        """

    # TODO: rename to dimensions
    @property
    def columns(self) -> list[Any]:
        """
        List of column metadata objects.

        Each object should provide at minimum:
        - column_name: str - the column's name
        - type: str - the column's data type
        - is_dttm: bool - whether it's a datetime column

        Used for validation, autocomplete, and query building.

        :return: List of column metadata objects
        """

    # TODO: remove and use columns instead
    @property
    def column_names(self) -> list[str]:
        """
        List of available column names.

        A simple list of all column names in the explorable.
        Used for quick validation and filtering.

        :return: List of column name strings
        """

    @property
    def data(self) -> ExplorableData:
        """
        Full metadata representation sent to the frontend.

        This property returns a dictionary containing all the metadata
        needed by the Explore UI, including columns, metrics, and
        other configuration.

        Required keys in the returned dictionary:
        - id: unique identifier (int or str)
        - uid: unique string identifier
        - name: display name
        - type: explorable type ('table', 'query', 'semantic_view', etc.)
        - columns: list of column metadata dicts (with column_name, type, etc.)
        - metrics: list of metric metadata dicts (with metric_name, expression, etc.)
        - database: database metadata dict (with id, backend, etc.)

        Optional keys:
        - description: human-readable description
        - schema: schema name (if applicable)
        - catalog: catalog name (if applicable)
        - cache_timeout: default cache timeout
        - offset: timezone offset
        - owners: list of owner IDs
        - verbose_map: dict mapping column/metric names to display names

        :return: Dictionary with complete explorable metadata
        """

    # =========================================================================
    # Caching
    # =========================================================================

    @property
    def cache_timeout(self) -> int | None:
        """
        Default cache timeout in seconds.

        Determines how long query results should be cached.
        Returns None to use the system default cache timeout.

        :return: Cache timeout in seconds, or None for system default
        """

    @property
    def changed_on(self) -> datetime | None:
        """
        Last modification timestamp.

        Used for cache invalidation - when this changes, cached
        results for this explorable become invalid.

        :return: Datetime of last modification, or None
        """

    def get_extra_cache_keys(self, query_obj: QueryObjectDict) -> list[Hashable]:
        """
        Additional cache key components specific to this explorable.

        Provides explorable-specific values to include in cache keys.
        Used to ensure cache invalidation when the explorable's
        underlying data or configuration changes in ways not captured
        by uid or changed_on.

        :param query_obj: The query being executed
        :return: List of additional hashable values for cache key
        """

    # =========================================================================
    # Security
    # =========================================================================

    @property
    def perm(self) -> str:
        """
        Permission string for this explorable.

        Used by the security manager to check if a user has access
        to this data source. Format depends on the explorable type
        (e.g., "[database].[schema].[table]" for SQL tables).

        :return: Permission identifier string
        """

    # =========================================================================
    # Time/Date Handling
    # =========================================================================

    @property
    def offset(self) -> int:
        """
        Timezone offset for datetime columns.

        Used to normalize datetime values to the user's timezone.
        Returns 0 for UTC, or an offset in seconds.

        :return: Timezone offset in seconds (0 for UTC)
        """

    # =========================================================================
    # Time Granularity
    # =========================================================================

    def get_time_grains(self) -> list[TimeGrainDict]:
        """
        Get available time granularities for temporal grouping.

        Returns a list of time grain options that can be used for grouping
        temporal data. Each time grain specifies how to bucket timestamps
        (e.g., by hour, day, week, month).

        Each dictionary in the returned list should contain:
        - name: str - Display name (e.g., "Hour", "Day", "Week")
        - function: str - How to apply the grain (implementation-specific)
        - duration: str - ISO 8601 duration string (e.g., "PT1H", "P1D", "P1W")

        For SQL datasources, the function is typically a SQL expression template
        like "DATE_TRUNC('hour', {col})". For semantic layers, it might be a
        semantic layer-specific identifier like "hour" or "day".

        Return an empty list if time grains are not supported or applicable.

        Example return value:
        ```python
        [
            {
                "name": "Second",
                "function": "DATE_TRUNC('second', {col})",
                "duration": "PT1S",
            },
            {
                "name": "Minute",
                "function": "DATE_TRUNC('minute', {col})",
                "duration": "PT1M",
            },
            {
                "name": "Hour",
                "function": "DATE_TRUNC('hour', {col})",
                "duration": "PT1H",
            },
            {
                "name": "Day",
                "function": "DATE_TRUNC('day', {col})",
                "duration": "P1D",
            },
        ]
        ```

        :return: List of time grain dictionaries (empty list if not supported)
        """

    # =========================================================================
    # Drilling
    # =========================================================================

    def has_drill_by_columns(self, column_names: list[str]) -> bool:
        """
        Check if the specified columns support drill-by operations.

        Drill-by allows users to navigate from aggregated views to detailed
        data by grouping on specific dimensions. This method determines whether
        the given columns can be used for drill-by in the current datasource.

        For SQL datasources, this typically checks if columns are marked as
        groupable in the metadata. For semantic views, it checks against the
        semantic layer's dimension definitions.

        :param column_names: List of column names to check
        :return: True if all columns support drill-by, False otherwise
        """

    # =========================================================================
    # Optional Properties
    # =========================================================================

    @property
    def is_rls_supported(self) -> bool:
        """
        Whether this explorable supports Row Level Security.

        Row Level Security (RLS) allows filtering data based on user identity.
        SQL-based datasources typically support this via SQL queries, while
        semantic layers may handle security at the semantic layer level.

        :return: True if RLS is supported, False otherwise
        """

    @property
    def query_language(self) -> str | None:
        """
        Query language identifier for syntax highlighting.

        Specifies the language used in queries for proper syntax highlighting
        in the UI (e.g., 'sql', 'graphql', 'jsoniq').

        :return: Language identifier string, or None if not applicable
        """
