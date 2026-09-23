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
  query; ``notify_cursor`` (called from ``get_df`` before the blocking execute)
  hands the live cursor to that sink so the task can capture an engine cancel id
  via ``db_engine_spec.get_cancel_query_id`` — the same contract SQL Lab uses.
- ``cancel_chart_query`` kills the backend session over a *fresh* connection
  (``db_engine_spec.cancel_query``), which unblocks the task's blocked ``get_df``.

Only engines that return a cancel id before execution participate; others
capture nothing and are simply not cancellable (the abort still frees the task).

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


def _registry_key(user_id: int, client_id: str) -> str:
    """Cache key for a user's in-flight, cancellable chart query.

    The user id is part of the key rather than a field compared after lookup, so
    a ``client_id`` is only ever resolvable within the namespace of the user who
    registered it. A caller passing somebody else's ``client_id`` gets a miss —
    it cannot read, cancel, or overwrite another user's entry.
    """
    return f"chart-query-cancel:{user_id}:{client_id}"


def _registry_ttl() -> int:
    """How long a cancel handle stays resolvable.

    A synchronous chart query cannot outlive the web request running it, so the
    webserver timeout is the natural upper bound. Entries are discarded as soon
    as the query returns; this TTL only bounds the leak when a worker dies
    mid-query.
    """
    from flask import current_app

    return int(current_app.config.get("SUPERSET_WEBSERVER_TIMEOUT", 60))


@contextmanager
def cancellable_chart_query(
    client_id: "str | None", database: "Database | None"
) -> Iterator[None]:
    """Let the requesting user cancel this synchronous chart query by ``client_id``.

    Captures the engine cancel id off the live cursor (for engines that expose
    one before execution) and publishes it so a concurrent Stop request — which
    lands on a different worker while this one is blocked on the query — can kill
    the backend session. Engines without cancel support capture nothing and the
    query stays non-cancellable, exactly as before.

    A no-op without a ``client_id``, without a database (e.g. the annotation
    datasource, which queries Superset's own metadata DB), or for an
    unauthenticated request — an anonymous viewer of a public dashboard has no
    user id to scope the handle to, and an unscoped handle would be cancellable
    by any other anonymous visitor.
    """
    from superset.utils.core import get_user_id

    user_id = get_user_id()
    if not client_id or database is None or user_id is None:
        yield
        return

    # Rebound as non-optional locals: mypy does not carry the narrowing above
    # into the nested function below.
    owner_id: int = user_id
    query_id: str = client_id
    target: "Database" = database
    database_id = target.id
    captured = False

    def _sink(cursor: Any) -> None:
        nonlocal captured
        if captured:
            return
        cancel_id = capture_cancel_query_id(target, cursor)
        if cancel_id is None:
            return
        captured = True
        _publish_cancel_handle(owner_id, query_id, database_id, cancel_id)

    try:
        with capture_cancel_id(_sink):
            yield
    finally:
        if captured:
            _discard_cancel_handle(owner_id, query_id)


def _publish_cancel_handle(
    user_id: int, client_id: str, database_id: int, cancel_query_id: str
) -> None:
    """Publish a cancel handle for the owning user. Best-effort."""
    from superset.extensions import cache_manager

    try:
        cache_manager.cache.set(
            _registry_key(user_id, client_id),
            {"database_id": database_id, "cancel_query_id": cancel_query_id},
            timeout=_registry_ttl(),
        )
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        # Forfeits cancellability for this query; never breaks its execution.
        logger.warning("Could not publish chart query cancel handle", exc_info=True)


def _discard_cancel_handle(user_id: int, client_id: str) -> None:
    """Drop a cancel handle once its query is no longer running. Best-effort."""
    from superset.extensions import cache_manager

    try:
        cache_manager.cache.delete(_registry_key(user_id, client_id))
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        logger.warning("Could not discard chart query cancel handle", exc_info=True)


def cancel_chart_query_for_user(client_id: str) -> bool:
    """Cancel the requesting user's running chart query, if it is cancellable.

    :returns: True if the engine reported the query cancelled. False covers both
        "no such in-flight query for this user" and "the engine declined" — the
        caller cannot distinguish them, which is deliberate: it keeps the
        endpoint from confirming whether a given ``client_id`` exists.
    """
    from superset.daos.database import DatabaseDAO
    from superset.extensions import cache_manager
    from superset.utils.core import get_user_id

    user_id = get_user_id()
    if user_id is None:
        return False

    try:
        handle = cache_manager.cache.get(_registry_key(user_id, client_id))
    except Exception:  # noqa: BLE001 pylint: disable=broad-except
        logger.warning("Could not read chart query cancel handle", exc_info=True)
        return False

    if not handle:
        return False

    database = DatabaseDAO.find_by_id(handle["database_id"])
    if database is None:
        return False

    cancelled = cancel_chart_query(database, handle["cancel_query_id"])
    if cancelled:
        _discard_cancel_handle(user_id, client_id)
    return cancelled
