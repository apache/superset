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
"""Engine-level cancellation for chart-data queries.

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

The same seam backs Explore's Stop button on the *synchronous* path. There the
cancel has to arrive on a different request (and likely a different worker) than
the one blocked on the query, so ``cancellable_chart_query`` publishes the
captured handle to the cache under a key derived from the requesting user and
the client-generated ``client_id``, and ``cancel_chart_query_for_user`` resolves
it back. Because the user id is part of the key, a lookup can only ever find the
requester's own query: a client-supplied ``client_id`` naming somebody else's
query simply misses.
"""

from __future__ import annotations

import logging
from contextlib import closing, contextmanager
from contextvars import ContextVar
from typing import Any, Callable, cast, Iterator, TYPE_CHECKING

from flask import current_app
from flask_babel import gettext as _

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import QueryObjectValidationError, SupersetErrorException
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


class ChartQueryStoppedError(QueryObjectValidationError):
    """Raised before a statement executes when its run was already stopped."""


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
    except (ChartQueryAbortedError, ChartQueryStoppedError):
        # Deliberate: stop the task's or the run's remaining work.
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


def _registry_key(user_id: int, client_id: str) -> str:
    """Cache key for a user's in-flight, cancellable chart query.

    The user id is part of the key rather than a field compared after lookup, so
    a ``client_id`` is only ever resolvable within the namespace of the user who
    registered it. A caller passing somebody else's ``client_id`` gets a miss —
    it cannot read, cancel, or overwrite another user's entry.
    """
    return f"chart-query-cancel:{user_id}:{client_id}"


def _cancel_requested_key(user_id: int, client_id: str) -> str:
    """Cache key recording that a user asked to stop a chart query run.

    Scoped by user for the same reason as ``_registry_key``: a ``client_id``
    can only ever flag the requester's own run.
    """
    return f"chart-query-cancel-requested:{user_id}:{client_id}"


def _registry_ttl() -> int:
    """How long a cancel handle stays resolvable.

    A synchronous chart query cannot outlive the web request running it, so the
    webserver timeout is the natural upper bound. Entries are discarded as soon
    as the query returns; this TTL only bounds the leak when a worker dies
    mid-query.
    """
    return int(current_app.config.get("SUPERSET_WEBSERVER_TIMEOUT", 60))


class _StopSink:
    """The cursor sink behind ``cancellable_chart_query``.

    Republishes the handle for every cursor rather than only the first: one
    query object can execute several statements in turn (e.g. the grouping-sets
    fallback), each on whatever connection the pool hands out, and the handle
    must always name the operation that is executing right now. Cursors on other
    databases never publish, since their id would be cancelled against the wrong
    database, but a Stop still keeps their statements from starting. Annotation
    layer queries run after this scope ends, so a Stop does not reach them.
    """

    def __init__(self, user_id: int, client_id: str, database: "Database") -> None:
        self._user_id = user_id
        self._client_id = client_id
        self._database = database
        self._database_id = database.id
        # Engines without an id before execution (Impala) expose the id of a
        # single submitted operation, so it is read after each submission rather
        # than once when the cursor opens; see ``CursorPhase``.
        self._after_submission = not database.db_engine_spec.has_query_id_before_execute
        self._published_id: str | None = None
        self.captured = False

    def __call__(
        self, cursor: Any, cursor_database: "Database", phase: CursorPhase
    ) -> None:
        own = cursor_database.id == self._database_id
        if phase == CursorPhase.OPENED:
            if own and not self._after_submission:
                self._publish(cursor)
        elif phase == CursorPhase.SUBMITTING:
            if own and self._after_submission:
                self._retire()
            # A Stop recorded before this statement had a handle to cancel is
            # honoured by not running the statement at all.
            if chart_query_cancel_requested(self._client_id):
                raise ChartQueryStoppedError(_("Query was stopped"))
        elif phase == CursorPhase.SUBMITTED:
            if own and self._after_submission:
                self._publish(cursor)
        elif own:
            self._retire()

    def _publish(self, cursor: Any) -> None:
        cancel_id = capture_cancel_query_id(self._database, cursor)
        if cancel_id is None:
            return
        self.captured = True
        self._published_id = cancel_id
        _publish_cancel_handle(
            self._user_id, self._client_id, self._database_id, cancel_id
        )
        # A Stop landing before the publish saw no handle to kill; recheck now
        # that the handle is visible.
        if chart_query_cancel_requested(self._client_id):
            self._retire()
            if self._after_submission:
                # The statement was already submitted and keeps running on the
                # warehouse unless it is cancelled here.
                cancel_chart_query(self._database, cancel_id)
            raise ChartQueryStoppedError(_("Query was stopped"))

    def _retire(self) -> None:
        # The operation the handle names is over: a Stop must never cancel it,
        # least of all a pooled session that has moved on to other work.
        if self._published_id is not None:
            _discard_cancel_handle(self._user_id, self._client_id, self._published_id)
            self._published_id = None


@contextmanager
def cancellable_chart_query(
    client_id: "str | None", database: "Database | None"
) -> Iterator[None]:
    """Let the requesting user cancel this synchronous chart query by ``client_id``.

    Captures the engine cancel id off the live cursor (when it opens, or after
    each submission for engines that expose an id only then) and publishes it so
    a concurrent Stop request — which lands on a different worker while this one
    is blocked on the query — can cancel the running operation. Engines without
    cancel support capture nothing and the query stays non-cancellable, exactly
    as before.

    A no-op without a ``client_id``, without a database (e.g. the annotation
    datasource, which queries Superset's own metadata DB), or for an
    unauthenticated request — an anonymous viewer of a public dashboard has no
    user id to scope the handle to, and an unscoped handle would be cancellable
    by any other anonymous visitor.
    """
    # Inline (also below, and in _publish_cancel_handle/_discard_cancel_handle/
    # cancel_chart_query_for_user): the unit tests patch get_user_id and
    # cache_manager at their defining modules (superset.utils.core,
    # superset.extensions), not here. A module-level `from ... import X` binds
    # X once at import time, before any test patch runs, so the patch would
    # silently never take effect; re-importing on every call picks up the
    # patched object instead.
    from superset.utils.core import get_user_id

    user_id = get_user_id()
    if not client_id or database is None or user_id is None:
        yield
        return

    sink = _StopSink(user_id, client_id, database)
    try:
        with capture_cancel_id(sink):
            yield
    finally:
        if sink.captured:
            _discard_cancel_handle(user_id, client_id)


def _publish_cancel_handle(
    user_id: int, client_id: str, database_id: int, cancel_query_id: str
) -> None:
    """Publish a cancel handle for the owning user. Best-effort."""
    # Inline for test-patchability; see cancellable_chart_query's comment.
    from superset.extensions import cache_manager

    try:
        cache_manager.chart_query_cancel_cache.set(
            _registry_key(user_id, client_id),
            {"database_id": database_id, "cancel_query_id": cancel_query_id},
            timeout=_registry_ttl(),
        )
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        # Forfeits cancellability for this query; never breaks its execution.
        logger.warning("Could not publish chart query cancel handle", exc_info=True)


def _discard_cancel_handle(
    user_id: int, client_id: str, expected_cancel_query_id: "str | None" = None
) -> None:
    """Drop a cancel handle once its query is no longer running. Best-effort.

    When ``expected_cancel_query_id`` is given, the entry is only deleted if it
    still names that id. Sequential cursors within one query (e.g. the
    grouping-sets fallback) republish the same key as each statement starts;
    without this check, discarding a handle resolved just before a newer
    cursor's republish would delete that newer, still-live entry instead of
    the stale one that was actually acted on.
    """
    # Inline for test-patchability; see cancellable_chart_query's comment.
    from superset.extensions import cache_manager

    key = _registry_key(user_id, client_id)
    try:
        if expected_cancel_query_id is not None:
            current = cache_manager.chart_query_cancel_cache.get(key)
            if (
                not current
                or current.get("cancel_query_id") != expected_cancel_query_id
            ):
                return
        cache_manager.chart_query_cancel_cache.delete(key)
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        logger.warning("Could not discard chart query cancel handle", exc_info=True)


def _request_chart_query_cancel(user_id: int, client_id: str) -> None:
    """Record that the user asked to stop this run. Best-effort.

    Killing the statement that is executing right now is only half of a Stop:
    a chart-data run can be several statements (contribution totals, the
    grouping-sets fallback's one-query-per-level, one query object after
    another), and a Stop that lands before the first starts, or in the gap
    between two, finds no handle to cancel. The intent recorded here is what
    the execution loop checks before it starts each statement (see
    ``chart_query_cancel_requested``), so the rest of the run is skipped
    instead of carrying on as if nothing happened.
    """
    # Inline for test-patchability; see cancellable_chart_query's comment.
    from superset.extensions import cache_manager

    try:
        cache_manager.chart_query_cancel_cache.set(
            _cancel_requested_key(user_id, client_id),
            True,
            timeout=_registry_ttl(),
        )
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        logger.warning("Could not record chart query cancel request", exc_info=True)


def chart_query_cancel_requested(client_id: "str | None") -> bool:
    """Whether the requesting user has asked to stop the run named by ``client_id``.

    Checked by the execution loop before each statement of a chart-data run.
    False without a ``client_id`` or a user (nothing could have been
    requested), and on a cache failure (never block a query on the registry).
    """
    # Inline for test-patchability; see cancellable_chart_query's comment.
    from superset.extensions import cache_manager
    from superset.utils.core import get_user_id

    user_id = get_user_id()
    if not client_id or user_id is None:
        return False

    try:
        return bool(
            cache_manager.chart_query_cancel_cache.get(
                _cancel_requested_key(user_id, client_id)
            )
        )
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        logger.warning("Could not read chart query cancel request", exc_info=True)
        return False


@contextmanager
def chart_query_run(client_id: "str | None") -> Iterator[None]:
    """Scope one chart-data run so its cancel intent is cleared when it ends.

    The intent is deliberately *not* cleared on entry: a Stop that arrives
    before the run reaches its first statement must still take effect. Each
    run carries a fresh ``client_id``, so an intent recorded for a run that is
    already over can never leak into a later one; clearing it here just keeps
    the registry tidy rather than leaving it to the TTL.
    """
    # Inline for test-patchability; see cancellable_chart_query's comment.
    from superset.extensions import cache_manager
    from superset.utils.core import get_user_id

    user_id = get_user_id()
    if not client_id or user_id is None:
        yield
        return

    try:
        yield
    finally:
        try:
            cache_manager.chart_query_cancel_cache.delete(
                _cancel_requested_key(user_id, client_id)
            )
        except Exception:  # noqa: BLE001 pylint: disable=broad-except
            logger.warning("Could not clear chart query cancel request", exc_info=True)


def cancel_chart_query_for_user(client_id: str) -> bool:
    """Cancel the requesting user's running chart query, if it is cancellable.

    Always records the cancel intent for the run first, so whatever the run
    has not started yet is skipped at its next checkpoint even when there is
    no statement executing right now to kill.

    :returns: True if the engine reported the query cancelled. False covers both
        "no such in-flight query for this user" and "the engine declined" — the
        caller cannot distinguish them, which is deliberate: it keeps the
        endpoint from confirming whether a given ``client_id`` exists.
    """
    # Inline for test-patchability; see cancellable_chart_query's comment.
    from superset.daos.database import DatabaseDAO
    from superset.extensions import cache_manager
    from superset.utils.core import get_user_id

    user_id = get_user_id()
    if user_id is None:
        return False

    _request_chart_query_cancel(user_id, client_id)

    try:
        handle = cache_manager.chart_query_cancel_cache.get(
            _registry_key(user_id, client_id)
        )
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        logger.warning("Could not read chart query cancel handle", exc_info=True)
        return False

    if not handle:
        return False

    # The handle is user-scoped and only written by an already-authorized run,
    # so the database filter (which hides it for all_datasource_access users
    # without per-database grants) must not block cancellation.
    database = DatabaseDAO.find_by_id(handle["database_id"], skip_base_filter=True)
    if database is None:
        return False

    cancelled = cancel_chart_query(database, handle["cancel_query_id"])
    if cancelled:
        _discard_cancel_handle(user_id, client_id, handle["cancel_query_id"])
    return cancelled
