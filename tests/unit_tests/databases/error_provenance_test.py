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

from __future__ import annotations

import sqlite3
from types import SimpleNamespace
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError

from superset.databases.error_provenance import (
    is_database_engine_error,
    mark_database_engine_error,
)
from superset.models.core import Database


def _database_engine(mocker: MockerFixture, **kwargs: Any) -> Engine:
    real_create_engine = create_engine
    mocker.patch(
        "superset.models.core.create_engine",
        side_effect=lambda url, **engine_kwargs: real_create_engine(
            url, **engine_kwargs, **kwargs
        ),
    )
    return Database(
        database_name="database",
        sqlalchemy_uri="sqlite://",
    )._get_sqla_engine(nullpool=False)


def test_connect_error_is_marked_without_changing_exception(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    original = sqlite3.OperationalError("connect failed")

    def fail_to_connect() -> None:
        raise original

    engine = _database_engine(mocker, creator=fail_to_connect)
    observed: list[BaseException] = []

    def observe(context: Any) -> None:
        observed.append(context.sqlalchemy_exception)

    event.listen(engine, "handle_error", observe)

    with pytest.raises(OperationalError) as exc_info:
        engine.connect()

    assert observed == [exc_info.value]
    assert observed[0] is exc_info.value
    assert is_database_engine_error(exc_info.value)
    assert exc_info.value.orig is original
    assert str(exc_info.value.orig) == "connect failed"


def test_sqlalchemy_core_error_is_marked_without_changing_exception(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    engine = _database_engine(mocker)
    observed: list[BaseException] = []

    def observe(context: Any) -> None:
        observed.append(context.sqlalchemy_exception)

    event.listen(engine, "handle_error", observe)

    with engine.connect() as connection, pytest.raises(OperationalError) as exc_info:
        connection.execute(text("SELECT * FROM table_that_does_not_exist"))

    assert observed == [exc_info.value]
    assert observed[0] is exc_info.value
    assert is_database_engine_error(exc_info.value)
    assert isinstance(exc_info.value.orig, sqlite3.OperationalError)
    assert "table_that_does_not_exist" in str(exc_info.value)


def test_raw_dbapi_cursor_error_is_outside_listener_scope(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    database = Database(database_name="database", sqlalchemy_uri="sqlite://")
    real_create_engine = create_engine
    mocker.patch(
        "superset.models.core.create_engine",
        side_effect=lambda url, **engine_kwargs: real_create_engine(
            url, **engine_kwargs
        ),
    )

    with (
        database.get_raw_connection() as connection,
        pytest.raises(sqlite3.OperationalError) as exc_info,
    ):
        connection.cursor().execute("SELECT * FROM table_that_does_not_exist")

    assert not is_database_engine_error(exc_info.value)


def test_unrelated_and_metadata_engine_errors_are_not_marked() -> None:
    assert not is_database_engine_error(ValueError("unrelated"))

    metadata_engine = create_engine("sqlite://")
    with (
        metadata_engine.connect() as connection,
        pytest.raises(OperationalError) as exc_info,
    ):
        connection.execute(text("SELECT * FROM table_that_does_not_exist"))

    assert not is_database_engine_error(exc_info.value)


def test_public_engine_context_preserves_marker_for_private_engine(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    original = sqlite3.OperationalError("public path connect failed")

    def fail_to_connect() -> None:
        raise original

    real_create_engine = create_engine
    mocker.patch(
        "superset.models.core.create_engine",
        side_effect=lambda url, **engine_kwargs: real_create_engine(
            url,
            **engine_kwargs,
            creator=fail_to_connect,
        ),
    )
    database = Database(database_name="database", sqlalchemy_uri="sqlite://")
    mocker.patch.object(
        database.db_engine_spec,
        "get_prequeries",
        return_value=["SELECT 1"],
    )

    with pytest.raises(OperationalError) as exc_info:
        with database.get_sqla_engine() as engine:
            engine.connect()

    assert exc_info.value.orig is original
    assert is_database_engine_error(exc_info.value)


def test_cached_engine_has_one_instance_listener_without_database_closure(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    from superset.models.core import _ENGINE_CACHE

    _ENGINE_CACHE.clear()
    try:
        listen = mocker.spy(__import__("sqlalchemy").event, "listen")
        database = Database(database_name="database", sqlalchemy_uri="sqlite://")
        database.id = 1

        first = database._get_sqla_engine(nullpool=False)
        second = database._get_sqla_engine(nullpool=False)

        assert first is second
        handle_error_calls = [
            call
            for call in listen.call_args_list
            if len(call.args) > 1 and call.args[1] == "handle_error"
        ]
        assert len(handle_error_calls) == 1
        callback = handle_error_calls[0].args[2]
        assert callback is mark_database_engine_error
    finally:
        _ENGINE_CACHE.clear()


def test_marker_assignment_failure_does_not_mask_error() -> None:
    class UnmarkableError(Exception):
        def __setattr__(self, name: str, value: object) -> None:
            raise AttributeError(name)

    unmarkable = UnmarkableError("original")
    context = SimpleNamespace(sqlalchemy_exception=unmarkable)

    mark_database_engine_error(context)
    assert context.sqlalchemy_exception is unmarkable
    assert not is_database_engine_error(unmarkable)


def test_marker_helper_marks_exception() -> None:
    exception = RuntimeError("database error")
    context = SimpleNamespace(sqlalchemy_exception=exception)

    mark_database_engine_error(context)

    assert is_database_engine_error(exception)


def test_original_exception_is_marked_when_sqlalchemy_exception_is_none() -> None:
    exception = UnicodeDecodeError("utf-8", b"\xff", 0, 1, "invalid byte")
    context = SimpleNamespace(
        sqlalchemy_exception=None,
        original_exception=exception,
    )

    mark_database_engine_error(context)

    assert is_database_engine_error(exception)


def test_later_listener_replacement_is_not_marked(
    app_context: None,
    mocker: MockerFixture,
) -> None:
    engine = _database_engine(mocker)
    original: list[BaseException] = []

    def replace(context: Any) -> RuntimeError:
        original.append(context.sqlalchemy_exception)
        return RuntimeError("replacement")

    event.listen(engine, "handle_error", replace, retval=True)

    with (
        engine.connect() as connection,
        pytest.raises(RuntimeError, match="replacement") as exc_info,
    ):
        connection.execute(text("SELECT * FROM table_that_does_not_exist"))

    assert is_database_engine_error(original[0])
    assert not is_database_engine_error(exc_info.value)
