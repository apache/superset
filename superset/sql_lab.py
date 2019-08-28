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
# pylint: disable=C,R,W
from contextlib import closing
from datetime import datetime
import logging
from sys import getsizeof
from time import sleep
from typing import Optional, Tuple, Union
import uuid

from celery.exceptions import SoftTimeLimitExceeded
from contextlib2 import contextmanager
from flask_babel import lazy_gettext as _
import msgpack
import pyarrow as pa
import simplejson as json
import sqlalchemy
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from superset import (
    app,
    db,
    results_backend,
    results_backend_use_msgpack,
    security_manager,
)
from superset.dataframe import SupersetDataFrame
from superset.db_engine_specs import BaseEngineSpec
from superset.models.sql_lab import Query
from superset.sql_parse import ParsedQuery
from superset.tasks.celery_app import app as celery_app
from superset.utils.core import json_iso_dttm_ser, QueryStatus, sources, zlib_compress
from superset.utils.dates import now_as_float
from superset.utils.decorators import stats_timing

config = app.config
stats_logger = config.get("STATS_LOGGER")
SQLLAB_TIMEOUT = config.get("SQLLAB_ASYNC_TIME_LIMIT_SEC", 600)
SQLLAB_HARD_TIMEOUT = SQLLAB_TIMEOUT + 60
log_query = config.get("QUERY_LOGGER")


class SqlLabException(Exception):
    pass


class SqlLabSecurityException(SqlLabException):
    pass


class SqlLabTimeoutException(SqlLabException):
    pass


def handle_query_error(msg, query, session, payload=None):
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


def get_query(query_id, session, retry_count=5):
    """attemps to get the query and retry if it cannot"""
    query = None
    attempt = 0
    while not query and attempt < retry_count:
        try:
            query = session.query(Query).filter_by(id=query_id).one()
        except Exception:
            attempt += 1
            logging.error(f"Query with id `{query_id}` could not be retrieved")
            stats_logger.incr("error_attempting_orm_query_" + str(attempt))
            logging.error(f"Query {query_id}: Sleeping for a sec before retrying...")
            sleep(1)
    if not query:
        stats_logger.incr("error_failed_at_getting_orm_query")
        raise SqlLabException("Failed at getting query")
    return query


@contextmanager
def session_scope(nullpool):
    """Provide a transactional scope around a series of operations."""
    if nullpool:
        engine = sqlalchemy.create_engine(
            app.config.get("SQLALCHEMY_DATABASE_URI"), poolclass=NullPool
        )
        session_class = sessionmaker()
        session_class.configure(bind=engine)
        session = session_class()
    else:
        session = db.session()
        session.commit()  # HACK

    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        logging.exception(e)
        raise
    finally:
        session.close()


@celery_app.task(
    name="sql_lab.get_sql_results",
    bind=True,
    time_limit=SQLLAB_HARD_TIMEOUT,
    soft_time_limit=SQLLAB_TIMEOUT,
)
def get_sql_results(
    ctask,
    query_id,
    rendered_query,
    return_results=True,
    store_results=False,
    user_name=None,
    start_time=None,
):
    """Executes the sql query returns the results."""
    with session_scope(not ctask.request.called_directly) as session:

        try:
            return execute_sql_statements(
                ctask,
                query_id,
                rendered_query,
                return_results,
                store_results,
                user_name,
                session=session,
                start_time=start_time,
            )
        except Exception as e:
            logging.exception(f"Query {query_id}: {e}")
            stats_logger.incr("error_sqllab_unhandled")
            query = get_query(query_id, session)
            return handle_query_error(str(e), query, session)


def execute_sql_statement(sql_statement, query, user_name, session, cursor):
    """Executes a single SQL statement"""
    query_id = query.id
    database = query.database
    db_engine_spec = database.db_engine_spec
    parsed_query = ParsedQuery(sql_statement)
    sql = parsed_query.stripped()
    SQL_MAX_ROWS = app.config.get("SQL_MAX_ROW")

    if not parsed_query.is_readonly() and not database.allow_dml:
        raise SqlLabSecurityException(
            _("Only `SELECT` statements are allowed against this database")
        )
    if query.select_as_cta:
        if not parsed_query.is_select():
            raise SqlLabException(
                _(
                    "Only `SELECT` statements can be used with the CREATE TABLE "
                    "feature."
                )
            )
        if not query.tmp_table_name:
            start_dttm = datetime.fromtimestamp(query.start_time)
            query.tmp_table_name = "tmp_{}_table_{}".format(
                query.user_id, start_dttm.strftime("%Y_%m_%d_%H_%M_%S")
            )
        sql = parsed_query.as_create_table(query.tmp_table_name)
        query.select_as_cta_used = True
    if parsed_query.is_select():
        if SQL_MAX_ROWS and (not query.limit or query.limit > SQL_MAX_ROWS):
            query.limit = SQL_MAX_ROWS
        if query.limit:
            sql = database.apply_limit_to_sql(sql, query.limit)

    # Hook to allow environment-specific mutation (usually comments) to the SQL
    SQL_QUERY_MUTATOR = config.get("SQL_QUERY_MUTATOR")
    if SQL_QUERY_MUTATOR:
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
            )
        query.executed_sql = sql
        with stats_timing("sqllab.query.time_executing_query", stats_logger):
            logging.info(f"Query {query_id}: Running query: \n{sql}")
            db_engine_spec.execute(cursor, sql, async_=True)
            logging.info(f"Query {query_id}: Handling cursor")
            db_engine_spec.handle_cursor(cursor, query, session)

        with stats_timing("sqllab.query.time_fetching_results", stats_logger):
            logging.debug(
                "Query {}: Fetching data for query object: {}".format(
                    query_id, query.to_dict()
                )
            )
            data = db_engine_spec.fetch_data(cursor, query.limit)

    except SoftTimeLimitExceeded as e:
        logging.exception(f"Query {query_id}: {e}")
        raise SqlLabTimeoutException(
            "SQL Lab timeout. This environment's policy is to kill queries "
            "after {} seconds.".format(SQLLAB_TIMEOUT)
        )
    except Exception as e:
        logging.exception(f"Query {query_id}: {e}")
        raise SqlLabException(db_engine_spec.extract_error_message(e))

    logging.debug(f"Query {query_id}: Fetching cursor description")
    cursor_description = cursor.description
    return SupersetDataFrame(data, cursor_description, db_engine_spec)


def _serialize_payload(
    payload: dict, use_msgpack: Optional[bool] = False
) -> Union[bytes, str]:
    logging.debug(f"Serializing to msgpack: {use_msgpack}")
    if use_msgpack:
        return msgpack.dumps(payload, default=json_iso_dttm_ser, use_bin_type=True)
    else:
        return json.dumps(payload, default=json_iso_dttm_ser, ignore_nan=True)


def _serialize_and_expand_data(
    cdf: SupersetDataFrame,
    db_engine_spec: BaseEngineSpec,
    use_msgpack: Optional[bool] = False,
) -> Tuple[Union[bytes, str], list, list, list]:
    selected_columns: list = cdf.columns or []
    expanded_columns: list

    if use_msgpack:
        with stats_timing(
            "sqllab.query.results_backend_pa_serialization", stats_logger
        ):
            data = (
                pa.default_serialization_context()
                .serialize(cdf.raw_df)
                .to_buffer()
                .to_pybytes()
            )
        # expand when loading data from results backend
        all_columns, expanded_columns = (selected_columns, [])
    else:
        data = cdf.data or []
        all_columns, data, expanded_columns = db_engine_spec.expand_data(
            selected_columns, data
        )

    return (data, selected_columns, all_columns, expanded_columns)


def execute_sql_statements(
    ctask,
    query_id,
    rendered_query,
    return_results=True,
    store_results=False,
    user_name=None,
    session=None,
    start_time=None,
):
    """Executes the sql query returns the results."""
    if store_results and start_time:
        # only asynchronous queries
        stats_logger.timing("sqllab.query.time_pending", now_as_float() - start_time)

    query = get_query(query_id, session)
    payload = dict(query_id=query_id)
    database = query.database
    db_engine_spec = database.db_engine_spec
    db_engine_spec.patch()

    if store_results and not results_backend:
        raise SqlLabException("Results backend isn't configured.")

    # Breaking down into multiple statements
    parsed_query = ParsedQuery(rendered_query)
    statements = parsed_query.get_statements()
    logging.info(f"Query {query_id}: Executing {len(statements)} statement(s)")

    logging.info(f"Query {query_id}: Set query to 'running'")
    query.status = QueryStatus.RUNNING
    query.start_running_time = now_as_float()
    session.commit()

    engine = database.get_sqla_engine(
        schema=query.schema,
        nullpool=True,
        user_name=user_name,
        source=sources.get("sql_lab", None),
    )
    # Sharing a single connection and cursor across the
    # execution of all statements (if many)
    with closing(engine.raw_connection()) as conn:
        with closing(conn.cursor()) as cursor:
            statement_count = len(statements)
            for i, statement in enumerate(statements):
                # Check if stopped
                query = get_query(query_id, session)
                if query.status == QueryStatus.STOPPED:
                    return

                # Run statement
                msg = f"Running statement {i+1} out of {statement_count}"
                logging.info(f"Query {query_id}: {msg}")
                query.set_extra_json_key("progress", msg)
                session.commit()
                try:
                    cdf = execute_sql_statement(
                        statement, query, user_name, session, cursor
                    )
                except Exception as e:
                    msg = str(e)
                    if statement_count > 1:
                        msg = f"[Statement {i+1} out of {statement_count}] " + msg
                    payload = handle_query_error(msg, query, session, payload)
                    return payload

    # Success, updating the query entry in database
    query.rows = cdf.size
    query.progress = 100
    query.set_extra_json_key("progress", None)
    if query.select_as_cta:
        query.select_sql = database.select_star(
            query.tmp_table_name,
            limit=query.limit,
            schema=database.force_ctas_schema,
            show_cols=False,
            latest_partition=False,
        )
    query.end_time = now_as_float()

    data, selected_columns, all_columns, expanded_columns = _serialize_and_expand_data(
        cdf, db_engine_spec, store_results and results_backend_use_msgpack
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

    if store_results:
        key = str(uuid.uuid4())
        logging.info(
            f"Query {query_id}: Storing results in results backend, key: {key}"
        )
        with stats_timing("sqllab.query.results_backend_write", stats_logger):
            with stats_timing(
                "sqllab.query.results_backend_write_serialization", stats_logger
            ):
                serialized_payload = _serialize_payload(
                    payload, results_backend_use_msgpack
                )
            cache_timeout = database.cache_timeout
            if cache_timeout is None:
                cache_timeout = config.get("CACHE_DEFAULT_TIMEOUT", 0)

            compressed = zlib_compress(serialized_payload)
            logging.debug(
                f"*** serialized payload size: {getsizeof(serialized_payload)}"
            )
            logging.debug(f"*** compressed payload size: {getsizeof(compressed)}")
            results_backend.set(key, compressed, cache_timeout)
        query.results_key = key

    query.status = QueryStatus.SUCCESS
    session.commit()

    if return_results:
        return payload
