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
  query. ``get_df`` calls ``notify_cursor`` at each phase of a cursor's life
  (see ``CursorPhase``), handing the sink the live cursor and its database so
  the task can capture the cancel id of the operation that is running, via
  ``db_engine_spec.get_cancel_query_id`` — the same contract SQL Lab uses.
- ``cancel_chart_query`` cancels the warehouse query over a *fresh* connection
  (``db_engine_spec.cancel_query``), which unblocks the task's blocked ``get_df``.

Engines that expose a cancel id before execution are captured when the cursor
opens; engines that expose it only once a statement is submitted (Impala) are
captured after each submission. Engines that expose none capture nothing and are
simply not cancellable (the abort still frees the task).
"""

from __future__ import annotations

import logging
from contextlib import closing, contextmanager
from contextvars import ContextVar
from typing import Any, Callable, cast, Iterator, TYPE_CHECKING

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException
from superset.stats_logger import BaseStatsLogger
from superset.utils.backports import StrEnum

if TYPE_CHECKING:
    from flask import Flask

    from superset.models.core import Database
    from superset.models.sql_lab import Query

logger = logging.getLogger(__name__)


class CursorPhase(StrEnum):
    """The points in a chart-data cursor's life at which the sink is notified."""

    # The cursor exists and nothing has been submitted on it.
    OPENED = "opened"
    # A statement is about to be submitted.
    SUBMITTING = "submitting"
    # A statement was submitted; its results have not been fetched.
    SUBMITTED = "submitted"
    # The cursor's statements are over and they succeeded.
    RELEASED = "released"
    # The cursor's statements are over because one of them failed.
    FAILED = "failed"


class ChartQueryAbortedError(SupersetErrorException):
    """Stops a chart-data task's remaining warehouse work once it is aborting.

    The only exception ``notify_cursor`` lets a sink raise, and only before or
    after a statement is submitted, or once a statement failed, so the task
    neither fetches the results of an operation it is cancelling nor starts
    another statement. A ``SupersetErrorException``, so the datasource's
    ``query()`` re-raises it instead of turning it into a failed result that a
    caller (e.g. a time comparison) would merge into a cached one.
    """

    def __init__(self) -> None:
        super().__init__(
            SupersetError(
                message="The chart-data query task was aborted",
                error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                level=ErrorLevel.WARNING,
            )
        )


# Set by a chart-data task for the span of its query. When present,
# Database._execute_sql_with_mutation_and_logging hands the sink each of its
# cursors, with the cursor's database and phase, so the task can follow the
# operation the cursor is running. Absent (None) for every other get_df caller,
# so this is a no-op elsewhere.
_cancel_id_sink: ContextVar["Callable[[Any, Database, CursorPhase], None] | None"] = (
    ContextVar("gtf_cancel_id_sink", default=None)
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

    Engines that expose a cancel id before execution
    (``has_query_id_before_execute``) return it as soon as the cursor exists;
    the others return the id of the cursor's last submitted operation, so they
    are read once a statement has been submitted. Engines without cancel support
    yield None and the task simply stays non-cancellable.
    """
    # The stand-in duck-types the attributes the engine specs read; cast so the
    # call type-checks against the Query the contract nominally expects.
    stub = cast("Query", _CancellationQuery(database))
    return database.db_engine_spec.get_cancel_query_id(cursor, stub)


@contextmanager
def capture_cancel_id(
    sink: "Callable[[Any, Database, CursorPhase], None]",
) -> Iterator[None]:
    """Register a cursor sink for the duration of a chart-data query execution."""
    token = _cancel_id_sink.set(sink)
    try:
        yield
    finally:
        _cancel_id_sink.reset(token)


def notify_cursor(
    cursor: Any,
    database: "Database",
    phase: CursorPhase = CursorPhase.OPENED,
) -> None:
    """Hand the live cursor, its database and its phase to the active sink, if any.

    Called from ``get_df`` on the thread that runs the cursor. Best-effort: a
    capture failure must never break query execution — it only forfeits
    cancellability. The exception is ``ChartQueryAbortedError``, which a sink
    raises to stop the task's remaining work once its abort is accepted.
    """
    sink = _cancel_id_sink.get()
    if sink is None:
        return
    try:
        sink(cursor, database, phase)
    except ChartQueryAbortedError:
        raise
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        logger.warning("Cancel-id capture failed", exc_info=True)


@contextmanager
def tracked_cursor(cursor: Any, database: "Database") -> Iterator[None]:
    """Notify the active sink that a cursor opened and, on exit, that it was released.

    The release is notified however the cursor's statements end, so a task never
    keeps the cancel id of an operation that is over.
    """
    notify_cursor(cursor, database)
    phase = CursorPhase.RELEASED
    try:
        yield
    except Exception:
        phase = CursorPhase.FAILED
        raise
    finally:
        notify_cursor(cursor, database, phase)


def cancel_chart_query(
    database: "Database",
    cancel_query_id: str,
    app: "Flask | None" = None,
    *,
    catalog: str | None = None,
    schema: str | None = None,
) -> bool:
    """Cancel a running chart-data warehouse query over a fresh connection.

    Runs ``db_engine_spec.cancel_query`` against a new connection to the same
    database, terminating the backend session or operation that the task's
    blocked ``get_df`` is waiting on. Invoked from the task's abort handler (on
    the abort-listener thread), so it opens its own connection rather than
    touching the busy one. Best-effort and fully logged; the task's terminal
    transition is authoritative.

    :param database: the database the query is running against
    :param cancel_query_id: engine cancel handle captured for the running query
    :param app: Flask app for config/DB access from the background thread
    :returns: True if the engine reported the query cancelled
    """
    from flask import current_app

    stats_logger: BaseStatsLogger = (app or current_app).config.get(
        "STATS_LOGGER", BaseStatsLogger()
    )
    try:
        spec = database.db_engine_spec
        stub = cast("Query", _CancellationQuery(database))
        with database.get_sqla_engine(catalog=catalog, schema=schema) as engine:
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
