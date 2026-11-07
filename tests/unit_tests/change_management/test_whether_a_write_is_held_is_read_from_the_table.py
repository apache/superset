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
"""``has_pending_request`` itself, rather than the callers that consult it.

A test leak, found by a sweep of this suite. ``_pending_review_exists`` is
what answers "is a reviewer looking at this right now", and that answer
decides whether a write is held: a never-published dashboard is editable
and deletable while nobody can see it, *unless* its first publish is
already with a reviewer, in which case the edit must fold into the request
rather than apply behind the reviewer's back (R7-03, ``bindings.py``).

Every reference to it in this suite was a patch -- ``guard_world``'s shared
fixture stubs it, and three other files stub ``bindings.has_pending_request``
-- so the function body had never run under test. Its status predicate could
be changed to any other status, or its fail-closed ``except`` inverted, and
all 1328 tests still passed. Both of those are a maker-checker bypass: the
first lets an author rewrite a draft while it is being reviewed and have the
approval publish what nobody read, the second lets a write apply whenever the
metadata database hiccups.

So this file drives the real function against a real table, one case per
status, which is what makes the status in the ``WHERE`` clause load-bearing.
"""

from __future__ import annotations

from typing import Any

import pytest
from asset_approval import gate
from asset_approval.types import AssetType, ChangeStatus, Operation

from tests.unit_tests.change_management.guard_world import (  # noqa: F401
    request_store,
)

AUTHOR = 5
DASHBOARD_ID = 31

# Every status the column can hold, and whether a request in it is one a
# reviewer is looking at. Parametrised over the whole enum rather than over a
# hand-picked pair, so a status added later has to be given an answer here.
WAITING_ON_A_REVIEWER = {
    ChangeStatus.PENDING: True,
    ChangeStatus.DRAFT: False,
    ChangeStatus.CHANGES_REQUESTED: False,
    ChangeStatus.APPROVED: False,
    ChangeStatus.DISCARDED: False,
}


def _a_request_in(store: Any, status: ChangeStatus, **over: Any) -> None:
    values: dict[str, Any] = {
        "id": 1,
        "asset_type": AssetType.DASHBOARD.value,
        "asset_id": DASHBOARD_ID,
        "operation": Operation.UPDATE.value,
        "status": status.value,
        "active_slot": 1,
        "author_fk": AUTHOR,
        "payload": "{}",
    }
    values.update(over)
    with store.engine.begin() as connection:
        connection.execute(store.table.insert().values(**values))


def test_every_status_is_accounted_for() -> None:
    """Or the table below is quietly partial."""
    assert set(WAITING_ON_A_REVIEWER) == set(ChangeStatus)


@pytest.mark.parametrize(
    "status,waiting",
    [(status, waiting) for status, waiting in WAITING_ON_A_REVIEWER.items()],
    ids=[status.value for status in WAITING_ON_A_REVIEWER],
)
def test_only_a_submitted_request_reads_as_being_reviewed(
    request_store: Any,  # noqa: F811
    status: ChangeStatus,
    waiting: bool,
) -> None:
    """The status in the WHERE clause, one row at a time.

    ``pending`` is the only status a reviewer can act from. Any other value
    in that clause gets at least one of these cases wrong.
    """
    _a_request_in(request_store, status)

    assert (
        gate.has_pending_request(AssetType.DASHBOARD, DASHBOARD_ID) is waiting
    )


def test_an_asset_with_no_request_at_all_is_not_being_reviewed(
    request_store: Any,  # noqa: F811
) -> None:
    assert not gate.has_pending_request(AssetType.DASHBOARD, DASHBOARD_ID)


def test_another_asset_of_the_same_kind_does_not_answer_for_this_one(
    request_store: Any,  # noqa: F811
) -> None:
    """The asset_id clause. Without it one dashboard in review would hold
    every dashboard."""
    _a_request_in(request_store, ChangeStatus.PENDING, asset_id=DASHBOARD_ID + 1)

    assert not gate.has_pending_request(AssetType.DASHBOARD, DASHBOARD_ID)


def test_the_same_id_on_another_kind_does_not_answer_either(
    request_store: Any,  # noqa: F811
) -> None:
    """The asset_type clause. Ids are per-kind, so chart 31 and dashboard 31
    are different assets that would otherwise share an answer."""
    _a_request_in(
        request_store, ChangeStatus.PENDING, asset_type=AssetType.CHART.value
    )

    assert not gate.has_pending_request(AssetType.DASHBOARD, DASHBOARD_ID)


def test_one_submitted_request_is_enough_among_several(
    request_store: Any,  # noqa: F811
) -> None:
    """An asset's history accumulates decided requests beside the open one."""
    _a_request_in(request_store, ChangeStatus.APPROVED, id=1, active_slot=None)
    _a_request_in(request_store, ChangeStatus.DISCARDED, id=2, active_slot=None)
    _a_request_in(request_store, ChangeStatus.PENDING, id=3)

    assert gate.has_pending_request(AssetType.DASHBOARD, DASHBOARD_ID)


def test_a_database_that_cannot_answer_is_treated_as_being_reviewed(
    request_store: Any,  # noqa: F811
    mocker: Any,
) -> None:
    """Fail closed. "Unknowable" is not "nobody is reviewing".

    Inverting this returns the permissive answer on any database error, so a
    write applies un-held exactly when the metadata database is unwell --
    the one moment nobody is watching the logs for a governance bypass.
    """
    mocker.patch.object(
        request_store.engine, "connect", side_effect=RuntimeError("no database")
    )

    assert gate.has_pending_request(AssetType.DASHBOARD, DASHBOARD_ID)
