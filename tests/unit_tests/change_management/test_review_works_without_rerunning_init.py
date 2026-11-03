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
"""Installing the extension after ``superset init`` still leaves review usable.

Superset builds its AppBuilder with ``update_perms=False``, so registering
an API does not create the permissions that protect it. ``superset init``
creates them and nothing else does. Install the extension after init has
run and no role holds ``can_read`` or ``can_write`` on ChangeRequest, so
every route answers 403.

The failure was silent in the worst way. The gate consults the feature flag
rather than a permission, so the write was still captured and the author was
told their change had been saved for review. Every read then 403'd and the
frontend reads a failed read as "no open change", so there was no banner and
no Request review. Submit and approve were 403 too, so nobody could move the
edit on, while other editors were correctly refused because the asset was
locked. The edit was stranded, not lost, and rerunning ``superset init``
released it (sc-131031).

The host already solves this for an extension's pages, which is why the
Approvals page worked while the API did not: ``ensure_page_permissions``
exists precisely because an extension can be installed long after init.
"""

from __future__ import annotations

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
    def __init__(self, name: str) -> None:
        self.name = name
        self.permissions: list[Any] = []


class _Pvm:
    """A permission-view pair, with the roles that hold it."""

    def __init__(self) -> None:
        self.role: list[_Role] = []


@pytest.fixture
def manager(mocker: MockerFixture) -> Any:
    """A security manager where no ChangeRequest permission exists yet."""
    created: list[tuple[str, str]] = []
    pvms: dict[str, _Pvm] = {}
    roles = {name: _Role(name) for name in ("Admin", "Alpha", "Gamma", "Public")}

    def add_permission_view_menu(permission: str, view_menu: str) -> Any:
        created.append((permission, view_menu))
        return pvms.setdefault(permission, _Pvm())

    def granted(role: _Role, pvm: _Pvm) -> None:
        role.permissions.append(pvm)
        pvm.role.append(role)

    fake = SimpleNamespace(
        add_permission_view_menu=add_permission_view_menu,
        find_permission_view_menu=lambda permission, _view: pvms.get(permission),
        find_role=roles.get,
        add_permission_role=granted,
    )
    mocker.patch("superset.extensions.security_manager", fake)
    mocker.patch.object(
        _entrypoint(), "_anonymous_role_name", return_value="Public"
    )
    return SimpleNamespace(created=created, pvms=pvms, roles=roles)


def test_the_permissions_are_derived_from_the_routes() -> None:
    """Listing them again here is how one gets forgotten.

    If a route is added under a new permission name, it is created too.
    """
    assert _entrypoint()._api_permissions() == ["can_read", "can_write"]


def test_the_permissions_are_created_without_waiting_for_init(
    manager: Any,
) -> None:
    _entrypoint()._ensure_the_api_permissions_exist()

    assert manager.created == [
        ("can_read", "ChangeRequest"),
        ("can_write", "ChangeRequest"),
    ]


def test_the_workflow_roles_are_seeded_so_an_editor_can_see_their_edit(
    manager: Any,
) -> None:
    """Creating the permission is not enough: it has to be held by somebody."""
    _entrypoint()._ensure_the_api_permissions_exist()

    for name in ("Admin", "Alpha", "Gamma"):
        held = manager.roles[name].permissions
        assert len(held) == 2, name


def test_the_anonymous_role_is_never_seeded(manager: Any) -> None:
    """``PUBLIC_ROLE_LIKE`` copies a role onto the anonymous one, and a
    review queue is not a thing to hand someone who has not signed in."""
    _entrypoint()._ensure_the_api_permissions_exist()

    assert manager.roles["Public"].permissions == []


def test_a_permission_somebody_already_holds_is_left_alone(
    manager: Any,
) -> None:
    """An operator's deliberate revocation must survive a restart.

    Once any real role holds the permission, the arrangement is theirs. Here
    Alpha holds the read and Admin does not, which is a narrowing an
    operator could have made on purpose.
    """
    existing = _Pvm()
    manager.pvms["can_read"] = existing
    alpha = manager.roles["Alpha"]
    existing.role.append(alpha)
    alpha.permissions.append(existing)

    _entrypoint()._ensure_the_api_permissions_exist()

    assert manager.roles["Admin"].permissions == [manager.pvms["can_write"]]
    assert alpha.permissions == [existing, manager.pvms["can_write"]]


def test_a_permission_held_only_by_the_anonymous_role_is_still_seeded(
    manager: Any,
) -> None:
    """That is not an operator's arrangement, it is the bug in
    ``belongs_to_the_workflow``: the anonymous role holding it does not mean
    anybody who can sign in does."""
    stray = _Pvm()
    manager.pvms["can_read"] = stray
    public = manager.roles["Public"]
    stray.role.append(public)

    _entrypoint()._ensure_the_api_permissions_exist()

    assert manager.pvms["can_read"] in manager.roles["Admin"].permissions


def test_a_database_that_cannot_be_written_does_not_stop_the_extension(
    mocker: MockerFixture,
) -> None:
    """Review is then unreachable until init runs, which is the behaviour
    this replaces rather than a regression it introduces."""
    mocker.patch(
        "superset.extensions.security_manager",
        SimpleNamespace(
            add_permission_view_menu=mocker.Mock(side_effect=RuntimeError("read-only")),
        ),
    )

    _entrypoint()._ensure_the_api_permissions_exist()


def test_the_page_grant_runs_after_the_permissions_exist() -> None:
    """Ordering is the whole point of where the call sits.

    ``_grant_page_permission_to_the_workflow`` reads ``can_read`` on
    ChangeRequest to decide who belongs in the workflow. Called first it
    finds nothing and returns silently, so the Approvals page stays
    Admin-only as well.
    """
    import inspect

    source = inspect.getsource(_entrypoint().install_views)
    assert source.index("_ensure_the_api_permissions_exist") < source.index(
        "_grant_page_permission_to_the_workflow"
    )
