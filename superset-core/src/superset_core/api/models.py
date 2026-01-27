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
Model API for superset-core.

Provides model classes that will be replaced by host implementations
during initialization for extension developers to use.

Usage:
    from superset_core.api.models import Dataset, Database, get_session

    # Use as regular model classes
    dataset = Dataset(name="My Dataset")
    db = Database(database_name="My DB")
    session = get_session()
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, TYPE_CHECKING
from uuid import UUID

from flask_appbuilder import Model
from sqlalchemy.orm import scoped_session

if TYPE_CHECKING:
    from superset_core.api.tasks import TaskProperties
    from superset_core.api.types import (
        AsyncQueryHandle,
        QueryOptions,
        QueryResult,
    )


class CoreModel(Model):
    """
    Abstract base class that extends Flask-AppBuilder's Model.

    This base class provides the interface contract for all Superset models.
    The host package provides concrete implementations.
    """

    __abstract__ = True


class Database(CoreModel):
    """
    Abstract class for Database models.

    This abstract class defines the contract that database models should implement,
    providing consistent database connectivity and metadata operations.
    """

    __abstract__ = True

    id: int
    verbose_name: str
    database_name: str | None

    @property
    def name(self) -> str:
        raise NotImplementedError

    @property
    def backend(self) -> str:
        raise NotImplementedError

    @property
    def data(self) -> dict[str, Any]:
        raise NotImplementedError

    def execute(
        self,
        sql: str,
        options: QueryOptions | None = None,
    ) -> QueryResult:
        """
        Execute SQL synchronously.

        The SQL must be written in the dialect of the target database (e.g.,
        PostgreSQL syntax for PostgreSQL databases, Snowflake syntax for
        Snowflake, etc.). No automatic cross-dialect translation is performed.

        :param sql: SQL query to execute (in the target database's dialect)
        :param options: Query execution options (see `QueryOptions`).
            If not provided, defaults are used.
        :returns: QueryResult with status, data (DataFrame), and metadata

        Example:
            from superset_core.api.daos import DatabaseDAO
            from superset_core.api.types import QueryOptions, QueryStatus

            db = DatabaseDAO.find_one_or_none(id=1)
            result = db.execute(
                "SELECT * FROM users WHERE active = true",
                options=QueryOptions(schema="public", limit=100)
            )
            if result.status == QueryStatus.SUCCESS:
                df = result.data
                print(f"Found {sum(s.row_count for s in result.statements)} rows")

        Example with templates:
            result = db.execute(
                "SELECT * FROM {{ table }} WHERE date > '{{ start_date }}'",
                options=QueryOptions(
                    schema="analytics",
                    template_params={"table": "events", "start_date": "2024-01-01"}
                )
            )

        Example with dry_run:
            result = db.execute(
                "SELECT * FROM users",
                options=QueryOptions(schema="public", limit=100, dry_run=True)
            )
            print(f"Would execute: {result.statements[0].statement}")
        """
        raise NotImplementedError("Method will be replaced during initialization")

    def execute_async(
        self,
        sql: str,
        options: QueryOptions | None = None,
    ) -> AsyncQueryHandle:
        """
        Execute SQL asynchronously.

        Returns immediately with a handle for tracking progress and retrieving
        results from the background worker.

        The SQL must be written in the dialect of the target database (e.g.,
        PostgreSQL syntax for PostgreSQL databases, Snowflake syntax for
        Snowflake, etc.). No automatic cross-dialect translation is performed.

        :param sql: SQL query to execute (in the target database's dialect)
        :param options: Query execution options (see `QueryOptions`).
            If not provided, defaults are used.
        :returns: AsyncQueryHandle for tracking the query

        Example:
            handle = db.execute_async(
                "SELECT * FROM large_table",
                options=QueryOptions(schema="analytics")
            )

            # Check status and get results
            status = handle.get_status()
            if status == QueryStatus.SUCCESS:
                query_result = handle.get_result()
                df = query_result.statements[0].data

            # Cancel if needed
            handle.cancel()
        """
        raise NotImplementedError("Method will be replaced during initialization")


class Dataset(CoreModel):
    """
    Abstract class for Dataset models.

    This abstract class defines the contract that dataset models should implement,
    providing consistent data source operations and metadata.

    It provides the public API for Datasets implemented by the host application.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    uuid: UUID | None
    table_name: str | None
    main_dttm_col: str | None
    database_id: int | None
    schema: str | None
    catalog: str | None
    sql: str | None  # For virtual datasets
    description: str | None
    default_endpoint: str | None
    is_featured: bool
    filter_select_enabled: bool
    offset: int
    cache_timeout: int
    params: str
    perm: str | None
    schema_perm: str | None
    catalog_perm: str | None
    is_managed_externally: bool
    external_url: str | None
    fetch_values_predicate: str | None
    is_sqllab_view: bool
    template_params: str | None
    extra: str | None  # JSON string
    normalize_columns: bool
    always_filter_main_dttm: bool
    folders: str | None  # JSON string


class Chart(CoreModel):
    """
    Abstract Chart/Slice model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    uuid: UUID | None
    slice_name: str | None
    datasource_id: int | None
    datasource_type: str | None
    datasource_name: str | None
    viz_type: str | None
    params: str | None
    query_context: str | None
    description: str | None
    cache_timeout: int
    certified_by: str | None
    certification_details: str | None
    is_managed_externally: bool
    external_url: str | None


class Dashboard(CoreModel):
    """
    Abstract Dashboard model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    uuid: UUID | None
    dashboard_title: str | None
    position_json: str | None
    description: str | None
    css: str | None
    json_metadata: str | None
    slug: str | None
    published: bool
    certified_by: str | None
    certification_details: str | None
    is_managed_externally: bool
    external_url: str | None


class User(CoreModel):
    """
    Abstract User model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    username: str | None
    email: str | None
    first_name: str | None
    last_name: str | None
    active: bool


class Query(CoreModel):
    """
    Abstract Query model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    client_id: str | None
    database_id: int | None
    sql: str | None
    status: str | None
    user_id: int | None
    progress: int
    error_message: str | None


class SavedQuery(CoreModel):
    """
    Abstract SavedQuery model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    uuid: UUID | None
    label: str | None
    sql: str | None
    database_id: int | None
    description: str | None
    user_id: int | None


class Tag(CoreModel):
    """
    Abstract Tag model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    name: str | None
    type: str | None


class KeyValue(CoreModel):
    """
    Abstract KeyValue model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.
    """

    __abstract__ = True

    id: int
    uuid: UUID | None
    resource: str | None
    value: str | None  # Encoded value
    expires_on: datetime | None
    created_by_fk: int | None
    changed_by_fk: int | None


class Task(CoreModel):
    """
    Abstract Task model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.

    This model represents async tasks in the Global Task Framework (GTF).

    Non-filterable fields (progress, error info, execution config) are stored
    in a `properties` JSON blob for schema flexibility.
    """

    __abstract__ = True

    # Type hints for expected column attributes
    id: int
    uuid: str
    task_key: str  # For deduplication
    task_type: str  # e.g., 'sql_execution'
    task_name: str | None  # Human readable name
    scope: str  # private/shared/system
    status: str
    dedup_key: str  # Computed deduplication key

    # Timestamps (from AuditMixinNullable)
    created_on: datetime | None
    changed_on: datetime | None
    started_at: datetime | None
    ended_at: datetime | None

    # User context
    created_by_fk: int | None
    user_id: int | None

    # Task output data
    payload: str  # JSON serialized task output data

    def get_payload(self) -> dict[str, Any]:
        """
        Get payload as parsed JSON.

        Payload contains task-specific output data set by task code.

        Host implementations will replace this method during initialization
        with concrete implementation providing actual functionality.

        :returns: Dictionary containing payload data
        """
        raise NotImplementedError("Method will be replaced during initialization")

    def set_payload(self, data: dict[str, Any]) -> None:
        """
        Update payload with new data (merges with existing).

        Host implementations will replace this method during initialization
        with concrete implementation providing actual functionality.

        :param data: Dictionary of data to merge into payload
        """
        raise NotImplementedError("Method will be replaced during initialization")

    @property
    def properties(self) -> Any:
        """
        Get typed properties (runtime state and execution config).

        Properties contain:
        - is_abortable: bool | None - has abort handler registered
        - progress_percent: float | None - progress 0.0-1.0
        - progress_current: int | None - current iteration count
        - progress_total: int | None - total iterations
        - error_message: str | None - human-readable error message
        - exception_type: str | None - exception class name
        - stack_trace: str | None - full formatted traceback
        - timeout: int | None - timeout in seconds

        Host implementations will replace this property during initialization.

        :returns: TaskProperties dataclass instance
        """
        raise NotImplementedError("Property will be replaced during initialization")

    def update_properties(self, updates: "TaskProperties") -> None:
        """
        Update specific properties fields (merge semantics).

        Only updates fields present in the updates dict.

        Host implementations will replace this method during initialization.

        :param updates: TaskProperties dict with fields to update

        Example:
            task.update_properties({"is_abortable": True})
        """
        raise NotImplementedError("Method will be replaced during initialization")


class TaskSubscriber(CoreModel):
    """
    Abstract TaskSubscriber model interface.

    Host implementations will replace this class during initialization
    with concrete implementation providing actual functionality.

    This model tracks task subscriptions for multi-user shared tasks. When a user
    schedules a shared task with the same parameters as an existing task,
    they are subscribed to that task instead of creating a duplicate.
    """

    __abstract__ = True

    # Type hints for expected attributes (no actual field definitions)
    id: int
    task_id: int
    user_id: int
    subscribed_at: datetime

    # Audit fields from AuditMixinNullable
    created_on: datetime | None
    changed_on: datetime | None
    created_by_fk: int | None
    changed_by_fk: int | None


def get_session() -> scoped_session:
    """
    Retrieve the SQLAlchemy session to directly interface with the
    Superset models.

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    :returns: The SQLAlchemy scoped session instance.
    """
    raise NotImplementedError("Function will be replaced during initialization")


__all__ = [
    "Dataset",
    "Database",
    "Chart",
    "Dashboard",
    "User",
    "Query",
    "SavedQuery",
    "Tag",
    "KeyValue",
    "Task",
    "TaskSubscriber",
    "CoreModel",
    "get_session",
]
