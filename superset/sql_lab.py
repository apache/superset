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
"""SQL Lab query helpers shared across the SQL Lab request/task paths.

Query execution itself lives in the unified execution feature
(``superset.sql.execution.sqllab_executor.execute_sql_lab_query``), run inline for
sync requests and wrapped by the ``superset.sql_lab`` GTF task
(``superset.tasks.sql_queries``) for async. This module keeps the pieces still
shared by both: loading a query (``get_query``), building a failure payload
(``handle_query_error``), and cancelling a running warehouse query
(``cancel_query``).
"""

import dataclasses
import logging
import traceback
from contextlib import closing
from typing import Any, Optional

import backoff
from flask import current_app as app

from superset import db
from superset.common.db_query_status import QueryStatus
from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
from superset.exceptions import SupersetErrorException, SupersetErrorsException
from superset.models.sql_lab import Query
from superset.utils.core import QuerySource
from superset.utils.dates import now_as_float

logger = logging.getLogger(__name__)


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
        errors = query.database.db_engine_spec.extract_errors(
            str(ex), database_name=query.database.unique_name
        )

    errors_payload = [dataclasses.asdict(error) for error in errors]
    if errors:
        query.set_extra_json_key("errors", errors_payload)

    db.session.commit()
    payload.update({"status": query.status, "error": msg, "errors": errors_payload})
    if app.config.get("SHOW_STACKTRACE"):
        if stacktrace := traceback.format_exc():
            payload["stacktrace"] = stacktrace
    if troubleshooting_link := app.config["TROUBLESHOOTING_LINK"]:
        payload["link"] = troubleshooting_link
    return payload


def get_query_backoff_handler(details: dict[Any, Any]) -> None:
    stats_logger = app.config["STATS_LOGGER"]
    query_id = details["kwargs"]["query_id"]
    stats_logger.incr(f"error_attempting_orm_query_{details['tries'] - 1}")
    logger.warning(
        "Query with id `%s` could not be retrieved, sleeping for a sec before retrying",
        str(query_id),
        exc_info=True,
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
        # roll back so a poisoned session (e.g. PendingRollbackError after a
        # failed flush) doesn't fail every subsequent backoff retry identically.
        # Swallow rollback failures so a session/connection too broken to roll
        # back doesn't replace the original exception with one the backoff
        # decorator won't retry on.
        try:
            db.session.rollback()
        except Exception:  # pylint: disable=broad-except
            logger.warning("Failed to roll back session in get_query", exc_info=True)
        raise SqlLabException("Failed at getting query") from ex


def cancel_query(query: Query) -> bool:
    """
    Cancel a running query.

    Note some engines implicitly handle the cancellation of a query and thus no explicit
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
