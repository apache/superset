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
        "sql_json_executor": MagicMock(),
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

    sql_json_executor = MagicMock()
    sql_json_executor.execute.return_value = SqlJsonExecutionStatus.HAS_RESULTS

    command = _make_command(
        execution_context=execution_context,
        database_dao=database_dao,
        access_validator=access_validator,
        sql_query_render=sql_query_render,
        sql_json_executor=sql_json_executor,
    )
    command._sqllab_ctas_no_limit = True

    command._run_sql_json_exec_from_scratch()

    # Authorized twice: once before rendering (macros with side effects run
    # at render time) and again against the literal, already-rendered SQL
    # that the executor is about to run.
    assert access_validator.validate.call_count == 2
    assert validate_calls == [None, "SELECT * FROM sales"]
    # executed_sql is not left pinned; the execution path assigns its own
    # final value.
    assert query.executed_sql is None
    sql_json_executor.execute.assert_called_once_with(
        execution_context, "SELECT * FROM sales", None
    )


# ---------------------------------------------------------------------------
# Regression: the recomputed row limit must be committed before the async
# executor can race it (apache/superset#40070)
# ---------------------------------------------------------------------------


class _FakeQuery:
    """
    A minimal stand-in whose ``.limit`` behaves like the real ORM attribute,
    so a commit's side effect can observe its *live* value. A plain
    ``MagicMock`` attribute can't distinguish "assigned in memory" from
    "actually committed" the way this test needs to.
    """

    def __init__(self, limit: int) -> None:
        self.id = 1
        self.limit = limit
        self.select_as_cta = False
        self.executed_sql: str | None = None


@patch("superset.commands.sql_lab.execute.db")
def test_run_sql_json_exec_from_scratch_commits_recomputed_limit_before_dispatch(
    mock_db: MagicMock,
) -> None:
    """
    Regression for apache/superset#40070 (same mechanism, confirmed by a
    community member there, never fixed).

    ``_set_query_limit`` recomputes ``query.limit`` as ``min(sql_limit,
    dropdown_limit)`` and the DAO ``update`` call assigns it in place, but
    neither commits. For an async (Celery) query, ``sql_json_executor.execute``
    below is ``ASynchronousSqlJsonExecutor.execute`` -- it hands the query off
    via ``.delay()`` to a worker that re-fetches the row on its own
    connection (``get_query`` in ``superset/sql_lab.py``). Under READ
    COMMITTED, that worker only sees the recomputed limit once it is
    actually committed; otherwise it reads the row as it was at creation
    time -- the raw dropdown value written by ``create_query()``, which is
    always >= the correct minimum. That is exactly "the dropdown wins" even
    though the query's own LIMIT was smaller.

    A real Celery worker isn't needed to pin this: it is enough to prove the
    commit boundary is in the right place -- that by the time the executor
    is invoked, a commit has already been observed with the *corrected*
    limit, not just the row's original creation-time value.
    """
    query = _FakeQuery(limit=1000)  # raw dropdown value, as written by create_query()

    observed_limits_at_commit: list[int] = []
    mock_db.session.commit.side_effect = lambda: observed_limits_at_commit.append(
        query.limit
    )

    execution_context = MagicMock()
    execution_context.template_params = {}
    execution_context.select_as_cta = False
    execution_context.limit = 1000  # the dropdown value the user chose
    execution_context.create_query.return_value = query
    execution_context.query = query
    execution_context.database.db_engine_spec.get_limit_from_sql.return_value = 200

    database_dao = MagicMock()
    database_dao.find_by_id.return_value = MagicMock()

    sql_query_render = MagicMock()
    sql_query_render.render.return_value = "SELECT * FROM sales LIMIT 200"

    def _fake_execute(*_args: object, **_kwargs: object) -> SqlJsonExecutionStatus:
        assert 200 in observed_limits_at_commit, (
            "the recomputed row limit (min of the query's own LIMIT and the "
            "dropdown) must be committed before the async executor dispatches "
            "to a Celery worker, or a worker racing the dispatch can read "
            "back the stale pre-recompute (dropdown) value instead"
        )
        return SqlJsonExecutionStatus.QUERY_IS_RUNNING

    sql_json_executor = MagicMock()
    sql_json_executor.execute.side_effect = _fake_execute

    command = _make_command(
        execution_context=execution_context,
        database_dao=database_dao,
        sql_query_render=sql_query_render,
        sql_json_executor=sql_json_executor,
    )

    command._run_sql_json_exec_from_scratch()

    assert query.limit == 200
    sql_json_executor.execute.assert_called_once()
