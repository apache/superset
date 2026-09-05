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
"""GTF task for asynchronous SQL Lab query execution.

Wraps the internal SQL-Lab execution entry (``execute_sql_lab_query``) in a
PRIVATE GTF task so an async SQL Lab query runs on a worker with GTF's lifecycle:
signal-driven cancellation (with warehouse-query kill), ``@task`` timeout, worker
heartbeat + orphan reaping, and status. Because it is a PRIVATE task an executing
SQL Lab statement shows up in the Task List (scoped to the running user) and is
cancellable from there.

The ``Query`` row remains the SQL-Lab-facing source of truth: the task mirrors its
terminal state onto ``Query.status`` (SUCCESS is set by the executor; FAILED /
STOPPED / TIMED_OUT are mirrored here) so the existing ``/query/updated_since``
poll keeps working. Sync SQL Lab does not use this task — it calls
``execute_sql_lab_query`` directly, in-process.

Cancellation reuses the engine-generic seam built for chart-data
(``superset.tasks.query_cancel``): the executor hands us the captured engine
cancel id, which we persist (for the orphan reaper) and use in an abort handler
that kills the backend session over a fresh connection — never touching the live
ORM ``Query`` from the abort-listener thread.
"""

from __future__ import annotations

from typing import Any, Callable, Optional, TYPE_CHECKING

from flask import current_app
from superset_core.tasks.types import TaskScope

from superset import db, security_manager
from superset.common.db_query_status import QueryStatus
from superset.tasks.ambient_context import get_context
from superset.tasks.decorators import task
from superset.tasks.query_cancel import cancel_chart_query
from superset.utils.core import override_user
from superset.utils.dates import now_as_float

if TYPE_CHECKING:
    from superset.models.sql_lab import Query
    from superset.tasks.context import TaskContext

# GTF task type for async SQL Lab query execution. One PRIVATE task per Query,
# keyed by ``Query.client_id`` (per-user idempotency, subsuming the classic
# ``is_query_handled`` guard). The SQL Lab client filters
# ``/api/v1/task/status_changes`` to this type.
SQL_LAB_TASK = "superset.sql_lab"


def _make_cancel_hook(ctx: "TaskContext", query: "Query") -> Callable[[int, str], None]:
    """Build the ``cancel_hook`` the executor calls once it captures a cancel id.

    Persists the handle so the orphan reaper can cancel a dead worker's query,
    and registers an abort handler that kills the backend session over a *fresh*
    connection (engine-generic ``cancel_chart_query``) — unblocking the task's
    blocked cursor. The handler captures plain values + the app, so it never
    touches the live ORM ``Query`` from the abort-listener thread.
    """
    app = current_app._get_current_object()  # noqa: SLF001
    database = query.database

    def _hook(database_id: int, cancel_query_id: str) -> None:
        # Persist before registering the handler: the first on_abort flushes the
        # property cache, persisting the handle in that same write.
        ctx.set_cancellation(database_id, cancel_query_id)

        def _cancel() -> None:
            cancel_chart_query(database, cancel_query_id, app)

        ctx.on_abort(_cancel)

    return _hook


def _mirror_terminal_status(query: "Query", ctx: "TaskContext") -> None:
    """Mirror an abort/timeout onto the ``Query`` row (SUCCESS/FAILED handled
    elsewhere). Runs on the task's main thread, so touching the ORM row is safe."""
    query.status = (
        QueryStatus.TIMED_OUT if ctx.timeout_triggered else QueryStatus.STOPPED
    )
    if not query.end_time:
        query.end_time = now_as_float()
    db.session.commit()


@task(name=SQL_LAB_TASK, scope=TaskScope.PRIVATE)
def run_sql_lab_query(
    query_id: int,
    rendered_query: str,
    *,
    store_results: bool = True,
    expand_data: bool = False,
    username: Optional[str] = None,
    start_time: Optional[float] = None,
    log_params: Optional[dict[str, Any]] = None,
) -> None:
    """Execute an async SQL Lab query as a GTF task.

    Runs the (already access-validated, Jinja-rendered) query through the internal
    SQL-Lab executor entry under the requesting user, wiring GTF cancellation and
    mirroring the terminal state onto the ``Query`` row.
    """
    # Imported lazily to keep this module import-light and avoid any import-order
    # coupling with the SQL Lab module at app startup.
    from superset.sql.execution.sqllab_executor import execute_sql_lab_query
    from superset.sql_lab import get_query, handle_query_error

    ctx = get_context()
    query = get_query(query_id)

    with override_user(security_manager.find_user(username)):
        try:
            execute_sql_lab_query(
                query,
                rendered_query,
                return_results=False,
                store_results=store_results,
                expand_data=expand_data,
                start_time=start_time,
                log_params=log_params,
                cancel_hook=_make_cancel_hook(ctx, query),
            )
        except Exception as ex:  # pylint: disable=broad-except
            if ctx.aborting_in_flight:
                # Abort/timeout killed the warehouse query and surfaced as an
                # error; this is a successful cancellation, not a failure. Mirror
                # the terminal state to the Query and let the framework finalize
                # the task as ABORTED / TIMED_OUT.
                _mirror_terminal_status(query, ctx)
                return
            # Genuine execution error: mark the Query FAILED (builds the error
            # payload) and re-raise so the framework finalizes the task FAILURE.
            handle_query_error(ex, query)
            raise
