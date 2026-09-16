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

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier
from uuid import uuid4

import pytest
import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker

from superset.commands.report.execution_claim import claim_execution, normalize_window
from superset.reports.models import ReportSchedule, ReportScheduleType, ReportState


@pytest.fixture(params=[ReportScheduleType.REPORT, ReportScheduleType.ALERT])
def sessions(tmp_path, request):
    """Use real independent connections, not a shared mocked session."""
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'claims.db'}")
    ReportSchedule.__table__.create(engine)
    factory = sessionmaker(bind=engine)
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
    yield factory
    engine.dispose()


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
    window = datetime.utcnow().replace(microsecond=0)
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
        if statement.startswith("UPDATE report_schedule"):
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
    window = datetime.utcnow().replace(microsecond=0)
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
    window = datetime.utcnow()
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
