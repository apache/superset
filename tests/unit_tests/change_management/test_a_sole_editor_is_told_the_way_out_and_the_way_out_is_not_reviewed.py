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
"""A chart or dashboard with one editor can still be changed.

A chart made by ``saveas`` (or by the REST create, which does the same) has
its author as its only editor. Review needs a second one and the author
cannot approve their own change, so the first governed change to it cannot
be submitted. That is by design (SOW 5.4: never auto-approve), and the
design's way out is that the editors list is not itself reviewed, so the
author can add the second editor and then submit.

These pin both halves of that: the refusal says what to do, and doing it is
not a second thing needing the approval that is missing. If the exemption
were ever narrowed, a sole-editor asset would be unchangeable for good.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import bindings, lifecycle
from asset_approval.exceptions import NoEligibleApproverError
from asset_approval.models import ChangeStatus
from pytest_mock import MockerFixture

AUTHOR = 7


def _draft() -> SimpleNamespace:
    return SimpleNamespace(
        id=1,
        asset_type="chart",
        asset_id=42,
        author_fk=AUTHOR,
        status=ChangeStatus.DRAFT.value,
    )


def test_submitting_with_nobody_else_to_approve_says_to_add_an_editor(
    mocker: MockerFixture,
) -> None:
    mocker.patch.object(lifecycle, "_locked", return_value=_draft())
    mocker.patch.object(lifecycle, "get_user_id", return_value=AUTHOR)
    mocker.patch.object(lifecycle, "_asset_for", return_value=SimpleNamespace(id=42))
    mocker.patch.object(lifecycle, "eligible_approvers", return_value=[])

    with pytest.raises(NoEligibleApproverError) as refusal:
        lifecycle.submit(1)

    assert "Add another editor" in str(refusal.value)


def test_adding_an_editor_to_a_sole_editor_asset_is_not_reviewed(
    mocker: MockerFixture,
) -> None:
    sole = SimpleNamespace(id=42, editors=[SimpleNamespace(id=1)])
    mocker.patch.object(
        bindings,
        "changed_fields",
        side_effect=lambda _asset, payload: [k for k in payload],
    )
    payload: dict[str, Any] = {"editors": [1, 2]}

    assert bindings._only_exempt(sole, payload) is True
