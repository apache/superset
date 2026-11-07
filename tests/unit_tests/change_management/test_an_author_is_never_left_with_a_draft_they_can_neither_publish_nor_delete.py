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
"""A draft nobody has seen can be deleted by the person who made it.

A dashboard is created as a draft with its author as the only editor, and
review needs a second one: the author cannot approve their own change. The
update gate already lets changes to a never-published dashboard apply
directly, because no viewer can reach it. Deleting it was held for review
all the same, and submitting that hold failed with "no one else can
approve", so the author could edit the draft freely and could never remove
it. The only way out was to name their own approver.

Review protects what viewers can see. A dashboard that has never been
published has not been seen, so a delete of it has nothing to protect.
Anything that has been published, or has a request in review, stays held.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import bindings
from asset_approval.types import AssetType
from pytest_mock import MockerFixture


def _dashboard(dashboard_id: int, published: bool = False) -> SimpleNamespace:
    return SimpleNamespace(id=dashboard_id, published=published)


def _delete(*models: SimpleNamespace) -> SimpleNamespace:
    return SimpleNamespace(_models=list(models))


@pytest.fixture
def seen(mocker: MockerFixture) -> dict[str, Any]:
    """The gate's outward calls, captured rather than performed."""
    return {
        "gate_delete": mocker.patch.object(bindings, "gate_delete"),
        "mark_published": mocker.patch.object(bindings, "mark_published"),
        "ever": mocker.patch.object(
            bindings, "has_ever_been_published", return_value=False
        ),
        "pending": mocker.patch.object(
            bindings, "has_pending_request", return_value=False
        ),
        "discard": mocker.patch.object(
            bindings, "discard_the_authors_draft_on"
        ),
    }


def test_a_never_published_draft_is_deleted_without_review(
    seen: dict[str, Any],
) -> None:
    """The trap: held for a review that could never be submitted."""
    bindings._gate_dashboard_delete(_delete(_dashboard(7)))

    seen["gate_delete"].assert_not_called()


def test_a_published_dashboard_is_still_held(seen: dict[str, Any]) -> None:
    bindings._gate_dashboard_delete(_delete(_dashboard(7, published=True)))

    seen["gate_delete"].assert_called_once_with(AssetType.DASHBOARD, [7])


def test_a_dashboard_published_and_since_unpublished_is_still_held(
    seen: dict[str, Any],
) -> None:
    """Draft now, but viewers have seen it, as for editing (QA-18)."""
    seen["ever"].return_value = True

    bindings._gate_dashboard_delete(_delete(_dashboard(7)))

    seen["gate_delete"].assert_called_once_with(AssetType.DASHBOARD, [7])


def test_a_draft_already_submitted_for_review_is_still_held(
    seen: dict[str, Any],
) -> None:
    """A reviewer is looking at it, as for editing (R7-03)."""
    seen["pending"].return_value = True

    bindings._gate_dashboard_delete(_delete(_dashboard(7)))

    seen["gate_delete"].assert_called_once_with(AssetType.DASHBOARD, [7])


def test_a_bulk_delete_holds_only_what_viewers_could_have_seen(
    seen: dict[str, Any],
) -> None:
    """Each asset is judged on its own, as a held delete already is.

    Note what this does NOT say. ``gate_delete`` is mocked here, so it does
    not raise, and in this test world the command carries on and dashboard 7
    looks deleted. In production ``gate_delete`` ends in
    ``ChangeRequestCreated``, which aborts the whole DELETE -- so 7 is not
    deleted either. This test is about which ids are judged governed; what
    happens to the exempt one is the test below.
    """
    seen["ever"].side_effect = lambda _type, dashboard_id: dashboard_id == 8

    bindings._gate_dashboard_delete(_delete(_dashboard(7), _dashboard(8)))

    seen["gate_delete"].assert_called_once_with(AssetType.DASHBOARD, [8])


def test_a_mixed_bulk_leaves_the_exempt_dashboards_draft_alone(
    seen: dict[str, Any],
) -> None:
    """Because that dashboard is not going to be deleted.

    ``gate_delete`` raises ``ChangeRequestCreated`` and the exception aborts
    the command, so in a mixed selection nothing is removed at all. The
    exempt member's draft, though, was discarded on the way past -- and
    ``_discard_request`` commits on its own connection, so it survived the
    abort. An author bulk-deleting a never-published dashboard alongside a
    published one lost the open publish request they were about to submit,
    and still had the dashboard.

    The draft is only in the way of a delete that is actually going to
    happen.
    """
    seen["ever"].side_effect = lambda _type, dashboard_id: dashboard_id == 8

    bindings._gate_dashboard_delete(_delete(_dashboard(7), _dashboard(8)))

    seen["gate_delete"].assert_called_once_with(AssetType.DASHBOARD, [8])
    seen["discard"].assert_not_called()


def test_but_a_delete_that_really_happens_still_clears_the_draft(
    seen: dict[str, Any],
) -> None:
    """The reason the discard exists: an author cannot be left with a draft
    on an asset that is gone (E1). Nothing is held here, so the command runs
    to completion and the dashboard really is removed."""
    bindings._gate_dashboard_delete(_delete(_dashboard(7)))

    seen["gate_delete"].assert_not_called()
    seen["discard"].assert_called_once_with(AssetType.DASHBOARD, 7)


def test_deleting_a_published_dashboard_records_that_it_was_seen(
    seen: dict[str, Any],
) -> None:
    """As the update gate does, so a dashboard published before the extension
    was installed is not mistaken for a draft by the next write."""
    bindings._gate_dashboard_delete(_delete(_dashboard(7, published=True)))

    seen["mark_published"].assert_called_once_with(AssetType.DASHBOARD, 7)
