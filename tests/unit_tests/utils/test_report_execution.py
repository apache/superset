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
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from uuid import UUID

import pytest

from superset.utils.report_execution import (
    get_report_task_timeout_options,
    ReportExecutionBudgetExceededError,
    ReportExecutionContext,
    ReportExecutionDeadline,
)


def test_report_deadline_derives_phase_timeout_from_one_clock() -> None:
    clock_value = 100.0
    deadline = ReportExecutionDeadline(
        total_seconds=900,
        started_at=0,
        _clock=lambda: clock_value,
    )
    context = ReportExecutionContext(
        execution_id=UUID("084e7ee6-5557-4ecd-9632-b7f39c9ec524"),
        report_schedule_id=7,
        deadline=deadline,
        capture_reserve_seconds=60,
        delivery_reserve_seconds=120,
        cleanup_reserve_seconds=30,
    )

    assert deadline.elapsed_seconds == 100
    assert deadline.remaining_seconds == 800
    assert context.readiness_reserve_seconds == 210
    assert (
        deadline.timeout_seconds(
            "chart_readiness",
            reserve_seconds=context.readiness_reserve_seconds,
        )
        == 590
    )
    assert (
        deadline.timeout_seconds(
            "screenshot_capture",
            reserve_seconds=context.post_capture_reserve_seconds,
        )
        == 650
    )
    assert (
        deadline.timeout_seconds(
            "notification_delivery",
            reserve_seconds=context.cleanup_reserve_seconds,
        )
        == 770
    )


def test_report_deadline_exhaustion_names_phase() -> None:
    deadline = ReportExecutionDeadline(
        total_seconds=900,
        started_at=0,
        _clock=lambda: 700,
    )

    with pytest.raises(
        ReportExecutionBudgetExceededError,
        match="before chart_readiness",
    ):
        deadline.timeout_seconds(
            "chart_readiness",
            reserve_seconds=210,
        )


def test_report_context_rejects_reserves_that_consume_deadline() -> None:
    deadline = ReportExecutionDeadline(total_seconds=210)

    with pytest.raises(ValueError, match="must total less"):
        ReportExecutionContext(
            execution_id=UUID("084e7ee6-5557-4ecd-9632-b7f39c9ec524"),
            report_schedule_id=7,
            deadline=deadline,
            capture_reserve_seconds=60,
            delivery_reserve_seconds=120,
            cleanup_reserve_seconds=30,
        )


def test_report_deadline_rejects_nonpositive_budget() -> None:
    with pytest.raises(ValueError, match="greater than zero"):
        ReportExecutionDeadline(total_seconds=0)


def test_report_task_limits_align_soft_timeout_with_budget() -> None:
    config = {
        "ALERT_REPORTS_WORKING_TIME_OUT_KILL": True,
        "ALERT_REPORTS_EXECUTION_BUDGET_SECONDS": 900,
        "ALERT_REPORTS_EXECUTION_HARD_TIMEOUT_GRACE_SECONDS": 30,
        "ALERT_REPORTS_WORKING_SOFT_TIME_OUT_LAG": 1,
        "ALERT_REPORTS_WORKING_TIME_OUT_LAG": 10,
    }

    assert get_report_task_timeout_options(
        is_report=True,
        working_timeout=3600,
        config=config,
    ) == {"soft_time_limit": 900, "time_limit": 930}
    assert get_report_task_timeout_options(
        is_report=False,
        working_timeout=3600,
        config=config,
    ) == {"soft_time_limit": 3601, "time_limit": 3610}
