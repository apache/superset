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
"""A signed-out visitor is not part of the review workflow (NEW-6).

Both grants in the entrypoint hand rights to "whoever already holds X", read
off the permission tables. ``PUBLIC_ROLE_LIKE`` -- Superset's documented way
to let signed-out visitors see dashboards -- copies a whole role onto the
anonymous one, so on such an instance the anonymous role held ``can_write``
on ChangeRequest and was seeded the approval right and the Approvals page
with it.

Nothing could be approved with it. But an approval permission on the
anonymous role is the wrong answer to give a control review, and a review
queue is not a page to offer someone who has not signed in.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from pytest_mock import MockerFixture


def _entrypoint() -> Any:
    """Imported inside a test: the module runs ``init()`` when first loaded,
    which needs the app context the autouse fixture has set up by then."""
    from asset_approval import entrypoint

    return entrypoint


class _Role:
    def __init__(self, name: str, permissions: list[Any]) -> None:
        self.name = name
        self.permissions = permissions


def _pvm(name: str) -> Any:
    return SimpleNamespace(permission=SimpleNamespace(name=name))


@pytest.fixture
def permissions() -> dict[str, Any]:
    return {"can_approve": _pvm("can_approve"), "can_review": _pvm("can_review")}


def _security(
    mocker: MockerFixture, roles: dict[str, _Role], permissions: dict[str, Any]
) -> list[tuple[str, str]]:
    """A security manager over these roles; returns the revokes it is told."""
    revoked: list[tuple[str, str]] = []

    def find_permission_view_menu(permission: str, _view_menu: str) -> Any:
        return permissions.get(permission)

    manager = SimpleNamespace(
        find_role=roles.get,
        find_permission_view_menu=find_permission_view_menu,
        del_permission_role=lambda role, pvm: revoked.append(
            (role.name, pvm.permission.name)
        ),
    )
    mocker.patch("superset.extensions.security_manager", manager)
    return revoked


def test_the_anonymous_role_loses_both_review_permissions(
    mocker: MockerFixture, permissions: dict[str, Any]
) -> None:
    public = _Role("Public", [permissions["can_approve"], permissions["can_review"]])
    revoked = _security(mocker, {"Public": public}, permissions)

    _entrypoint()._take_the_workflow_off_the_anonymous_role()

    assert sorted(revoked) == [("Public", "can_approve"), ("Public", "can_review")]


def test_a_role_that_holds_neither_is_left_alone(
    mocker: MockerFixture, permissions: dict[str, Any]
) -> None:
    revoked = _security(mocker, {"Public": _Role("Public", [])}, permissions)

    _entrypoint()._take_the_workflow_off_the_anonymous_role()

    assert revoked == []


def test_only_the_anonymous_role_is_touched(
    mocker: MockerFixture, permissions: dict[str, Any]
) -> None:
    # Alpha holds exactly what Public holds. Only one of them is anonymous.
    held = [permissions["can_approve"], permissions["can_review"]]
    roles = {"Public": _Role("Public", list(held)), "Alpha": _Role("Alpha", held)}
    revoked = _security(mocker, roles, permissions)

    _entrypoint()._take_the_workflow_off_the_anonymous_role()

    assert {name for name, _ in revoked} == {"Public"}


def test_the_seed_skips_the_anonymous_role() -> None:
    """The grant side of the same rule, so a fresh install never gets there."""
    assert _entrypoint().belongs_to_the_workflow(_Role("Alpha", [])) is True
    assert _entrypoint().belongs_to_the_workflow(_Role("Public", [])) is False


def test_the_role_name_follows_the_instance_configuration(
    mocker: MockerFixture,
) -> None:
    """An instance that renamed its anonymous role is still covered."""
    mocker.patch.object(
        _entrypoint(),
        "current_app",
        SimpleNamespace(config={"AUTH_ROLE_PUBLIC": "Anonymous"}),
    )

    assert _entrypoint().belongs_to_the_workflow(_Role("Anonymous", [])) is False
    assert _entrypoint().belongs_to_the_workflow(_Role("Public", [])) is True
