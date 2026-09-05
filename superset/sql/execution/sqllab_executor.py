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
# pylint: disable=consider-using-transaction
"""
Internal SQL-Lab-oriented execution entry for the unified execution feature.

This is the SQL-Lab-complete counterpart to the general, records-oriented
``SQLExecutor.execute()``: it executes a SQL Lab ``Query`` row (multi-statement,
one shared cursor) with the full SQL Lab feature set — CTAS/CVAS, ``LimitingFactor``
bookkeeping, ``expand_data`` nested-column expansion, and Arrow→results-backend
persistence — reusing the shared statement primitives (``apply_ctas`` /
``apply_limit`` / ``build_statement_blocks``).

It is added additively: the classic ``superset.sql_lab.execute_sql_statements``
path is left untouched for now. A later change points the SQL Lab ``/execute/``
endpoint and the GTF SQL task at this entry and retires the classic path.

Unlike ``execute_sql_statements`` this entry takes an already-loaded ``Query``
(the caller — the ``/execute/`` command or the GTF task body — owns loading it and
mirroring its terminal status), keeping this focused on execution.
"""

from __future__ import annotations

import logging
import sys
import uuid
from typing import Any, cast, Optional, TYPE_CHECKING, Union

import msgpack
from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app as app, has_app_context
from flask_babel import gettext as __

from superset import (
    db,
    is_feature_enabled,
    results_backend,
    results_backend_use_msgpack,
    security_manager,
)
from superset.common.db_query_status import QueryStatus
from superset.constants import QUERY_CANCEL_KEY
from superset.dataframe import df_to_records
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetDisallowedSQLFunctionException,
    SupersetDisallowedSQLTableException,
    SupersetDMLNotAllowedException,
    SupersetErrorException,
    SupersetInvalidCTASException,
    SupersetInvalidCVASException,
    SupersetResultsBackendNotConfigureException,
)
from superset.extensions import event_logger
from superset.result_set import SupersetResultSet
from superset.sql.execution.executor import (
    apply_ctas,
    apply_limit,
    build_statement_blocks,
)
from superset.sql.parse import CTASMethod, SQLScript, Table
from superset.sqllab.limiting_factor import LimitingFactor
from superset.sqllab.utils import write_ipc_buffer
from superset.utils import json
from superset.utils.core import QuerySource, zlib_compress
from superset.utils.database import warm_and_release_connection
from superset.utils.dates import now_as_float
from superset.utils.decorators import stats_timing
from superset.utils.rls import apply_rls

if TYPE_CHECKING:
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.models.core import Database
    from superset.models.sql_lab import Query

logger = logging.getLogger(__name__)

BYTES_IN_MB = 1024 * 1024


def _execute_statement(
    query: Query,
    cursor: Any,
    log_params: Optional[dict[str, Any]] = None,
) -> SupersetResultSet:
    """Execute a single SQL statement on the shared cursor and fetch its result.

    Mirrors the classic ``sql_lab.execute_query``: logs the query, eagerly reloads
    the ORM row so a lazy-load can't open an idle metadata connection for the query
    duration, executes via the engine spec, applies the ``LimitingFactor`` +1
    "more rows" probe, and maps a soft-timeout / cooperative stop to the SQL Lab
    exceptions.
    """
    # Imported from the classic module so both paths raise/​catch the same types
    # while the classic path still exists (relocated when it is retired).
    from superset.sql_lab import SqlLabException, SqlLabQueryStoppedException

    database: Database = query.database
    db_engine_spec = database.db_engine_spec

    try:
        if log_query := app.config["QUERY_LOGGER"]:
            log_query(
                query.database.sqlalchemy_uri,
                query.executed_sql,
                query.schema,
                __name__,
                security_manager,
                log_params,
            )
        db.session.commit()
        # Eagerly reload query attributes so no lazy-load triggers a new metadata
        # DB connection during the (potentially long) cursor execution.
        db.session.refresh(query)
        warm_and_release_connection(query, "database")
        with event_logger.log_context(
            action="execute_sql",
            database=database,
            object_ref=__name__,
        ):
            stats_logger = app.config["STATS_LOGGER"]
            with stats_timing("sqllab.query.time_executing_query", stats_logger):
                db_engine_spec.execute_with_cursor(cursor, query.executed_sql, query)

            with stats_timing("sqllab.query.time_fetching_results", stats_logger):
                increased_limit = None if query.limit is None else query.limit + 1
                data = db_engine_spec.fetch_data(cursor, increased_limit)
                if query.limit is None or len(data) <= query.limit:
                    query.limiting_factor = LimitingFactor.NOT_LIMITED
                else:
                    # return 1 row less than increased_query
                    data = data[:-1]
    except SoftTimeLimitExceeded as ex:
        query.status = QueryStatus.TIMED_OUT
        logger.warning("Query %d: Time limit exceeded", query.id)
        logger.debug("Query %d: %s", query.id, ex)
        raise SupersetErrorException(
            SupersetError(
                message=__(
                    "The query was killed after %(sqllab_timeout)s seconds. It might "
                    "be too complex, or the database might be under heavy load.",
                    sqllab_timeout=app.config["SQLLAB_ASYNC_TIME_LIMIT_SEC"],
                ),
                error_type=SupersetErrorType.SQLLAB_TIMEOUT_ERROR,
                level=ErrorLevel.ERROR,
            )
        ) from ex
    except OAuth2RedirectError:
        raise
    except Exception as ex:
        # A cooperative stop (status set STOPPED out-of-band) surfaces as an
        # engine error on the killed session; reinterpret it as a clean stop.
        db.session.refresh(query)
        if query.status == QueryStatus.STOPPED:
            raise SqlLabQueryStoppedException() from ex
        logger.debug("Query %d: %s", query.id, ex)
        raise SqlLabException(db_engine_spec.extract_error_message(ex)) from ex

    return SupersetResultSet(data, cursor.description, db_engine_spec)


def _serialize_payload(
    payload: dict[Any, Any], use_msgpack: Optional[bool] = False
) -> Union[bytes, str]:
    if use_msgpack:
        return msgpack.dumps(payload, default=json.json_iso_dttm_ser, use_bin_type=True)
    return json.dumps(payload, default=json.json_iso_dttm_ser, ignore_nan=True)


def _serialize_and_expand_data(
    result_set: SupersetResultSet,
    db_engine_spec: type[BaseEngineSpec],
    use_msgpack: Optional[bool] = False,
    expand_data: bool = False,
) -> tuple[Union[bytes, str], list[Any], list[Any], list[Any]]:
    selected_columns = result_set.columns
    all_columns: list[Any]
    expanded_columns: list[Any]

    if use_msgpack:
        if has_app_context():
            with stats_timing(
                "sqllab.query.results_backend_pa_serialization",
                app.config["STATS_LOGGER"],
            ):
                data = write_ipc_buffer(result_set.pa_table).to_pybytes()
        else:
            # No app context, skip stats timing
            data = write_ipc_buffer(result_set.pa_table).to_pybytes()
        # expand when loading data from results backend
        all_columns, expanded_columns = (selected_columns, [])
    else:
        df = result_set.to_pandas_df()
        data = df_to_records(df) or []
        if expand_data:
            all_columns, data, expanded_columns = db_engine_spec.expand_data(
                selected_columns, data
            )
        else:
            all_columns = selected_columns
            expanded_columns = []

    return (data, selected_columns, all_columns, expanded_columns)


def _store_results_in_backend(
    query: Query,
    payload: dict[str, Any],
    query_id: int,
) -> None:
    """Serialize the payload and persist it to the results backend.

    Sets ``query.results_key`` on success; on a backend write failure clears it
    and (for async, non-inline queries) fails the query, matching the classic
    ``execute_sql_statements`` behavior so ``/sqllab/results`` never 410s.
    """
    key = str(uuid.uuid4())
    payload["query"]["resultsKey"] = key
    logger.info("Query %s: Storing results in results backend, key: %s", query_id, key)
    stats_logger = app.config["STATS_LOGGER"]
    with stats_timing("sqllab.query.results_backend_write", stats_logger):
        with stats_timing(
            "sqllab.query.results_backend_write_serialization", stats_logger
        ):
            serialized_payload = _serialize_payload(
                payload, cast(bool, results_backend_use_msgpack)
            )
            _check_payload_size(serialized_payload)

        cache_timeout = query.database.cache_timeout
        if cache_timeout is None:
            cache_timeout = app.config["CACHE_DEFAULT_TIMEOUT"]

        compressed = zlib_compress(serialized_payload)
        write_success = results_backend.set(key, compressed, cache_timeout)
        if not write_success:
            logger.error(
                "Query %s: Failed to store results in backend, key: %s", query_id, key
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
        query.results_key = key
        logger.info(
            "Query %s: Successfully stored results in backend, key: %s", query_id, key
        )


def _check_payload_size(serialized_payload: Union[bytes, str]) -> None:
    """Raise if the serialized payload exceeds ``SQLLAB_PAYLOAD_MAX_MB``."""
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
                        f"exceeds the allowed limit of {sql_lab_payload_max_mb} MB."
                    ),
                    error_type=SupersetErrorType.RESULT_TOO_LARGE_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )


def execute_sql_lab_query(  # noqa: C901
    # pylint: disable=too-many-arguments, too-many-locals, too-many-branches, too-many-statements
    query: Query,
    rendered_query: str,
    *,
    return_results: bool,
    store_results: bool,
    expand_data: bool = False,
    start_time: Optional[float] = None,
    log_params: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, Any]]:
    """Execute a SQL Lab ``Query`` (multi-statement) and return its payload.

    The SQL-Lab-complete execution entry: applies the SQL Lab controls
    (disallowed functions/tables, DML gate, RLS, CTAS/CVAS rewrite, per-statement
    limit), runs the statements over one shared cursor, then serializes and
    (optionally) persists the result to the results backend.

    The caller owns loading ``query`` and mirroring its terminal status. A
    cooperative stop returns a ``STOPPED`` payload; execution errors propagate as
    exceptions for the caller (the ``/execute/`` command or the GTF task) to
    handle — this entry does not build a FAILED error payload itself.
    """
    if store_results and start_time:
        app.config["STATS_LOGGER"].timing(
            "sqllab.query.time_pending", now_as_float() - start_time
        )

    from superset.sql_lab import SqlLabQueryStoppedException

    query_id = query.id
    payload: dict[str, Any] = {"query_id": query_id}
    database = query.database
    db_engine_spec = database.db_engine_spec
    db_engine_spec.patch()

    if database.allow_run_async and not results_backend:
        raise SupersetResultsBackendNotConfigureException()

    logger.info("Query %s: Set query to 'running'", str(query_id))
    query.status = QueryStatus.RUNNING
    query.start_running_time = now_as_float()
    db.session.commit()

    parsed_script = SQLScript(rendered_query, engine=db_engine_spec.engine)

    disallowed_functions = app.config["DISALLOWED_SQL_FUNCTIONS"].get(
        db_engine_spec.engine, set()
    )
    if disallowed_functions and parsed_script.check_functions_present(
        disallowed_functions
    ):
        raise SupersetDisallowedSQLFunctionException(disallowed_functions)

    disallowed_tables = app.config["DISALLOWED_SQL_TABLES"].get(
        db_engine_spec.engine, set()
    )
    rls_enabled = is_feature_enabled("RLS_IN_SQLLAB")

    # Resolve the effective per-query schema once, through the query-aware
    # ``get_default_schema_for_query``, and share it between the denylist check and
    # RLS injection so both match the schema the engine uses at runtime.
    effective_schema = ""
    if disallowed_tables or rls_enabled:
        effective_schema = database.get_default_schema_for_query(query)

    if disallowed_tables:
        if found_tables := parsed_script.get_disallowed_tables(
            disallowed_tables, effective_schema
        ):
            raise SupersetDisallowedSQLTableException(found_tables)

    if parsed_script.has_mutation() and not database.allow_dml:
        raise SupersetDMLNotAllowedException()

    if rls_enabled:
        for statement in parsed_script.statements:
            apply_rls(query.database, query.catalog, effective_schema, statement)

    if query.select_as_cta:
        # CTAS is valid when the last statement is a SELECT; CVAS requires a single
        # SELECT statement.
        if (
            query.ctas_method == CTASMethod.TABLE.name
            and not parsed_script.is_valid_ctas()
        ):
            raise SupersetInvalidCTASException()
        if (
            query.ctas_method == CTASMethod.VIEW.name
            and not parsed_script.is_valid_cvas()
        ):
            raise SupersetInvalidCVASException()
        parsed_script.statements[-1] = apply_ctas(  # type: ignore
            query, parsed_script.statements[-1]
        )
        query.select_as_cta_used = True

    for statement in parsed_script.statements:
        apply_limit(query, statement)

    # Apply SQL_QUERY_MUTATOR per MUTATE_AFTER_SPLIT (shared with the other paths).
    parsed_script, blocks = build_statement_blocks(
        parsed_script, db_engine_spec, database
    )

    with database.get_raw_connection(
        catalog=query.catalog,
        schema=query.schema,
        source=QuerySource.SQL_LAB,
    ) as conn:
        # One shared connection and cursor across all statements.
        cursor = conn.cursor()

        cancel_query_id = db_engine_spec.get_cancel_query_id(cursor, query)
        if cancel_query_id is not None:
            query.set_extra_json_key(QUERY_CANCEL_KEY, cancel_query_id)
            db.session.commit()

        block_count = len(blocks)
        for i, block in enumerate(blocks):
            # Cooperative stop between blocks (kept for now; GTF abort is added
            # when this entry is driven by the GTF SQL task).
            db.session.refresh(query)
            if query.status == QueryStatus.STOPPED:
                payload.update({"status": query.status})
                return payload

            msg = __(
                "Running block %(block_num)s out of %(block_count)s",
                block_num=i + 1,
                block_count=block_count,
            )
            logger.info("Query %s: %s", str(query_id), msg)
            query.set_extra_json_key("progress", msg)
            db.session.commit()

            query.executed_sql = database.mutate_sql_based_on_config(
                block,
                is_split=not db_engine_spec.run_multiple_statements_as_one,
            )

            try:
                result_set = _execute_statement(query, cursor, log_params)
            except SqlLabQueryStoppedException:
                payload.update({"status": QueryStatus.STOPPED})
                return payload

        # Commit so CTAS queries create the table and any DML persists.
        if parsed_script.has_mutation() or query.select_as_cta:
            conn.commit()

    # Success: update the query row.
    query.rows = result_set.size
    query.progress = 100
    query.set_extra_json_key("progress", None)
    query.set_extra_json_key("columns", result_set.columns)
    if query.select_as_cta:
        query.select_sql = database.select_star(
            Table(query.tmp_table_name, query.tmp_schema_name),
            limit=query.limit,
            show_cols=False,
            latest_partition=False,
        )
    query.end_time = now_as_float()

    use_arrow_data = store_results and cast(bool, results_backend_use_msgpack)
    data, selected_columns, all_columns, expanded_columns = _serialize_and_expand_data(
        result_set, db_engine_spec, use_arrow_data, expand_data
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

    if store_results and results_backend:
        _store_results_in_backend(query, payload, query_id)

    if query.status != QueryStatus.FAILED:
        query.status = QueryStatus.SUCCESS
    db.session.commit()

    if return_results:
        # Re-serialize inline (non-arrow) data for the synchronous response.
        if use_arrow_data:
            (
                data,
                selected_columns,
                all_columns,
                expanded_columns,
            ) = _serialize_and_expand_data(
                result_set, db_engine_spec, False, expand_data
            )
            payload.update(
                {
                    "data": data,
                    "columns": all_columns,
                    "selected_columns": selected_columns,
                    "expanded_columns": expanded_columns,
                }
            )
        _check_payload_size(
            _serialize_payload(payload, cast(bool, results_backend_use_msgpack))
        )
        return payload

    return None
