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
"""Execution-owner hooks must leave ordinary SQLAlchemy execution unchanged."""

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from unittest.mock import Mock

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

from superset.sql.execution import cancellation


def test_optional_deadline_and_execute_hooks() -> None:
    """Hooks are no-ops without an owner and dispatch to the active owner."""
    cancellation.check_query_deadline()
    cancellation.query_executed()
    check = Mock()
    refresh = Mock()
    deadline_token = cancellation.check_deadline.set(check)
    execute_token = cancellation.after_execute.set(refresh)
    try:
        cancellation.check_query_deadline()
        cancellation.query_executed()
        check.assert_called_once_with()
        refresh.assert_called_once_with()
    finally:
        cancellation.after_execute.reset(execute_token)
        cancellation.check_deadline.reset(deadline_token)


@pytest.mark.parametrize("fail", [False, True])
def test_engine_cursor_scope_lifecycle(fail: bool) -> None:
    """Register only matching warehouse statements and propagate driver errors."""
    database = Mock()
    warehouse = create_engine("sqlite://")
    metadata = create_engine("sqlite://")
    registered = []
    exited: list[BaseException | None] = []

    @contextmanager
    def owner(
        target: Any, cursor: Any, catalog: str | None, schema: str | None
    ) -> Iterator[None]:
        """Observe the production SQLAlchemy event listener lifecycle."""
        registered.append((target, cursor, catalog, schema))
        try:
            yield
        except BaseException as exc:
            exited.append(exc)
            raise
        else:
            exited.append(None)

    token = cancellation.cursor_scope.set(owner)
    try:
        with cancellation.cancellable_engine(database, warehouse, "catalog", "schema"):
            with metadata.connect() as connection:
                connection.execute(text("SELECT 1"))
            assert not registered
            with warehouse.connect() as connection:
                if fail:
                    with pytest.raises(OperationalError):
                        connection.execute(text("SELECT * FROM missing_table"))
                else:
                    assert connection.execute(text("SELECT 1")).scalar() == 1
            assert len(registered) == 1
            target, cursor, catalog, schema = registered[0]
            assert target is database
            assert cursor is not None
            assert (catalog, schema) == ("catalog", "schema")
            assert len(exited) == 1
            assert isinstance(exited[0], Exception) if fail else exited[0] is None
        # A statement after scope exit must not reuse the old registration.
        with warehouse.connect() as connection:
            connection.execute(text("SELECT 2"))
            with pytest.raises(OperationalError):
                connection.execute(text("SELECT * FROM missing_table"))
        assert len(registered) == 1
    finally:
        cancellation.cursor_scope.reset(token)
        warehouse.dispose()
        metadata.dispose()


def test_cursor_and_engine_without_owner() -> None:
    """Web/Celery execution does not install a cursor scope or call hooks."""
    database = Mock()
    engine = create_engine("sqlite://")
    try:
        with cancellation.cancellable_cursor(database, Mock()):
            with cancellation.cancellable_engine(database, engine, None, None):
                with engine.connect() as connection:
                    assert connection.execute(text("SELECT 1")).scalar() == 1
    finally:
        engine.dispose()
