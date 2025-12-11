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
Celery task for async SQL execution.

This module provides the Celery task for executing SQL queries asynchronously.
It is used by SQLExecutor.execute_async() to run queries in the background.
"""

from __future__ import annotations

import dataclasses
import logging
import sys
import uuid
from sys import getsizeof
from typing import Any, cast, TYPE_CHECKING

import backoff
import msgpack
from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app as app, has_app_context
from flask_babel import gettext as __

from superset import (
    db,
    results_backend,
    results_backend_use_msgpack,
    security_manager,
)
from superset.common.db_query_status import QueryStatus
from superset.constants import QUERY_CANCEL_KEY
from superset.dataframe import df_to_records
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetErrorException,
    SupersetErrorsException,
)
from superset.extensions import celery_app
from superset.models.sql_lab import Query
from superset.result_set import SupersetResultSet
from superset.sql.execution.executor import execute_sql_with_cursor
from superset.sql.parse import SQLScript
from superset.sqllab.utils import write_ipc_buffer
from superset.utils import json
from superset.utils.core import override_user, zlib_compress
from superset.utils.dates import now_as_float
from superset.utils.decorators import stats_timing

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

BYTES_IN_MB = 1024 * 1024


def _get_query_backoff_handler(details: dict[Any, Any]) -> None:
    """Handler for backoff retry logging."""
    stats_logger = app.config["STATS_LOGGER"]
    query_id = details["kwargs"]["query_id"]
    stats_logger.incr(f"error_attempting_orm_query_{details['tries'] - 1}")
    logger.warning(
        "Query with id `%s` could not be retrieved, retrying...",
        str(query_id),
        exc_info=True,
    )


def _get_query_giveup_handler(_: Any) -> None:
    """Handler for backoff giveup logging."""
    stats_logger = app.config["STATS_LOGGER"]
    stats_logger.incr("error_failed_at_getting_orm_query")


@backoff.on_exception(
    backoff.constant,
    Exception,
    interval=1,
    on_backoff=_get_query_backoff_handler,
    on_giveup=_get_query_giveup_handler,
    max_tries=5,
)
def _get_query(query_id: int) -> Query:
    """Attempt to get the query with retry logic."""
    return db.session.query(Query).filter_by(id=query_id).one()


def _handle_query_error(
    ex: Exception,
    query: Query,
    payload: dict[str, Any] | None = None,
    prefix_message: str = "",
) -> dict[str, Any]:
    """Handle error while processing the SQL query."""
    payload = payload or {}
    msg = f"{prefix_message} {str(ex)}".strip()
    query.error_message = msg
    query.tmp_table_name = None
    query.status = QueryStatus.FAILED

    if not query.end_time:
        query.end_time = now_as_float()

    # Extract DB-specific errors
    if isinstance(ex, SupersetErrorException):
        errors = [ex.error]
    elif isinstance(ex, SupersetErrorsException):
        errors = ex.errors
    else:
        errors = query.database.db_engine_spec.extract_errors(
            str(ex), database_name=query.database.unique_name
        )

    errors_payload = [dataclasses.asdict(error) for error in errors]
    if errors:
        query.set_extra_json_key("errors", errors_payload)

    db.session.commit()
    payload.update({"status": query.status, "error": msg, "errors": errors_payload})
    if troubleshooting_link := app.config["TROUBLESHOOTING_LINK"]:
        payload["link"] = troubleshooting_link
    return payload


def _serialize_payload(
    payload: dict[Any, Any], use_msgpack: bool | None = False
) -> bytes | str:
    """Serialize payload for storage."""
    logger.debug("Serializing to msgpack: %r", use_msgpack)
    if use_msgpack:
        return msgpack.dumps(payload, default=json.json_iso_dttm_ser, use_bin_type=True)
    return json.dumps(payload, default=json.json_iso_dttm_ser, ignore_nan=True)


def _prepare_statement_blocks(
    rendered_query: str,
    db_engine_spec: Any,
) -> tuple[SQLScript, list[str]]:
    """
    Parse SQL and build statement blocks for execution.

    Note: RLS, security checks, and other preprocessing are handled by
    SQLExecutor before the query reaches this task.
    """
    parsed_script = SQLScript(rendered_query, engine=db_engine_spec.engine)

    # Build statement blocks for execution
    if db_engine_spec.run_multiple_statements_as_one:
        blocks = [parsed_script.format(comments=db_engine_spec.allows_sql_comments)]
    else:
        blocks = [
            statement.format(comments=db_engine_spec.allows_sql_comments)
            for statement in parsed_script.statements
        ]

    return parsed_script, blocks


def _finalize_successful_query(
    query: Query,
    result_set: SupersetResultSet,
    db_engine_spec: Any,
    payload: dict[str, Any],
) -> None:
    """Update query metadata and payload after successful execution."""
    query.rows = result_set.size
    query.progress = 100
    query.set_extra_json_key("progress", None)
    query.set_extra_json_key("columns", result_set.columns)
    query.end_time = now_as_float()

    use_arrow_data = cast(bool, results_backend_use_msgpack)
    data, selected_columns, all_columns, expanded_columns = _serialize_and_expand_data(
        result_set, db_engine_spec, use_arrow_data
    )

    payload.update(
        {
            "status": QueryStatus.SUCCESS,
            "data": data,
            "columns": all_columns,
            "selected_columns": selected_columns,
            "expanded_columns": expanded_columns,
            "query": query.to_dict(),
        }
    )
    payload["query"]["state"] = QueryStatus.SUCCESS


def _store_results_in_backend(
    query: Query,
    payload: dict[str, Any],
    database: Any,
) -> None:
    """Store query results in the results backend."""
    key = str(uuid.uuid4())
    payload["query"]["resultsKey"] = key
    logger.info(
        "Query %s: Storing results in results backend, key: %s",
        str(query.id),
        key,
    )
    stats_logger = app.config["STATS_LOGGER"]
    with stats_timing("sqllab.query.results_backend_write", stats_logger):
        with stats_timing(
            "sqllab.query.results_backend_write_serialization", stats_logger
        ):
            serialized_payload = _serialize_payload(
                payload, cast(bool, results_backend_use_msgpack)
            )

            # Check payload size limit
            if sql_lab_payload_max_mb := app.config.get("SQLLAB_PAYLOAD_MAX_MB"):
                serialized_payload_size = sys.getsizeof(serialized_payload)
                max_bytes = sql_lab_payload_max_mb * BYTES_IN_MB

                if serialized_payload_size > max_bytes:
                    logger.info("Result size exceeds the allowed limit.")
                    raise SupersetErrorException(
                        SupersetError(
                            message=(
                                f"Result size "
                                f"({serialized_payload_size / BYTES_IN_MB:.2f} MB) "
                                f"exceeds the allowed limit of "
                                f"{sql_lab_payload_max_mb} MB."
                            ),
                            error_type=SupersetErrorType.RESULT_TOO_LARGE_ERROR,
                            level=ErrorLevel.ERROR,
                        )
                    )

        cache_timeout = database.cache_timeout
        if cache_timeout is None:
            cache_timeout = app.config["CACHE_DEFAULT_TIMEOUT"]

        compressed = zlib_compress(serialized_payload)
        logger.debug("*** serialized payload size: %i", getsizeof(serialized_payload))
        logger.debug("*** compressed payload size: %i", getsizeof(compressed))

        write_success = results_backend.set(key, compressed, cache_timeout)
        if not write_success:
            logger.error(
                "Query %s: Failed to store results in backend, key: %s",
                str(query.id),
                key,
            )
            stats_logger.incr("sqllab.results_backend.write_failure")
            query.results_key = None
            query.status = QueryStatus.FAILED
            query.error_message = (
                "Failed to store query results in the results backend. "
                "Please try again or contact your administrator."
            )
            db.session.commit()
            raise SupersetErrorException(
                SupersetError(
                    message=__("Failed to store query results. Please try again."),
                    error_type=SupersetErrorType.RESULTS_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )
        else:
            query.results_key = key
            logger.info(
                "Query %s: Successfully stored results in backend, key: %s",
                str(query.id),
                key,
            )


def _serialize_and_expand_data(
    result_set: SupersetResultSet,
    db_engine_spec: Any,
    use_msgpack: bool | None = False,
) -> tuple[bytes | str, list[Any], list[Any], list[Any]]:
    """Serialize result data for storage in results backend."""
    selected_columns = result_set.columns
    expanded_columns: list[Any] = []

    if use_msgpack:
        if has_app_context():
            stats_logger = app.config["STATS_LOGGER"]
            with stats_timing(
                "sqllab.query.results_backend_pa_serialization", stats_logger
            ):
                data = write_ipc_buffer(result_set.pa_table).to_pybytes()
        else:
            data = write_ipc_buffer(result_set.pa_table).to_pybytes()
        all_columns = selected_columns
    else:
        df = result_set.to_pandas_df()
        data = df_to_records(df) or []
        all_columns = selected_columns

    return (data, selected_columns, all_columns, expanded_columns)


_soft_time_limit = app.config["SQLLAB_ASYNC_TIME_LIMIT_SEC"]
_hard_time_limit = _soft_time_limit + 60


@celery_app.task(
    name="query_execution.execute_sql",
    time_limit=_hard_time_limit,
    soft_time_limit=_soft_time_limit,
)
def execute_sql_task(
    query_id: int,
    rendered_query: str,
    username: str | None = None,
    start_time: float | None = None,
) -> dict[str, Any] | None:
    """
    Execute SQL query asynchronously via Celery.

    This task is used by SQLExecutor.execute_async() to run queries
    in background workers with full feature support.

    :param query_id: ID of the Query model
    :param rendered_query: Pre-rendered SQL query to execute
    :param username: Username for context override
    :param start_time: Query start time for timing metrics
    :returns: Query result payload or None
    """
    with app.test_request_context():
        with override_user(security_manager.find_user(username)):
            try:
                return _execute_sql_statements(
                    query_id,
                    rendered_query,
                    start_time=start_time,
                )
            except Exception as ex:
                logger.debug("Query %d: %s", query_id, ex)
                stats_logger = app.config["STATS_LOGGER"]
                stats_logger.incr("error_sqllab_unhandled")
                query = _get_query(query_id=query_id)
                return _handle_query_error(ex, query)


def _make_check_stopped_fn(query: Query) -> Any:
    """Create a function to check if query was stopped."""

    def check_stopped() -> bool:
        db.session.refresh(query)
        return query.status == QueryStatus.STOPPED

    return check_stopped


def _make_execute_fn(query: Query, db_engine_spec: Any) -> Any:
    """Create an execute function with stats timing."""

    def execute_with_stats(cursor: Any, sql: str) -> None:
        query.executed_sql = sql
        stats_logger = app.config["STATS_LOGGER"]
        with stats_timing("sqllab.query.time_executing_query", stats_logger):
            db_engine_spec.execute_with_cursor(cursor, sql, query)

    return execute_with_stats


def _make_log_query_fn(database: Any) -> Any:
    """Create a query logging function."""

    def log_query(sql: str, schema: str | None) -> None:
        if log_query_fn := app.config.get("QUERY_LOGGER"):
            log_query_fn(
                database.sqlalchemy_uri,
                sql,
                schema,
                __name__,
                security_manager,
                None,
            )

    return log_query


def _execute_sql_statements(
    query_id: int,
    rendered_query: str,
    start_time: float | None,
) -> dict[str, Any] | None:
    """Execute SQL statements and store results."""
    if start_time:
        stats_logger = app.config["STATS_LOGGER"]
        stats_logger.timing("sqllab.query.time_pending", now_as_float() - start_time)

    query = _get_query(query_id=query_id)
    payload: dict[str, Any] = {"query_id": query_id}
    database = query.database
    db_engine_spec = database.db_engine_spec
    db_engine_spec.patch()

    logger.info("Query %s: Set query to 'running'", str(query_id))
    query.status = QueryStatus.RUNNING
    query.start_running_time = now_as_float()
    db.session.commit()

    parsed_script, blocks = _prepare_statement_blocks(rendered_query, db_engine_spec)

    with database.get_raw_connection(
        catalog=query.catalog,
        schema=query.schema,
    ) as conn:
        cursor = conn.cursor()

        cancel_query_id = db_engine_spec.get_cancel_query_id(cursor, query)
        if cancel_query_id is not None:
            query.set_extra_json_key(QUERY_CANCEL_KEY, cancel_query_id)
            db.session.commit()

        try:
            result_set = execute_sql_with_cursor(
                database=database,
                cursor=cursor,
                statements=blocks,
                query=query,
                log_query_fn=_make_log_query_fn(database),
                check_stopped_fn=_make_check_stopped_fn(query),
                execute_fn=_make_execute_fn(query, db_engine_spec),
            )
        except SoftTimeLimitExceeded as ex:
            query.status = QueryStatus.TIMED_OUT
            logger.warning("Query %d: Time limit exceeded", query.id)
            timeout_sec = app.config["SQLLAB_ASYNC_TIME_LIMIT_SEC"]
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "The query was killed after %(sqllab_timeout)s seconds. "
                        "It might be too complex, or the database might be "
                        "under heavy load.",
                        sqllab_timeout=timeout_sec,
                    ),
                    error_type=SupersetErrorType.SQLLAB_TIMEOUT_ERROR,
                    level=ErrorLevel.ERROR,
                )
            ) from ex

        # Check if stopped
        if result_set is None:
            payload.update({"status": QueryStatus.STOPPED})
            return payload

        # Commit for mutations
        if parsed_script.has_mutation() or query.select_as_cta:
            conn.commit()

    _finalize_successful_query(query, result_set, db_engine_spec, payload)

    if results_backend:
        _store_results_in_backend(query, payload, database)

    if query.status != QueryStatus.FAILED:
        query.status = QueryStatus.SUCCESS
    db.session.commit()

    return None
