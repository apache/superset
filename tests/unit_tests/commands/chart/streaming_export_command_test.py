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
"""Unit tests for Chart Streaming CSV Export Command."""

from types import SimpleNamespace
from typing import Any, Iterator

import pytest
from flask import g
from flask.globals import _cv_request
from flask_appbuilder.security.sqla.models import User
from flask_login import current_user
from pytest_mock import MockerFixture
from sqlalchemy import inspect
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import DetachedInstanceError

from superset.commands.chart.data.streaming_export_command import (
    StreamingCSVExportCommand,
)
from superset.commands.streaming_export.base import (
    _reload_detached_acting_user,
    _reload_if_detached,
)
from superset.security.guest_token import GuestUser
from superset.utils.core import get_user_id, get_username


def _setup_chart_mocks(
    mocker: MockerFixture,
    sql: str = "SELECT * FROM test",
    catalog: str | None = None,
    schema: str | None = None,
) -> tuple[MockerFixture, MockerFixture, MockerFixture]:
    """Set up common mocks for chart streaming export tests."""
    mock_db = mocker.patch("superset.commands.streaming_export.base.db")
    mock_session = mocker.MagicMock()
    mock_db.session.return_value.__enter__.return_value = mock_session

    query_context = mocker.MagicMock()
    datasource = mocker.MagicMock()
    datasource.get_query_str.return_value = sql
    datasource.database = mocker.MagicMock()
    datasource.database.mutate_sql_based_on_config.side_effect = (
        lambda sql_, **kwargs: sql_
    )
    datasource.catalog = catalog
    datasource.schema = schema
    query_context.datasource = datasource
    query_context.queries = [mocker.MagicMock()]
    mock_session.merge.return_value = datasource.database

    return mock_db, query_context, datasource


def test_streaming_csv_export_command_init(mocker: MockerFixture) -> None:
    """Test command initialization."""
    query_context = mocker.MagicMock()
    command = StreamingCSVExportCommand(query_context, chunk_size=500)

    assert command._query_context == query_context
    assert command._chunk_size == 500


def test_streaming_csv_export_command_default_chunk_size(
    mocker: MockerFixture,
) -> None:
    """Test command uses default chunk size."""
    query_context = mocker.MagicMock()
    command = StreamingCSVExportCommand(query_context)

    assert command._chunk_size == 1000


def test_validate_calls_raise_for_access(mocker: MockerFixture) -> None:
    """Test validate method calls query context raise_for_access."""
    query_context = mocker.MagicMock()
    command = StreamingCSVExportCommand(query_context)

    command.validate()

    query_context.raise_for_access.assert_called_once()


def test_validate_raises_exception_on_access_denied(mocker: MockerFixture) -> None:
    """Test validate raises exception when access is denied."""
    query_context = mocker.MagicMock()
    query_context.raise_for_access.side_effect = Exception("Access denied")
    command = StreamingCSVExportCommand(query_context)

    with pytest.raises(Exception, match="Access denied"):
        command.validate()


def test_csv_generation_with_small_dataset(mocker: MockerFixture) -> None:
    """Test CSV generation with a small dataset."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_result_proxy = mocker.MagicMock()
    mock_result_proxy.keys.return_value = ["col1", "col2", "col3"]
    mock_result_proxy.fetchmany.side_effect = [
        [
            ("row1_val1", "row1_val2", "row1_val3"),
            ("row2_val1", "row2_val2", "row2_val3"),
        ],
        [("row3_val1", "row3_val2", "row3_val3")],
        [],
    ]

    mock_connection = mocker.MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = (
        mock_result_proxy
    )
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context, chunk_size=2)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()

    chunks = list(generator)

    csv_data = "".join(chunks)
    lines = [line.strip() for line in csv_data.strip().split("\n")]

    assert len(lines) == 4
    assert lines[0] == "col1,col2,col3"
    assert "row1_val1,row1_val2,row1_val3" in csv_data
    assert "row2_val1,row2_val2,row2_val3" in csv_data
    assert "row3_val1,row3_val2,row3_val3" in csv_data


def test_csv_generation_with_special_characters(mocker: MockerFixture) -> None:
    """Test CSV generation properly escapes special characters."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_result = mocker.MagicMock()
    mock_result.keys.return_value = ["name", "description"]
    mock_result.fetchmany.side_effect = [
        [("John, Jr.", 'Quote"Test'), ("Line\nBreak", "Comma,Value")],
        [],
    ]

    mock_connection = mocker.MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context, chunk_size=10)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    assert '"John, Jr."' in csv_data
    assert '"Quote""Test"' in csv_data
    assert "Line\nBreak" in csv_data
    assert '"Comma,Value"' in csv_data


def test_csv_generation_escapes_formula_prefixes(mocker: MockerFixture) -> None:
    """Streaming CSV must escape formula prefixes like the batch export path."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_result = mocker.MagicMock()
    mock_result.keys.return_value = ["=header", "name"]
    mock_result.fetchmany.side_effect = [
        [("=cmd|' /C calc'!A0", "safe"), ("+SUM(A1:A2)", "@evil")],
        [],
    ]

    mock_connection = mocker.MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context, chunk_size=10)
    csv_generator_callable = command.run()
    csv_data = "".join(csv_generator_callable())

    lines = [line.strip() for line in csv_data.strip().split("\n")]
    # Header cell is escaped too
    assert lines[0] == "'=header,name"
    # Formula-prefixed cells are neutralized ('-prefixed, pipe escaped)
    assert "'=cmd\\|' /C calc'!A0" in csv_data
    assert "\n=cmd" not in csv_data
    assert "'+SUM(A1:A2)" in csv_data
    assert "'@evil" in csv_data


def test_streaming_with_null_values(mocker: MockerFixture) -> None:
    """Test CSV generation handles NULL values correctly."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_result = mocker.MagicMock()
    mock_result.keys.return_value = ["col1", "col2", "col3"]
    mock_result.fetchmany.side_effect = [
        [("value1", None, "value3"), (None, "value2", None)],
        [],
    ]

    mock_connection = mocker.MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context, chunk_size=10)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    lines = csv_data.strip().split("\n")
    assert len(lines) == 3
    assert "value1,,value3" in csv_data
    assert ",value2," in csv_data


def test_streaming_execution_options_enabled(mocker: MockerFixture) -> None:
    """Test that streaming execution options are enabled."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_result_proxy = mocker.MagicMock()
    mock_result_proxy.keys.return_value = ["col1", "col2", "col3"]
    mock_result_proxy.fetchmany.side_effect = [
        [
            ("row1_val1", "row1_val2", "row1_val3"),
            ("row2_val1", "row2_val2", "row2_val3"),
        ],
        [("row3_val1", "row3_val2", "row3_val3")],
        [],
    ]

    mock_connection = mocker.MagicMock()
    mock_execution_options = mocker.MagicMock()
    mock_connection.execution_options.return_value = mock_execution_options
    mock_execution_options.execute.return_value = mock_result_proxy
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    list(generator)

    mock_connection.execution_options.assert_called_once_with(stream_results=True)


def test_empty_result_set(mocker: MockerFixture) -> None:
    """Test CSV generation with empty result set."""
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    mock_result = mocker.MagicMock()
    mock_result.keys.return_value = ["col1", "col2"]
    mock_result.fetchmany.side_effect = [[]]

    mock_connection = mocker.MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context)
    csv_generator_callable = command.run()
    generator = csv_generator_callable()
    csv_data = "".join(generator)

    lines = [line.strip() for line in csv_data.strip().split("\n")]
    assert len(lines) == 1
    assert lines[0] == "col1,col2"


def test_catalog_and_schema_passed_to_engine(mocker: MockerFixture) -> None:
    """Test that catalog and schema are forwarded to get_sqla_engine.

    Prequeries (e.g. SET search_path for PostgreSQL) are now run automatically
    via a connect event listener registered inside get_sqla_engine, not by the
    streaming command itself.
    """
    mock_db, query_context, datasource = _setup_chart_mocks(
        mocker, catalog="my_catalog", schema="my_schema"
    )

    mock_result = mocker.MagicMock()
    mock_result.keys.return_value = ["col1"]
    mock_result.fetchmany.side_effect = [[("val",)], []]

    mock_connection = mocker.MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context)
    list(command.run()())

    datasource.database.get_sqla_engine.assert_called_once_with(
        catalog="my_catalog",
        schema="my_schema",
    )


def test_streaming_export_mutation_does_not_double_apply(
    mocker: MockerFixture,
) -> None:
    """
    Regression test for a bug caught in review of apache/superset#40465's fix:
    ``datasource.get_query_str()`` (used to build the SQL for chart streaming
    exports) already runs it through
    ``Database.mutate_sql_based_on_config(sql)`` -- with ``is_split=False`` --
    upstream in ``get_query_str_extended``. If
    ``_execute_query_and_stream`` mutated again with the same default
    ``is_split=False``, a ``SQL_QUERY_MUTATOR`` would run twice under the
    default ``MUTATE_AFTER_SPLIT=False`` config, and never run at all under
    ``MUTATE_AFTER_SPLIT=True`` (since neither call would use
    ``is_split=True``). Passing ``is_split=True`` here is the complement of
    the upstream call, so exactly one of the two fires for either setting.
    """
    mock_db, query_context, datasource = _setup_chart_mocks(
        mocker, sql="SELECT * FROM test /* mutated */"
    )

    mock_result = mocker.MagicMock()
    mock_result.keys.return_value = ["col1"]
    mock_result.fetchmany.side_effect = [[("val",)], []]

    mock_connection = mocker.MagicMock()
    mock_connection.execution_options.return_value.execute.return_value = mock_result
    mock_connection.__enter__.return_value = mock_connection
    mock_connection.__exit__.return_value = None

    mock_engine = mocker.MagicMock()
    mock_engine.connect.return_value = mock_connection
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = (
        mock_engine
    )

    command = StreamingCSVExportCommand(query_context)
    list(command.run()())

    datasource.database.mutate_sql_based_on_config.assert_called_once_with(
        "SELECT * FROM test /* mutated */", is_split=True
    )


def test_streaming_export_runs_in_its_request_context_after_the_view_returns(
    app: Any,
    mocker: MockerFixture,
) -> None:
    """
    The WSGI server iterates a streaming body only after the view has returned and
    the request context has been popped. The export must still run as part of
    that request: as the acting user, which Flask-AppBuilder exposes as
    ``g.user = current_user`` (a Flask-Login proxy that resolves to ``None``
    outside a request), and with the request context active, since engine
    specs such as Snowflake only use the user's OAuth2 token inside a request.
    """
    _mock_db, query_context, datasource = _setup_chart_mocks(mocker)

    result_proxy = mocker.MagicMock()
    result_proxy.keys.return_value = ["id"]
    result_proxy.fetchmany.side_effect = [[(1,)], []]

    connection = mocker.MagicMock()
    connection.execution_options.return_value.execute.return_value = result_proxy
    connection.__enter__.return_value = connection
    connection.__exit__.return_value = None
    engine = mocker.MagicMock()
    engine.connect.return_value = connection

    # Record the request state at the moment the engine is acquired -- the
    # point where the real Database._get_sqla_engine resolves the OAuth2 token.
    # Compare against this request's own context rather than asking whether any
    # request context is active, so a context another test left pushed can't
    # make this pass (or fail).
    view_request: dict[str, Any] = {}
    seen: list[tuple[str | None, int | None, bool]] = []

    def fake_get_sqla_engine(*args: Any, **kwargs: Any) -> Any:
        in_view_request = _cv_request.get(None) is view_request["context"]
        seen.append((get_username(), get_user_id(), in_view_request))
        cm = mocker.MagicMock()
        cm.__enter__.return_value = engine
        cm.__exit__.return_value = None
        return cm

    datasource.database.get_sqla_engine.side_effect = fake_get_sqla_engine

    user = SimpleNamespace(id=42, username="alice")

    # Like Flask's wsgi_app, the request pushes (and tears down) its own app
    # context, so nothing it put on ``g`` outlives it by accident.
    with app.app_context(), app.test_request_context("/"):
        view_request["context"] = _cv_request.get()
        g._login_user = user
        g.user = current_user  # exactly what Flask-AppBuilder's before_request does
        assert (get_username(), get_user_id()) == ("alice", 42)

        # The view builds the response body...
        command = StreamingCSVExportCommand(query_context, chunk_size=10)
        stream = command.run()()

    # ...which is streamed once the request context is gone.
    assert _cv_request.get(None) is not view_request["context"]
    assert "".join(stream).splitlines() == ["id", "1"]

    assert seen == [("alice", 42, True)]


def test_streaming_export_reloads_a_detached_acting_user(
    app: Any,
    session: Session,
    mocker: MockerFixture,
) -> None:
    """
    By the time the body is streamed, the metadata session that loaded the
    acting user has been removed by the request teardown, and the user has
    usually been expired by a commit (the event logger commits once the view
    returns). Reading ``g.user.id`` to find the user's OAuth2 token would then
    raise ``DetachedInstanceError`` unless the export loads the user again.
    """
    user = _detached_user(session)
    user_id = inspect(user).identity[0]
    with pytest.raises(DetachedInstanceError):
        _ = user.id

    seen: list[tuple[str | None, int | None, str]] = []

    def fake_execute_query_and_stream(
        self: StreamingCSVExportCommand, *args: Any, **kwargs: Any
    ) -> Iterator[str]:
        seen.append((get_username(), get_user_id(), current_user.username))
        yield "id\n"

    mocker.patch.object(
        StreamingCSVExportCommand,
        "_execute_query_and_stream",
        fake_execute_query_and_stream,
    )

    # Like Flask's wsgi_app, the request pushes (and tears down) its own app
    # context, so nothing it put on ``g`` outlives it by accident.
    with app.app_context(), app.test_request_context("/"):
        g._login_user = user
        g.user = current_user
        stream = StreamingCSVExportCommand(mocker.MagicMock()).run()()

    assert list(stream) == ["id\n"]
    assert seen == [("alice", user_id, "alice")]


def _detached_user(session: Session, expired: bool = True) -> User:
    """
    A persisted user, detached as the request teardown leaves it: expired too
    when the event logger committed after the view, loaded when nothing did.
    """
    User.__table__.create(session.get_bind(), checkfirst=True)
    user = User(
        first_name="Alice",
        last_name="Doe",
        username="alice",
        email="alice@example.com",
        active=True,
    )
    session.add(user)
    session.commit()
    if expired:
        session.expire(user)
    else:
        session.refresh(user)
    session.close()
    return user


def test_streaming_export_fails_closed_when_the_acting_user_is_gone(
    app: Any,
    session: Session,
    mocker: MockerFixture,
) -> None:
    """
    If the acting user was deleted before the body is streamed, the export must
    not go ahead without a user: impersonating databases would then connect with
    the connection's own credentials.
    """
    user = _detached_user(session)
    session.query(User).delete()
    session.commit()

    execute = mocker.patch.object(
        StreamingCSVExportCommand, "_execute_query_and_stream"
    )

    with app.app_context(), app.test_request_context("/"):
        g._login_user = user
        g.user = current_user
        stream = StreamingCSVExportCommand(mocker.MagicMock()).run()()

    assert "".join(stream).startswith("__STREAM_ERROR__:")
    execute.assert_not_called()


def test_reload_detached_acting_user_leaves_other_users_alone(
    app: Any,
    session: Session,
) -> None:
    """Only a detached ORM user is reloaded; anything else on ``g.user`` stays."""
    User.__table__.create(session.get_bind(), checkfirst=True)
    attached = User(
        first_name="Bob",
        last_name="Doe",
        username="bob",
        email="bob@example.com",
        active=True,
    )
    session.add(attached)
    session.commit()

    guest = GuestUser(
        token={
            "iat": 0,
            "exp": 0,
            "user": {"username": "guest"},
            "resources": [],
            "rls_rules": [],
        },
        roles=[],
    )
    for user in (attached, guest, None):
        g.user = user
        _reload_detached_acting_user()
        assert g.user is user


def test_streaming_export_commits_before_streaming_rows(mocker: MockerFixture) -> None:
    """
    Building the engine can refresh the user's OAuth2 token, which is only staged
    on the session. It must be committed before the rows stream: closing the
    session would otherwise roll it back (spending a single-use refresh token),
    and the metadata transaction would stay open for the whole export.
    """
    mock_db, query_context, datasource = _setup_chart_mocks(mocker)
    mock_session = mock_db.session.return_value.__enter__.return_value

    result_proxy = mocker.MagicMock()
    result_proxy.keys.return_value = ["id"]
    result_proxy.fetchmany.side_effect = [[(1,)], []]
    connection = mocker.MagicMock()
    connection.execution_options.return_value.execute.return_value = result_proxy
    connection.__enter__.return_value = connection
    connection.__exit__.return_value = None

    def connect() -> Any:
        mock_session.commit.assert_called_once()
        return connection

    engine = mocker.MagicMock()
    engine.connect.side_effect = connect
    datasource.database.get_sqla_engine.return_value.__enter__.return_value = engine

    stream = StreamingCSVExportCommand(query_context).run()()

    assert "".join(stream).splitlines() == ["id", "1"]
    mock_session.commit.assert_called_once()


def test_streaming_export_leaves_no_request_context_behind(
    app: Any,
    mocker: MockerFixture,
) -> None:
    """
    Building the body must not push the request's contexts: a body the server
    never iterates (the response failed after the view returned, say) would
    leave them on the worker thread, where later requests would inherit its
    ``g`` and logged-in user. Flask < 3.1.2's ``stream_with_context`` pushes
    them as soon as the body is built.
    """
    mocker.patch.object(
        StreamingCSVExportCommand,
        "_execute_query_and_stream",
        return_value=iter(()),
    )

    outer = _cv_request.get(None)
    with app.app_context(), app.test_request_context("/"):
        stream = StreamingCSVExportCommand(mocker.MagicMock()).run()()

    assert _cv_request.get(None) is outer
    del stream
    assert _cv_request.get(None) is outer


def test_streaming_export_does_not_leave_its_contexts_on_the_thread_mid_stream(
    app: Any,
    mocker: MockerFixture,
) -> None:
    """
    While the body is suspended between chunks, the request's contexts must not
    stay pushed on the worker thread: a body the server never finishes (an
    error raised while encoding keeps it alive on a traceback) would otherwise
    hand the thread's next request this one's ``g`` and logged-in user.
    """

    def fake_execute_query_and_stream(
        self: StreamingCSVExportCommand, *args: Any, **kwargs: Any
    ) -> Iterator[str]:
        yield "id\n"
        yield "1\n"

    mocker.patch.object(
        StreamingCSVExportCommand,
        "_execute_query_and_stream",
        fake_execute_query_and_stream,
    )

    outer = _cv_request.get(None)
    with app.app_context(), app.test_request_context("/"):
        view_request = _cv_request.get()
        stream = StreamingCSVExportCommand(mocker.MagicMock()).run()()

    assert next(stream) == "id\n"
    assert _cv_request.get(None) is outer is not view_request
    assert list(stream) == ["1\n"]
    assert _cv_request.get(None) is outer


def test_streaming_export_read_in_part_before_the_request_ends(
    app: Any,
    mocker: MockerFixture,
) -> None:
    """
    Reading part of the body while the request is still being handled (from an
    ``after_request`` hook, say) must not stop Flask from popping the request's
    contexts, and the rest of the body must still stream inside that request.
    """
    view_request: dict[str, Any] = {}
    seen: list[bool] = []

    def fake_execute_query_and_stream(
        self: StreamingCSVExportCommand, *args: Any, **kwargs: Any
    ) -> Iterator[str]:
        seen.append(_cv_request.get(None) is view_request["context"])
        yield "id\n"
        seen.append(_cv_request.get(None) is view_request["context"])
        yield "1\n"

    mocker.patch.object(
        StreamingCSVExportCommand,
        "_execute_query_and_stream",
        fake_execute_query_and_stream,
    )

    outer = _cv_request.get(None)
    with app.app_context(), app.test_request_context("/"):
        view_request["context"] = _cv_request.get()
        stream = StreamingCSVExportCommand(mocker.MagicMock()).run()()
        assert next(stream) == "id\n"

    assert _cv_request.get(None) is outer
    assert list(stream) == ["1\n"]
    assert seen == [True, True]
    assert _cv_request.get(None) is outer


def test_reload_if_detached_keeps_changes_made_meanwhile(
    app: Any,
    session: Session,
) -> None:
    """
    An instance the request loaded is reloaded rather than merged, so the
    export's commit can't write the values it read during the request back
    over a change made since (an admin editing the connection, say).
    """
    user = _detached_user(session, expired=False)
    assert user.email == "alice@example.com"
    session.query(User).filter_by(username="alice").update(
        {"email": "changed@example.com"}
    )
    session.commit()

    reloaded = _reload_if_detached(user)
    session.commit()

    assert reloaded is not user
    assert reloaded.email == "changed@example.com"
    assert (
        session.query(User.email).filter_by(username="alice").scalar()
        == "changed@example.com"
    )
