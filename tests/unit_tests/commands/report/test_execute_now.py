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
import sys
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from kombu.exceptions import OperationalError as KombuOperationalError

from superset.commands.report.exceptions import (
    ReportScheduleCeleryNotConfiguredError,
    ReportScheduleExecuteNowFailedError,
    ReportScheduleForbiddenError,
    ReportScheduleNotFoundError,
)
from superset.exceptions import SupersetSecurityException


def _make_mock_schedule(*, working_timeout: int | None = None) -> MagicMock:
    """Return a minimal mock ReportSchedule."""
    mock_schedule = MagicMock()
    mock_schedule.id = 1
    mock_schedule.name = "Test Report"
    mock_schedule.working_timeout = working_timeout
    return mock_schedule


def test_execute_now_success() -> None:
    """Command returns a valid UUID string and calls apply_async on success."""
    mock_task = MagicMock()
    mock_scheduler = MagicMock()
    mock_scheduler.execute = mock_task

    with patch.dict(sys.modules, {"superset.tasks.scheduler": mock_scheduler}):
        from superset.commands.report.execute_now import ExecuteReportScheduleNowCommand

        with (
            patch(
                "superset.commands.report.execute_now.ReportScheduleDAO.find_by_id",
                return_value=_make_mock_schedule(),
            ),
            patch(
                "superset.commands.report.execute_now.security_manager"
                ".raise_for_ownership"
            ),
        ):
            command = ExecuteReportScheduleNowCommand(1)
            result = command.run()

    # Result is a valid UUID string.
    UUID(result)

    mock_task.apply_async.assert_called_once()
    positional_args, keyword_args = mock_task.apply_async.call_args
    assert positional_args[0] == (1,)
    assert keyword_args["task_id"] == result
    assert "eta" in keyword_args


def test_execute_now_not_found() -> None:
    """Command raises ReportScheduleNotFoundError when the schedule is missing."""
    mock_scheduler = MagicMock()

    with patch.dict(sys.modules, {"superset.tasks.scheduler": mock_scheduler}):
        from superset.commands.report.execute_now import ExecuteReportScheduleNowCommand

        with patch(
            "superset.commands.report.execute_now.ReportScheduleDAO.find_by_id",
            return_value=None,
        ):
            command = ExecuteReportScheduleNowCommand(999)
            with pytest.raises(ReportScheduleNotFoundError):
                command.run()


def test_execute_now_forbidden() -> None:
    """Command raises ReportScheduleForbiddenError when the caller is not an owner."""
    mock_scheduler = MagicMock()

    with patch.dict(sys.modules, {"superset.tasks.scheduler": mock_scheduler}):
        from superset.commands.report.execute_now import ExecuteReportScheduleNowCommand

        with (
            patch(
                "superset.commands.report.execute_now.ReportScheduleDAO.find_by_id",
                return_value=_make_mock_schedule(),
            ),
            patch(
                "superset.commands.report.execute_now.security_manager"
                ".raise_for_ownership",
                side_effect=SupersetSecurityException(MagicMock(message="Forbidden")),
            ),
        ):
            command = ExecuteReportScheduleNowCommand(1)
            with pytest.raises(ReportScheduleForbiddenError):
                command.run()


def test_execute_now_celery_not_configured() -> None:
    """Command raises ReportScheduleCeleryNotConfiguredError on broker error."""
    mock_task = MagicMock()
    mock_task.apply_async.side_effect = KombuOperationalError(
        "broker connection refused"
    )
    mock_scheduler = MagicMock()
    mock_scheduler.execute = mock_task

    with patch.dict(sys.modules, {"superset.tasks.scheduler": mock_scheduler}):
        from superset.commands.report.execute_now import ExecuteReportScheduleNowCommand

        with (
            patch(
                "superset.commands.report.execute_now.ReportScheduleDAO.find_by_id",
                return_value=_make_mock_schedule(),
            ),
            patch(
                "superset.commands.report.execute_now.security_manager"
                ".raise_for_ownership"
            ),
        ):
            command = ExecuteReportScheduleNowCommand(1)
            with pytest.raises(ReportScheduleCeleryNotConfiguredError):
                command.run()


def test_execute_now_unexpected_failure() -> None:
    """Command raises ReportScheduleExecuteNowFailedError on unexpected errors."""
    mock_task = MagicMock()
    mock_task.apply_async.side_effect = RuntimeError("unexpected task error")
    mock_scheduler = MagicMock()
    mock_scheduler.execute = mock_task

    with patch.dict(sys.modules, {"superset.tasks.scheduler": mock_scheduler}):
        from superset.commands.report.execute_now import ExecuteReportScheduleNowCommand

        with (
            patch(
                "superset.commands.report.execute_now.ReportScheduleDAO.find_by_id",
                return_value=_make_mock_schedule(),
            ),
            patch(
                "superset.commands.report.execute_now.security_manager"
                ".raise_for_ownership"
            ),
        ):
            command = ExecuteReportScheduleNowCommand(1)
            with pytest.raises(ReportScheduleExecuteNowFailedError):
                command.run()


def test_execute_now_sets_time_limit_when_working_timeout_configured() -> None:
    """Command includes time_limit in async options when working_timeout is set."""
    mock_task = MagicMock()
    mock_scheduler = MagicMock()
    mock_scheduler.execute = mock_task

    with patch.dict(sys.modules, {"superset.tasks.scheduler": mock_scheduler}):
        from superset.commands.report.execute_now import ExecuteReportScheduleNowCommand

        with (
            patch(
                "superset.commands.report.execute_now.ReportScheduleDAO.find_by_id",
                return_value=_make_mock_schedule(working_timeout=300),
            ),
            patch(
                "superset.commands.report.execute_now.security_manager"
                ".raise_for_ownership"
            ),
            patch("superset.commands.report.execute_now.current_app") as mock_app,
        ):
            mock_app.config = {
                "ALERT_REPORTS_WORKING_TIME_OUT_KILL": True,
                "ALERT_REPORTS_WORKING_TIME_OUT_LAG": 10,
                "ALERT_REPORTS_WORKING_SOFT_TIME_OUT_LAG": 5,
            }

            command = ExecuteReportScheduleNowCommand(1)
            command.run()

    _, keyword_args = mock_task.apply_async.call_args
    assert "time_limit" in keyword_args
    assert keyword_args["time_limit"] == 310  # working_timeout(300) + LAG(10)
    assert "soft_time_limit" in keyword_args
    assert keyword_args["soft_time_limit"] == 305  # working_timeout(300) + SOFT_LAG(5)
