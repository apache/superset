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
"""``dashboard_is_exposed``, which had no test of its own.

A test leak, found by a sweep of this suite. This is the question the whole
never-published exemption turns on -- whether viewers can reach a dashboard,
or ever could -- and it decides two things: whether a draft may be edited and
deleted freely, and whether placing a chart on a dashboard is held, because
that changes what the dashboard's viewers can reach.

It was exercised only indirectly, through callers that mock
``has_ever_been_published`` away. So the "published right now" half, the
"published earlier in this very flush" half, and the database fallback for a
flag set without its old value loaded were all unasserted.

The reason it has three halves is QA-18. Reading the live flag alone let an
editor unpublish, edit under the exemption, and publish again, with the
approver seeing only the flag move and never the content behind it. So the
flag answers where the dashboard *is* and the mark answers where it has
*been*, and only the second one answers "could a viewer have seen this".
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import gate
from asset_approval.types import AssetType
from pytest_mock import MockerFixture

DASHBOARD_ID = 61


@pytest.fixture
def never_marked(mocker: MockerFixture) -> Any:
    """No publish mark on record, so the flag is the only evidence."""
    return mocker.patch.object(gate, "has_ever_been_published", return_value=False)


def test_a_published_dashboard_is_exposed(never_marked: Any) -> None:
    assert gate.dashboard_is_exposed(
        SimpleNamespace(id=DASHBOARD_ID, published=True)
    )


def test_a_draft_nobody_has_published_is_not(never_marked: Any) -> None:
    """The exemption's whole premise: nothing for review to protect yet."""
    assert not gate.dashboard_is_exposed(
        SimpleNamespace(id=DASHBOARD_ID, published=False)
    )


def test_a_draft_that_was_published_once_is_exposed(never_marked: Any) -> None:
    """Draft now, but viewers have seen it. The flag says where it is; the
    mark says where it has been, and only the mark answers this (QA-18).

    Without this, an editor could unpublish, edit freely under the
    exemption, and publish again -- and the approver would see the flag move
    with the content behind it never shown.
    """
    never_marked.return_value = True

    assert gate.dashboard_is_exposed(
        SimpleNamespace(id=DASHBOARD_ID, published=False)
    )
    never_marked.assert_called_with(AssetType.DASHBOARD, DASHBOARD_ID)


def test_a_dashboard_with_no_id_yet_is_not_exposed(never_marked: Any) -> None:
    """Being created. There is nothing to have been seen, and nothing to
    look up -- asking the mark table for ``None`` would be a query for no
    reason."""
    assert not gate.dashboard_is_exposed(SimpleNamespace(id=None, published=False))
    never_marked.assert_not_called()


def test_the_flag_read_is_the_one_from_before_this_write(
    never_marked: Any, mocker: MockerFixture
) -> None:
    """A write that unpublishes is judged on what the flag held *before* it.

    Otherwise the unpublish itself would be the write that slipped through:
    read after the change, a dashboard being taken private looks like a
    draft, and a draft is exempt.
    """
    history = SimpleNamespace(deleted=[True], unchanged=[], added=[False])
    mocker.patch.object(
        gate,
        "_before",
        side_effect=lambda h: h.deleted[0] if h.deleted else gate._UNKNOWN,
    )
    mocker.patch(
        "sqlalchemy.inspect",
        return_value=SimpleNamespace(
            attrs=SimpleNamespace(published=SimpleNamespace(history=history)),
            session=None,
        ),
    )

    assert gate.dashboard_is_exposed(
        SimpleNamespace(id=DASHBOARD_ID, published=False)
    )


def test_an_object_sqlalchemy_cannot_inspect_falls_back_to_its_flag(
    never_marked: Any,
) -> None:
    """A stand-in rather than a mapped row -- which is what the gate is
    handed in several of its own tests, so the fallback is load-bearing."""
    assert gate.dashboard_is_exposed(
        SimpleNamespace(id=DASHBOARD_ID, published=True)
    )
    assert not gate.dashboard_is_exposed(
        SimpleNamespace(id=DASHBOARD_ID, published=False)
    )
