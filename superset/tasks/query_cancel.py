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
"""Engine-level cancellation for GTF chart-data query tasks.

The chart-data execution path (``Database.get_df``) has none of SQL Lab's
cancel plumbing, so a GTF abort/timeout could only mark the task terminal while
the warehouse query kept running. This module adds the missing seam:

- ``capture_cancel_id`` registers a cursor sink for the duration of a task's
  query; ``notify_cursor`` (called from ``get_df`` before the blocking execute)
  hands the live cursor to that sink so the task can capture an engine cancel id
  via ``db_engine_spec.get_cancel_query_id`` — the same contract SQL Lab uses.
- ``cancel_chart_query`` kills the backend session over a *fresh* connection
  (``db_engine_spec.cancel_query``), which unblocks the task's blocked ``get_df``.

Only engines that return a cancel id before execution participate; others
capture nothing and are simply not cancellable (the abort still frees the task).
"""

from __future__ import annotations

import logging
from contextlib import closing, contextmanager
from contextvars import ContextVar
from typing import Any, Callable, cast, Iterator, TYPE_CHECKING

from superset.stats_logger import BaseStatsLogger

if TYPE_CHECKING:
    from flask import Flask

    from superset.models.core import Database
    from superset.models.sql_lab import Query

logger = logging.getLogger(__name__)

# Set by a chart-data task for the span of its query. When present,
# Database._execute_sql_with_mutation_and_logging hands the sink the live cursor
# before the blocking execute so the task can capture an engine cancel id.
# Absent (None) for every other get_df caller, so this is a no-op elsewhere.
_cancel_id_sink: ContextVar["Callable[[Any], None] | None"] = ContextVar(
    "gtf_cancel_id_sink", default=None
)


class _CancellationQuery:
    """Minimal stand-in for the SQL Lab ``Query`` the engine cancel contract expects.

    ``db_engine_spec.get_cancel_query_id``/``cancel_query`` take a ``Query``; the
    common explicit-id engines (Postgres, MySQL, Snowflake, Redshift) ignore it,
    but some (e.g. Impala reads ``query.database``, Ocient reads ``query.id``) do
    not. Chart-data tasks have no ``Query`` row, so this exposes just those
    attributes: the database is real, ``id`` is ``None`` (so an engine that
    cancels by query id declines gracefully via ``validate_cancel_query_id``
    rather than raising), and the ``extra`` accessors are no-op scratch space.
    """

    def __init__(self, database: "Database") -> None:
        self.id = None
        self.database = database
        self.extra: dict[str, Any] = {}

    def set_extra_json_key(self, key: str, value: Any) -> None:
        self.extra[key] = value


def capture_cancel_query_id(database: "Database", cursor: Any) -> "str | None":
    """Return an engine cancel id for a live cursor, or None if unsupported.

    Only engines that expose a cancel id *before* execution return non-None here
    (the seam is invoked before the blocking execute); others yield None and the
    task simply stays non-cancellable.
    """
    # The stand-in duck-types the attributes the engine specs read; cast so the
    # call type-checks against the Query the contract nominally expects.
    stub = cast("Query", _CancellationQuery(database))
    return database.db_engine_spec.get_cancel_query_id(cursor, stub)


@contextmanager
def capture_cancel_id(sink: "Callable[[Any], None]") -> Iterator[None]:
    """Register a cursor sink for the duration of a chart-data query execution."""
    token = _cancel_id_sink.set(sink)
    try:
        yield
    finally:
        _cancel_id_sink.reset(token)


def notify_cursor(cursor: Any) -> None:
    """Hand the live cursor to the active sink, if any.

    Called from ``get_df`` before the query executes. Best-effort: a capture
    failure must never break query execution — it only forfeits cancellability.
    """
    sink = _cancel_id_sink.get()
    if sink is None:
        return
    try:
        sink(cursor)
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        logger.warning("Cancel-id capture failed", exc_info=True)


def cancel_chart_query(
    database: "Database", cancel_query_id: str, app: "Flask | None" = None
) -> bool:
    """Cancel a running chart-data warehouse query over a fresh connection.

    Runs ``db_engine_spec.cancel_query`` against a new connection to the same
    database, terminating the backend session that the task's blocked ``get_df``
    is waiting on. Invoked from the task's abort handler (on the abort-listener
    thread), so it opens its own connection rather than touching the busy one.
    Best-effort and fully logged; the task's terminal transition is authoritative.

    :param database: the database the query is running against
    :param cancel_query_id: engine cancel handle captured at query start
    :param app: Flask app for config/DB access from the background thread
    :returns: True if the engine reported the query cancelled
    """
    from flask import current_app

    stats_logger: BaseStatsLogger = (app or current_app).config.get(
        "STATS_LOGGER", BaseStatsLogger()
    )
    spec = database.db_engine_spec
    stub = cast("Query", _CancellationQuery(database))
    try:
        with database.get_sqla_engine() as engine:
            with closing(engine.raw_connection()) as conn:
                with closing(conn.cursor()) as cursor:
                    cancelled = spec.cancel_query(cursor, stub, cancel_query_id)
        if cancelled:
            stats_logger.incr("gtf.query.cancel")
            logger.info(
                "Cancelled warehouse query on database %s (id=%s)",
                database.id,
                cancel_query_id,
            )
        else:
            stats_logger.incr("gtf.query.cancel_failed")
        return cancelled
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        stats_logger.incr("gtf.query.cancel_failed")
        logger.warning(
            "Failed to cancel warehouse query on database %s (id=%s)",
            database.id,
            cancel_query_id,
            exc_info=True,
        )
        return False
