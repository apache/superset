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
from typing import Any, Protocol, runtime_checkable

from superset.models.helpers import QueryResult
from superset.superset_typing import QueryObjectDict


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

    def query(self, query_obj: QueryObjectDict) -> QueryResult:
        """
        Execute a query and return results.

        This is the primary method for data retrieval. It takes a query
        object dictionary describing what data to fetch (columns, metrics,
        filters, time range, etc.) and returns a QueryResult containing
        a pandas DataFrame with the results.

        :param query_obj: Dictionary describing the query with keys like:
            - columns: list of column names to select
            - metrics: list of metrics to compute
            - filter: list of filter clauses
            - from_dttm/to_dttm: time range
            - granularity: time column for grouping
            - groupby: columns to group by
            - orderby: ordering specification
            - row_limit/row_offset: pagination
            - extras: additional parameters

        :return: QueryResult containing:
            - df: pandas DataFrame with query results
            - query: string representation of the executed query
            - duration: query execution time
            - status: QueryStatus (SUCCESS/FAILED)
            - error_message: error details if query failed
        """
        ...

    def get_query_str(self, query_obj: QueryObjectDict) -> str:
        """
        Get the query string without executing.

        Returns a string representation of the query that would be executed
        for the given query object. This is used for display in the UI
        and debugging.

        :param query_obj: Dictionary describing the query
        :return: String representation of the query (SQL, GraphQL, etc.)
        """
        ...

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
        ...

    @property
    def type(self) -> str:
        """
        Type discriminator for this explorable.

        Identifies the kind of data source (e.g., 'table', 'query', 'semantic_view').
        Used for routing and type-specific behavior.

        :return: Type identifier string
        """
        ...

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
        ...

    @property
    def column_names(self) -> list[str]:
        """
        List of available column names.

        A simple list of all column names in the explorable.
        Used for quick validation and filtering.

        :return: List of column name strings
        """
        ...

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
        ...

    @property
    def changed_on(self) -> datetime | None:
        """
        Last modification timestamp.

        Used for cache invalidation - when this changes, cached
        results for this explorable become invalid.

        :return: Datetime of last modification, or None
        """
        ...

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
        ...

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
        ...

    @property
    def schema_perm(self) -> str | None:
        """
        Schema-level permission string.

        Optional permission string for schema-level access control.
        Some explorables don't have a schema concept and can return None.

        :return: Schema permission string, or None
        """
        ...

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
        ...
