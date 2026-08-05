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

"""Shared deadline and logging context for scheduled report execution."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

logger = logging.getLogger(__name__)

# Minimum working allowance kept above the summed phase reserves when a
# per-schedule working_timeout would otherwise squeeze the effective budget
# below what the execution context can represent. A floored budget still
# fails fast (budget-exceeded on the first phase) rather than erroring while
# constructing the deadline.
MIN_REPORT_EXECUTION_WORK_SECONDS = 30.0


def validate_report_execution_config(config: Mapping[str, Any]) -> None:
    """Validate the scheduled-report budget invariant during application startup."""

    budget = float(config["ALERT_REPORTS_EXECUTION_BUDGET_SECONDS"])
    reserves = (
        float(config["ALERT_REPORTS_EXECUTION_CAPTURE_RESERVE_SECONDS"]),
        float(config["ALERT_REPORTS_EXECUTION_DELIVERY_RESERVE_SECONDS"]),
        float(config["ALERT_REPORTS_EXECUTION_CLEANUP_RESERVE_SECONDS"]),
    )
    hard_timeout_grace = float(
        config["ALERT_REPORTS_EXECUTION_HARD_TIMEOUT_GRACE_SECONDS"]
    )

    if budget <= 0:
        raise ValueError("Report execution budget must be greater than zero")
    if any(reserve < 0 for reserve in reserves):
        raise ValueError("Report execution phase reserves cannot be negative")
    if sum(reserves) >= budget:
        raise ValueError(
            "Report execution phase reserves must total less than the execution budget"
        )
    if hard_timeout_grace < 0:
        raise ValueError("Report execution hard-timeout grace cannot be negative")


def resolve_report_execution_budget_seconds(
    config: Mapping[str, Any],
    working_timeout: int | None = None,
) -> float:
    """Return the effective execution budget for one REPORT schedule.

    The per-schedule ``working_timeout`` keeps its historical, user-facing
    meaning ("kill my report after N seconds"): when it is lower than the
    global ``ALERT_REPORTS_EXECUTION_BUDGET_SECONDS`` it caps the budget, so
    introducing the global deadline does not silently grant a schedule more
    time than its owner configured. The result is floored at the summed
    phase reserves plus a minimal working allowance so the execution context
    remains constructible; a floored budget fails cleanly on its first phase
    check instead of raising at setup.
    """
    budget = float(config["ALERT_REPORTS_EXECUTION_BUDGET_SECONDS"])
    if working_timeout is not None:
        budget = min(budget, float(working_timeout))
    reserves_total = (
        float(config["ALERT_REPORTS_EXECUTION_CAPTURE_RESERVE_SECONDS"])
        + float(config["ALERT_REPORTS_EXECUTION_DELIVERY_RESERVE_SECONDS"])
        + float(config["ALERT_REPORTS_EXECUTION_CLEANUP_RESERVE_SECONDS"])
    )
    if budget < (min_viable := reserves_total + MIN_REPORT_EXECUTION_WORK_SECONDS):
        logger.warning(
            "Report working_timeout=%s is below the minimum viable execution "
            "budget (%.0fs phase reserves + %.0fs working allowance); "
            "flooring the effective budget at %.0fs.",
            working_timeout,
            reserves_total,
            MIN_REPORT_EXECUTION_WORK_SECONDS,
            min_viable,
        )
        return min_viable
    return budget


class ReportExecutionBudgetExceededError(TimeoutError):
    """Raised before a report phase would overrun its execution deadline."""

    def __init__(
        self,
        phase: str,
        *,
        elapsed_seconds: float,
        remaining_seconds: float,
    ) -> None:
        self.phase = phase
        self.elapsed_seconds = elapsed_seconds
        self.remaining_seconds = remaining_seconds
        super().__init__(
            f"Report execution budget exhausted before {phase} "
            f"(elapsed={elapsed_seconds:.2f}s, remaining={remaining_seconds:.2f}s)"
        )


@dataclass(frozen=True)
class ReportExecutionDeadline:
    """A monotonic end-to-end deadline shared by every report phase."""

    total_seconds: float
    started_at: float = field(default_factory=time.monotonic)
    _clock: Callable[[], float] = field(
        default=time.monotonic,
        repr=False,
        compare=False,
    )

    def __post_init__(self) -> None:
        """Reject deadlines that cannot provide any execution time."""

        if self.total_seconds <= 0:
            raise ValueError("Report execution budget must be greater than zero")

    @property
    def elapsed_seconds(self) -> float:
        """Return non-negative wall-clock time consumed by this execution."""

        return max(0.0, self._clock() - self.started_at)

    @property
    def remaining_seconds(self) -> float:
        """Return wall-clock time left before the execution deadline."""

        return max(0.0, self.total_seconds - self.elapsed_seconds)

    def available_seconds(self, phase: str, *, reserve_seconds: float = 0.0) -> float:
        """Return time available to a phase after preserving later-phase capacity."""

        available = self.remaining_seconds - max(0.0, reserve_seconds)
        if available <= 0:
            raise ReportExecutionBudgetExceededError(
                phase,
                elapsed_seconds=self.elapsed_seconds,
                remaining_seconds=self.remaining_seconds,
            )
        return available

    def timeout_seconds(
        self,
        phase: str,
        *,
        requested_seconds: float | None = None,
        reserve_seconds: float = 0.0,
    ) -> float:
        """Cap an operation timeout at the time available to its report phase."""

        available = self.available_seconds(
            phase,
            reserve_seconds=reserve_seconds,
        )
        if requested_seconds is None or requested_seconds <= 0:
            return available
        return min(float(requested_seconds), available)


@dataclass(frozen=True)
class ReportExecutionContext:
    """Identifiers, deadline, and phase reserves shared by one report attempt."""

    execution_id: UUID
    report_schedule_id: int
    deadline: ReportExecutionDeadline
    dashboard_id: int | None = None
    chart_id: int | None = None
    expected_chart_count: int | None = None
    attempt: int = 1
    capture_reserve_seconds: float = 0.0
    delivery_reserve_seconds: float = 0.0
    cleanup_reserve_seconds: float = 0.0

    def __post_init__(self) -> None:
        """Validate that configured phase reserves fit inside the deadline."""

        reserves = (
            self.capture_reserve_seconds,
            self.delivery_reserve_seconds,
            self.cleanup_reserve_seconds,
        )
        if any(reserve < 0 for reserve in reserves):
            raise ValueError("Report execution phase reserves cannot be negative")
        if sum(reserves) >= self.deadline.total_seconds:
            raise ValueError(
                "Report execution phase reserves must total less than the "
                "execution budget"
            )

    @property
    def log_context(self) -> str:
        """Return stable key/value identifiers for plain-text log formatters."""

        return (
            f"capture_kind=report execution_id={self.execution_id} "
            f"report_schedule_id={self.report_schedule_id} "
            f"dashboard_id={self.dashboard_id} chart_id={self.chart_id} "
            f"expected_holders={self.expected_chart_count} attempt={self.attempt}"
        )

    @property
    def readiness_reserve_seconds(self) -> float:
        """Capacity kept for capture, delivery, and terminal state persistence."""

        return (
            self.capture_reserve_seconds
            + self.delivery_reserve_seconds
            + self.cleanup_reserve_seconds
        )

    @property
    def post_capture_reserve_seconds(self) -> float:
        """Capacity kept for delivery and terminal state persistence."""

        return self.delivery_reserve_seconds + self.cleanup_reserve_seconds


def get_report_task_timeout_options(
    *,
    is_report: bool,
    working_timeout: int | None,
    config: Mapping[str, Any],
) -> dict[str, int]:
    """Return Celery time limits aligned with the application execution budget."""

    if is_report:
        validate_report_execution_config(config)
    if not config["ALERT_REPORTS_WORKING_TIME_OUT_KILL"]:
        return {}
    if is_report:
        budget = int(
            resolve_report_execution_budget_seconds(
                config,
                working_timeout=working_timeout,
            )
        )
        hard_grace = int(config["ALERT_REPORTS_EXECUTION_HARD_TIMEOUT_GRACE_SECONDS"])
        return {
            "soft_time_limit": budget,
            "time_limit": budget + hard_grace,
        }
    if working_timeout is None:
        return {}
    return {
        "soft_time_limit": working_timeout
        + int(config["ALERT_REPORTS_WORKING_SOFT_TIME_OUT_LAG"]),
        "time_limit": working_timeout
        + int(config["ALERT_REPORTS_WORKING_TIME_OUT_LAG"]),
    }
