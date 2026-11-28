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
"""Unit tests for the reports beat task (superset.tasks.scheduler.scheduler)."""

from collections.abc import Iterator
from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
from freezegun import freeze_time

from superset.reports.models import ReportScheduleType
from superset.tasks.scheduler import scheduler


def _schedule(schedule_id: int, crontab: str, timezone: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=schedule_id,
        name=f"report {schedule_id}",
        crontab=crontab,
        timezone=timezone,
        type=ReportScheduleType.REPORT,
        working_timeout=3600,
    )


@pytest.fixture
def apply_async() -> Iterator[MagicMock]:
    with (
        patch("superset.tasks.scheduler.is_feature_enabled", return_value=True),
        patch("superset.tasks.scheduler.execute.apply_async") as apply_async,
    ):
        yield apply_async


def _queued(apply_async: MagicMock) -> list[tuple[int, datetime]]:
    return [
        (call.args[0][0], call.kwargs["eta"]) for call in apply_async.call_args_list
    ]


def test_scheduler_queues_others_while_dublin_falls_back(
    apply_async: MagicMock,
) -> None:
    """
    Reports scheduler: a Europe/Dublin schedule on the night its clock falls
    back does not stop the schedules around it from being queued
    """
    schedules = [
        _schedule(1, "0 23 * * *", "UTC"),
        _schedule(2, "30 1 * * *", "Europe/Dublin"),
        _schedule(3, "0 23 * * *", "UTC"),
    ]
    with (
        patch(
            "superset.tasks.scheduler.ReportScheduleDAO.find_active",
            return_value=schedules,
        ),
        freeze_time("2026-10-24T23:00:00Z"),
    ):
        scheduler()

    assert _queued(apply_async) == [
        (1, datetime(2026, 10, 24, 23, 0)),
        (3, datetime(2026, 10, 24, 23, 0)),
    ]


def test_scheduler_skips_a_schedule_whose_window_fails(
    apply_async: MagicMock,
) -> None:
    """
    Reports scheduler: an error computing one schedule's run times is logged
    and the next schedule is still queued
    """
    schedules = [
        _schedule(1, "0 9 * * *", "UTC"),
        _schedule(2, "0 9 * * *", "UTC"),
    ]
    with (
        patch(
            "superset.tasks.scheduler.ReportScheduleDAO.find_active",
            return_value=schedules,
        ),
        patch(
            "superset.tasks.scheduler.cron_schedule_window",
            side_effect=[ValueError("bad"), iter([datetime(2026, 1, 1, 9, 0)])],
        ),
        patch("superset.tasks.scheduler.logger") as logger,
        freeze_time("2026-01-01T09:00:00Z"),
    ):
        scheduler()

    assert _queued(apply_async) == [(2, datetime(2026, 1, 1, 9, 0))]
    logger.exception.assert_called_once()
    assert logger.exception.call_args.args[1] == 1
