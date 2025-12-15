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
SQL Executor implementation for Database.execute() and execute_async().

This module provides the SQLExecutor class that implements the query execution
methods defined in superset_core.api.models.Database.

Implementation Features
-----------------------

Query Preparation (applies to both sync and async):
- Jinja2 template rendering (via template_params in QueryOptions)
- SQL mutation via SQL_QUERY_MUTATOR config hook
- DML permission checking (requires database.allow_dml=True for DML)
- Disallowed functions checking via DISALLOWED_SQL_FUNCTIONS config
- Row-level security (RLS) via AST transformation (always applied)
- Result limit application via SQL_MAX_ROW config
- Catalog/schema resolution and validation

Synchronous Execution (execute):
- Multi-statement SQL parsing and execution
- Progress tracking via Query model
- Result caching via cache_manager.data_cache
- Query logging via QUERY_LOGGER config hook
- Timeout protection via SQLLAB_TIMEOUT config
- Dry run mode (returns transformed SQL without execution)

Asynchronous Execution (execute_async):
- Celery task submission for background execution
- Security validation before submission
- Query model creation with PENDING status
- Result caching check (returns cached if available)
- Background execution with timeout via SQLLAB_ASYNC_TIME_LIMIT_SEC
- Results stored in results backend for retrieval
- Handle-based progress tracking and cancellation

See Database.execute() and Database.execute_async() docstrings in
superset_core.api.models for the public API contract.
"""

from __future__ import annotations

import contextlib
import hashlib
import logging
import time
import uuid
from datetime import datetime
from typing import Any, TYPE_CHECKING

from flask import current_app as app, g, has_app_context

from superset import db
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetSecurityException,
    SupersetTimeoutException,
)
from superset.extensions import cache_manager
from superset.sql.parse import SQLScript
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset_core.api.types import (
        AsyncQueryHandle,
        QueryOptions,
        QueryResult,
        QueryStatus,
        StatementResult,
    )

    from superset.models.core import Database
    from superset.result_set import SupersetResultSet

logger = logging.getLogger(__name__)


def execute_sql_with_cursor(
    database: Database,
    cursor: Any,
    statements: list[str],
    query: Any,
    log_query_fn: Any | None = None,
    check_stopped_fn: Any | None = None,
    execute_fn: Any | None = None,
) -> list[tuple[str, SupersetResultSet | None, float, int]]:
    """
    Execute SQL statements with a cursor and return all result sets.

    This is the shared execution logic used by both sync (SQLExecutor) and
    async (celery_task) execution paths. It handles multi-statement execution
    with progress tracking via the Query model.

    :param database: Database model to execute against
    :param cursor: Database cursor to use for execution
    :param statements: List of SQL statements to execute
    :param query: Query model for progress tracking
    :param log_query_fn: Optional function to log queries, called as fn(sql, schema)
    :param check_stopped_fn: Optional function to check if query was stopped.
        Should return True if stopped. Used by async execution for cancellation.
    :param execute_fn: Optional custom execute function. If not provided, uses
        database.db_engine_spec.execute(cursor, sql, database). Custom function
        should accept (cursor, sql) and handle execution.
    :returns: List of (statement_sql, result_set, execution_time_ms, rowcount) tuples
        Returns empty list if stopped. Raises exception on error (fail-fast).
    """
    from superset.result_set import SupersetResultSet

    total = len(statements)
    if total == 0:
        return []

    results: list[tuple[str, SupersetResultSet | None, float, int]] = []

    for i, statement in enumerate(statements):
        # Check if query was stopped (async cancellation)
        if check_stopped_fn and check_stopped_fn():
            return results

        stmt_start_time = time.time()

        # Apply SQL mutation
        stmt_sql = database.mutate_sql_based_on_config(
            statement,
            is_split=True,
        )

        # Log query
        if log_query_fn:
            log_query_fn(stmt_sql, query.schema)

        # Execute - use custom function or default
        if execute_fn:
            execute_fn(cursor, stmt_sql)
        else:
            database.db_engine_spec.execute(cursor, stmt_sql, database)

        stmt_execution_time = (time.time() - stmt_start_time) * 1000

        # Fetch results from ALL statements
        description = cursor.description
        if description:
            rows = database.db_engine_spec.fetch_data(cursor)
            result_set = SupersetResultSet(
                rows,
                description,
                database.db_engine_spec,
            )
        else:
            # DML statement - no result set
            result_set = None

        # Get row count for DML statements
        rowcount = cursor.rowcount if hasattr(cursor, "rowcount") else 0

        results.append((stmt_sql, result_set, stmt_execution_time, rowcount))

        # Update progress on Query model
        progress_pct = int(((i + 1) / total) * 100)
        query.progress = progress_pct
        query.set_extra_json_key(
            "progress",
            f"Running statement {i + 1} of {total}",
        )
        db.session.commit()  # pylint: disable=consider-using-transaction

    return results


class SQLExecutor:
    """
    SQL query executor implementation.

    Implements Database.execute() and execute_async() methods.
    See superset_core.api.models.Database for the full public API documentation.
    """

    def __init__(self, database: Database) -> None:
        """
        Initialize the executor with a database.

        :param database: Database model instance to execute queries against
        """
        self.database = database

    def execute(
        self,
        sql: str,
        options: QueryOptions | None = None,
    ) -> QueryResult:
        """
        Execute SQL synchronously.

        If options.dry_run=True, returns the transformed SQL without execution.
        All transformations (RLS, templates, limits) are still applied.

        See superset_core.api.models.Database.execute() for full documentation.
        """
        from superset_core.api.types import (
            QueryOptions as QueryOptionsType,
            QueryResult as QueryResultType,
            QueryStatus,
            StatementResult,
        )

        opts: QueryOptionsType = options or QueryOptionsType()
        start_time = time.time()

        try:
            # 1. Prepare SQL (assembly only, no security checks)
            original_script, transformed_script, catalog, schema = self._prepare_sql(
                sql, opts
            )

            # 2. Security checks on transformed script
            self._check_security(transformed_script)

            # 3. Get mutation status and format SQL
            has_mutation = transformed_script.has_mutation()
            final_sql = transformed_script.format()

            # DRY RUN: Return transformed SQL without execution
            if opts.dry_run:
                total_execution_time_ms = (time.time() - start_time) * 1000
                # Create a StatementResult for each statement in dry-run mode
                original_sqls = [stmt.format() for stmt in original_script.statements]
                transformed_sqls = [
                    stmt.format() for stmt in transformed_script.statements
                ]
                dry_run_statements = [
                    StatementResult(
                        original_sql=orig_sql,
                        executed_sql=trans_sql,
                        data=None,
                        row_count=0,
                        execution_time_ms=0,
                    )
                    for orig_sql, trans_sql in zip(
                        original_sqls, transformed_sqls, strict=True
                    )
                ]
                return QueryResultType(
                    status=QueryStatus.SUCCESS,
                    statements=dry_run_statements,
                    query_id=None,
                    total_execution_time_ms=total_execution_time_ms,
                    is_cached=False,
                )

            # 4. Check cache
            cached_result = self._try_get_cached_result(has_mutation, final_sql, opts)
            if cached_result:
                return cached_result

            # 5. Create Query model for audit
            query = self._create_query_record(
                final_sql, opts, catalog, schema, status=QueryStatus.RUNNING
            )

            # 6. Execute with timeout
            timeout = opts.timeout_seconds or app.config.get("SQLLAB_TIMEOUT", 30)
            timeout_msg = f"Query exceeded the {timeout} seconds timeout."

            with utils.timeout(seconds=timeout, error_message=timeout_msg):
                statement_results = self._execute_statements(
                    original_script,
                    transformed_script,
                    catalog,
                    schema,
                    query,
                )

            total_execution_time_ms = (time.time() - start_time) * 1000

            # Calculate total row count for Query model
            total_rows = sum(stmt.row_count for stmt in statement_results)

            # Update query record
            query.status = "success"
            query.rows = total_rows
            query.progress = 100
            db.session.commit()  # pylint: disable=consider-using-transaction

            result = QueryResultType(
                status=QueryStatus.SUCCESS,
                statements=statement_results,
                query_id=query.id,
                total_execution_time_ms=total_execution_time_ms,
            )

            # Store in cache (if SELECT and caching enabled)
            if not has_mutation:
                self._store_in_cache(result, final_sql, opts)

            return result

        except SupersetTimeoutException:
            return self._create_error_result(
                QueryStatus.TIMED_OUT,
                "Query exceeded the timeout limit",
                start_time,
            )
        except SupersetSecurityException as ex:
            return self._create_error_result(QueryStatus.FAILED, str(ex), start_time)
        except Exception as ex:
            error_msg = self.database.db_engine_spec.extract_error_message(ex)
            return self._create_error_result(QueryStatus.FAILED, error_msg, start_time)

    def execute_async(
        self,
        sql: str,
        options: QueryOptions | None = None,
    ) -> AsyncQueryHandle:
        """
        Execute SQL asynchronously via Celery.

        If options.dry_run=True, returns the transformed SQL as a completed
        AsyncQueryHandle without submitting to Celery.

        See superset_core.api.models.Database.execute_async() for full documentation.
        """
        from superset_core.api.types import (
            QueryOptions as QueryOptionsType,
            QueryResult as QueryResultType,
            QueryStatus,
        )

        opts: QueryOptionsType = options or QueryOptionsType()

        # 1. Prepare SQL (assembly only, no security checks)
        original_script, transformed_script, catalog, schema = self._prepare_sql(
            sql, opts
        )

        # 2. Security checks on transformed script
        self._check_security(transformed_script)

        # 3. Get mutation status and format SQL
        has_mutation = transformed_script.has_mutation()
        final_sql = transformed_script.format()

        # DRY RUN: Return transformed SQL as completed async handle
        if opts.dry_run:
            from superset_core.api.types import StatementResult

            original_sqls = [stmt.format() for stmt in original_script.statements]
            transformed_sqls = [stmt.format() for stmt in transformed_script.statements]
            dry_run_statements = [
                StatementResult(
                    original_sql=orig_sql,
                    executed_sql=trans_sql,
                    data=None,
                    row_count=0,
                    execution_time_ms=0,
                )
                for orig_sql, trans_sql in zip(
                    original_sqls, transformed_sqls, strict=True
                )
            ]
            dry_run_result = QueryResultType(
                status=QueryStatus.SUCCESS,
                statements=dry_run_statements,
                query_id=None,
                total_execution_time_ms=0,
                is_cached=False,
            )
            return self._create_cached_handle(dry_run_result)

        # 4. Check cache
        if cached_result := self._try_get_cached_result(has_mutation, final_sql, opts):
            return self._create_cached_handle(cached_result)

        # 5. Create Query model for audit
        query = self._create_query_record(
            final_sql, opts, catalog, schema, status=QueryStatus.PENDING
        )

        # 6. Submit to Celery
        self._submit_query_to_celery(query, final_sql)

        # 7. Create and return handle with bound methods
        return self._create_async_handle(query.id)

    def _prepare_sql(
        self,
        sql: str,
        opts: QueryOptions,
    ) -> tuple[SQLScript, SQLScript, str | None, str | None]:
        """
        Prepare SQL for execution (no side effects, no security checks).

        This method performs SQL preprocessing:
        1. Template rendering
        2. SQL parsing
        3. Catalog/schema resolution
        4. RLS application
        5. Limit application (if not mutation)

        Security checks (disallowed functions, DML permission) are performed
        by the caller after receiving the prepared scripts.

        :param sql: Original SQL query
        :param opts: Query options
        :returns: Tuple of (original_script, transformed_script, catalog, schema)
        """
        # 1. Render Jinja2 templates
        rendered_sql = self._render_sql_template(sql, opts.template_params)

        # 2. Parse SQL with SQLScript - this is the ORIGINAL script
        original_script = SQLScript(rendered_sql, self.database.db_engine_spec.engine)

        # 3. Create a copy for transformation
        transformed_script = SQLScript(
            rendered_sql, self.database.db_engine_spec.engine
        )

        # 4. Get catalog and schema
        catalog = opts.catalog or self.database.get_default_catalog()
        schema = opts.schema or self.database.get_default_schema(catalog)

        # 5. Apply RLS to transformed script only
        self._apply_rls_to_script(transformed_script, catalog, schema)

        # 6. Apply limit only if not a mutation
        if not transformed_script.has_mutation():
            self._apply_limit_to_script(transformed_script, opts)

        return original_script, transformed_script, catalog, schema

    def _check_security(self, script: SQLScript) -> None:
        """
        Perform security checks on prepared SQL script.

        :param script: Prepared SQLScript
        :raises SupersetSecurityException: If security checks fail
        """
        # Check disallowed functions
        if disallowed := self._check_disallowed_functions(script):
            raise SupersetSecurityException(
                SupersetError(
                    message=f"Disallowed SQL functions: {', '.join(disallowed)}",
                    error_type=SupersetErrorType.INVALID_SQL_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )

        # Check DML permission
        if script.has_mutation() and not self.database.allow_dml:
            raise SupersetSecurityException(
                SupersetError(
                    message="DML queries are not allowed on this database",
                    error_type=SupersetErrorType.DML_NOT_ALLOWED_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )

    def _execute_statements(
        self,
        original_script: SQLScript,
        transformed_script: SQLScript,
        catalog: str | None,
        schema: str | None,
        query: Any,
    ) -> list[StatementResult]:
        """
        Execute SQL statements and return per-statement results.

        Progress is tracked via Query.progress field.
        Uses the same execution path for both single and multi-statement queries.

        :param original_script: SQLScript with original SQL (before transformations)
        :param transformed_script: SQLScript with transformed SQL
            (after RLS, limits, etc.)
        :param catalog: Catalog name
        :param schema: Schema name
        :param query: Query model for progress tracking
        :returns: List of StatementResult objects
        """
        from superset_core.api.types import StatementResult

        # Get original statement strings
        original_sqls = [stmt.format() for stmt in original_script.statements]

        # Handle empty script
        if not transformed_script.statements:
            return []

        results_list = []

        # Use consistent execution path for all queries
        with self.database.get_raw_connection(catalog=catalog, schema=schema) as conn:
            with contextlib.closing(conn.cursor()) as cursor:
                execution_results = execute_sql_with_cursor(
                    database=self.database,
                    cursor=cursor,
                    statements=[
                        stmt.format() for stmt in transformed_script.statements
                    ],
                    query=query,
                    log_query_fn=self._log_query,
                )

                # If execution was stopped or returned no results, return early
                if not execution_results:
                    return []

                # Build StatementResult for each executed statement
                # with both original and executed SQL
                for orig_sql, (exec_sql, result_set, exec_time, rowcount) in zip(
                    original_sqls, execution_results, strict=True
                ):
                    if result_set is not None:
                        # SELECT statement
                        df = result_set.to_pandas_df()
                        stmt_result = StatementResult(
                            original_sql=orig_sql,
                            executed_sql=exec_sql,
                            data=df,
                            row_count=len(df),
                            execution_time_ms=exec_time,
                        )
                    else:
                        # DML statement - no data, just row count
                        stmt_result = StatementResult(
                            original_sql=orig_sql,
                            executed_sql=exec_sql,
                            data=None,
                            row_count=rowcount,
                            execution_time_ms=exec_time,
                        )

                    results_list.append(stmt_result)

        return results_list

    def _log_query(
        self,
        sql: str,
        schema: str | None,
    ) -> None:
        """
        Log query using QUERY_LOGGER config.

        :param sql: SQL to log
        :param schema: Schema name
        """
        from superset import security_manager

        if log_query := app.config.get("QUERY_LOGGER"):
            log_query(
                self.database,
                sql,
                schema,
                __name__,
                security_manager,
                {},
            )

    def _create_error_result(
        self,
        status: Any,
        error_message: str,
        start_time: float,
        partial_results: list[Any] | None = None,
    ) -> QueryResult:
        """
        Create a QueryResult for error cases.

        :param status: QueryStatus enum value
        :param error_message: Error message to include
        :param start_time: Start time for calculating execution duration
        :param partial_results: Optional list of StatementResult from successful
            statements before the failure
        :returns: QueryResult with error status
        """
        from superset_core.api.types import QueryResult as QueryResultType

        return QueryResultType(
            status=status,
            statements=partial_results or [],
            error_message=error_message,
            total_execution_time_ms=(time.time() - start_time) * 1000,
        )

    def _render_sql_template(
        self, sql: str, template_params: dict[str, Any] | None
    ) -> str:
        """
        Render Jinja2 template with params.

        :param sql: SQL string potentially containing Jinja2 templates
        :param template_params: Parameters to pass to the template
        :returns: Rendered SQL string
        """
        if template_params is None:
            return sql

        from superset.jinja_context import get_template_processor

        tp = get_template_processor(database=self.database)
        return tp.process_template(sql, **template_params)

    def _apply_limit_to_script(self, script: SQLScript, opts: QueryOptions) -> None:
        """
        Apply limit to the last statement in the script in place.

        :param script: SQLScript object to modify
        :param opts: Query options
        """
        # Skip if no limit requested
        if opts.limit is None:
            return

        sql_max_row = app.config.get("SQL_MAX_ROW")
        effective_limit = opts.limit
        if sql_max_row and opts.limit > sql_max_row:
            effective_limit = sql_max_row

        # Apply limit to last statement only
        if script.statements:
            script.statements[-1].set_limit_value(
                effective_limit,
                self.database.db_engine_spec.limit_method,
            )

    def _try_get_cached_result(
        self,
        has_mutation: bool,
        sql: str,
        opts: QueryOptions,
    ) -> QueryResult | None:
        """
        Try to get a cached result if conditions allow.

        :param has_mutation: Whether the query contains mutations (DML)
        :param sql: SQL query
        :param opts: Query options
        :returns: Cached QueryResult or None
        """
        if has_mutation or (opts.cache and opts.cache.force_refresh):
            return None

        return self._get_from_cache(sql, opts)

    def _check_disallowed_functions(self, script: SQLScript) -> set[str] | None:
        """
        Check for disallowed SQL functions.

        :param script: Parsed SQL script
        :returns: Set of disallowed functions found, or None if none found
        """
        disallowed_config = app.config.get("DISALLOWED_SQL_FUNCTIONS", {})
        engine_name = self.database.db_engine_spec.engine

        # Get disallowed functions for this engine
        engine_disallowed = disallowed_config.get(engine_name, set())
        if not engine_disallowed:
            return None

        # Check each statement for disallowed functions
        found = set()
        for statement in script.statements:
            # Use the statement's AST to check for function calls
            statement_str = str(statement).upper()
            for func in engine_disallowed:
                if func.upper() in statement_str:
                    found.add(func)

        return found if found else None

    def _apply_rls_to_script(
        self, script: SQLScript, catalog: str | None, schema: str | None
    ) -> None:
        """
        Apply Row-Level Security to SQLScript statements in place.

        :param script: SQLScript object to modify
        :param catalog: Catalog name
        :param schema: Schema name
        """
        from superset.utils.rls import apply_rls

        # Apply RLS to each statement in the script
        for statement in script.statements:
            apply_rls(self.database, catalog, schema or "", statement)

    def _create_query_record(
        self,
        sql: str,
        opts: QueryOptions,
        catalog: str | None,
        schema: str | None,
        status: QueryStatus,
    ) -> Any:
        """
        Create Query model for audit/tracking.

        :param sql: SQL to execute
        :param opts: Query options
        :param catalog: Catalog name
        :param schema: Schema name
        :param status: Initial QueryStatus (RUNNING for sync, PENDING for async)
        :returns: Query model instance
        """
        from superset.models.sql_lab import Query as QueryModel

        user_id = None
        if has_app_context() and hasattr(g, "user") and g.user:
            user_id = g.user.get_id()

        # Generate client_id for Query model
        client_id = uuid.uuid4().hex[:11]

        query = QueryModel(
            client_id=client_id,
            database_id=self.database.id,
            sql=sql,
            catalog=catalog,
            schema=schema,
            user_id=user_id,
            status=status.value,
            limit=opts.limit,
        )
        db.session.add(query)
        db.session.commit()  # pylint: disable=consider-using-transaction

        return query

    def _get_from_cache(self, sql: str, opts: QueryOptions) -> QueryResult | None:
        """
        Check results cache for existing result.

        :param sql: SQL query
        :param opts: Query options
        :returns: Cached QueryResult if found, None otherwise
        """
        from superset_core.api.types import (
            QueryResult as QueryResultType,
            QueryStatus,
            StatementResult,
        )

        cache_key = self._generate_cache_key(sql, opts)

        if (cached := cache_manager.data_cache.get(cache_key)) is not None:
            # Reconstruct statement results from cached data
            statements = [
                StatementResult(
                    original_sql=stmt_data["original_sql"],
                    executed_sql=stmt_data["executed_sql"],
                    data=stmt_data["data"],
                    row_count=stmt_data["row_count"],
                    execution_time_ms=stmt_data["execution_time_ms"],
                )
                for stmt_data in cached.get("statements", [])
            ]
            return QueryResultType(
                status=QueryStatus.SUCCESS,
                statements=statements,
                query_id=None,
                is_cached=True,
                total_execution_time_ms=cached.get("total_execution_time_ms", 0),
            )

        return None

    def _store_in_cache(
        self, result: QueryResult, sql: str, opts: QueryOptions
    ) -> None:
        """
        Store result in cache.

        :param result: Query result to cache
        :param sql: SQL query (for cache key)
        :param opts: Query options
        """
        from superset_core.api.types import QueryStatus

        if result.status != QueryStatus.SUCCESS:
            return

        cache_key = self._generate_cache_key(sql, opts)
        timeout = (
            (opts.cache.timeout if opts.cache else None)
            or self.database.cache_timeout
            or app.config.get("CACHE_DEFAULT_TIMEOUT", 300)
        )

        # Serialize statement results for caching
        cached_data = {
            "statements": [
                {
                    "original_sql": stmt.original_sql,
                    "executed_sql": stmt.executed_sql,
                    "data": stmt.data,
                    "row_count": stmt.row_count,
                    "execution_time_ms": stmt.execution_time_ms,
                }
                for stmt in result.statements
            ],
            "total_execution_time_ms": result.total_execution_time_ms,
        }

        cache_manager.data_cache.set(
            cache_key,
            cached_data,
            timeout=timeout,
        )

    def _generate_cache_key(self, sql: str, opts: QueryOptions) -> str:
        """
        Generate cache key for query result.

        :param sql: SQL query
        :param opts: Query options
        :returns: Cache key string
        """
        # Include relevant options in the cache key
        key_parts = [
            str(self.database.id),
            sql,
            opts.catalog or "",
            opts.schema or "",
            str(opts.limit) if opts.limit is not None else "",
        ]
        key_string = "|".join(key_parts)
        return hashlib.sha256(key_string.encode()).hexdigest()

    def _submit_query_to_celery(
        self,
        query: Any,
        rendered_sql: str,
    ) -> None:
        """
        Submit query to Celery for async execution.

        :param query: Query model instance
        :param rendered_sql: Rendered SQL to execute
        :raises: Re-raises any exception after marking query as failed
        """
        from superset.sql.execution.celery_task import execute_sql_task
        from superset.utils.core import get_username
        from superset.utils.dates import now_as_float

        try:
            task = execute_sql_task.delay(
                query.id,
                rendered_sql,
                username=get_username(),
                start_time=now_as_float(),
            )
            task.forget()  # Don't track task result in Celery backend
        except Exception as ex:
            query.status = "failed"
            query.error_message = str(ex)
            db.session.commit()  # pylint: disable=consider-using-transaction
            raise

    def _create_async_handle(self, query_id: int) -> AsyncQueryHandle:
        """
        Create AsyncQueryHandle with bound methods for tracking the query.

        :param query_id: ID of the Query model
        :returns: AsyncQueryHandle with configured methods
        """
        from superset_core.api.types import (
            AsyncQueryHandle as AsyncQueryHandleType,
            QueryResult as QueryResultType,
            QueryStatus,
        )

        handle = AsyncQueryHandleType(
            query_id=query_id,
            status=QueryStatus.PENDING,
            started_at=datetime.now(),
        )

        # Create bound closures for handle methods
        def get_status_impl() -> QueryStatus:
            return SQLExecutor._get_async_query_status(query_id)

        def get_result_impl() -> QueryResultType:
            return SQLExecutor._get_async_query_result(query_id)

        def cancel_impl() -> bool:
            return SQLExecutor._cancel_async_query(query_id, self.database)

        # Use object.__setattr__ to bypass dataclass frozen-like behavior
        object.__setattr__(handle, "get_status", get_status_impl)
        object.__setattr__(handle, "get_result", get_result_impl)
        object.__setattr__(handle, "cancel", cancel_impl)

        return handle

    def _create_cached_handle(self, cached_result: QueryResult) -> AsyncQueryHandle:
        """
        Create AsyncQueryHandle for a cached result.

        When cache hits occur for async queries, we return an AsyncQueryHandle
        that immediately provides the cached data without submitting to Celery.

        :param cached_result: The cached QueryResult
        :returns: AsyncQueryHandle that returns the cached data
        """
        from superset_core.api.types import (
            AsyncQueryHandle as AsyncQueryHandleType,
            QueryResult as QueryResultType,
            QueryStatus,
        )

        handle = AsyncQueryHandleType(
            query_id=None,
            status=QueryStatus.SUCCESS,
            started_at=datetime.now(),
        )

        # Create closures that return the cached result
        def get_status_impl() -> QueryStatus:
            return QueryStatus.SUCCESS

        def get_result_impl() -> QueryResultType:
            return cached_result

        def cancel_impl() -> bool:
            return False  # Nothing to cancel for cached results

        object.__setattr__(handle, "get_status", get_status_impl)
        object.__setattr__(handle, "get_result", get_result_impl)
        object.__setattr__(handle, "cancel", cancel_impl)

        return handle

    @staticmethod
    def _get_async_query_status(query_id: int) -> Any:
        """Get the current status of an async query."""
        from superset_core.api.types import QueryStatus as QueryStatusType

        from superset.models.sql_lab import Query as QueryModel

        query = db.session.query(QueryModel).filter_by(id=query_id).one_or_none()
        if not query:
            return QueryStatusType.FAILED

        status_map = {
            "pending": QueryStatusType.PENDING,
            "running": QueryStatusType.RUNNING,
            "success": QueryStatusType.SUCCESS,
            "failed": QueryStatusType.FAILED,
            "timed_out": QueryStatusType.TIMED_OUT,
            "stopped": QueryStatusType.STOPPED,
        }
        return status_map.get(query.status, QueryStatusType.FAILED)

    @staticmethod
    def _get_async_query_result(query_id: int) -> Any:
        """Get the result of an async query."""
        import pandas as pd
        from superset_core.api.types import (
            QueryResult as QueryResultType,
            QueryStatus as QueryStatusType,
            StatementResult,
        )

        from superset.models.sql_lab import Query as QueryModel

        query = db.session.query(QueryModel).filter_by(id=query_id).one_or_none()
        if not query:
            return QueryResultType(
                status=QueryStatusType.FAILED,
                error_message="Query not found",
            )

        status = SQLExecutor._get_async_query_status(query_id)
        if status != QueryStatusType.SUCCESS:
            return QueryResultType(
                status=status,
                error_message=query.error_message,
                query_id=query_id,
            )

        # Fetch results from results backend
        if query.results_key:
            import msgpack

            from superset import results_backend_manager

            results_backend = results_backend_manager.results_backend
            if results_backend is not None:
                blob = results_backend.get(query.results_key)
                if blob:
                    try:
                        from superset.utils.core import zlib_decompress

                        payload = msgpack.loads(zlib_decompress(blob))

                        statements = [
                            StatementResult(
                                original_sql=stmt_data.get("original_sql", ""),
                                executed_sql=stmt_data.get("executed_sql", ""),
                                data=(
                                    pd.DataFrame(
                                        stmt_data.get("data", []),
                                        columns=[
                                            c.get("column_name", c.get("name", ""))
                                            for c in stmt_data.get("columns", [])
                                        ],
                                    )
                                    if stmt_data.get("data")
                                    else None
                                ),
                                row_count=stmt_data.get("row_count", 0),
                                execution_time_ms=stmt_data.get("execution_time_ms"),
                            )
                            for stmt_data in payload.get("statements", [])
                        ]
                        return QueryResultType(
                            status=QueryStatusType.SUCCESS,
                            statements=statements,
                            query_id=query_id,
                            total_execution_time_ms=payload.get(
                                "total_execution_time_ms"
                            ),
                            is_cached=True,
                        )
                    except Exception as ex:
                        logger.exception("Error loading async query results")
                        return QueryResultType(
                            status=QueryStatusType.FAILED,
                            error_message=f"Error loading results: {str(ex)}",
                            query_id=query_id,
                        )

        return QueryResultType(
            status=QueryStatusType.FAILED,
            error_message="Results not available",
            query_id=query_id,
        )

    @staticmethod
    def _cancel_async_query(query_id: int, database: Database) -> bool:
        """Cancel an async query."""
        from superset.models.sql_lab import Query as QueryModel

        query = db.session.query(QueryModel).filter_by(id=query_id).one_or_none()
        if not query:
            return False

        return SQLExecutor._cancel_query(database, query)

    @staticmethod
    def _cancel_query(database: Database, query: Any) -> bool:
        """
        Cancel a running query.

        This method handles query cancellation for different database types.
        Some databases have implicit cancellation, others require explicit
        cursor-based cancellation.

        :param database: Database model instance
        :param query: Query model instance to cancel
        :returns: True if cancelled successfully, False otherwise
        """
        from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
        from superset.utils.core import QuerySource

        # Some engines implicitly handle cancellation
        if database.db_engine_spec.has_implicit_cancel():
            return True

        # Some databases may need to make preparations for query cancellation
        database.db_engine_spec.prepare_cancel_query(query)

        # Check early cancellation flag
        if query.extra.get(QUERY_EARLY_CANCEL_KEY):
            return True

        # Get cancel ID
        cancel_query_id = query.extra.get(QUERY_CANCEL_KEY)
        if cancel_query_id is None:
            return False

        # Execute cancellation
        with database.get_sqla_engine(
            catalog=query.catalog,
            schema=query.schema,
            source=QuerySource.SQL_LAB,
        ) as engine:
            with contextlib.closing(engine.raw_connection()) as conn:
                with contextlib.closing(conn.cursor()) as cursor:
                    return database.db_engine_spec.cancel_query(
                        cursor, query, cancel_query_id
                    )
