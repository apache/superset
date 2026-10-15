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
import traceback
import uuid
from collections.abc import Callable
from typing import Any, TYPE_CHECKING

import msgpack
import sqlalchemy as sa
from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app as app, has_app_context
from flask_babel import gettext as __

from superset import (
    db,
    results_backend,
    security_manager,
)
from superset.common.db_query_status import QueryStatus
from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetErrorException,
    SupersetErrorsException,
)
from superset.extensions import celery_app
from superset.models.sql_lab import Query
from superset.result_set import SupersetResultSet
from superset.sql.execution.executor import (
    build_statement_blocks,
    execute_sql_with_cursor,
)
from superset.sql.parse import SQLScript
from superset.sqllab.utils import write_ipc_buffer
from superset.utils import json
from superset.utils.core import override_user, zlib_compress
from superset.utils.dates import now_as_float
from superset.utils.decorators import stats_timing

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)

BYTES_IN_MB = 1024 * 1024


def _get_query(query_id: int) -> Query:
    """Get the query by ID."""
    return db.session.query(Query).filter_by(id=query_id).one()


def _handle_query_error(
    ex: Exception,
    query: Query,
    payload: dict[str, Any] | None = None,
    prefix_message: str = "",
    durable: bool = False,
    results_key: str | None = None,
) -> dict[str, Any]:
    """
    Handle error while processing the SQL query.

    :param durable: the target database already committed the query's effects,
        so a stop recorded after that commit lost the race and must not mask
        the failure
    :param results_key: key of results stored in the results backend before the
        failure; the failed row keeps it, or it is deleted if a stop wins
    """
    # Preserve TIMED_OUT status if already set (from SoftTimeLimitExceeded handler).
    # A timeout is a terminal outcome the user did not cause, so like committed
    # effects it outranks a stop recorded while the query was being killed.
    timed_out = query.status == QueryStatus.TIMED_OUT
    status = QueryStatus.TIMED_OUT if timed_out else QueryStatus.FAILED
    final = durable or timed_out
    # Results stored before the failure are unpublished; a stop reloads the row
    # and drops their pending key, so read it first. A rollback after a failed
    # flush has already dropped it, so prefer the key tracked at the write.
    stored_key = results_key or query.results_key
    if not final and _make_check_stopped_fn(query, preserve_pending=True)():
        _discard_unreferenced_results(query.id, stored_key)
        return _stopped_query_payload(query)

    with db.session.no_autoflush:
        payload = payload or {}
        msg = f"{prefix_message} {str(ex)}".strip()
        query.error_message = msg
        query.tmp_table_name = None
        query.status = status
        if stored_key:
            query.results_key = stored_key

        if not query.end_time:
            query.end_time = now_as_float()

        errors = _extract_errors(ex, query)
        errors_payload = [dataclasses.asdict(error) for error in errors]
        if errors:
            query.set_extra_json_key("errors", errors_payload)

        payload.update({"status": status.value, "error": msg, "errors": errors_payload})
        if app.config.get("SHOW_STACKTRACE"):
            if stacktrace := traceback.format_exc():
                payload["stacktrace"] = stacktrace
        if troubleshooting_link := app.config.get("TROUBLESHOOTING_LINK"):
            payload["link"] = troubleshooting_link
        # The commit is the last step that can fail: when this function raises,
        # the failed row was not committed and does not reference the results.
        if final:
            db.session.commit()  # pylint: disable=consider-using-transaction
        elif not _commit_query_unless_stopped(query):
            _discard_unreferenced_results(query.id, stored_key)
            return _stopped_query_payload(query)
        return payload


def _extract_errors(ex: Exception, query: Query) -> list[SupersetError]:
    """Extract DB-specific errors."""
    if isinstance(ex, SupersetErrorException):
        return [ex.error]
    if isinstance(ex, SupersetErrorsException):
        return ex.errors
    return query.database.db_engine_spec.extract_errors(
        str(ex), database_name=query.database.unique_name
    )


def _serialize_payload(payload: dict[Any, Any]) -> bytes:
    """Serialize payload for storage based on RESULTS_BACKEND_USE_MSGPACK config."""
    from superset import results_backend_use_msgpack

    if results_backend_use_msgpack:
        return msgpack.dumps(payload, default=json.json_iso_dttm_ser, use_bin_type=True)
    return json.dumps(payload, default=json.json_iso_dttm_ser, ignore_nan=True).encode(
        "utf-8"
    )


def _prepare_statement_blocks(
    rendered_query: str,
    db_engine_spec: Any,
    database: Database,
) -> tuple[SQLScript, list[str]]:
    """
    Parse SQL and build statement blocks for execution.

    Delegates to the shared ``build_statement_blocks`` so the sync
    (``sql_lab``) and async (this module) SQL Lab paths apply
    ``SQL_QUERY_MUTATOR``/``MUTATE_AFTER_SPLIT`` identically.
    """
    parsed_script = SQLScript(rendered_query, engine=db_engine_spec.engine)
    return build_statement_blocks(parsed_script, db_engine_spec, database)


def _finalize_successful_query(
    query: Query,
    original_script: SQLScript,
    execution_results: list[tuple[str, SupersetResultSet | None, float, int]],
    payload: dict[str, Any],
    total_execution_time_ms: float,
) -> None:
    """Update query metadata and payload after successful execution."""
    # Calculate total rows across all statements
    total_rows = 0
    statements_data: list[dict[str, Any]] = []

    # Get original statement strings
    original_sqls = [stmt.format() for stmt in original_script.statements]

    if len(original_sqls) != len(execution_results):
        # A `SQL_QUERY_MUTATOR` that changes the number of statements (e.g. by
        # prepending a `SET ROLE` statement when run on the whole, un-split
        # query) can leave the un-mutated `original_script` no longer aligned
        # 1:1 with `execution_results`. Fall back to labeling each result with
        # its own executed SQL rather than crash a query that ran successfully.
        original_sqls = [exec_sql for exec_sql, *_ in execution_results]

    for orig_sql, (exec_sql, result_set, exec_time, rowcount) in zip(
        original_sqls, execution_results, strict=True
    ):
        if result_set is not None:
            # SELECT statement
            total_rows += result_set.size
            data, columns = _serialize_result_set(result_set)
            statements_data.append(
                {
                    "original_sql": orig_sql,
                    "executed_sql": exec_sql,
                    "data": data,
                    "columns": columns,
                    "row_count": result_set.size,
                    "truncated": result_set.truncated,
                    "execution_time_ms": exec_time,
                }
            )
        else:
            # DML statement - no data, just row count
            statements_data.append(
                {
                    "original_sql": orig_sql,
                    "executed_sql": exec_sql,
                    "data": None,
                    "columns": [],
                    "row_count": rowcount,
                    "execution_time_ms": exec_time,
                }
            )

    with db.session.no_autoflush:
        query.rows = total_rows
        query.progress = 100
        query.set_extra_json_key("progress", None)
        # Store columns from last statement (for compatibility)
        if execution_results and execution_results[-1][1] is not None:
            query.set_extra_json_key("columns", execution_results[-1][1].columns)
        query.end_time = now_as_float()

        payload.update(
            {
                "status": QueryStatus.SUCCESS.value,
                "statements": statements_data,
                "total_execution_time_ms": total_execution_time_ms,
                "query": query.to_dict(),
            }
        )
        payload["query"]["state"] = QueryStatus.SUCCESS.value


def _store_results_in_backend(
    query: Query,
    payload: dict[str, Any],
    database: Any,
    durable: bool = False,
    on_results_key: Callable[[str], None] | None = None,
) -> None:
    """
    Store query results in the results backend.

    :param on_results_key: called with the key as soon as the results are
        stored, before any metadata read that can fail
    """
    with db.session.no_autoflush:
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
                serialized_payload = _serialize_payload(payload)

                # Check payload size limit
                if sql_lab_payload_max_mb := app.config.get("SQLLAB_PAYLOAD_MAX_MB"):
                    serialized_payload_size = len(serialized_payload)
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
            logger.debug("*** serialized payload size: %i", len(serialized_payload))
            logger.debug("*** compressed payload size: %i", len(compressed))

            write_success = results_backend.set(key, compressed, cache_timeout)
            if write_success and on_results_key:
                on_results_key(key)
            if not durable and _make_check_stopped_fn(query, preserve_pending=True)():
                if write_success:
                    _discard_stored_results(query.id, key)
                return
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
                if durable:
                    db.session.commit()  # pylint: disable=consider-using-transaction
                elif not _commit_query_unless_stopped(query):
                    return
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


def _serialize_result_set(
    result_set: SupersetResultSet,
) -> tuple[bytes | list[Any], list[Any]]:
    """
    Serialize result set based on RESULTS_BACKEND_USE_MSGPACK config.

    When msgpack is enabled, uses Apache Arrow IPC format for efficiency.
    Otherwise, falls back to JSON-serializable records.

    :param result_set: Query result set to serialize
    :returns: Tuple of (serialized_data, columns)
    """
    from superset import results_backend_use_msgpack
    from superset.dataframe import df_to_records

    if results_backend_use_msgpack:
        if has_app_context():
            stats_logger = app.config["STATS_LOGGER"]
            with stats_timing(
                "sqllab.query.results_backend_pa_serialization", stats_logger
            ):
                data: bytes | list[Any] = write_ipc_buffer(
                    result_set.pa_table
                ).to_pybytes()
        else:
            data = write_ipc_buffer(result_set.pa_table).to_pybytes()
    else:
        df = result_set.to_pandas_df()
        data = df_to_records(df, convert_decimals=True) or []

    return (data, result_set.columns)


@celery_app.task(name="query_execution.execute_sql")
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
        # OAuth retries and error recovery can load ORM state after a failure.
        # Only guarded commits may flush pending terminal metadata over a stop.
        with (
            override_user(security_manager.find_user(username)),
            db.session.no_autoflush,
        ):
            committed = False

            def mark_committed() -> None:
                nonlocal committed
                committed = True

            results_key: str | None = None

            def track_results_key(key: str) -> None:
                nonlocal results_key
                results_key = key

            try:
                from superset.utils.oauth2 import execute_with_oauth2_retry

                query = _get_query(query_id=query_id)
                return execute_with_oauth2_retry(
                    query.database,
                    lambda: _execute_sql_statements(
                        query_id,
                        rendered_query,
                        start_time=start_time,
                        on_commit=mark_committed,
                        on_results_key=track_results_key,
                    ),
                    can_retry=lambda: not query.progress,
                )
            except Exception as ex:
                logger.exception("Query %d: %s", query_id, ex)
                stats_logger = app.config["STATS_LOGGER"]
                stats_logger.incr("error_sqllab_unhandled")
                try:
                    query = _get_query_after_error(query_id)
                    # Failures after the target commit (result serialization,
                    # the results backend, closing the connection) cannot undo
                    # it.
                    return _handle_query_error(
                        ex, query, durable=committed, results_key=results_key
                    )
                except Exception:
                    # _handle_query_error commits last, so the failure was most
                    # likely not recorded. A commit can still apply and raise.
                    _discard_unreferenced_results(query_id, results_key)
                    raise


def _get_query_after_error(query_id: int) -> Query:
    """Get the query, rolling back a session a failed flush left unusable."""
    try:
        return _get_query(query_id=query_id)
    except Exception:  # pylint: disable=broad-except
        # Rolling back only discards metadata the failed task never committed.
        db.session.rollback()  # pylint: disable=consider-using-transaction
        return _get_query(query_id=query_id)


def _commit_query_unless_stopped(query: Query) -> bool:
    """Atomically guard terminal metadata writes against a concurrent stop."""
    with db.session.no_autoflush:
        # The conditional write acquires the row's write lock until commit.
        # A separate status read cannot protect the subsequent ORM flush.
        updated = (
            db.session.query(Query)
            .filter(Query.id == query.id, Query.status != QueryStatus.STOPPED)
            .update({Query.status: query.status}, synchronize_session=False)
        )
        if not updated:
            # A locking read also sees the latest row under REPEATABLE READ.
            db.session.refresh(query, with_for_update=True)
            return False
    db.session.commit()  # pylint: disable=consider-using-transaction
    return True


def _discard_stored_results(query_id: int, key: str | None) -> None:
    """
    Delete stored results whose key no committed query row will reference.

    That happens when a stop wins, or when the task cannot record its failure.
    The blob would only occupy the results backend until it expires. A failed
    delete is logged and does not change the query's outcome.
    """
    if not key or not results_backend:
        return
    try:
        deleted = results_backend.delete(key)
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Query %s: Failed to delete unpublished results, key: %s",
            str(query_id),
            key,
            exc_info=True,
        )
        return
    if not deleted:
        logger.warning(
            "Query %s: Unpublished results were not deleted, key: %s",
            str(query_id),
            key,
        )


def _discard_unreferenced_results(query_id: int, key: str | None) -> None:
    """
    Delete stored results after a failure the task could not record, or after
    a stop wins the error path, unless the query row references them.

    A metadata commit can apply and still raise, for example when its
    acknowledgement is lost, and a stop can then land on the row that commit
    published. Uncommitted metadata is rolled back and the row is read again
    in a new transaction. If that read fails, the results are kept until they
    expire: an orphaned blob is safer than a committed row that references
    deleted results.
    """
    if not key or not results_backend:
        return
    try:
        db.session.rollback()  # pylint: disable=consider-using-transaction
        referenced_key = (
            db.session.query(Query.results_key).filter(Query.id == query_id).scalar()
        )
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "Query %s: Kept results that may be referenced, key: %s",
            str(query_id),
            key,
            exc_info=True,
        )
        return
    if referenced_key != key:
        _discard_stored_results(query_id, key)


def _stopped_query_payload(query: Query) -> dict[str, Any]:
    """Return a minimal stopped result without publishing successful results."""
    query.status = QueryStatus.STOPPED
    if not query.end_time:
        query.end_time = now_as_float()
    db.session.commit()  # pylint: disable=consider-using-transaction
    return {"query_id": query.id, "status": QueryStatus.STOPPED.value}


def _make_check_stopped_fn(
    query: Query, preserve_pending: bool = False
) -> Callable[[], bool]:
    """Check stop intent, optionally preserving uncommitted success metadata."""

    def check_stopped() -> bool:
        # Finalization has dirty result metadata. Read status without flushing
        # stale state or discarding that metadata on an ordinary success path.
        with db.session.no_autoflush:
            db.session.refresh(
                query, attribute_names=["status"] if preserve_pending else None
            )
            stopped = query.status == QueryStatus.STOPPED or bool(
                query.extra.get(QUERY_EARLY_CANCEL_KEY)
            )
            if stopped and preserve_pending:
                # Discard pending success fields and reload the recorded stop
                # time before any subsequent commit can overwrite them.
                db.session.refresh(query)
        return stopped

    return check_stopped


def stop_seen_during_execution(query: Query) -> bool:
    """
    Whether the session's copy of the query held a stop when execution returned.

    Engines that cancel a running statement on a stop (Hive, Impala, Presto) do
    so after loading the stop into this session, as do the checks between
    statements. A stop the session never loaded was recorded after the
    statements finished. The row is not read again, and attributes expired by a
    commit count as unseen.
    """
    loaded = sa.inspect(query).dict
    if loaded.get("status") == QueryStatus.STOPPED:
        return True
    extra_json = loaded.get("extra_json")
    return bool(extra_json and json.loads(extra_json).get(QUERY_EARLY_CANCEL_KEY))


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
    on_commit: Callable[[], None] | None = None,
    on_results_key: Callable[[str], None] | None = None,
) -> dict[str, Any] | None:
    """
    Execute SQL statements and store results.

    :param on_commit: called once the target database commits a mutation or CTAS
    :param on_results_key: called with the key of results stored in the results
        backend, before any metadata read or write that can fail
    """
    if start_time:
        stats_logger = app.config["STATS_LOGGER"]
        stats_logger.timing("sqllab.query.time_pending", now_as_float() - start_time)

    query = _get_query(query_id=query_id)
    payload: dict[str, Any] = {"query_id": query_id}
    database = query.database
    db_engine_spec = database.db_engine_spec
    db_engine_spec.patch()
    check_stopped = _make_check_stopped_fn(query)

    logger.info("Query %s: Set query to 'running'", str(query_id))
    query.status = QueryStatus.RUNNING
    query.start_running_time = now_as_float()
    execution_start_time = now_as_float()
    db.session.commit()  # pylint: disable=consider-using-transaction

    # Parse original SQL (from user) to preserve before transformations
    original_script = SQLScript(query.sql, engine=db_engine_spec.engine)

    # Parse transformed SQL (with RLS, limits, etc.)
    parsed_script, blocks = _prepare_statement_blocks(
        rendered_query, db_engine_spec, database
    )
    # Whether the target database committed a mutation or CTAS.
    committed = False
    writes = parsed_script.has_mutation() or query.select_as_cta

    with database.get_raw_connection(
        catalog=query.catalog,
        schema=query.schema,
    ) as conn:
        cursor = conn.cursor()

        cancel_query_id = db_engine_spec.get_cancel_query_id(cursor, query)
        if cancel_query_id is not None:
            query.set_extra_json_key(QUERY_CANCEL_KEY, cancel_query_id)
            db.session.commit()  # pylint: disable=consider-using-transaction

        try:
            execution_results = execute_sql_with_cursor(
                database=database,
                cursor=cursor,
                statements=blocks,
                query=query,
                log_query_fn=_make_log_query_fn(database),
                check_stopped_fn=check_stopped,
                execute_fn=_make_execute_fn(query, db_engine_spec),
                # `blocks` is a single un-split block when the engine runs multiple
                # statements as one; otherwise each block is an individual statement.
                is_split=not db_engine_spec.run_multiple_statements_as_one,
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

        if writes and execution_results and db_engine_spec.is_autocommit(conn):
            # Each finished statement is already durable and ``conn.commit()``
            # cannot discard it. Only a stop seen while the statements ran,
            # which is when the engine cancels a running one, ends STOPPED; a
            # later stop lost the race to the committed work.
            stopped = stop_seen_during_execution(query)
        else:
            # Cancelling can clear cursor.description, leaving a nonempty
            # result list that looks like successful DML. Check intent, not
            # just results.
            stopped = not execution_results or check_stopped()

        # Commit for mutations
        if not stopped and writes:
            conn.commit()  # pylint: disable=consider-using-transaction
            committed = True
            if on_commit:
                on_commit()

    if stopped:
        return _stopped_query_payload(query)

    # A stop that lands from here on is caught after the results backend write
    # and by the guarded publish, so serialization does not re-read the row. A
    # committed mutation or CTAS is durable: a stop recorded after the
    # pre-commit check lost the race and must not mask the committed result.
    total_execution_time_ms = (now_as_float() - execution_start_time) * 1000
    _finalize_successful_query(
        query, original_script, execution_results, payload, total_execution_time_ms
    )

    if results_backend:
        _store_results_in_backend(
            query,
            payload,
            database,
            durable=committed,
            on_results_key=on_results_key,
        )

    return _publish_query_result(query, payload, durable=committed)


def _publish_query_result(
    query: Query, payload: dict[str, Any], durable: bool = False
) -> dict[str, Any]:
    """Publish terminal metadata only if no stop has won the finalization race."""
    if durable:
        # Committed effects outrank a stop recorded after the commit check.
        if query.status != QueryStatus.FAILED:
            query.status = QueryStatus.SUCCESS
        db.session.commit()  # pylint: disable=consider-using-transaction
        return payload

    # Serialization and backend writes can outlive the last execution check.
    # Read the stored key first: a stop reloads the row and drops it.
    stored_key = query.results_key
    if _make_check_stopped_fn(query, preserve_pending=True)():
        _discard_stored_results(query.id, stored_key)
        return _stopped_query_payload(query)

    if query.status != QueryStatus.FAILED:
        query.status = QueryStatus.SUCCESS
    if not _commit_query_unless_stopped(query):
        _discard_stored_results(query.id, stored_key)
        return _stopped_query_payload(query)

    return payload
