# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

import os
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path
from threading import Barrier
from typing import Any
from unittest.mock import Mock
from uuid import uuid4

import pytest
import sqlalchemy as sa
from pytest_mock import MockerFixture
from sqlalchemy.orm import sessionmaker

from superset.commands.report.execution_claim import (
    cancel_disabled_retry,
    claim_execution,
    normalize_window,
)
from superset.reports.models import ReportSchedule, ReportScheduleType, ReportState


def utc_now() -> datetime:
    """Match the metadata database's naive UTC timestamp representation."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


@pytest.fixture(params=["sqlite", "postgres"])
def claim_engine(tmp_path: Path, request: pytest.FixtureRequest) -> Iterator[sa.Engine]:
    """Exercise PostgreSQL REPEATABLE READ when a test database is provided."""
    if request.param == "sqlite":
        engine = sa.create_engine(f"sqlite:///{tmp_path / 'claims.db'}")
        ReportSchedule.__table__.create(engine)
        yield engine
        engine.dispose()
        return
    uri = os.environ.get("REPORT_CLAIM_TEST_DATABASE_URI") or os.environ.get(
        "SUPERSET__SQLALCHEMY_DATABASE_URI"
    )
    if not uri or sa.engine.make_url(uri).get_backend_name() != "postgresql":
        pytest.skip("Set REPORT_CLAIM_TEST_DATABASE_URI for PostgreSQL race coverage")
    schema = f"report_claim_test_{uuid4().hex}"
    base_engine = sa.create_engine(uri, isolation_level="REPEATABLE READ")
    table = ReportSchedule.__table__.to_metadata(sa.MetaData(), schema=schema)
    with base_engine.begin() as connection:
        connection.execute(sa.schema.CreateSchema(schema))
        connection.execute(
            sa.schema.CreateTable(table, include_foreign_key_constraints=[])
        )
    engine = base_engine.execution_options(schema_translate_map={None: schema})
    try:
        yield engine
    finally:
        with base_engine.begin() as connection:
            connection.execute(sa.schema.DropSchema(schema, cascade=True))
        base_engine.dispose()


@pytest.fixture(params=[ReportScheduleType.REPORT, ReportScheduleType.ALERT])
def sessions(claim_engine: sa.Engine, request: pytest.FixtureRequest) -> sessionmaker:
    """Use real independent connections, not a shared mocked session."""
    factory = sessionmaker(bind=claim_engine)
    with factory() as session:
        session.add(
            ReportSchedule(
                id=1,
                name="claim test",
                type=request.param,
                crontab="* * * * *",
                last_state=ReportState.NOOP,
                retry_on_failure=True,
            )
        )
        session.commit()
    return factory


def claim(session, window, *, retry=False, owner=None):
    return claim_execution(
        session,
        1,
        str(uuid4()),
        window,
        is_retry=retry,
        expected_owner=owner,
        retries_enabled=True,
        stale_retry_seconds=4140,
    )


@pytest.mark.parametrize("retry", [False, True])
def test_competing_workers_have_one_winner(sessions, retry):
    window = utc_now().replace(microsecond=0)
    owner = str(uuid4())
    if retry:
        with sessions() as session:
            session.query(ReportSchedule).update(
                {
                    "last_state": ReportState.RETRYING,
                    "execution_owner": owner,
                    "execution_window": window,
                    "retry_scheduled_dttm": window,
                }
            )
            session.commit()
    # Synchronize AFTER both SELECTs. Each worker must contend on the UPDATE
    # using the same observed state, rather than simply reading the winner.
    barrier = Barrier(2)
    engine = sessions.kw["bind"]

    def synchronize(_conn, _cursor, statement, _parameters, _context, _executemany):
        if statement.startswith("UPDATE ") and "report_schedule" in statement:
            barrier.wait(timeout=10)

    sa.event.listen(engine, "before_cursor_execute", synchronize)
    try:

        def run(_index):
            with sessions() as session:
                return claim(session, window, retry=retry, owner=owner)

        with ThreadPoolExecutor(max_workers=2) as workers:
            results = list(workers.map(run, range(2)))
        assert sum(result is not None for result in results) == 1
    finally:
        sa.event.remove(engine, "before_cursor_execute", synchronize)


def test_retry_window_and_owner_fence_replays(sessions):
    window = utc_now().replace(microsecond=0)
    with sessions() as session:
        assert claim(session, window) is not None
        schedule = session.query(ReportSchedule).one()
        owner = schedule.execution_owner
        schedule.last_state = ReportState.RETRYING
        schedule.retry_scheduled_dttm = window
        session.commit()
    with sessions() as session:
        assert claim(session, window) is None
        assert claim(session, window, retry=True, owner="wrong-owner") is None
        assert claim(session, window, retry=True, owner=owner) is not None
        schedule = session.query(ReportSchedule).one()
        schedule.last_state = ReportState.RETRYING
        session.commit()
        assert claim(session, window, retry=True, owner=owner) is None
        schedule.last_state = ReportState.SUCCESS
        session.commit()
        assert claim(session, window) is None
        assert claim(session, window + timedelta(hours=1)) is not None


def test_alert_can_claim_a_retry(sessions):
    window = utc_now()
    with sessions() as session:
        session.query(ReportSchedule).update(
            {
                "type": ReportScheduleType.ALERT,
                "last_state": ReportState.RETRYING,
                "execution_owner": "owner",
                "retry_scheduled_dttm": window,
            }
        )
        session.commit()
        assert claim(session, window, retry=True, owner="owner") is not None


def test_window_normalization_converts_offsets():
    assert normalize_window(
        datetime(2026, 9, 15, 10, tzinfo=timezone(timedelta(hours=10)))
    ) == datetime(2026, 9, 15)


def test_recovery_can_fence_worker_during_transport(
    sessions: sessionmaker, mocker: MockerFixture
) -> None:
    """A separate connection can recover the row while a send is in flight."""
    from superset.commands.report.exceptions import ReportSchedulePreviousWorkingError
    from superset.commands.report.execute import BaseReportState
    from superset.reports.notifications.base import NotificationContent
    from superset.utils.report_execution import (
        ReportExecutionContext,
        ReportExecutionDeadline,
    )

    execution_id = uuid4()
    with sessions() as session:
        schedule = session.query(ReportSchedule).one()
        schedule.execution_owner = str(execution_id)
        schedule.last_state = ReportState.WORKING
        session.commit()
        context = ReportExecutionContext(
            execution_id=execution_id,
            report_schedule_id=1,
            execution_claimed=True,
            deadline=ReportExecutionDeadline(total_seconds=60),
        )
        state = BaseReportState(schedule, utc_now(), execution_id, context)
        mocker.patch("superset.commands.report.execute.db.session", session)

        def recover(*_args: Any) -> None:
            with sessions() as recovery:
                if recovery.bind.dialect.name == "postgresql":
                    recovery.execute(sa.text("SET LOCAL lock_timeout = '500ms'"))
                assert (
                    recovery.query(ReportSchedule)
                    .filter_by(id=1)
                    .update({"execution_owner": None})
                    == 1
                )
                recovery.commit()

        send = mocker.patch.object(state, "_send_notification", side_effect=recover)
        with pytest.raises(ReportSchedulePreviousWorkingError):
            state._send(
                NotificationContent(
                    name="report",
                    text="failure",
                    header_data={
                        "notification_format": "PNG",
                        "editors": [],
                        "notification_type": "Report",
                        "notification_source": None,
                        "chart_id": None,
                        "dashboard_id": None,
                        "slack_channels": None,
                        "execution_id": str(execution_id),
                    },
                ),
                [Mock(), Mock()],
            )
        assert send.call_count == 1


def test_terminal_fallback_persists_without_working_log(
    sessions: sessionmaker, mocker: MockerFixture
) -> None:
    """A committed claim followed by rollback still gets a durable ERROR log."""
    from superset.commands.report.execute import (
        BaseReportState,
        persist_owned_report_execution_terminal_error,
    )
    from superset.reports.models import ReportExecutionLog
    from superset.utils.report_execution import (
        ReportExecutionContext,
        ReportExecutionDeadline,
    )

    engine = sessions.kw["bind"]
    with engine.begin() as connection:
        connection.execute(
            sa.schema.CreateTable(
                ReportExecutionLog.__table__, include_foreign_key_constraints=[]
            )
        )
    execution_id = uuid4()
    with sessions() as session:
        assert claim_execution(
            session,
            1,
            str(execution_id),
            utc_now(),
            is_retry=False,
            expected_owner=None,
            retries_enabled=True,
            stale_retry_seconds=4140,
        )
        mocker.patch("superset.commands.report.execute.db.session", session)
        mocker.patch.object(
            BaseReportState, "is_in_error_grace_period", return_value=False
        )
        send = mocker.patch.object(BaseReportState, "send_error")
        context = ReportExecutionContext(
            execution_id=execution_id,
            report_schedule_id=1,
            execution_claimed=True,
            deadline=ReportExecutionDeadline(total_seconds=60),
        )
        assert persist_owned_report_execution_terminal_error(
            1, execution_id, "escaped", "RuntimeError", context
        )
        session.expire_all()
        assert session.query(ReportSchedule).one().last_state == ReportState.ERROR
        log = session.query(ReportExecutionLog).filter_by(error_message="escaped").one()
        assert log.state == ReportState.ERROR
        send.assert_called_once()
        assert not persist_owned_report_execution_terminal_error(
            1, execution_id, "escaped", "RuntimeError", context
        )
        assert send.call_count == 1


@pytest.mark.parametrize("sqlstate", ["40001", "40P01", "08006"])
def test_claim_database_conflict_rolls_back(
    mocker: MockerFixture, sqlstate: str
) -> None:
    """Only serialization/deadlock losers are suppressed, not connection failures."""
    from sqlalchemy.exc import OperationalError

    class DatabaseFailureError(Exception):
        pgcode = sqlstate

    original = DatabaseFailureError("database failure")
    error = OperationalError("UPDATE", {}, original)
    mocker.patch(
        "superset.commands.report.execution_claim._claim_execution", side_effect=error
    )
    session = Mock()
    if sqlstate == "08006":
        with pytest.raises(OperationalError):
            claim(session, utc_now())
    else:
        assert claim(session, utc_now()) is None
    session.rollback.assert_called_once()


@pytest.mark.parametrize("global_enabled,opt_in", [(False, True), (True, False)])
@pytest.mark.parametrize("stale", [False, True])
def test_cancel_disabled_retry_fences_owner_and_releases_next_window(
    sessions: sessionmaker, global_enabled: bool, opt_in: bool, stale: bool
) -> None:
    """Disabling retries must not suspend cron or allow an old owner to cancel."""
    window = utc_now().replace(microsecond=0)
    with sessions() as session:
        schedule = session.query(ReportSchedule).one()
        schedule.last_state = ReportState.RETRYING
        schedule.execution_owner = "owner"
        schedule.execution_window = window
        schedule.retry_scheduled_dttm = window
        schedule.retry_on_failure = opt_in
        schedule.retry_attempt = 2
        session.commit()
        assert cancel_disabled_retry(
            session,
            1,
            window,
            "old-owner" if stale else "owner",
            retries_enabled=global_enabled,
        ) is (not stale)
        session.expire_all()
        assert schedule.last_state == (
            ReportState.RETRYING if stale else ReportState.ERROR
        )
        if not stale:
            assert schedule.retry_attempt == 0
            assert schedule.retry_scheduled_dttm is None
            assert claim(session, window) is None
            assert claim(session, window + timedelta(minutes=5)) is not None


def test_cancel_retry_cannot_cancel_new_window_or_reenabled_schedule(
    sessions: sessionmaker,
) -> None:
    """Cancellation must recheck opt-in and the window in its UPDATE predicate."""
    window = utc_now().replace(microsecond=0)
    with sessions() as session:
        schedule = session.query(ReportSchedule).one()
        schedule.last_state = ReportState.RETRYING
        schedule.execution_owner = "owner"
        schedule.execution_window = window
        schedule.retry_scheduled_dttm = window
        session.commit()
        assert not cancel_disabled_retry(
            session, 1, window, "owner", retries_enabled=True
        )
        assert not cancel_disabled_retry(
            session, 1, window - timedelta(minutes=5), "owner", retries_enabled=False
        )


@pytest.mark.parametrize("age,eligible", [(3599, False), (3601, True)])
def test_stale_retry_recovers_at_max_delay(
    sessions: sessionmaker, age: int, eligible: bool
) -> None:
    """Admission must not add the execution budget to the retry recovery delay."""
    now = utc_now().replace(microsecond=0)
    with sessions() as session:
        schedule = session.query(ReportSchedule).one()
        schedule.last_state = ReportState.RETRYING
        schedule.execution_owner = "owner"
        schedule.execution_window = now - timedelta(hours=2)
        schedule.retry_scheduled_dttm = schedule.execution_window
        schedule.last_eval_dttm = now - timedelta(seconds=age)
        session.commit()
        result = claim_execution(
            session,
            1,
            str(uuid4()),
            now,
            is_retry=False,
            expected_owner=None,
            retries_enabled=True,
            stale_retry_seconds=3600,
        )
        assert (result is not None) is eligible
