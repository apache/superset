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
"""Approving belongs to the asset's editors, and not to a role.

The right travels with the asset, because that is what maker-checker means
here: a *second editor* of this dashboard, chart or dataset. The mockups
settled it and this file is where that decision is written down in code.

It replaces ``test_approval_is_a_separate_permission``. S-05 was read as
asking for a grantable ``can_approve`` on ChangeRequest, one was built, and
it was removed again because a role gate on top of editorship can only ever
subtract. It silently stops a legitimate editor approving, which is a
deadlock rather than a control, and that is not a theoretical risk: while it
existed, ``can_approve`` consulted it and ``eligible_approvers`` did not, so
narrowing the roles would have named an approver the route then refused.

Service accounts are still excluded by role name, and that is a different
thing. A denylist stops certain accounts counting as approvers; it does not
hand anybody the right (S-07).

If S-05 is reopened, it should be answered with this file rather than by
building the permission again.
"""

from __future__ import annotations

import inspect
from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import eligibility
from asset_approval.api import ChangeRequestRestApi
from pytest_mock import MockerFixture


def _request(author_fk: int = 7) -> Any:
    return SimpleNamespace(id=1, author_fk=author_fk, command_args={})


@pytest.fixture
def account(mocker: MockerFixture) -> None:
    """A live, human account, so only editorship is left to decide."""
    mocker.patch.object(
        eligibility, "security_manager", SimpleNamespace(is_guest_user=lambda: False)
    )
    mocker.patch.object(
        eligibility,
        "load_user",
        return_value=SimpleNamespace(id=9, active=True, roles=[]),
    )
    mocker.patch.object(eligibility, "machine_user_roles", return_value=set())


@pytest.mark.parametrize("action", ["approve", "request_changes"])
def test_the_reviewer_actions_carry_no_permission_of_their_own(action: str) -> None:
    """They sit on ``can_write`` with submit, withdraw and discard.

    FAB creates a permission per distinct name in this mapping, so giving
    the reviewer actions their own name is what made ``can_approve`` exist
    and what made it grantable. Keeping them on ``write`` is how the right
    stays with the asset.
    """
    assert ChangeRequestRestApi.method_permission_name[action] == "write"


def test_a_second_editor_may_approve(
    account: None, mocker: MockerFixture
) -> None:
    mocker.patch.object(eligibility, "is_strict_editor", return_value=True)

    assert eligibility.can_approve(_request(), object(), 9) is True


def test_someone_who_does_not_edit_the_asset_may_not(
    account: None, mocker: MockerFixture
) -> None:
    """Including an administrator: ``is_strict_editor`` has no admin
    shortcut, which is Visa Q1 / SOW 9.3."""
    mocker.patch.object(eligibility, "is_strict_editor", return_value=False)

    assert eligibility.can_approve(_request(), object(), 9) is False


def test_the_author_may_not_approve_their_own_change(
    account: None, mocker: MockerFixture
) -> None:
    """Checked before anything else, and not overridable. It is the
    separation of duties the whole feature exists for."""
    mocker.patch.object(eligibility, "is_strict_editor", return_value=True)

    assert eligibility.can_approve(_request(author_fk=9), object(), 9) is False


def test_nothing_in_the_decision_consults_a_role_permission() -> None:
    """The structural half, so this cannot drift back.

    A behavioural test passes whether or not a permission lookup is there,
    as long as the stub grants it. This one reads the source, which is the
    only way to assert the *absence* of a gate.
    """
    source = inspect.getsource(eligibility.can_approve)

    assert "permission" not in source.lower()
    assert "is_strict_editor" in source
    # And the helpers that performed the lookup are gone, not merely unused.
    for gone in (
        "holds_approval_permission",
        "roles_that_may_approve",
        "roles_carry_approval",
        "APPROVAL_PERMISSION",
    ):
        assert not hasattr(eligibility, gone), gone


def test_the_approver_list_asks_the_same_questions_as_the_route(
    mocker: MockerFixture,
) -> None:
    """The dialog and the route disagreeing is how S-07 and its inverse
    both happened, so the two conditions on the account are shared."""
    mocker.patch.object(eligibility, "machine_user_roles", return_value={"Bots"})

    live = SimpleNamespace(id=1, active=True, roles=[])
    deactivated = SimpleNamespace(id=2, active=False, roles=[])
    robot = SimpleNamespace(id=3, active=True, roles=[SimpleNamespace(name="Bots")])

    assert eligibility.is_eligible_approver(live) is True
    assert eligibility.is_eligible_approver(deactivated) is False
    assert eligibility.is_eligible_approver(robot) is False
