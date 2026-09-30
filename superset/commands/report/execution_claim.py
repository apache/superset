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
"""Atomic admission for scheduled report executions and their retries."""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from superset.reports.models import ReportSchedule, ReportState

logger = logging.getLogger(__name__)


def normalize_window(value: datetime | None) -> datetime | None:
    """Compare database timestamps and broker timestamps at UTC second precision."""
    if value is None:
        return None
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc)
    return value.replace(tzinfo=None, microsecond=0)


@dataclass(frozen=True)
class ExecutionClaim:
    """State observed by the worker which won the database claim."""

    initial_state: str | None


def cancel_disabled_retry(
    session: Session,
    schedule_id: int,
    window: datetime,
    expected_owner: str | None,
    *,
    retries_enabled: bool,
) -> bool:
    """Release a disabled retry only when the queued owner's window still matches."""
    if not expected_owner:
        return False
    query = session.query(ReportSchedule).filter(
        ReportSchedule.id == schedule_id,
        ReportSchedule.last_state == ReportState.RETRYING,
        ReportSchedule.execution_owner == expected_owner,
        ReportSchedule.execution_window == normalize_window(window),
        ReportSchedule.retry_scheduled_dttm == normalize_window(window),
    )
    if retries_enabled:
        query = query.filter(~ReportSchedule.retry_on_failure)
    matched = query.update(
        {
            ReportSchedule.last_state: ReportState.ERROR,
            ReportSchedule.last_eval_dttm: datetime.now(timezone.utc).replace(
                tzinfo=None
            ),
            ReportSchedule.retry_attempt: 0,
            ReportSchedule.retry_scheduled_dttm: None,
        },
        synchronize_session=False,
    )
    # Retain owner/window to fence stale replays of the cancelled execution.
    session.commit()  # pylint: disable=consider-using-transaction
    return matched == 1


def claim_execution(
    session: Session,
    schedule_id: int,
    execution_id: str,
    window: datetime,
    *,
    is_retry: bool,
    expected_owner: str | None,
    retries_enabled: bool,
    stale_retry_seconds: float,
) -> ExecutionClaim | None:
    """Claim work, treating database serialization losers as unclaimed."""
    try:
        return _claim_execution(
            session,
            schedule_id,
            execution_id,
            window,
            is_retry=is_retry,
            expected_owner=expected_owner,
            retries_enabled=retries_enabled,
            stale_retry_seconds=stale_retry_seconds,
        )
    except DBAPIError as ex:
        session.rollback()  # pylint: disable=consider-using-transaction
        # PostgreSQL REPEATABLE READ can raise instead of returning zero rows
        # when another claimant updates the snapshot we observed.
        sqlstate = getattr(ex.orig, "sqlstate", None) or getattr(
            ex.orig, "pgcode", None
        )
        if sqlstate not in {"40001", "40P01"}:
            raise
        logger.info(
            "report_execution_claim_conflict schedule_id=%s "
            "execution_id=%s sqlstate=%s",
            schedule_id,
            execution_id,
            sqlstate,
        )
        return None


def _claim_execution(
    session: Session,
    schedule_id: int,
    execution_id: str,
    window: datetime,
    *,
    is_retry: bool,
    expected_owner: str | None,
    retries_enabled: bool,
    stale_retry_seconds: float,
) -> ExecutionClaim | None:
    """Atomically promote an eligible schedule to WORKING, committing ownership.

    A conditional UPDATE is the claim, not the preceding read. A competing
    worker observing the same row loses when any admission field changes.
    Ownership survives terminal states to fence broker redelivery of a window.
    """
    schedule = (
        session.query(ReportSchedule)
        .filter_by(id=schedule_id)
        .populate_existing()
        .one_or_none()
    )
    if schedule is None or schedule.last_state == ReportState.WORKING:
        return None
    normalized = normalize_window(window)
    assert normalized is not None
    initial_state = schedule.last_state
    if is_retry:
        if (
            not retries_enabled
            or not schedule.retry_on_failure
            or initial_state != ReportState.RETRYING
            or not expected_owner
            or schedule.execution_owner != expected_owner
            or normalize_window(schedule.retry_scheduled_dttm) != normalized
        ):
            return None
    else:
        previous_window = normalize_window(schedule.execution_window)
        if previous_window is not None and normalized <= previous_window:
            return None
        if initial_state == ReportState.RETRYING:
            anchor = normalize_window(schedule.retry_scheduled_dttm)
            touched = normalize_window(schedule.last_eval_dttm)
            if anchor == normalized or (
                touched is not None
                and (datetime.utcnow() - touched).total_seconds() < stale_retry_seconds
            ):
                return None
    matched = (
        session.query(ReportSchedule)
        .filter(
            ReportSchedule.id == schedule_id,
            ReportSchedule.last_state == initial_state,
            ReportSchedule.last_eval_dttm == schedule.last_eval_dttm,
            ReportSchedule.execution_owner == schedule.execution_owner,
            ReportSchedule.execution_window == schedule.execution_window,
            ReportSchedule.retry_on_failure == schedule.retry_on_failure,
            ReportSchedule.retry_scheduled_dttm == schedule.retry_scheduled_dttm,
        )
        .update(
            {
                ReportSchedule.last_state: ReportState.WORKING,
                ReportSchedule.last_eval_dttm: datetime.utcnow(),
                ReportSchedule.execution_owner: execution_id,
                ReportSchedule.execution_window: normalized,
            },
            synchronize_session=False,
        )
    )
    session.commit()  # pylint: disable=consider-using-transaction
    if matched != 1:
        return None
    return ExecutionClaim(initial_state=initial_state)
