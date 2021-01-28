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
import logging
import uuid
from contextlib import closing
from datetime import datetime
from sys import getsizeof
from typing import Any, cast, Dict, List, Optional, Tuple, Union

import backoff
import msgpack
import pyarrow as pa
import simplejson as json
from celery.exceptions import SoftTimeLimitExceeded
from celery.task.base import Task
from flask_babel import lazy_gettext as _
from sqlalchemy.orm import Session
from werkzeug.local import LocalProxy

from superset import app, results_backend, results_backend_use_msgpack, security_manager
from superset.dataframe import df_to_records
from superset.db_engine_specs import BaseEngineSpec
from superset.extensions import celery_app
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.result_set import SupersetResultSet
from superset.sql_parse import CtasMethod, ParsedQuery
from superset.utils.celery import session_scope
from superset.utils.core import (
    json_iso_dttm_ser,
    QuerySource,
    QueryStatus,
    zlib_compress,
)
from superset.utils.dates import now_as_float
from superset.utils.decorators import stats_timing


# pylint: disable=unused-argument, redefined-outer-name
def dummy_sql_query_mutator(
    sql: str,
    user_name: Optional[str],
    security_manager: LocalProxy,
    database: Database,
) -> str:
    """A no-op version of SQL_QUERY_MUTATOR"""
    return sql


config = app.config
stats_logger = config["STATS_LOGGER"]
SQLLAB_TIMEOUT = config["SQLLAB_ASYNC_TIME_LIMIT_SEC"]
SQLLAB_HARD_TIMEOUT = SQLLAB_TIMEOUT + 60
SQL_MAX_ROW = config["SQL_MAX_ROW"]
SQLLAB_CTAS_NO_LIMIT = config["SQLLAB_CTAS_NO_LIMIT"]
SQL_QUERY_MUTATOR = config.get("SQL_QUERY_MUTATOR") or dummy_sql_query_mutator
log_query = config["QUERY_LOGGER"]
logger = logging.getLogger(__name__)


class SqlLabException(Exception):
    pass


class SqlLabSecurityException(SqlLabException):
    pass


class SqlLabTimeoutException(SqlLabException):
    pass


def handle_query_error(
    msg: str, query: Query, session: Session, payload: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Local method handling error while processing the SQL"""
    payload = payload or {}
    troubleshooting_link = config["TROUBLESHOOTING_LINK"]
    query.error_message = msg
    query.status = QueryStatus.FAILED
    query.tmp_table_name = None
    session.commit()
    payload.update({"status": query.status, "error": msg})
    if troubleshooting_link:
        payload["link"] = troubleshooting_link
    return payload


def get_query_backoff_handler(details: Dict[Any, Any]) -> None:
    query_id = details["kwargs"]["query_id"]
    logger.error("Query with id `%s` could not be retrieved", str(query_id))
    stats_logger.incr("error_attempting_orm_query_{}".format(details["tries"] - 1))
    logger.error("Query %s: Sleeping for a sec before retrying...", str(query_id))


def get_query_giveup_handler(_: Any) -> None:
    stats_logger.incr("error_failed_at_getting_orm_query")


@backoff.on_exception(
    backoff.constant,
    SqlLabException,
    interval=1,
    on_backoff=get_query_backoff_handler,
    on_giveup=get_query_giveup_handler,
    max_tries=5,
)
def get_query(query_id: int, session: Session) -> Query:
    """attempts to get the query and retry if it cannot"""
    try:
        return session.query(Query).filter_by(id=query_id).one()
    except Exception:
        raise SqlLabException("Failed at getting query")


@celery_app.task(
    name="sql_lab.get_sql_results",
    bind=True,
    time_limit=SQLLAB_HARD_TIMEOUT,
    soft_time_limit=SQLLAB_TIMEOUT,
)
def get_sql_results(  # pylint: disable=too-many-arguments
    ctask: Task,
    query_id: int,
    rendered_query: str,
    return_results: bool = True,
    store_results: bool = False,
    user_name: Optional[str] = None,
    start_time: Optional[float] = None,
    expand_data: bool = False,
    log_params: Optional[Dict[str, Any]] = None,
) -> Optional[Dict[str, Any]]:
    """Executes the sql query returns the results."""
    with session_scope(not ctask.request.called_directly) as session:

        try:
            return execute_sql_statements(
                query_id,
                rendered_query,
                return_results,
                store_results,
                user_name,
                session=session,
                start_time=start_time,
                expand_data=expand_data,
                log_params=log_params,
            )
        except Exception as ex:  # pylint: disable=broad-except
            logger.debug("Query %d: %s", query_id, ex)
            stats_logger.incr("error_sqllab_unhandled")
            query = get_query(query_id, session)
            return handle_query_error(str(ex), query, session)


# pylint: disable=too-many-arguments
def execute_sql_statement(
    sql_statement: str,
    query: Query,
    user_name: Optional[str],
    session: Session,
    cursor: Any,
    log_params: Optional[Dict[str, Any]],
    apply_ctas: bool = False,
) -> SupersetResultSet:
    """Executes a single SQL statement"""
    database = query.database
    db_engine_spec = database.db_engine_spec
    parsed_query = ParsedQuery(sql_statement)
    sql = parsed_query.stripped()

    if not db_engine_spec.is_readonly_query(parsed_query) and not database.allow_dml:
        raise SqlLabSecurityException(
            _("Only `SELECT` statements are allowed against this database")
        )
    if apply_ctas:
        if not query.tmp_table_name:
            start_dttm = datetime.fromtimestamp(query.start_time)
            query.tmp_table_name = "tmp_{}_table_{}".format(
                query.user_id, start_dttm.strftime("%Y_%m_%d_%H_%M_%S")
            )
        sql = parsed_query.as_create_table(
            query.tmp_table_name,
            schema_name=query.tmp_schema_name,
            method=query.ctas_method,
        )
        query.select_as_cta_used = True

    # Do not apply limit to the CTA queries when SQLLAB_CTAS_NO_LIMIT is set to true
    if parsed_query.is_select() and not (
        query.select_as_cta_used and SQLLAB_CTAS_NO_LIMIT
    ):
        if SQL_MAX_ROW and (not query.limit or query.limit > SQL_MAX_ROW):
            query.limit = SQL_MAX_ROW
        if query.limit:
            sql = database.apply_limit_to_sql(sql, query.limit)

    # Hook to allow environment-specific mutation (usually comments) to the SQL
    sql = SQL_QUERY_MUTATOR(sql, user_name, security_manager, database)

    try:
        if log_query:
            log_query(
                query.database.sqlalchemy_uri,
                query.executed_sql,
                query.schema,
                user_name,
                __name__,
                security_manager,
                log_params,
            )
        query.executed_sql = sql
        session.commit()
        with stats_timing("sqllab.query.time_executing_query", stats_logger):
            logger.debug("Query %d: Running query: %s", query.id, sql)
            db_engine_spec.execute(cursor, sql, async_=True)
            logger.debug("Query %d: Handling cursor", query.id)
            db_engine_spec.handle_cursor(cursor, query, session)

        with stats_timing("sqllab.query.time_fetching_results", stats_logger):
            logger.debug(
                "Query %d: Fetching data for query object: %s",
                query.id,
                str(query.to_dict()),
            )
            data = db_engine_spec.fetch_data(cursor, query.limit)

    except SoftTimeLimitExceeded as ex:
        logger.error("Query %d: Time limit exceeded", query.id)
        logger.debug("Query %d: %s", query.id, ex)
        raise SqlLabTimeoutException(
            "SQL Lab timeout. This environment's policy is to kill queries "
            "after {} seconds.".format(SQLLAB_TIMEOUT)
        )
    except Exception as ex:
        logger.error("Query %d: %s", query.id, type(ex))
        logger.debug("Query %d: %s", query.id, ex)
        raise SqlLabException(db_engine_spec.extract_error_message(ex))

    logger.debug("Query %d: Fetching cursor description", query.id)
    cursor_description = cursor.description
    return SupersetResultSet(data, cursor_description, db_engine_spec)


def _serialize_payload(
    payload: Dict[Any, Any], use_msgpack: Optional[bool] = False
) -> Union[bytes, str]:
    logger.debug("Serializing to msgpack: %r", use_msgpack)
    if use_msgpack:
        return msgpack.dumps(payload, default=json_iso_dttm_ser, use_bin_type=True)

    return json.dumps(payload, default=json_iso_dttm_ser, ignore_nan=True)


def _serialize_and_expand_data(
    result_set: SupersetResultSet,
    db_engine_spec: BaseEngineSpec,
    use_msgpack: Optional[bool] = False,
    expand_data: bool = False,
) -> Tuple[Union[bytes, str], List[Any], List[Any], List[Any]]:
    selected_columns = result_set.columns
    all_columns: List[Any]
    expanded_columns: List[Any]

    if use_msgpack:
        with stats_timing(
            "sqllab.query.results_backend_pa_serialization", stats_logger
        ):
            data = (
                pa.default_serialization_context()
                .serialize(result_set.pa_table)
                .to_buffer()
                .to_pybytes()
            )

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


def execute_sql_statements(  # pylint: disable=too-many-arguments, too-many-locals, too-many-statements, too-many-branches
    query_id: int,
    rendered_query: str,
    return_results: bool,
    store_results: bool,
    user_name: Optional[str],
    session: Session,
    start_time: Optional[float],
    expand_data: bool,
    log_params: Optional[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """Executes the sql query returns the results."""
    if store_results and start_time:
        # only asynchronous queries
        stats_logger.timing("sqllab.query.time_pending", now_as_float() - start_time)

    query = get_query(query_id, session)
    payload: Dict[str, Any] = dict(query_id=query_id)
    database = query.database
    db_engine_spec = database.db_engine_spec
    db_engine_spec.patch()

    if database.allow_run_async and not results_backend:
        raise SqlLabException("Results backend isn't configured.")

    # Breaking down into multiple statements
    parsed_query = ParsedQuery(rendered_query, strip_comments=True)
    if not db_engine_spec.run_multiple_statements_as_one:
        statements = parsed_query.get_statements()
        logger.info(
            "Query %s: Executing %i statement(s)", str(query_id), len(statements)
        )
    else:
        statements = [rendered_query]
        logger.info("Query %s: Executing query as a single statement", str(query_id))

    logger.info("Query %s: Set query to 'running'", str(query_id))
    query.status = QueryStatus.RUNNING
    query.start_running_time = now_as_float()
    session.commit()

    # Should we create a table or view from the select?
    if (
        query.select_as_cta
        and query.ctas_method == CtasMethod.TABLE
        and not parsed_query.is_valid_ctas()
    ):
        raise SqlLabException(
            _(
                "CTAS (create table as select) can only be run with a query where "
                "the last statement is a SELECT. Please make sure your query has "
                "a SELECT as its last statement. Then, try running your query again."
            )
        )
    if (
        query.select_as_cta
        and query.ctas_method == CtasMethod.VIEW
        and not parsed_query.is_valid_cvas()
    ):
        raise SqlLabException(
            _(
                "CVAS (create view as select) can only be run with a query with "
                "a single SELECT statement. Please make sure your query has only "
                "a SELECT statement. Then, try running your query again."
            )
        )

    engine = database.get_sqla_engine(
        schema=query.schema,
        nullpool=True,
        user_name=user_name,
        source=QuerySource.SQL_LAB,
    )
    # Sharing a single connection and cursor across the
    # execution of all statements (if many)
    with closing(engine.raw_connection()) as conn:
        # closing the connection closes the cursor as well
        cursor = conn.cursor()
        statement_count = len(statements)
        for i, statement in enumerate(statements):
            # Check if stopped
            query = get_query(query_id, session)
            if query.status == QueryStatus.STOPPED:
                return None

            # For CTAS we create the table only on the last statement
            apply_ctas = query.select_as_cta and (
                query.ctas_method == CtasMethod.VIEW
                or (query.ctas_method == CtasMethod.TABLE and i == len(statements) - 1)
            )

            # Run statement
            msg = f"Running statement {i+1} out of {statement_count}"
            logger.info("Query %s: %s", str(query_id), msg)
            query.set_extra_json_key("progress", msg)
            session.commit()
            try:
                result_set = execute_sql_statement(
                    statement,
                    query,
                    user_name,
                    session,
                    cursor,
                    log_params,
                    apply_ctas,
                )
            except Exception as ex:  # pylint: disable=broad-except
                msg = str(ex)
                if statement_count > 1:
                    msg = f"[Statement {i+1} out of {statement_count}] " + msg
                payload = handle_query_error(msg, query, session, payload)
                return payload

        # Commit the connection so CTA queries will create the table.
        conn.commit()

    # Success, updating the query entry in database
    query.rows = result_set.size
    query.progress = 100
    query.set_extra_json_key("progress", None)
    if query.select_as_cta:
        query.select_sql = database.select_star(
            query.tmp_table_name,
            schema=query.tmp_schema_name,
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
        logger.info(
            "Query %s: Storing results in results backend, key: %s", str(query_id), key
        )
        with stats_timing("sqllab.query.results_backend_write", stats_logger):
            with stats_timing(
                "sqllab.query.results_backend_write_serialization", stats_logger
            ):
                serialized_payload = _serialize_payload(
                    payload, cast(bool, results_backend_use_msgpack)
                )
            cache_timeout = database.cache_timeout
            if cache_timeout is None:
                cache_timeout = config["CACHE_DEFAULT_TIMEOUT"]

            compressed = zlib_compress(serialized_payload)
            logger.debug(
                "*** serialized payload size: %i", getsizeof(serialized_payload)
            )
            logger.debug("*** compressed payload size: %i", getsizeof(compressed))
            results_backend.set(key, compressed, cache_timeout)
        query.results_key = key

    query.status = QueryStatus.SUCCESS
    session.commit()

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
        return payload

    return None
