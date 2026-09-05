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
# pylint: disable=unused-argument

from typing import Any

import pytest
from pytest_mock import MockerFixture

from superset.common.db_query_status import QueryStatus
from superset.tasks.sql_queries import run_sql_lab_query, SQL_LAB_TASK

_MOD = "superset.tasks.sql_queries"
_ENTRY = "superset.sql.execution.sqllab_executor.execute_sql_lab_query"


def test_sql_lab_task_type_is_superset_sql_lab() -> None:
    """The GTF task type is ``superset.sql_lab`` (what the SQL Lab client filters)."""
    assert SQL_LAB_TASK == "superset.sql_lab"
    assert run_sql_lab_query.name == "superset.sql_lab"


def _wire(mocker: MockerFixture, ctx: Any) -> Any:
    """Patch the task's lazily-imported deps + context; return the mocked Query."""
    mocker.patch(f"{_MOD}.get_context", return_value=ctx)
    mocker.patch(f"{_MOD}.override_user")
    mocker.patch(f"{_MOD}.security_manager")
    mocker.patch(f"{_MOD}.db")
    query = mocker.MagicMock()
    query.end_time = None
    mocker.patch("superset.sql_lab.get_query", return_value=query)
    return query


def test_run_sql_lab_query_success(mocker: MockerFixture, app) -> None:
    """Happy path: the entry runs; no error mirroring; correct args wired."""
    ctx = mocker.MagicMock(aborting_in_flight=False, timeout_triggered=False)
    _wire(mocker, ctx)
    entry = mocker.patch(_ENTRY)

    run_sql_lab_query.func(
        1, "SELECT 1", store_results=True, expand_data=True, username="admin"
    )

    entry.assert_called_once()
    _, kwargs = entry.call_args
    assert kwargs["return_results"] is False
    assert kwargs["store_results"] is True
    assert kwargs["expand_data"] is True
    assert callable(kwargs["cancel_hook"])


def test_run_sql_lab_query_error_marks_failed_and_reraises(
    mocker: MockerFixture, app
) -> None:
    """A genuine execution error fails the Query and propagates (→ task FAILURE)."""
    ctx = mocker.MagicMock(aborting_in_flight=False, timeout_triggered=False)
    _wire(mocker, ctx)
    mocker.patch(_ENTRY, side_effect=RuntimeError("boom"))
    handle_query_error = mocker.patch("superset.sql_lab.handle_query_error")

    with pytest.raises(RuntimeError):
        run_sql_lab_query.func(1, "SELECT 1", username="admin")

    handle_query_error.assert_called_once()


def test_run_sql_lab_query_abort_mirrors_stopped(mocker: MockerFixture, app) -> None:
    """An abort (killed query surfaces as an error) mirrors STOPPED, no re-raise."""
    ctx = mocker.MagicMock(aborting_in_flight=True, timeout_triggered=False)
    query = _wire(mocker, ctx)
    mocker.patch(_ENTRY, side_effect=RuntimeError("killed"))

    run_sql_lab_query.func(1, "SELECT 1", username="admin")  # must not raise

    assert query.status == QueryStatus.STOPPED


def test_run_sql_lab_query_timeout_mirrors_timed_out(
    mocker: MockerFixture, app
) -> None:
    """A timeout mirrors TIMED_OUT rather than STOPPED."""
    ctx = mocker.MagicMock(aborting_in_flight=True, timeout_triggered=True)
    query = _wire(mocker, ctx)
    mocker.patch(_ENTRY, side_effect=RuntimeError("timed out"))

    run_sql_lab_query.func(1, "SELECT 1", username="admin")

    assert query.status == QueryStatus.TIMED_OUT


def test_cancel_hook_registers_abort_and_persists_handle(
    mocker: MockerFixture, app
) -> None:
    """The cancel hook persists the engine handle and registers an abort handler
    that cancels the warehouse query over a fresh connection."""
    ctx = mocker.MagicMock(aborting_in_flight=False, timeout_triggered=False)
    _wire(mocker, ctx)
    entry = mocker.patch(_ENTRY)
    cancel_chart_query = mocker.patch(f"{_MOD}.cancel_chart_query")

    run_sql_lab_query.func(1, "SELECT 1", username="admin")
    cancel_hook = entry.call_args.kwargs["cancel_hook"]

    cancel_hook(7, "cancel-id-123")
    ctx.set_cancellation.assert_called_once_with(7, "cancel-id-123")
    ctx.on_abort.assert_called_once()

    # Invoke the registered abort handler → it kills the query over a fresh conn.
    abort_handler = ctx.on_abort.call_args.args[0]
    abort_handler()
    cancel_chart_query.assert_called_once()
