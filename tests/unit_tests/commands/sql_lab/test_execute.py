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
"""Unit tests for ExecuteSqlCommand's authorization of the SQL it executes."""

from unittest.mock import MagicMock, patch

import pytest

from superset.commands.sql_lab.execute import ExecuteSqlCommand
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.sqllab.exceptions import QueryIsForbiddenToAccessException


def _make_command(**overrides: MagicMock) -> ExecuteSqlCommand:
    kwargs: dict[str, MagicMock] = {
        "execution_context": MagicMock(),
        "query_dao": MagicMock(),
        "database_dao": MagicMock(),
        "access_validator": MagicMock(),
        "sql_query_render": MagicMock(),
        "execution_context_convertor": MagicMock(),
    }
    kwargs.update(overrides)
    return ExecuteSqlCommand(
        sqllab_ctas_no_limit_flag=False,
        **kwargs,
    )


# ---------------------------------------------------------------------------
# _validate_rendered_access: pin / delegate / reset
# ---------------------------------------------------------------------------


def test_validate_rendered_access_authorizes_the_literal_rendered_sql() -> None:
    """
    ``_validate_rendered_access`` must pin ``query.executed_sql`` to the
    already-rendered text *before* delegating to the access validator, so
    ``raise_for_access``'s "prefer executed_sql" path authorizes exactly
    the SQL that is about to execute rather than re-rendering the Jinja
    source (which could pick a different table for a nondeterministic
    template). Afterwards ``executed_sql`` must be reset so the execution
    path can assign its own final (limited / per-block mutated) SQL.
    """
    command = _make_command()
    query = MagicMock()
    query.executed_sql = None
    seen_executed_sql = []

    def _capture_validate(q: MagicMock, template_params: object) -> None:
        seen_executed_sql.append(q.executed_sql)

    command._access_validator.validate.side_effect = _capture_validate  # type: ignore[attr-defined]  # noqa: E501

    command._validate_rendered_access(query, "SELECT * FROM sales")

    assert seen_executed_sql == ["SELECT * FROM sales"]
    assert query.executed_sql is None


def test_validate_rendered_access_resets_executed_sql_on_denial() -> None:
    """
    A denial for the rendered SQL must still surface as
    ``QueryIsForbiddenToAccessException`` and must not leave
    ``query.executed_sql`` pinned to the rejected text.
    """
    command = _make_command()
    query = MagicMock()
    query.executed_sql = None
    command._access_validator.validate.side_effect = Exception("access denied")  # type: ignore[attr-defined]  # noqa: E501

    with pytest.raises(QueryIsForbiddenToAccessException):
        command._validate_rendered_access(query, "SELECT * FROM secret_payroll")

    assert query.executed_sql is None


# ---------------------------------------------------------------------------
# Regression: nondeterministic templates must not let execution diverge
# from the authorized render
# ---------------------------------------------------------------------------


@patch("superset.commands.sql_lab.execute.db")
def test_run_sql_json_exec_from_scratch_revalidates_rendered_sql(
    mock_db: MagicMock,
) -> None:
    """
    Regression: previously only ``query.sql`` + ``template_params`` was
    authorized (render #1, inside the access validator) while a second,
    independent render (``sql_query_render.render()``) produced the SQL
    that was actually handed to the executor. A nondeterministic Jinja
    construct (e.g. the ``random`` filter picking a table) could make the
    two renders diverge, letting a query read a table the authorization
    check never saw. The literal rendered SQL must now be re-validated
    before it reaches the executor.
    """
    execution_context = MagicMock()
    execution_context.template_params = {}
    # Skip the query-limit machinery entirely; it is unrelated to this fix.
    execution_context.select_as_cta = True

    query = MagicMock()
    query.id = 1
    query.executed_sql = None
    execution_context.create_query.return_value = query

    database_dao = MagicMock()
    database_dao.find_by_id.return_value = MagicMock()

    access_validator = MagicMock()
    validate_calls: list[object] = []

    def _capture_validate(q: MagicMock, template_params: object) -> None:
        validate_calls.append(q.executed_sql)

    access_validator.validate.side_effect = _capture_validate

    sql_query_render = MagicMock()
    sql_query_render.render.return_value = "SELECT * FROM sales"

    command = _make_command(
        execution_context=execution_context,
        database_dao=database_dao,
        access_validator=access_validator,
        sql_query_render=sql_query_render,
    )
    command._sqllab_ctas_no_limit = True
    # Stub the actual execution dispatch; this test only pins the re-validation
    # of the literal rendered SQL before it reaches execution.
    execute = MagicMock(return_value=SqlJsonExecutionStatus.HAS_RESULTS)
    command._execute = execute  # type: ignore[method-assign]

    command._run_sql_json_exec_from_scratch()

    # Authorized twice: once before rendering (macros with side effects run
    # at render time) and again against the literal, already-rendered SQL
    # that execution is about to run.
    assert access_validator.validate.call_count == 2
    assert validate_calls == [None, "SELECT * FROM sales"]
    # executed_sql is not left pinned; the execution path assigns its own
    # final value.
    assert query.executed_sql is None
    execute.assert_called_once_with("SELECT * FROM sales")


# ---------------------------------------------------------------------------
# _execute / _execute_sync / _prepare_async / submit_async dispatch
# ---------------------------------------------------------------------------

_EXEC = "superset.commands.sql_lab.execute"
_ENTRY = "superset.sql.execution.sqllab_executor.execute_sql_lab_query"


def _sync_context() -> MagicMock:
    ctx = MagicMock()
    ctx.is_run_asynchronous.return_value = False
    ctx.select_as_cta = False
    ctx.expand_data = False
    ctx.query.id = 1
    return ctx


@patch(f"{_EXEC}.app")
@patch(f"{_EXEC}.is_feature_enabled", return_value=False)
def test_execute_sync_runs_entry_and_sets_result(
    mock_flag: MagicMock, mock_app: MagicMock
) -> None:
    """Sync dispatch runs the executor entry inline and stores the payload."""
    mock_app.config = {"SQLLAB_TIMEOUT": 30}
    ctx = _sync_context()
    entry = patch(_ENTRY, return_value={"status": "success"}).start()
    try:
        command = _make_command(execution_context=ctx)
        assert command._execute("SELECT 1") == SqlJsonExecutionStatus.HAS_RESULTS
        entry.assert_called_once()
        assert entry.call_args.kwargs["return_results"] is True
        ctx.set_execution_result.assert_called_once_with({"status": "success"})
    finally:
        patch.stopall()


@patch(f"{_EXEC}.app")
@patch(f"{_EXEC}.is_feature_enabled", return_value=False)
def test_execute_sync_failed_payload_raises(
    mock_flag: MagicMock, mock_app: MagicMock
) -> None:
    """A FAILED payload from the sync path surfaces as an error exception."""
    from superset.exceptions import SupersetGenericDBErrorException

    mock_app.config = {"SQLLAB_TIMEOUT": 30}
    ctx = _sync_context()
    patch(_ENTRY, return_value={"status": "failed", "error": "boom"}).start()
    try:
        command = _make_command(execution_context=ctx)
        with pytest.raises(SupersetGenericDBErrorException):
            command._execute("SELECT 1")
    finally:
        patch.stopall()


@patch(f"{_EXEC}.is_feature_enabled", return_value=True)
def test_prepare_async_defers_scheduling(mock_flag: MagicMock) -> None:
    """Async dispatch (GTF enabled) prepares but does not schedule inline."""
    ctx = MagicMock()
    ctx.is_run_asynchronous.return_value = True
    command = _make_command(execution_context=ctx)
    assert command._execute("SELECT 1") == SqlJsonExecutionStatus.QUERY_IS_RUNNING
    assert command._pending_async is True
    assert command._rendered_query == "SELECT 1"


@patch(f"{_EXEC}.db")
@patch(f"{_EXEC}.is_feature_enabled", return_value=False)
def test_prepare_async_requires_gtf(mock_flag: MagicMock, mock_db: MagicMock) -> None:
    """Async with GLOBAL_TASK_FRAMEWORK disabled fails fast with a clear error."""
    from superset.exceptions import SupersetErrorException

    ctx = MagicMock()
    ctx.is_run_asynchronous.return_value = True
    command = _make_command(execution_context=ctx)
    with pytest.raises(SupersetErrorException):
        command._execute("SELECT 1")
    assert ctx.query.status == "failed"


def test_submit_async_schedules_task_keyed_by_client_id() -> None:
    """submit_async schedules the GTF task keyed by the browser client_id."""
    ctx = MagicMock()
    ctx.select_as_cta = False
    ctx.expand_data = False
    ctx.query.id = 7
    ctx.query.client_id = "abc123"
    command = _make_command(execution_context=ctx)
    command._pending_async = True
    command._rendered_query = "SELECT 1"
    schedule = patch("superset.tasks.sql_queries.run_sql_lab_query.schedule").start()
    patch(f"{_EXEC}.get_username", return_value="admin").start()
    try:
        command.submit_async()
        schedule.assert_called_once()
        assert schedule.call_args.kwargs["options"].task_key == "abc123"
    finally:
        patch.stopall()


def test_submit_async_noop_when_not_pending() -> None:
    """submit_async does nothing for a sync command."""
    command = _make_command()
    command._pending_async = False
    command.submit_async()  # must not raise / schedule


@patch(f"{_EXEC}.app")
@patch(f"{_EXEC}.is_feature_enabled", return_value=False)
def test_execute_sync_entry_error_builds_failed_payload(
    mock_flag: MagicMock, mock_app: MagicMock
) -> None:
    """An execution error is turned into a FAILED payload (via handle_query_error)
    and surfaced as a rich SupersetErrorsException."""
    import dataclasses

    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetErrorsException

    mock_app.config = {"SQLLAB_TIMEOUT": 30}
    ctx = _sync_context()
    failed_payload = {
        "status": "failed",
        "errors": [
            dataclasses.asdict(
                SupersetError(
                    message="db boom",
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )
        ],
    }
    patch(_ENTRY, side_effect=RuntimeError("db boom")).start()
    patch("superset.sql_lab.get_query", return_value=ctx.query).start()
    patch("superset.sql_lab.handle_query_error", return_value=failed_payload).start()
    try:
        command = _make_command(execution_context=ctx)
        with pytest.raises(SupersetErrorsException):
            command._execute("SELECT 1")
    finally:
        patch.stopall()


def test_submit_async_schedule_failure_marks_query_failed() -> None:
    """A scheduling failure marks the Query FAILED and raises."""
    from superset.exceptions import SupersetErrorException

    ctx = MagicMock()
    ctx.select_as_cta = False
    ctx.expand_data = False
    ctx.query.id = 7
    ctx.query.client_id = "abc123"
    command = _make_command(execution_context=ctx)
    command._pending_async = True
    command._rendered_query = "SELECT 1"
    patch(
        "superset.tasks.sql_queries.run_sql_lab_query.schedule",
        side_effect=RuntimeError("broker down"),
    ).start()
    patch(f"{_EXEC}.get_username", return_value="admin").start()
    patch(f"{_EXEC}.db").start()
    try:
        with pytest.raises(SupersetErrorException):
            command.submit_async()
        assert ctx.query.status == "failed"
    finally:
        patch.stopall()
