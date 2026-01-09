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
Query execution types for superset-core.

Provides type definitions for query execution that are partially aligned
with frontend types in superset-ui-core/src/query/types/.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd


class QueryStatus(Enum):
    """
    Status of query execution.
    """

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    TIMED_OUT = "timed_out"
    STOPPED = "stopped"


@dataclass
class CacheOptions:
    """
    Options for query result caching.
    """

    timeout: int | None = None  # Override default cache timeout (seconds)
    force_refresh: bool = False  # Bypass cache and re-execute query


@dataclass
class QueryOptions:
    """
    Options for query execution via Database.execute() and execute_async().

    Supports customization of:
    - Basic: catalog, schema, limit, timeout
    - Templates: Jinja2 template parameters
    - Caching: Cache timeout and refresh control
    - Dry run: Return transformed SQL without execution
    """

    # Basic options
    catalog: str | None = None
    schema: str | None = None
    limit: int | None = None
    timeout_seconds: int | None = None

    # Template options
    template_params: dict[str, Any] | None = None  # For Jinja2 rendering

    # Caching options
    cache: CacheOptions | None = None

    # Dry run option
    dry_run: bool = False  # Return transformed SQL without executing


@dataclass
class StatementResult:
    """
    Result of a single SQL statement execution.

    For SELECT queries: data contains DataFrame, row_count is len(data)
    For DML queries: data is None, row_count contains affected rows
    """

    original_sql: str  # The SQL statement as submitted by the user
    executed_sql: (
        str  # The SQL statement after transformations (RLS, mutations, limits)
    )
    data: pd.DataFrame | None = None
    row_count: int = 0
    execution_time_ms: float | None = None


@dataclass
class QueryResult:
    """
    Result of a multi-statement query execution.

    On success: statements contains all executed statements
    On failure: statements contains successful statements before failure

    Fields:
        status: Overall query status (SUCCESS or FAILED)
        statements: Results from each executed statement
        query_id: Query model ID for entire execution (None if dry_run=True)
        total_execution_time_ms: Total execution time across all statements
        is_cached: Whether result came from cache
        error_message: Query-level error (e.g., "Statement 2 of 3: error")
    """

    status: QueryStatus
    statements: list[StatementResult] = field(default_factory=list)
    query_id: int | None = None
    total_execution_time_ms: float | None = None
    is_cached: bool = False
    error_message: str | None = None


@dataclass
class AsyncQueryHandle:
    """
    Handle for tracking an asynchronous query.

    Provides methods to check status, retrieve results, and cancel the query.
    The methods are bound to concrete implementations at runtime.

    This is the return type of Database.execute_async().
    """

    query_id: int | None  # None for cached results
    status: QueryStatus = field(default=QueryStatus.PENDING)
    started_at: datetime | None = None

    def get_status(self) -> QueryStatus:
        """
        Get the current status of the async query.

        :returns: Current QueryStatus
        """
        raise NotImplementedError("Method will be replaced during initialization")

    def get_result(self) -> QueryResult:
        """
        Get the result of the async query.

        :returns: QueryResult with data if successful
        """
        raise NotImplementedError("Method will be replaced during initialization")

    def cancel(self) -> bool:
        """
        Cancel the async query.

        :returns: True if cancellation was successful
        """
        raise NotImplementedError("Method will be replaced during initialization")


__all__ = [
    "QueryStatus",
    "QueryOptions",
    "QueryResult",
    "StatementResult",
    "AsyncQueryHandle",
    "CacheOptions",
]
