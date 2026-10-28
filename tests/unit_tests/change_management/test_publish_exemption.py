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
"""The draft exemption, and the laundering route it used to leave open.

SOW 5.1 lets a dashboard be built without an approval per save, because
while it is a draft no viewer can reach it. The exemption has to be keyed
on *never published* rather than *not published right now*: the Draft flag
is one an editor sets themselves, so reading it live let them unpublish,
edit under the exemption, and publish again, showing the approver nothing
but the flag (QA-18).
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import bindings
from asset_approval.types import AssetType
from pytest_mock import MockerFixture


def _command(published: bool, payload: dict[str, Any]) -> SimpleNamespace:
    return SimpleNamespace(
        _model=SimpleNamespace(id=7, published=published),
        _captured_payload=dict(payload),
    )


@pytest.fixture
def seen(mocker: MockerFixture) -> dict[str, Any]:
    """The gate's three outward calls, captured rather than performed."""
    return {
        "gate_write": mocker.patch.object(bindings, "gate_write"),
        "mark_published": mocker.patch.object(bindings, "mark_published"),
        "ever": mocker.patch.object(bindings, "has_ever_been_published"),
    }


def test_a_dashboard_never_published_is_exempt(seen: dict[str, Any]) -> None:
    """The case the exemption exists for: nobody can see it yet."""
    seen["ever"].return_value = False

    bindings._gate_dashboard_update(_command(False, {"dashboard_title": "Draft"}))

    seen["gate_write"].assert_not_called()


def test_editing_a_published_dashboard_is_reviewed(seen: dict[str, Any]) -> None:
    seen["ever"].return_value = True

    bindings._gate_dashboard_update(_command(True, {"dashboard_title": "Live"}))

    seen["gate_write"].assert_called_once()


def test_publishing_for_the_first_time_is_reviewed(seen: dict[str, Any]) -> None:
    """The transition that first exposes it to viewers is a governed write."""
    seen["ever"].return_value = False

    bindings._gate_dashboard_update(_command(False, {"published": True}))

    seen["gate_write"].assert_called_once()


def test_editing_after_an_unpublish_is_still_reviewed(seen: dict[str, Any]) -> None:
    """The laundering route, closed.

    Unpublish, then edit: the Draft flag now says 'draft', but a viewer has
    seen this dashboard before and will see it again, so the edit is not
    the unobserved building the exemption is for.
    """
    seen["ever"].return_value = True

    bindings._gate_dashboard_update(_command(False, {"dashboard_title": "Snuck in"}))

    seen["gate_write"].assert_called_once()


def test_a_write_against_a_published_dashboard_records_the_fact(
    seen: dict[str, Any],
) -> None:
    """Including one installed before the extension existed."""
    seen["ever"].return_value = True

    bindings._gate_dashboard_update(_command(True, {"dashboard_title": "Live"}))

    seen["mark_published"].assert_called_once_with(AssetType.DASHBOARD, 7)


def test_unpublishing_records_it_too(seen: dict[str, Any]) -> None:
    """An asset cannot be unpublished without having been published.

    This is the call that closes the hole for a dashboard the extension
    never saw published any other way.
    """
    seen["ever"].return_value = False

    bindings._gate_dashboard_update(_command(True, {"published": False}))

    seen["mark_published"].assert_called_once_with(AssetType.DASHBOARD, 7)
    seen["gate_write"].assert_called_once()


def test_a_draft_write_does_not_record_anything(seen: dict[str, Any]) -> None:
    seen["ever"].return_value = False

    bindings._gate_dashboard_update(_command(False, {"dashboard_title": "Draft"}))

    seen["mark_published"].assert_not_called()
