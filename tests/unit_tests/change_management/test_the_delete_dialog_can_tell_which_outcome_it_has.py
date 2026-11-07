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
"""B1: the delete confirmation has two outcomes and could only describe one.

SOW 5.1 exempts a dashboard that has never been published: nothing a viewer
could reach, so nothing for review to protect, and the delete applies at
once. The dialog said "This dashboard needs review before it is removed.
Nothing is removed yet" either way -- word for word the same sentence over
the case that files a request and the case that deletes the row -- so the
person pressing it could not tell which they were about to get.

The client cannot work the answer out. The rule is "never published", not
"not published now", so the Draft flag on the row does not answer it
(QA-18), and nothing on the asset endpoint carried the history. So the
predicate the gate already uses is exposed as a read, and these tests pin
that the read and the gate give the same answer -- a dialog that is honest
about the wrong thing is the defect over again.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from pytest_mock import MockerFixture

from asset_approval import bindings
from asset_approval.types import AssetType


def _dashboard(dashboard_id: int = 7, published: bool = False) -> Any:
    return SimpleNamespace(id=dashboard_id, published=published)


@pytest.fixture
def world(mocker: MockerFixture) -> dict[str, Any]:
    """Review on, nothing published, nothing pending: the exempt case."""
    return {
        "enabled": mocker.patch.object(bindings, "is_enabled", return_value=True),
        "ever": mocker.patch.object(
            bindings, "has_ever_been_published", return_value=False
        ),
        "pending": mocker.patch.object(
            bindings, "has_pending_request", return_value=False
        ),
    }


# ---- the answer itself ------------------------------------------------------


def test_a_never_published_draft_is_not_governed(world: dict[str, Any]) -> None:
    """The case the dialog was lying about."""
    assert not bindings.delete_is_governed(AssetType.DASHBOARD, _dashboard())


def test_a_published_dashboard_is_governed(world: dict[str, Any]) -> None:
    assert bindings.delete_is_governed(
        AssetType.DASHBOARD, _dashboard(published=True)
    )


def test_a_dashboard_published_and_since_unpublished_is_governed(
    world: dict[str, Any],
) -> None:
    """Draft now, but viewers have seen it. The flag cannot see this (QA-18)."""
    world["ever"].return_value = True

    assert bindings.delete_is_governed(AssetType.DASHBOARD, _dashboard())


def test_a_draft_already_with_a_reviewer_is_governed(
    world: dict[str, Any],
) -> None:
    """Its first publish is being reviewed, so a reviewer is looking (R7-03)."""
    world["pending"].return_value = True

    assert bindings.delete_is_governed(AssetType.DASHBOARD, _dashboard())


@pytest.mark.parametrize("kind", [AssetType.CHART, AssetType.DATASET])
def test_charts_and_datasets_have_no_exemption(
    world: dict[str, Any], kind: AssetType
) -> None:
    """Only `_gate_dashboard_delete` reasons about exposure; the other two
    hand every delete to `gate_delete` unconditionally. So the copy for them
    needs no lookup, and must not acquire one by accident."""
    assert bindings.delete_is_governed(kind, _dashboard())


def test_nothing_is_governed_with_review_off(world: dict[str, Any]) -> None:
    """The whole question is the feature's. Off, the plain archive copy is
    right for every asset."""
    world["enabled"].return_value = False

    assert not bindings.delete_is_governed(
        AssetType.DASHBOARD, _dashboard(published=True)
    )
    assert not bindings.delete_is_governed(AssetType.CHART, _dashboard())


def test_an_asset_with_no_id_is_governed(world: dict[str, Any]) -> None:
    """There is nothing to look up, and of the two wrong answers this is the
    one that does not promise recovery for a delete that will not happen."""
    assert bindings.delete_is_governed(
        AssetType.DASHBOARD, SimpleNamespace(published=False)
    )


# ---- it is the gate's own answer, not a second opinion ----------------------


@pytest.mark.parametrize(
    "published,ever,pending",
    [
        (False, False, False),
        (True, False, False),
        (False, True, False),
        (False, False, True),
    ],
)
def test_the_read_agrees_with_the_gate_in_every_case(
    world: dict[str, Any],
    mocker: MockerFixture,
    published: bool,
    ever: bool,
    pending: bool,
) -> None:
    """The point of the whole fix. A dialog that is confidently wrong is no
    better than one that is vaguely wrong, so the sentence and the behaviour
    are driven off one predicate and this is what says so.
    """
    world["ever"].return_value = ever
    world["pending"].return_value = pending
    model = _dashboard(published=published)
    held = mocker.patch.object(bindings, "gate_delete")
    mocker.patch.object(bindings, "mark_published")
    mocker.patch.object(bindings, "discard_the_authors_draft_on")

    bindings._gate_dashboard_delete(
        SimpleNamespace(_models=[model], _model=model)
    )

    says_governed = bindings.delete_is_governed(AssetType.DASHBOARD, model)
    assert says_governed is (held.call_count == 1)
