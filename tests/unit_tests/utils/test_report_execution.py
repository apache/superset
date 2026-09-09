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
    MIN_REPORT_EXECUTION_WORK_SECONDS,
    ReportExecutionBudgetExceededError,
    ReportExecutionContext,
    ReportExecutionDeadline,
    resolve_report_execution_budget_seconds,
    validate_report_execution_config,
)


def _report_config(**overrides: int) -> dict[str, int | bool]:
    config: dict[str, int | bool] = {
        "ALERT_REPORTS_WORKING_TIME_OUT_KILL": True,
        "ALERT_REPORTS_EXECUTION_BUDGET_SECONDS": 900,
        "ALERT_REPORTS_EXECUTION_CAPTURE_RESERVE_SECONDS": 60,
        "ALERT_REPORTS_EXECUTION_DELIVERY_RESERVE_SECONDS": 120,
        "ALERT_REPORTS_EXECUTION_CLEANUP_RESERVE_SECONDS": 30,
        "ALERT_REPORTS_EXECUTION_HARD_TIMEOUT_GRACE_SECONDS": 30,
        "ALERT_REPORTS_WORKING_SOFT_TIME_OUT_LAG": 1,
        "ALERT_REPORTS_WORKING_TIME_OUT_LAG": 10,
    }
    config.update(overrides)
    return config


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
    config = _report_config()

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


def test_working_timeout_caps_report_budget() -> None:
    """A per-schedule working_timeout below the global budget keeps its
    historical user-facing meaning: it caps the effective budget and the
    derived Celery limits."""
    config = _report_config()

    assert resolve_report_execution_budget_seconds(config, working_timeout=600) == 600.0
    assert get_report_task_timeout_options(
        is_report=True,
        working_timeout=600,
        config=config,
    ) == {"soft_time_limit": 600, "time_limit": 630}


def test_working_timeout_above_budget_does_not_raise_it() -> None:
    config = _report_config()

    assert (
        resolve_report_execution_budget_seconds(config, working_timeout=7200) == 900.0
    )


def test_missing_working_timeout_uses_global_budget() -> None:
    config = _report_config()

    assert (
        resolve_report_execution_budget_seconds(config, working_timeout=None) == 900.0
    )


def test_tiny_working_timeout_floors_at_minimum_viable_budget() -> None:
    """A working_timeout below the summed phase reserves cannot construct a
    valid execution context; it is floored (with a warning) so the report
    fails cleanly at its first phase check instead of erroring at setup."""
    config = _report_config()
    reserves_total = 60 + 120 + 30

    budget = resolve_report_execution_budget_seconds(config, working_timeout=120)

    assert budget == reserves_total + MIN_REPORT_EXECUTION_WORK_SECONDS


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"ALERT_REPORTS_EXECUTION_BUDGET_SECONDS": 0}, "greater than zero"),
        (
            {"ALERT_REPORTS_EXECUTION_CAPTURE_RESERVE_SECONDS": -1},
            "cannot be negative",
        ),
        (
            {"ALERT_REPORTS_EXECUTION_DELIVERY_RESERVE_SECONDS": 810},
            "must total less",
        ),
        (
            {"ALERT_REPORTS_EXECUTION_HARD_TIMEOUT_GRACE_SECONDS": -1},
            "grace cannot be negative",
        ),
    ],
)
def test_report_execution_config_rejects_invalid_startup_values(
    overrides: dict[str, int],
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        validate_report_execution_config(_report_config(**overrides))


def test_report_execution_config_accepts_defaults() -> None:
    validate_report_execution_config(_report_config())
