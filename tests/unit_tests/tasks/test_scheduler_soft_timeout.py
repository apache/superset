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
"""Unit tests for the shared ``reports.execute`` soft-timeout handler."""

from unittest.mock import MagicMock, patch

import pytest
from celery.exceptions import SoftTimeLimitExceeded


def test_soft_timeout_handler_is_shared_by_alerts() -> None:
    """The ``reports.execute`` soft-timeout handler is type-unconditional.

    The handler runs before any report-vs-alert dispatch, so an ALERT
    schedule that hits ``SoftTimeLimitExceeded`` gets the same operator
    metric, warning log, and explicit FAILURE state before the re-raise as
    a report does. This is observability-only for alerts: their numeric
    Celery limits are untouched, and pre-handler behavior (uncaught
    exception, Celery FAILURE) is preserved by the re-raise.
    """
    from superset.tasks.scheduler import execute

    alert_schedule_id = 1234
    stats_logger = MagicMock()

    # The task reads STATS_LOGGER via the module's ``current_app`` proxy;
    # patching the proxy keeps the test independent of which Flask app the
    # Celery AppContextTask wrapper happens to have captured.
    with (
        patch("superset.tasks.scheduler.current_app") as current_app_mock,
        patch(
            "superset.commands.report.execute."
            "AsyncExecuteReportScheduleCommand.__init__",
            return_value=None,
        ),
        patch(
            "superset.commands.report.execute.AsyncExecuteReportScheduleCommand.run",
            side_effect=SoftTimeLimitExceeded(),
        ),
        patch("superset.tasks.scheduler.execute.update_state") as update_state_mock,
        patch("superset.tasks.scheduler.logger") as logger_mock,
    ):
        current_app_mock.config = {"STATS_LOGGER": stats_logger}
        with pytest.raises(SoftTimeLimitExceeded):
            execute(alert_schedule_id)

    stats_logger.incr.assert_any_call("reports.execute.celery_soft_timeout")
    update_state_mock.assert_called_once_with(state="FAILURE")
    assert any(
        call.args
        and "terminal_reason=celery_soft_timeout" in call.args[0]
        and alert_schedule_id in call.args
        for call in logger_mock.warning.call_args_list
    )
