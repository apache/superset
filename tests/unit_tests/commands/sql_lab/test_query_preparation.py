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
"""Prepared warning attempts retain SQL and control confirmation dispatch."""

from collections.abc import Iterator
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask, g
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.sqla.models import User
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from superset.commands.sql_lab.query import QueryPruneCommand
from superset.common.db_query_status import QueryStatus
from superset.daos.query import QueryDAO
from superset.db_engine_specs.query_warning import QueryCostEstimate
from superset.exceptions import (
    SupersetErrorException,
    SupersetGenericErrorException,
    SupersetSyntaxErrorException,
)
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.queries.filters import QueryFilter
from superset.sqllab.api import SqlLabRestApi
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.sqllab.exceptions import SqlLabException
from superset.sqllab.query_preparation import (
    discard_preparation,
    PREPARATION_KEY,
)
from superset.sqllab.query_render import SqlQueryRenderException
from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext
from superset.utils import json


@pytest.fixture
def session_engine(tmp_path: Path) -> Iterator[Engine]:
    """Use independent database connections for confirmation/cancellation races."""
    engine = create_engine(f"sqlite:///{tmp_path / 'preparations.db'}")
    yield engine
    engine.dispose()


@pytest.fixture
def preparation(app: Flask, session: Session, mocker: MockerFixture) -> Iterator[Any]:
    """Use real persistence and preparation; stub external I/O."""
    Query.metadata.create_all(session.get_bind())
    database = Database(
        database_name="preparation",
        sqlalchemy_uri="postgresql://localhost/test",
        allow_dml=False,
        extra=json.dumps(
            {
                "cost_estimate_enabled": True,
                "query_cost_warning": {
                    "enabled": True,
                    "all_users": True,
                    "metric": "total_cost",
                    "threshold": 10,
                },
            }
        ),
    )
    session.add(database)
    session.commit()
    mocker.patch("superset.commands.sql_lab.estimate.security_manager.raise_for_access")
    mocker.patch(
        "superset.commands.sql_lab.estimate.is_feature_enabled", return_value=True
    )
    mocker.patch(
        "superset.db_engine_specs.query_warning.is_feature_enabled", return_value=True
    )
    mocker.patch.object(database, "get_default_catalog", return_value="test")
    mocker.patch.object(database, "get_default_schema_for_query", return_value="public")
    estimator = mocker.patch.object(
        database.db_engine_spec,
        "estimate_query_cost_for_warning",
        return_value=QueryCostEstimate.from_value(20),
    )
    mocker.patch(
        "superset.commands.sql_lab.estimate.DatabaseDAO.find_by_id",
        return_value=database,
    )
    mocker.patch(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        side_effect=lambda flag: flag == "ENABLE_TEMPLATE_PROCESSING",
    )
    mocker.patch("superset.sqllab.query_render.is_feature_enabled", return_value=True)
    params = {
        "database_id": database.id,
        "sql": "SELECT {{ amount }}",
        "templateParams": '{"amount": 42}',
        "client_id": "prepare001",
        "schema": "public",
        "catalog": "test",
        "queryLimit": 1000,
        "runAsync": False,
        "expand_data": True,
    }
    command_factory = SqlLabRestApi._create_sql_json_command

    def make(**overrides: Any) -> Any:
        context = SqlJsonExecutionContext({**params, **overrides})
        command = command_factory(context, None)
        command._database_dao = MagicMock()
        command._database_dao.find_by_id.return_value = database
        mocker.patch.object(
            command._sql_json_executor,
            "execute",
            return_value=SqlJsonExecutionStatus.QUERY_IS_RUNNING,
        )
        mocker.patch.object(command._access_validator, "validate")
        return command

    with app.test_request_context():
        user = User(
            username="preparer",
            first_name="Query",
            last_name="User",
            email="query@example.invalid",
            active=True,
        )
        session.add(user)
        session.commit()
        g.user = user
        mocker.patch(
            "superset.sqllab.sqllab_execution_context.get_user_id", return_value=user.id
        )
        mocker.patch(
            "superset.sqllab.query_preparation.get_user_id", return_value=user.id
        )
        mocker.patch("superset.daos.query.get_user_id", return_value=user.id)
        yield make, database, estimator


def test_prepare_confirm_retains_render_and_is_hidden(
    preparation: Any,
    session: Session,
    mocker: MockerFixture,
) -> None:
    make, _, estimate = preparation
    command = make()
    render = mocker.spy(command._sql_query_render, "render")
    response = command.prepare_warning()
    query = session.query(Query).one()
    assert response["result"]["action"] == "confirm"
    assert query.status == QueryStatus.PREPARED
    assert "42" in estimate.call_args.args[3]
    assert "LIMIT 1001" in estimate.call_args.args[3]
    assert PREPARATION_KEY not in query.to_dict()["extra"]
    assert QueryDAO.get_queries_changed_after(0) == []
    mocker.patch(
        "superset.queries.filters.security_manager.can_access_all_queries",
        return_value=True,
    )
    assert (
        QueryFilter("id", SQLAInterface(Query)).apply(session.query(Query), None).all()
        == []
    )
    resume = make(prepared_query_id=response["prepared_query_id"])
    resume._sql_query_render.render = MagicMock(
        side_effect=AssertionError("must not render again")
    )
    resume.run()
    assert query.status == QueryStatus.PENDING
    executed_sql = "SELECT 42 LIMIT 1001"
    columns = [{"name": "answer"}]
    query.executed_sql = executed_sql
    QueryDAO.save_metadata(query, {"columns": columns})
    query.status = QueryStatus.SUCCESS
    session.commit()

    def validate_existing_query(checked: Query, template_params: Any) -> None:
        assert checked.executed_sql == "SELECT 42"
        # Access-check lookups must not flush temporary SQL into the saved record.
        assert (
            session.query(Query.executed_sql).filter_by(id=checked.id).scalar()
            == executed_sql
        )

    resume._access_validator.validate.side_effect = validate_existing_query
    resume.run()
    resume.run()
    session.refresh(query)
    resume._sql_json_executor.execute.assert_called_once()
    assert resume._sql_json_executor.execute.call_args.args[1] == "SELECT 42"
    render.assert_called_once()
    assert query.status == QueryStatus.SUCCESS
    assert query.executed_sql == executed_sql
    assert query.extra["columns"] == columns
    assert columns == [{"name": "answer", "column_name": "answer"}]


@pytest.mark.parametrize(
    "sql", ["SELECT '{{1,2},{3,4}}'::int[]", "SELECT 'x' LIKE '{%'"]
)
def test_disabled_templates_preserve_literal_braces(
    preparation: Any,
    app: Flask,
    mocker: MockerFixture,
    sql: str,
) -> None:
    make, _, estimate = preparation
    mocker.patch(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        return_value=False,
    )
    mocker.patch("superset.sqllab.query_render.is_feature_enabled", return_value=False)
    make(sql=sql, templateParams="{}").prepare_warning()
    assert (
        "{{1,2}" in estimate.call_args.args[3] or "'{%'" in estimate.call_args.args[3]
    )


@pytest.mark.parametrize("sql", ["SELECT {{ missing.attribute }}", "SELECT {{ broken"])
def test_render_error_stops_before_assessment(
    preparation: Any,
    session: Session,
    sql: str,
) -> None:
    make, _, estimate = preparation
    command = make(sql=sql, templateParams="{}")
    with pytest.raises((SupersetSyntaxErrorException, SqlQueryRenderException)):
        command.prepare_warning()
    estimate.assert_not_called()
    command._sql_json_executor.execute.assert_not_called()
    assert session.query(Query).one().status == QueryStatus.DISCARDED


@pytest.mark.parametrize("change", ["sql", "limit", "owner", "connection", "cancel"])
def test_changed_or_discarded_preparation_cannot_execute(
    preparation: Any,
    session: Session,
    change: str,
) -> None:
    make, database, _ = preparation
    response = make().prepare_warning()
    query = session.query(Query).one()
    kwargs = {"prepared_query_id": response["prepared_query_id"]}
    if change == "sql":
        kwargs["sql"] = "SELECT 99"
    if change == "limit":
        kwargs["queryLimit"] = 20
    if change == "owner":
        query.user_id = 99
    if change == "connection":
        database.extra = "{}"
    if change == "cancel":
        discard_preparation(query.client_id)
    session.commit()
    command = make(**kwargs)
    with pytest.raises(SupersetGenericErrorException):
        command._resume_prepared_query()
    command._sql_json_executor.execute.assert_not_called()


def test_cancel_during_preparation_cannot_publish_or_execute(
    preparation: Any,
    session: Session,
) -> None:
    make, _, estimate = preparation

    def cancel_estimate(*args: Any) -> QueryCostEstimate:
        discard_preparation("prepare001")
        return QueryCostEstimate.from_value(20)

    estimate.side_effect = cancel_estimate
    command = make()
    with pytest.raises(SupersetGenericErrorException):
        command.prepare_warning()
    assert session.query(Query).one().status == QueryStatus.DISCARDED
    command._sql_json_executor.execute.assert_not_called()


def test_query_retention_removes_old_attempts_and_preserves_recent_history(
    preparation: Any, session: Session
) -> None:
    """Ordinary retention uses changed_on across both hidden and executed queries."""
    make, _, _ = preparation
    now = datetime.now()
    retained_ids = []
    old_prepared = None
    for index, status in enumerate(
        [
            QueryStatus.PREPARING,
            QueryStatus.PREPARED,
            QueryStatus.DISCARDED,
            QueryStatus.SUCCESS,
            QueryStatus.FAILED,
        ]
    ):
        for old in (False, True):
            client_id = f"retain{index}{int(old)}"
            response = make(client_id=client_id).prepare_warning()
            query = session.query(Query).filter_by(client_id=client_id).one()
            query.status = status
            query.changed_on = now - timedelta(days=31 if old else 1)
            # Start time does not control the existing history retention policy.
            query.start_time = now.timestamp() * 1000 if old else 0
            if not old:
                retained_ids.append(query.id)
            elif status == QueryStatus.PREPARED:
                old_prepared = make(
                    client_id=client_id,
                    prepared_query_id=response["prepared_query_id"],
                )
    session.commit()
    QueryPruneCommand(retention_period_days=30).run()
    session.expire_all()
    assert sorted(row.id for row in session.query(Query).all()) == retained_ids
    assert old_prepared is not None
    with pytest.raises(SupersetGenericErrorException):
        old_prepared.run()
    old_prepared._sql_json_executor.execute.assert_not_called()


@pytest.mark.parametrize("peer_action", ["confirm", "cancel"])
def test_concurrent_confirmation_and_cancellation(
    preparation: Any,
    session_engine: Engine,
    mocker: MockerFixture,
    peer_action: str,
) -> None:
    """A second connection wins while the first request still holds a stale object."""
    from superset.sqllab.query_preparation import validate_prepared_sql

    make, _, _ = preparation
    response = make().prepare_warning()
    first = make(prepared_query_id=response["prepared_query_id"])
    second = make(prepared_query_id=response["prepared_query_id"])
    interleaved = False

    def before_claim(query: Query, script: Any) -> None:
        nonlocal interleaved
        validate_prepared_sql(query, script)
        if interleaved:
            return
        interleaved = True
        with Session(session_engine) as peer, patch("superset.db.session", peer):
            if peer_action == "confirm":
                second._resume_prepared_query()
            else:
                discard_preparation("prepare001")

    mocker.patch(
        "superset.sqllab.query_preparation.validate_prepared_sql",
        side_effect=before_claim,
    )
    if peer_action == "cancel":
        with pytest.raises(SupersetGenericErrorException):
            first._resume_prepared_query()
    else:
        first._resume_prepared_query()
    first._sql_json_executor.execute.assert_not_called()
    assert second._sql_json_executor.execute.call_count == int(peer_action == "confirm")


def test_confirmation_rechecks_rendered_permissions(
    preparation: Any, mocker: MockerFixture
) -> None:
    make, _, _ = preparation
    response = make().prepare_warning()
    command = make(prepared_query_id=response["prepared_query_id"])
    mocker.patch.object(
        command._access_validator, "validate", side_effect=PermissionError("revoked")
    )
    from superset.sqllab.exceptions import QueryIsForbiddenToAccessException

    with pytest.raises(QueryIsForbiddenToAccessException):
        command._resume_prepared_query()
    command._sql_json_executor.execute.assert_not_called()


def test_delayed_confirmation_executes_original_template_once(
    preparation: Any,
    session: Session,
    mocker: MockerFixture,
) -> None:
    from superset.jinja_context import BaseTemplateProcessor, get_template_processors

    renders = []

    class ChangingProcessor(BaseTemplateProcessor):
        def process_template(self, sql: str, **kwargs: Any) -> str:
            renders.append(sql)
            return f"SELECT {len(renders)}"

    mocker.patch.dict(get_template_processors(), {"postgresql": ChangingProcessor})
    make, _, estimate = preparation
    response = make().prepare_warning()
    prepared = session.query(Query).one()
    prepared_id = prepared.id
    mocker.patch(
        "superset.commands.sql_lab.execute.now_as_float",
        return_value=float(prepared.start_time) + 30 * 60 * 1000,
    )
    command = make(prepared_query_id=response["prepared_query_id"])
    command.run()
    command.run()
    assert session.query(Query).one().id == prepared_id
    command._sql_json_executor.execute.assert_called_once()
    assert len(renders) == 1
    estimate.assert_called_once()
    assert "SELECT" in estimate.call_args.args[3]
    assert command._sql_json_executor.execute.call_args.args[1] == "SELECT 1"


@pytest.mark.parametrize("excluded", [False, True])
def test_inapplicable_warning_does_not_prepare(
    preparation: Any, session: Session, mocker: MockerFixture, excluded: bool
) -> None:
    make, database, estimate = preparation
    mocker.patch(
        "superset.db_engine_specs.query_warning.security_manager.has_access",
        return_value=not excluded,
    )
    # An excluded user's invalid threshold must not create a hidden preparation.
    rule = {"enabled": True, "threshold": -1} if excluded else {"enabled": False}
    database.extra = json.dumps({"query_cost_warning": rule})
    assert make().prepare_warning() == {"result": {"action": "proceed"}}
    assert session.query(Query).count() == 0
    estimate.assert_not_called()


def test_rendered_multiple_statements_still_require_confirmation(
    preparation: Any,
) -> None:
    make, _, estimate = preparation
    command = make(sql="SELECT {{ amount }}; SELECT 2")
    response = command.prepare_warning()
    assert response["result"]["reason"] == "unavailable"
    estimate.assert_not_called()
    resume = make(
        sql="SELECT {{ amount }}; SELECT 2",
        prepared_query_id=response["prepared_query_id"],
    )
    resume._resume_prepared_query()
    assert resume._sql_json_executor.execute.call_args.args[1] == "SELECT 42; SELECT 2"


def test_changed_rls_invalidates_assessment(
    preparation: Any, mocker: MockerFixture
) -> None:
    make, _, _ = preparation
    mocker.patch(
        "superset.sql_lab.is_feature_enabled",
        side_effect=lambda flag: flag == "RLS_IN_SQLLAB",
    )
    predicates = mocker.patch(
        "superset.utils.rls.get_predicates_for_table", return_value=["tenant_id = 1"]
    )
    response = make(sql="SELECT * FROM public.sales").prepare_warning()
    predicates.return_value = ["tenant_id = 2"]
    command = make(
        sql="SELECT * FROM public.sales",
        prepared_query_id=response["prepared_query_id"],
    )
    with pytest.raises(SupersetGenericErrorException):
        command._resume_prepared_query()
    command._sql_json_executor.execute.assert_not_called()


def test_async_dispatch_receives_committed_prepared_query(
    preparation: Any, session_engine: Engine
) -> None:
    from superset.sqllab.sql_json_executer import ASynchronousSqlJsonExecutor

    make, _, _ = preparation
    response = make(runAsync=True).prepare_warning()
    task = MagicMock()
    seen = []

    def enqueue(query_id: int, rendered: str, **kwargs: Any) -> MagicMock:
        with Session(session_engine) as worker:
            query = worker.get(Query, query_id)
            assert query is not None
            seen.append((rendered, query.limit, query.status))
        return MagicMock()

    task.delay.side_effect = enqueue
    command = make(runAsync=True, prepared_query_id=response["prepared_query_id"])
    command._sql_json_executor = ASynchronousSqlJsonExecutor(QueryDAO(), task)
    command._resume_prepared_query()
    assert seen == [("SELECT 42", 1000, QueryStatus.PENDING)]


def test_confirmation_uses_updated_tab_bookkeeping(
    preparation: Any, session: Session
) -> None:
    make, _, _ = preparation
    response = make(sql_editor_id="local", tab="Original").prepare_warning()
    command = make(
        prepared_query_id=response["prepared_query_id"],
        sql_editor_id="123",
        tab="Renamed",
    )
    command._resume_prepared_query()
    query = session.query(Query).one()
    assert query.sql_editor_id == "123"
    assert query.tab_name == "Renamed"
    command._sql_json_executor.execute.assert_called_once()


@pytest.mark.parametrize("confirm", [True, False])
def test_warning_api_retains_and_consumes_preparation(
    preparation: Any,
    client: Any,
    full_api_access: None,
    session: Session,
    mocker: MockerFixture,
    confirm: bool,
) -> None:
    make, database, estimate = preparation
    commands = []

    def factory(context: SqlJsonExecutionContext, log_params: Any) -> Any:
        command = make()
        command._execution_context = context
        commands.append(command)
        return command

    mocker.patch.object(SqlLabRestApi, "_create_sql_json_command", side_effect=factory)
    execution = {
        "database_id": database.id,
        "sql": "SELECT {{ amount }}",
        "templateParams": '{"amount": 42}',
        "client_id": "http001",
        "queryLimit": 1000,
        "runAsync": False,
    }
    response = client.post(
        "/api/v1/sqllab/warning/",
        json={
            "database_id": database.id,
            "sql": execution["sql"],
            "execution": execution,
        },
    )
    assert response.status_code == 200, response.json
    assert response.json["result"]["action"] == "confirm"
    identifier = response.json["prepared_query_id"]
    assert session.query(Query).one().status == QueryStatus.PREPARED
    if not confirm:
        response = client.delete("/api/v1/sqllab/warning/http001")
        assert response.status_code == 200
        assert session.query(Query).one().status == QueryStatus.DISCARDED
    response = client.post(
        "/api/v1/sqllab/execute/", json={**execution, "prepared_query_id": identifier}
    )
    assert response.status_code == (202 if confirm else 400), response.json
    assert sum(
        command._sql_json_executor.execute.call_count for command in commands
    ) == int(confirm)
    estimate.assert_called_once()


def test_worker_rejects_a_new_sql_mutator_after_assessment(
    preparation: Any, session: Session, app: Flask, mocker: MockerFixture
) -> None:
    from superset.sql.parse import SQLScript
    from superset.sqllab.query_preparation import validate_prepared_sql

    make, _, _ = preparation
    make().prepare_warning()
    query = session.query(Query).one()
    sql = query.extra[PREPARATION_KEY]["assessed_sql"]
    mocker.patch.dict(
        app.config, {"SQL_QUERY_MUTATOR": lambda sql, **kwargs: "SELECT 99"}
    )
    with pytest.raises(SupersetGenericErrorException):
        validate_prepared_sql(query, SQLScript(sql, engine="postgresql"))


@pytest.mark.parametrize("prepared", [False, True])
@pytest.mark.parametrize("run_async", [False, True])
def test_dispatch_failure_survives_command_rollback(
    preparation: Any, session_engine: Engine, prepared: bool, run_async: bool
) -> None:
    """Read durable state after the complete command, including its rollback."""
    from superset.sqllab.sql_json_executer import ASynchronousSqlJsonExecutor

    make, _, _ = preparation
    response = make(runAsync=run_async).prepare_warning() if prepared else {}
    command = make(
        runAsync=run_async, prepared_query_id=response.get("prepared_query_id")
    )
    if run_async:
        task = MagicMock()
        task.delay.side_effect = ConnectionError("broker unavailable")
        command._sql_json_executor = ASynchronousSqlJsonExecutor(QueryDAO(), task)
        exception: type[Exception] = SupersetErrorException
        message = "Failed to start remote query on a worker."
    else:
        command._sql_json_executor.execute.side_effect = RuntimeError("dispatch failed")
        exception = SqlLabException
        message = "dispatch failed"

    with pytest.raises(exception, match=message):
        command.run()

    with Session(session_engine) as observer:
        query = observer.query(Query).one()
        assert query.status == QueryStatus.FAILED
        assert query.error_message == message
        assert query.end_time is not None
        assert query.extra["errors"][0]["message"] == message
        if prepared:
            assert query.extra[PREPARATION_KEY]["id"] == response["prepared_query_id"]
    if run_async:
        task.delay.assert_called_once()
        task.delay.return_value.forget.assert_not_called()
    else:
        command._sql_json_executor.execute.assert_called_once()


@pytest.mark.parametrize(
    "worker_status",
    [
        QueryStatus.RUNNING,
        QueryStatus.STOPPED,
        QueryStatus.SUCCESS,
        QueryStatus.FAILED,
        QueryStatus.TIMED_OUT,
    ],
)
def test_dispatch_error_preserves_concurrent_outcome(
    preparation: Any, session_engine: Engine, worker_status: str
) -> None:
    """A stale request cannot replace the worker's state or a committed stop."""
    make, _, _ = preparation
    response = make().prepare_warning()
    command = make(prepared_query_id=response["prepared_query_id"])

    def fail_after_worker_update(context: Any, *_: Any) -> None:
        with Session(session_engine) as worker:
            query = worker.get(Query, context.query.id)
            assert query is not None
            query.status = worker_status
            query.error_message = "worker detail"
            query.end_time = 123
            query.set_extra_json_key("worker_detail", "preserve")
            worker.commit()
        raise RuntimeError("dispatch failed")

    command._sql_json_executor.execute.side_effect = fail_after_worker_update
    with pytest.raises(SqlLabException, match="dispatch failed"):
        command.run()
    with Session(session_engine) as observer:
        query = observer.query(Query).one()
        assert query.status == worker_status
        assert query.error_message == "worker detail"
        assert query.end_time == 123
        assert query.extra["worker_detail"] == "preserve"
        assert "errors" not in query.extra


@pytest.mark.parametrize("prepared", [False, True])
@pytest.mark.parametrize("cleanup_error", [NotImplementedError, ConnectionError])
def test_async_cleanup_error_does_not_fail_submitted_query(
    preparation: Any,
    session_engine: Engine,
    prepared: bool,
    cleanup_error: type[Exception],
) -> None:
    """Failure to forget the task result does not undo a successful submission."""
    from superset.sqllab.sql_json_executer import ASynchronousSqlJsonExecutor

    make, _, _ = preparation
    response = make(runAsync=True).prepare_warning() if prepared else {}
    command = make(runAsync=True, prepared_query_id=response.get("prepared_query_id"))
    task = MagicMock()
    task.delay.return_value.forget.side_effect = cleanup_error("cleanup unavailable")
    command._sql_json_executor = ASynchronousSqlJsonExecutor(QueryDAO(), task)

    assert command.run()["status"] == SqlJsonExecutionStatus.QUERY_IS_RUNNING
    task.delay.assert_called_once()
    task.delay.return_value.forget.assert_called_once()
    with Session(session_engine) as observer:
        query = observer.query(Query).one()
        assert query.status == QueryStatus.PENDING
        assert query.error_message is None
        assert "errors" not in query.extra


@pytest.mark.parametrize("broken_transaction", [False, True])
def test_dispatch_failure_preserves_original_error_on_metadata_failure(
    preparation: Any,
    session: Session,
    session_engine: Engine,
    mocker: MockerFixture,
    broken_transaction: bool,
) -> None:
    """Recover a failed session; if saving also fails, retain the original error."""
    make, _, _ = preparation
    response = make().prepare_warning()
    command = make(prepared_query_id=response["prepared_query_id"])

    def fail(context: Any, *_: Any) -> None:
        if broken_transaction:
            # A real flush failure expires ORM attributes and requires rollback.
            session.add(
                Query(
                    client_id=context.client_id,
                    database_id=context.database_id,
                    sql="SELECT 1",
                )
            )
            session.flush()
        else:
            mocker.patch.object(
                session, "commit", side_effect=SQLAlchemyError("save failed")
            )
            raise RuntimeError("original dispatch failure")

    command._sql_json_executor.execute.side_effect = fail
    expected = (
        "UNIQUE constraint failed"
        if broken_transaction
        else "original dispatch failure"
    )
    with pytest.raises(SqlLabException, match=expected):
        command.run()
    with Session(session_engine) as observer:
        query = observer.query(Query).one()
        if broken_transaction:
            assert query.status == QueryStatus.FAILED
            assert expected in query.error_message
        else:
            assert query.status == QueryStatus.PENDING
            assert query.error_message is None
