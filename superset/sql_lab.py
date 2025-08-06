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
import dataclasses
import logging
import sys
import uuid
from contextlib import closing
from datetime import datetime
from sys import getsizeof
from typing import Any, cast, Optional, TYPE_CHECKING, TypeVar, Union

import backoff
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
from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
from superset.dataframe import df_to_records
from superset.db_engine_specs import BaseEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetDisallowedSQLFunctionException,
    SupersetDMLNotAllowedException,
    SupersetErrorException,
    SupersetErrorsException,
    SupersetInvalidCTASException,
    SupersetInvalidCVASException,
    SupersetResultsBackendNotConfigureException,
)
from superset.extensions import celery_app, event_logger
from superset.models.sql_lab import Query
from superset.result_set import SupersetResultSet
from superset.sql.parse import BaseSQLStatement, CTASMethod, SQLScript, Table
from superset.sqllab.limiting_factor import LimitingFactor
from superset.sqllab.utils import write_ipc_buffer
from superset.utils import json
from superset.utils.core import (
    override_user,
    QuerySource,
    zlib_compress,
)
from superset.utils.dates import now_as_float
from superset.utils.decorators import stats_timing
from superset.utils.rls import apply_rls

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)
BYTES_IN_MB = 1024 * 1024


class SqlLabException(Exception):  # noqa: N818
    pass


class SqlLabSecurityException(SqlLabException):
    pass


class SqlLabQueryStoppedException(SqlLabException):
    pass


def handle_query_error(
    ex: Exception,
    query: Query,
    payload: Optional[dict[str, Any]] = None,
    prefix_message: str = "",
) -> dict[str, Any]:
    """Local method handling error while processing the SQL"""
    payload = payload or {}
    msg = f"{prefix_message} {str(ex)}".strip()
    query.error_message = msg
    query.tmp_table_name = None
    query.status = QueryStatus.FAILED
    # TODO: re-enable this after updating the frontend to properly display timeout status  # noqa: E501
    # if query.status != QueryStatus.TIMED_OUT:
    #   query.status = QueryStatus.FAILED
    if not query.end_time:
        query.end_time = now_as_float()

    # extract DB-specific errors (invalid column, eg)
    if isinstance(ex, SupersetErrorException):
        errors = [ex.error]
    elif isinstance(ex, SupersetErrorsException):
        errors = ex.errors
    else:
        errors = query.database.db_engine_spec.extract_errors(str(ex))

    errors_payload = [dataclasses.asdict(error) for error in errors]
    if errors:
        query.set_extra_json_key("errors", errors_payload)

    db.session.commit()
    payload.update({"status": query.status, "error": msg, "errors": errors_payload})
    if troubleshooting_link := app.config["TROUBLESHOOTING_LINK"]:
        payload["link"] = troubleshooting_link
    return payload


def get_query_backoff_handler(details: dict[Any, Any]) -> None:
    stats_logger = app.config["STATS_LOGGER"]
    query_id = details["kwargs"]["query_id"]
    logger.error(
        "Query with id `%s` could not be retrieved", str(query_id), exc_info=True
    )
    stats_logger.incr(f"error_attempting_orm_query_{details['tries'] - 1}")
    logger.error(
        "Query %s: Sleeping for a sec before retrying...", str(query_id), exc_info=True
    )


def get_query_giveup_handler(_: Any) -> None:
    stats_logger = app.config["STATS_LOGGER"]
    stats_logger.incr("error_failed_at_getting_orm_query")


@backoff.on_exception(
    backoff.constant,
    SqlLabException,
    interval=1,
    on_backoff=get_query_backoff_handler,
    on_giveup=get_query_giveup_handler,
    max_tries=5,
)
def get_query(query_id: int) -> Query:
    """attempts to get the query and retry if it cannot"""
    try:
        return db.session.query(Query).filter_by(id=query_id).one()
    except Exception as ex:
        raise SqlLabException("Failed at getting query") from ex


# Default timeouts from config.py:
# SQLLAB_TIMEOUT = 30 seconds
# SQLLAB_ASYNC_TIME_LIMIT_SEC = 6 hours
# SQLLAB_HARD_TIMEOUT = SQLLAB_ASYNC_TIME_LIMIT_SEC + 60
@celery_app.task(
    name="sql_lab.get_sql_results",
    time_limit=21660,  # 6 hours + 60 seconds
    soft_time_limit=21600,  # 6 hours
)
def get_sql_results(  # pylint: disable=too-many-arguments
    query_id: int,
    rendered_query: str,
    return_results: bool = True,
    store_results: bool = False,
    username: Optional[str] = None,
    start_time: Optional[float] = None,
    expand_data: bool = False,
    log_params: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, Any]]:
    """Executes the sql query returns the results."""
    with app.test_request_context():
        with override_user(security_manager.find_user(username)):
            try:
                return execute_sql_statements(
                    query_id,
                    rendered_query,
                    return_results,
                    store_results,
                    start_time=start_time,
                    expand_data=expand_data,
                    log_params=log_params,
                )
            except Exception as ex:  # pylint: disable=broad-except
                logger.debug("Query %d: %s", query_id, ex)
                stats_logger = app.config["STATS_LOGGER"]
                stats_logger.incr("error_sqllab_unhandled")
                query = get_query(query_id=query_id)
                return handle_query_error(ex, query)


S = TypeVar("S", bound=BaseSQLStatement[Any])


def apply_ctas(query: Query, parsed_statement: S) -> S:
    """
    Apply CTAS/CVAS.
    """
    if not query.tmp_table_name:
        start_dttm = datetime.fromtimestamp(query.start_time)
        prefix = f"tmp_{query.user_id}_table"
        query.tmp_table_name = start_dttm.strftime(f"{prefix}_%Y_%m_%d_%H_%M_%S")

    catalog = (
        query.catalog
        if query.database.db_engine_spec.supports_cross_catalog_queries
        else None
    )
    table = Table(query.tmp_table_name, query.tmp_schema_name, catalog)
    method = CTASMethod[query.ctas_method.upper()]

    return parsed_statement.as_create_table(table, method)  # type: ignore[return-value]


def apply_limit(query: Query, parsed_statement: BaseSQLStatement[Any]) -> None:
    """
    Apply limit to the SQL statement.
    """
    sqllab_ctas_no_limit = app.config["SQLLAB_CTAS_NO_LIMIT"]
    sql_max_row = app.config["SQL_MAX_ROW"]

    # Do not apply limit to the CTA queries when SQLLAB_CTAS_NO_LIMIT is set to true
    if parsed_statement.is_mutating() or (
        query.select_as_cta_used and sqllab_ctas_no_limit
    ):
        return

    if sql_max_row and (not query.limit or query.limit > sql_max_row):
        query.limit = sql_max_row

    if query.limit:
        parsed_statement.set_limit_value(
            # fetch an extra row to inform user if there are more rows
            query.limit + 1,
            query.database.db_engine_spec.limit_method,
        )


def execute_query(  # pylint: disable=too-many-statements, too-many-locals  # noqa: C901
    query: Query,
    cursor: Any,
    log_params: Optional[dict[str, Any]] = None,
) -> SupersetResultSet:
    """Executes a single SQL statement"""
    database: Database = query.database
    db_engine_spec = database.db_engine_spec

    try:
        log_query = app.config["QUERY_LOGGER"]
        if log_query:
            log_query(
                query.database.sqlalchemy_uri,
                query.executed_sql,
                query.schema,
                __name__,
                security_manager,
                log_params,
            )
        db.session.commit()
        with event_logger.log_context(
            action="execute_sql",
            database=database,
            object_ref=__name__,
        ):
            stats_logger = app.config["STATS_LOGGER"]
            with stats_timing("sqllab.query.time_executing_query", stats_logger):
                db_engine_spec.execute_with_cursor(cursor, query.executed_sql, query)

            with stats_timing("sqllab.query.time_fetching_results", stats_logger):
                logger.debug(
                    "Query %d: Fetching data for query object: %s",
                    query.id,
                    str(query.to_dict()),
                )
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
        # user needs to authenticate with OAuth2 in order to run query
        raise
    except Exception as ex:
        # query is stopped in another thread/worker
        # stopping raises expected exceptions which we should skip
        db.session.refresh(query)
        if query.status == QueryStatus.STOPPED:
            raise SqlLabQueryStoppedException() from ex

        logger.debug("Query %d: %s", query.id, ex)
        raise SqlLabException(db_engine_spec.extract_error_message(ex)) from ex

    logger.debug("Query %d: Fetching cursor description", query.id)
    cursor_description = cursor.description
    return SupersetResultSet(data, cursor_description, db_engine_spec)


def _serialize_payload(
    payload: dict[Any, Any], use_msgpack: Optional[bool] = False
) -> Union[bytes, str]:
    logger.debug("Serializing to msgpack: %r", use_msgpack)
    if use_msgpack:
        return msgpack.dumps(payload, default=json.json_iso_dttm_ser, use_bin_type=True)

    return json.dumps(payload, default=json.json_iso_dttm_ser, ignore_nan=True)


def _serialize_and_expand_data(
    result_set: SupersetResultSet,
    db_engine_spec: BaseEngineSpec,
    use_msgpack: Optional[bool] = False,
    expand_data: bool = False,
) -> tuple[Union[bytes, str], list[Any], list[Any], list[Any]]:
    selected_columns = result_set.columns
    all_columns: list[Any]
    expanded_columns: list[Any]

    if use_msgpack:
        if has_app_context():
            stats_logger = app.config["STATS_LOGGER"]
            with stats_timing(
                "sqllab.query.results_backend_pa_serialization", stats_logger
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


def execute_sql_statements(  # noqa: C901
    # pylint: disable=too-many-arguments, too-many-locals, too-many-statements, too-many-branches
    query_id: int,
    rendered_query: str,
    return_results: bool,
    store_results: bool,
    start_time: Optional[float],
    expand_data: bool,
    log_params: Optional[dict[str, Any]],
) -> Optional[dict[str, Any]]:
    """Executes the sql query returns the results."""
    if store_results and start_time:
        # only asynchronous queries
        stats_logger = app.config["STATS_LOGGER"]
        stats_logger.timing("sqllab.query.time_pending", now_as_float() - start_time)

    query = get_query(query_id=query_id)
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
        db_engine_spec.engine,
        set(),
    )
    if disallowed_functions and parsed_script.check_functions_present(
        disallowed_functions
    ):
        raise SupersetDisallowedSQLFunctionException(disallowed_functions)

    if parsed_script.has_mutation() and not database.allow_dml:
        raise SupersetDMLNotAllowedException()

    if is_feature_enabled("RLS_IN_SQLLAB"):
        default_schema = query.database.get_default_schema_for_query(query)
        for statement in parsed_script.statements:
            apply_rls(query.database, query.catalog, default_schema, statement)

    if query.select_as_cta:
        # CTAS is valid when the last statement is a SELECT, while CVAS is valid when
        # there is only a single statement which must be a SELECT.
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
            query,
            parsed_script.statements[-1],
        )
        query.select_as_cta_used = True

    for statement in parsed_script.statements:
        apply_limit(query, statement)

    # some databases (like BigQuery and Kusto) do not persist state across mmultiple
    # statements if they're run separately (especially when using `NullPool`), so we run
    # the query as a single block.
    if db_engine_spec.run_multiple_statements_as_one:
        blocks = [parsed_script.format(comments=db_engine_spec.allows_sql_comments)]
    else:
        blocks = [
            statement.format(comments=db_engine_spec.allows_sql_comments)
            for statement in parsed_script.statements
        ]

    with database.get_raw_connection(
        catalog=query.catalog,
        schema=query.schema,
        source=QuerySource.SQL_LAB,
    ) as conn:
        # Sharing a single connection and cursor across the
        # execution of all statements (if many)
        cursor = conn.cursor()

        cancel_query_id = db_engine_spec.get_cancel_query_id(cursor, query)
        if cancel_query_id is not None:
            query.set_extra_json_key(QUERY_CANCEL_KEY, cancel_query_id)
            db.session.commit()

        block_count = len(blocks)
        for i, block in enumerate(blocks):
            # Check if stopped
            db.session.refresh(query)
            if query.status == QueryStatus.STOPPED:
                payload.update({"status": query.status})
                return payload

            # Run statement
            msg = __(
                "Running block %(block_num)s out of %(block_count)s",
                block_num=i + 1,
                block_count=block_count,
            )
            logger.info("Query %s: %s", str(query_id), msg)
            query.set_extra_json_key("progress", msg)
            db.session.commit()

            # Hook to allow environment-specific mutation (usually comments) to the SQL
            query.executed_sql = database.mutate_sql_based_on_config(block)

            try:
                result_set = execute_query(query, cursor, log_params)
            except SqlLabQueryStoppedException:
                payload.update({"status": QueryStatus.STOPPED})
                return payload
            except Exception as ex:  # pylint: disable=broad-except
                msg = str(ex)
                prefix_message = (
                    __(
                        "Block %(block_num)s out of %(block_count)s",
                        block_num=i + 1,
                        block_count=block_count,
                    )
                    if block_count > 1
                    else ""
                )
                payload = handle_query_error(ex, query, payload, prefix_message)
                return payload

        # Commit the connection so CTA queries will create the table and any DML.
        if parsed_script.has_mutation() or query.select_as_cta:
            conn.commit()

    # Success, updating the query entry in database
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

    # TODO: data should be saved separately from metadata (likely in Parquet)
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
        key = str(uuid.uuid4())
        payload["query"]["resultsKey"] = key
        logger.info(
            "Query %s: Storing results in results backend, key: %s", str(query_id), key
        )
        stats_logger = app.config["STATS_LOGGER"]
        with stats_timing("sqllab.query.results_backend_write", stats_logger):
            with stats_timing(
                "sqllab.query.results_backend_write_serialization", stats_logger
            ):
                serialized_payload = _serialize_payload(
                    payload, cast(bool, results_backend_use_msgpack)
                )

                # Check the size of the serialized payload
                if sql_lab_payload_max_mb := app.config.get("SQLLAB_PAYLOAD_MAX_MB"):
                    serialized_payload_size = sys.getsizeof(serialized_payload)
                    max_bytes = sql_lab_payload_max_mb * BYTES_IN_MB

                    if serialized_payload_size > max_bytes:
                        logger.info("Result size exceeds the allowed limit.")
                        raise SupersetErrorException(
                            SupersetError(
                                message=f"Result size ({serialized_payload_size / BYTES_IN_MB:.2f} MB) exceeds the allowed limit of {sql_lab_payload_max_mb} MB.",  # noqa: E501
                                error_type=SupersetErrorType.RESULT_TOO_LARGE_ERROR,
                                level=ErrorLevel.ERROR,
                            )
                        )

            cache_timeout = database.cache_timeout
            if cache_timeout is None:
                cache_timeout = app.config["CACHE_DEFAULT_TIMEOUT"]

            compressed = zlib_compress(serialized_payload)
            logger.debug(
                "*** serialized payload size: %i", getsizeof(serialized_payload)
            )
            logger.debug("*** compressed payload size: %i", getsizeof(compressed))
            results_backend.set(key, compressed, cache_timeout)
        query.results_key = key

    query.status = QueryStatus.SUCCESS
    db.session.commit()

    if return_results:
        # since we're returning results we need to create non-arrow data
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
        # Check the size of the serialized payload (opt-in logic for return_results)
        if sql_lab_payload_max_mb := app.config.get("SQLLAB_PAYLOAD_MAX_MB"):
            serialized_payload = _serialize_payload(
                payload, cast(bool, results_backend_use_msgpack)
            )
            serialized_payload_size = sys.getsizeof(serialized_payload)
            max_bytes = sql_lab_payload_max_mb * BYTES_IN_MB

            if serialized_payload_size > max_bytes:
                logger.info("Result size exceeds the allowed limit.")
                raise SupersetErrorException(
                    SupersetError(
                        message=f"Result size ({serialized_payload_size / BYTES_IN_MB:.2f} MB) exceeds the allowed limit of {sql_lab_payload_max_mb} MB.",  # noqa: E501
                        error_type=SupersetErrorType.RESULT_TOO_LARGE_ERROR,
                        level=ErrorLevel.ERROR,
                    )
                )
        return payload

    return None


def cancel_query(query: Query) -> bool:
    """
    Cancel a running query.

    Note some engines implicitly handle the cancelation of a query and thus no explicit
    action is required.

    :param query: Query to cancel
    :return: True if query cancelled successfully, False otherwise
    """

    if query.database.db_engine_spec.has_implicit_cancel():
        return True

    # Some databases may need to make preparations for query cancellation
    query.database.db_engine_spec.prepare_cancel_query(query)

    if query.extra.get(QUERY_EARLY_CANCEL_KEY):
        # Query has been cancelled prior to being able to set the cancel key.
        # This can happen if the query cancellation key can only be acquired after the
        # query has been executed
        return True

    cancel_query_id = query.extra.get(QUERY_CANCEL_KEY)
    if cancel_query_id is None:
        return False

    with query.database.get_sqla_engine(
        catalog=query.catalog,
        schema=query.schema,
        source=QuerySource.SQL_LAB,
    ) as engine:
        with closing(engine.raw_connection()) as conn:
            with closing(conn.cursor()) as cursor:
                return query.database.db_engine_spec.cancel_query(
                    cursor, query, cancel_query_id
                )
