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
"""A restore request has to be one a person can actually act on.

Restoring an asset whose delete was approved is captured for review like
any other write, and that much worked: the request was created and the
asset stayed deleted. Every call against the request then answered 404
-- submit, approve, withdraw, and discard alike -- so the request could
neither be carried out nor cleared away, and the asset could not come
back through review at all (R3-01).

The cause is one lookup. ``load_asset`` hides soft-deleted rows, which
is right for an ordinary request -- an asset deleted out from under an
open edit really does kill it -- and exactly wrong for a restore, where
the asset being deleted is the premise. So the lookup asks for the
deleted row only when the request is a restore, using the same two
bypasses ``BaseRestoreCommand`` uses to find the row it restores.

The pair of tests that matter here are the two directions: a restore
request must find its asset, and a dead ordinary request must still not.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import lifecycle, replay
from asset_approval.exceptions import ChangeRequestNotFoundError
from asset_approval.gate import COMMAND_KEY, RESTORE_COMMAND
from asset_approval.types import AssetType
from pytest_mock import MockerFixture

DELETED_CHART = SimpleNamespace(id=42, deleted_at="2026-10-30T12:00:00")


def _request(command_args: dict[str, Any] | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        id=4,
        asset_type="chart",
        asset_id=42,
        author_fk=7,
        base_dict={},
        command_args=command_args or {},
        status="draft",
        is_open=True,
    )


def _restore_request() -> SimpleNamespace:
    return _request({COMMAND_KEY: RESTORE_COMMAND})


def test_a_restore_is_identified_by_the_command_it_carries() -> None:
    # Not an Operation of its own: a restore is captured as an update
    # carrying the command to replay, so the operation column cannot
    # answer this.
    assert replay.is_restore(_restore_request()) is True


def test_an_ordinary_change_is_not_a_restore() -> None:
    assert replay.is_restore(_request()) is False


def test_the_lookup_asks_for_the_deleted_row_when_told_to(
    mocker: MockerFixture,
) -> None:
    find = mocker.patch(
        "superset.daos.chart.ChartDAO.find_by_id", return_value=DELETED_CHART
    )

    replay.load_asset(AssetType.CHART, 42, include_deleted=True)

    find.assert_called_once_with(
        42, skip_base_filter=True, skip_visibility_filter=True
    )


def test_the_ordinary_lookup_is_left_alone(mocker: MockerFixture) -> None:
    # Widening every lookup would let an edit be approved onto an asset
    # that is in the trash, which is the behaviour the 404 exists for.
    find = mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=None)

    replay.load_asset(AssetType.CHART, 42)

    find.assert_called_once_with(42)


def test_a_restore_request_finds_its_deleted_asset(
    mocker: MockerFixture,
) -> None:
    """The defect: this raised 404, and every lifecycle call went through here."""

    def _find(asset_id: int, **kwargs: Any) -> Any:
        # The real DAO's behaviour in miniature: the row is invisible
        # unless the caller asks past the visibility filter.
        return DELETED_CHART if kwargs.get("skip_visibility_filter") else None

    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", side_effect=_find)

    assert lifecycle._asset_for(_restore_request()) is DELETED_CHART


def test_an_ordinary_request_whose_asset_is_gone_is_still_dead(
    mocker: MockerFixture,
) -> None:
    mocker.patch("superset.daos.chart.ChartDAO.find_by_id", return_value=None)

    with pytest.raises(ChangeRequestNotFoundError):
        lifecycle._asset_for(_request())


def test_a_restore_request_can_be_discarded(mocker: MockerFixture) -> None:
    """The sharpest form of the bug: the row could not even be cleared.

    Discard authorizes against the asset, so it went through the same
    lookup and failed the same way -- leaving a request that could be
    neither carried out nor thrown away.
    """
    request = _restore_request()
    statuses: list[Any] = []
    request.set_status = statuses.append

    mocker.patch.object(lifecycle, "find", return_value=request)
    mocker.patch.object(lifecycle, "get_user_id", return_value=7)
    mocker.patch(
        "superset.daos.chart.ChartDAO.find_by_id",
        side_effect=lambda asset_id, **kw: (
            DELETED_CHART if kw.get("skip_visibility_filter") else None
        ),
    )
    mocker.patch.object(lifecycle.db.session, "add")
    mocker.patch.object(lifecycle.db.session, "commit")

    lifecycle.discard(4)

    assert statuses, "the discard never reached the status change"
