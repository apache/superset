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
"""The guards a full export request passes before anything is queued."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from flask import current_app
from pytest_mock import MockerFixture

from superset.data_export.enqueue import (
    enqueue_full_export,
    EnqueueAccepted,
    EnqueueRefusal,
    is_full_export_enabled,
)
from superset.data_export.sources import KIND_CHART
from superset.exceptions import LockAlreadyHeldException

MODULE = "superset.data_export.enqueue"


@pytest.fixture
def available(mocker: MockerFixture) -> MagicMock:
    """Everything a full export needs, so each test removes one thing."""
    mocker.patch(f"{MODULE}.is_feature_enabled", return_value=True)
    mocker.patch(f"{MODULE}.is_full_export_available", return_value=True)
    mocker.patch(f"{MODULE}.get_user_id", return_value=7)
    mocker.patch(f"{MODULE}.AcquireDistributedLock")
    return mocker.patch(f"{MODULE}.export_full_data")


def _enqueue() -> EnqueueAccepted | EnqueueRefusal:
    return enqueue_full_export(
        kind=KIND_CHART, target="slice:1", payload={"label": "Sales"}
    )


def test_enqueue_returns_a_job_id_to_poll(available: MagicMock) -> None:
    outcome = _enqueue()

    assert isinstance(outcome, EnqueueAccepted)
    assert outcome.job_id
    assert available.apply_async.call_args.kwargs["task_id"] == outcome.job_id


def test_enqueue_passes_the_configured_time_limits(available: MagicMock) -> None:
    """The decorator's limits are import-time defaults; the operator's values
    only take effect if they are passed per call."""
    with patch.dict(
        current_app.config,
        {
            "FULL_DATA_EXPORT_SOFT_TIME_LIMIT": 120,
            "FULL_DATA_EXPORT_HARD_TIME_LIMIT": 180,
        },
    ):
        _enqueue()

    kwargs = available.apply_async.call_args.kwargs
    assert kwargs["soft_time_limit"] == 120
    assert kwargs["time_limit"] == 180


def test_enqueue_runs_the_export_as_the_requesting_user(available: MagicMock) -> None:
    """The task re-runs the query, so it has to carry whose permissions and
    row-level security apply -- not the worker's ambient identity."""
    _enqueue()

    assert available.apply_async.call_args.kwargs["kwargs"]["user_id"] == 7


def test_enqueue_is_refused_when_the_feature_flag_is_off(
    available: MagicMock, mocker: MockerFixture
) -> None:
    mocker.patch(f"{MODULE}.is_feature_enabled", return_value=False)

    outcome = _enqueue()

    assert isinstance(outcome, EnqueueRefusal)
    assert outcome.status == 404
    available.apply_async.assert_not_called()


def test_enqueue_is_refused_without_storage_rather_than_downgraded(
    available: MagicMock, mocker: MockerFixture
) -> None:
    """There is deliberately no direct-download fallback: a response-bound
    export is bounded by the request timeout, which is the limit this feature
    exists to remove."""
    mocker.patch(f"{MODULE}.is_full_export_available", return_value=False)

    outcome = _enqueue()

    assert isinstance(outcome, EnqueueRefusal)
    assert outcome.status == 400
    assert "background exports" in outcome.message
    available.apply_async.assert_not_called()


def test_enqueue_is_refused_for_a_session_with_no_user(
    available: MagicMock, mocker: MockerFixture
) -> None:
    """A guest or anonymous session has no address to send the link to."""
    mocker.patch(f"{MODULE}.get_user_id", return_value=None)

    outcome = _enqueue()

    assert isinstance(outcome, EnqueueRefusal)
    assert outcome.status == 403
    available.apply_async.assert_not_called()


def test_enqueue_is_refused_while_the_same_export_is_running(
    available: MagicMock, mocker: MockerFixture
) -> None:
    lock = mocker.patch(f"{MODULE}.AcquireDistributedLock")
    lock.return_value.run.side_effect = LockAlreadyHeldException("held")

    outcome = _enqueue()

    assert isinstance(outcome, EnqueueRefusal)
    assert outcome.status == 409
    available.apply_async.assert_not_called()


def test_enqueue_releases_the_lock_when_queueing_fails(
    available: MagicMock, mocker: MockerFixture
) -> None:
    """Nothing else would: the task that releases the lock never runs."""
    release = mocker.patch(f"{MODULE}.release_lock")
    available.apply_async.side_effect = RuntimeError("broker down")

    with pytest.raises(RuntimeError):
        _enqueue()

    release.assert_called_once()


@pytest.mark.parametrize(
    "flag_on, storage_ready, expected",
    [
        (True, True, True),
        (True, False, False),
        (False, True, False),
        (False, False, False),
    ],
)
def test_the_ui_only_offers_the_action_when_it_would_work(
    mocker: MockerFixture, flag_on: bool, storage_ready: bool, expected: bool
) -> None:
    """The bootstrap flag is both halves, so the flag alone never shows a menu
    item whose request would be refused."""
    mocker.patch(f"{MODULE}.is_feature_enabled", return_value=flag_on)
    mocker.patch(f"{MODULE}.is_full_export_available", return_value=storage_ready)

    assert is_full_export_enabled() is expected


def test_lock_keys_separate_two_charts_but_not_two_requests_for_one(
    available: MagicMock,
) -> None:
    """One user may export two charts at once; the same chart twice is the
    case the lock exists to refuse."""
    from superset.tasks.export_full_data import export_lock_params

    first = export_lock_params(7, KIND_CHART, "slice:1")
    second = export_lock_params(7, KIND_CHART, "slice:2")
    again = export_lock_params(7, KIND_CHART, "slice:1")

    assert first != second
    assert first == again
