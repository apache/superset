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
"""Optional execution-owner hooks around a live warehouse cursor.

Ordinary web and Celery execution are unchanged. An in-process execution owner
can register cancellation while keeping its async runtime out of model code.
"""

from __future__ import annotations

from contextlib import AbstractContextManager, contextmanager
from contextvars import ContextVar
from typing import Any, Callable, Iterator, TYPE_CHECKING

from sqlalchemy import event
from sqlalchemy.engine import Engine

if TYPE_CHECKING:
    from superset.models.core import Database

cursor_scope: ContextVar[
    Callable[[Database, Any, str | None, str | None], AbstractContextManager[None]]
    | None
] = ContextVar("warehouse_cursor_scope", default=None)


@contextmanager
def cancellable_cursor(
    database: Database,
    cursor: Any,
    catalog: str | None = None,
    schema: str | None = None,
) -> Iterator[None]:
    """Let the execution owner capture cancellation before blocking DBAPI I/O."""
    scope = cursor_scope.get()
    if scope is None:
        yield
    else:
        with scope(database, cursor, catalog, schema):
            yield


check_deadline: ContextVar[Callable[[], None] | None] = ContextVar(
    "warehouse_check_deadline", default=None
)
after_execute: ContextVar[Callable[[], None] | None] = ContextVar(
    "warehouse_after_execute", default=None
)


def check_query_deadline() -> None:
    """Stop before metadata access or another statement after warehouse I/O."""
    if check := check_deadline.get():
        check()


def query_executed() -> None:
    """Refresh cancellation handles exposed only after driver execution."""
    if refresh := after_execute.get():
        refresh()


_engine_scope: ContextVar[tuple[Database, Engine, str | None, str | None] | None] = (
    ContextVar("warehouse_engine_scope", default=None)
)


@contextmanager
def cancellable_engine(
    database: Database, engine: Engine, catalog: str | None, schema: str | None
) -> Iterator[None]:
    """Cover SQLAlchemy warehouse statements, including metadata discovery.

    Listeners are installed once, never added/removed on shared cached engines.
    Matching the engine excludes Superset metadata queries in the same context.
    """
    if cursor_scope.get() is None:
        yield
        return
    token = _engine_scope.set((database, engine, catalog, schema))
    try:
        yield
    finally:
        _engine_scope.reset(token)


@event.listens_for(Engine, "before_cursor_execute")
def _before_cursor_execute(
    conn: Any,
    cursor: Any,
    statement: str,
    parameters: Any,
    context: Any,
    executemany: bool,
) -> None:
    """Register SQLAlchemy's live cursor with the execution owner."""
    if (scope := _engine_scope.get()) is None or conn.engine is not scope[1]:
        return
    database, _, catalog, schema = scope
    manager = cancellable_cursor(database, cursor, catalog, schema)
    manager.__enter__()
    context._superset_cancellation_scope = manager


@event.listens_for(Engine, "after_cursor_execute")
def _after_cursor_execute(
    conn: Any,
    cursor: Any,
    statement: str,
    parameters: Any,
    context: Any,
    executemany: bool,
) -> None:
    """Release the statement's cancellation registration on success."""
    if manager := getattr(context, "_superset_cancellation_scope", None):
        context._superset_cancellation_scope = None
        manager.__exit__(None, None, None)


@event.listens_for(Engine, "handle_error")
def _handle_error(context: Any) -> None:
    """Release cancellation registration and invalidate failed metadata state."""
    execution = context.execution_context
    if manager := getattr(execution, "_superset_cancellation_scope", None):
        execution._superset_cancellation_scope = None
        error = context.original_exception
        manager.__exit__(type(error), error, error.__traceback__)
