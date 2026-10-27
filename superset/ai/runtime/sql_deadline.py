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
"""Apply the agent's absolute deadline to active warehouse cursors."""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from contextvars import copy_context
from threading import Timer
from typing import Any, Iterator, TYPE_CHECKING

from superset.errors import ErrorLevel, SupersetErrorType
from superset.exceptions import SupersetTimeoutException
from superset.sql.execution.cancellation import (
    after_execute,
    check_deadline,
    cursor_scope,
    timeout_scope,
    without_execution_hooks,
)
from superset.tasks.query_cancel import cancel_chart_query, capture_cancel_query_id

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)


def _cancel_explicit(
    database_id: int,
    user_id: int | None,
    active_cursor: Any,
    cancel_id: str | None,
    catalog: str | None,
    schema: str | None,
) -> None:
    """Reload metadata in the cancellation thread's request and session."""
    from flask import g

    from superset import db, security_manager
    from superset.models.core import Database as DatabaseModel

    with without_execution_hooks():
        if user_id is not None:
            g.user = db.session.get(security_manager.user_model, user_id)
            if g.user is None:
                logger.warning("AI query cancellation user no longer exists")
                return
        target = db.session.get(DatabaseModel, database_id)
        handle = cancel_id
        if (
            target is not None
            and handle is None
            and target.db_engine_spec.has_query_id_during_execute
        ):
            handle = capture_cancel_query_id(target, active_cursor)
        if target is not None and handle is not None:
            cancel_chart_query(target, handle, catalog=catalog, schema=schema)
        else:
            logger.warning("AI query deadline expired without a cancellation handle")


@contextmanager
def warehouse_deadline(deadline: float) -> Iterator[None]:  # noqa: C901
    """Cancel using the engine contract; never replace a driver's cancellation API.

    Drivers without cancellation support still stop before the next statement
    when their current I/O returns. Cancellation must finish before the cursor
    can be returned to a pool and reused by another query.
    """

    def check() -> None:
        if time.monotonic() >= deadline:
            raise SupersetTimeoutException(
                SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                "The agent's query deadline has expired.",
                ErrorLevel.ERROR,
            )

    @contextmanager
    def cursor(
        database: Database,
        active_cursor: Any,
        catalog: str | None,
        schema: str | None,
    ) -> Iterator[None]:
        from flask import current_app

        from superset.mcp_service.session_scope import _mcp_session_token
        from superset.utils.core import get_user_id

        check()
        app = current_app._get_current_object()
        user_id = get_user_id()
        database_id = database.id
        spec = database.db_engine_spec
        live_cancel = spec.has_implicit_cancel() or (
            getattr(spec, "supports_cancel_on_live_cursor", False) is True
            and callable(getattr(active_cursor, "cancel", None))
        )
        cancel_id: str | None = None
        context = copy_context()

        def capture() -> None:
            nonlocal cancel_id
            cancel_id = None
            try:
                cancel_id = capture_cancel_query_id(database, active_cursor)
            except Exception:  # pylint: disable=broad-except
                logger.warning(
                    "AI query cancellation handle unavailable", exc_info=True
                )

        def cancel() -> None:
            # Isolate metadata even when MCP has installed context-based scoping.
            token = _mcp_session_token.set(object())
            try:
                if live_cancel:
                    active_cursor.cancel()
                    return
                with app.test_request_context():
                    _cancel_explicit(
                        database_id, user_id, active_cursor, cancel_id, catalog, schema
                    )
            except Exception:  # pylint: disable=broad-except
                logger.warning("AI query cancellation failed", exc_info=True)
            finally:
                _mcp_session_token.reset(token)

        def refresh() -> None:
            if not live_cancel and not spec.has_query_id_before_execute:
                capture()
            check()

        if not live_cancel:
            capture()
        timer = Timer(max(0, deadline - time.monotonic()), lambda: context.run(cancel))
        timer.daemon = True
        refresh_token = after_execute.set(refresh)
        started = False
        try:
            timer.start()
            started = True
            check()
            yield
            check()
        finally:
            timer.cancel()
            if started:
                timer.join()
            after_execute.reset(refresh_token)

    cursor_token = cursor_scope.set(cursor)
    deadline_token = check_deadline.set(check)
    timeout_token = timeout_scope.set(
        lambda seconds: warehouse_deadline(min(deadline, time.monotonic() + seconds))
    )
    try:
        check()
        yield
        check()
    finally:
        timeout_scope.reset(timeout_token)
        check_deadline.reset(deadline_token)
        cursor_scope.reset(cursor_token)
