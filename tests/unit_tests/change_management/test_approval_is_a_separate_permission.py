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
"""Approving is a right of its own, grantable apart from editing (S-05).

``can_write`` on ChangeRequest used to cover submit, approve, request
changes, withdraw and discard together, so an operator could not say who may
approve without also saying who may submit -- which SOW 5.4 asks for.

Two halves are pinned here. The route mapping, which is what makes FAB create
the permission and is what ``@protect()`` enforces. And ``can_approve``,
which re-reads the same right so the UI cannot offer an Approve button the
route would refuse.
"""

from types import SimpleNamespace
from typing import Any

import pytest
from asset_approval import eligibility
from asset_approval.api import ChangeRequestRestApi
from pytest_mock import MockerFixture


def _request(author_fk: int = 7) -> Any:
    return SimpleNamespace(id=1, author_fk=author_fk, command_args={})


@pytest.fixture
def editor(mocker: MockerFixture) -> None:
    """Everything about the would-be approver except the permission."""
    mocker.patch.object(
        eligibility, "security_manager", SimpleNamespace(is_guest_user=lambda: False)
    )
    mocker.patch.object(eligibility, "is_strict_editor", return_value=True)


def _security(
    mocker: MockerFixture,
    role_ids: set[int] | None,
    user_id: int,
    user_role_ids: set[int],
) -> None:
    """Stand in for the stored permission, the roles on it, and the user.

    ``role_ids`` of ``None`` means the permission does not exist on this
    instance yet. Patched on ``superset.extensions`` rather than on the
    manager, which is a ``LocalProxy``: an attribute set on the proxy does
    not reach the object the function resolves.
    """
    pvm = (
        None
        if role_ids is None
        else SimpleNamespace(role=[SimpleNamespace(id=i) for i in sorted(role_ids)])
    )
    user = SimpleNamespace(
        id=user_id, roles=[SimpleNamespace(id=i) for i in sorted(user_role_ids)]
    )
    mocker.patch(
        "superset.extensions.security_manager",
        SimpleNamespace(
            find_permission_view_menu=lambda *_args: pvm,
            current_user=user,
            get_user_by_id=lambda _id: None,
        ),
    )


# ------------------------------------------------------------- the route


def test_the_reviewer_actions_do_not_share_write_with_the_author_actions() -> None:
    mapping = ChangeRequestRestApi.method_permission_name

    assert mapping["approve"] == mapping["request_changes"] == "approve"
    # Submitting, withdrawing and discarding are the author's and the
    # editors', and stay where they were.
    assert mapping["submit"] == mapping["withdraw"] == mapping["discard"] == "write"
    assert "approve" not in {mapping[name] for name in ("submit", "withdraw", "discard")}


def test_the_permission_name_is_the_one_eligibility_reads() -> None:
    """The route mapping and the eligibility check must name the same right."""
    permission, view_menu = eligibility.APPROVAL_PERMISSION

    assert permission == f"can_{ChangeRequestRestApi.method_permission_name['approve']}"
    assert view_menu == ChangeRequestRestApi.class_permission_name


# ------------------------------------------------------- holding the right


def test_a_role_without_the_right_may_not_approve(
    mocker: MockerFixture, editor: None
) -> None:
    _security(mocker, {1}, user_id=9, user_role_ids={2})

    assert eligibility.holds_approval_permission(9) is False
    assert eligibility.can_approve(_request(), SimpleNamespace(id=42), 9) is False


def test_a_role_with_the_right_approves_as_before(
    mocker: MockerFixture, editor: None
) -> None:
    _security(mocker, {1}, user_id=9, user_role_ids={1, 2})

    assert eligibility.holds_approval_permission(9) is True
    assert eligibility.can_approve(_request(), SimpleNamespace(id=42), 9) is True


def test_nobody_approves_while_the_right_is_granted_to_no_role(
    mocker: MockerFixture, editor: None
) -> None:
    _security(mocker, set(), user_id=9, user_role_ids={1})

    assert eligibility.holds_approval_permission(9) is False


def test_an_instance_without_the_permission_yet_is_unchanged(
    mocker: MockerFixture, editor: None
) -> None:
    """Fail open, and only here.

    An instance that has not run ``superset init`` since this shipped has no
    such permission to read. Refusing there would turn a new permission into
    an outage for every approver; instead each role keeps the approval rights
    it had when the right was still folded into ``can_write``.
    """
    _security(mocker, None, user_id=9, user_role_ids={1})

    assert eligibility.holds_approval_permission(9) is True
    assert eligibility.can_approve(_request(), SimpleNamespace(id=42), 9) is True


def test_the_author_check_still_wins(mocker: MockerFixture, editor: None) -> None:
    """Separation of duties is not something a permission can buy back."""
    _security(mocker, {1}, user_id=7, user_role_ids={1})

    assert eligibility.holds_approval_permission(7) is True
    assert eligibility.can_approve(_request(author_fk=7), SimpleNamespace(id=42), 7) is False


# ------------------------------------------------- who the operator grants it to


def _role(name: str, holds: Any) -> Any:
    return SimpleNamespace(name=name, permissions=[holds] if holds else [])


def _manager(mocker: MockerFixture, roles: list[Any], pvm: Any) -> tuple[list, list]:
    """A security manager that records what would be granted and revoked."""
    granted: list[str] = []
    revoked: list[str] = []

    def add(role: Any, permission: Any) -> None:
        role.permissions.append(permission)
        granted.append(role.name)

    def remove(role: Any, permission: Any) -> None:
        role.permissions.remove(permission)
        revoked.append(role.name)

    mocker.patch(
        "superset.extensions.security_manager",
        SimpleNamespace(
            find_permission_view_menu=lambda *_args: pvm,
            get_all_roles=lambda: roles,
            add_permission_role=add,
            del_permission_role=remove,
        ),
    )
    return granted, revoked


def _configured(mocker: MockerFixture, value: Any) -> Any:
    from asset_approval import entrypoint

    mocker.patch.object(
        entrypoint,
        "current_app",
        SimpleNamespace(config={entrypoint.APPROVER_ROLES_CONFIG: value}),
    )
    return entrypoint


def test_configuring_nothing_leaves_who_may_approve_alone(
    mocker: MockerFixture,
) -> None:
    """The shipped default must not move an existing instance.

    With no list configured, the right is whatever ``superset init``'s role
    sync produced -- Admin, Alpha and Gamma, the same set that already held
    ``can_write``. Separating the permission is meant to make the decision
    expressible, not to make it for the operator.
    """
    pvm = object()
    entrypoint = _configured(mocker, None)
    granted, revoked = _manager(mocker, [_role("Admin", pvm)], pvm)

    entrypoint._align_approval_permission()

    assert granted == [] and revoked == []


def test_a_configured_list_grants_and_revokes_the_builtin_roles(
    mocker: MockerFixture,
) -> None:
    pvm = object()
    roles = [
        _role("Admin", pvm),
        _role("Alpha", pvm),
        _role("Gamma", pvm),
        _role("Reviewers", None),
    ]
    entrypoint = _configured(mocker, ["Admin", "Reviewers"])
    granted, revoked = _manager(mocker, roles, pvm)

    entrypoint._align_approval_permission()

    assert granted == ["Reviewers"]
    assert sorted(revoked) == ["Alpha", "Gamma"]


def test_a_role_the_operator_built_is_never_revoked_from(
    mocker: MockerFixture,
) -> None:
    """Only the roles ``superset init`` rebuilds are realigned.

    A grant on a role an operator created is theirs; this runs on every boot
    and must not quietly undo it. The same loop re-asserts the configured
    grants precisely because ``superset init`` would otherwise hand the right
    back to the builtin roles and erase a deliberate revoke.
    """
    pvm = object()
    roles = [_role("Gamma", pvm), _role("Auditors", pvm)]
    entrypoint = _configured(mocker, ["Admin"])
    _granted, revoked = _manager(mocker, roles, pvm)

    entrypoint._align_approval_permission()

    assert revoked == ["Gamma"]
    assert pvm in dict((r.name, r.permissions) for r in roles)["Auditors"]


def test_an_instance_missing_the_permission_is_left_untouched(
    mocker: MockerFixture,
) -> None:
    entrypoint = _configured(mocker, ["Admin"])
    granted, revoked = _manager(mocker, [_role("Gamma", object())], None)

    entrypoint._align_approval_permission()

    assert granted == [] and revoked == []


def test_a_failure_here_does_not_stop_the_extension_loading(
    mocker: MockerFixture,
) -> None:
    """A read-only or unmigrated metadata database is a degraded state.

    ``install_bindings`` has core refuse every governed write until a gate
    registers, so an exception escaping ``init()`` would be an authoring
    outage rather than a weaker exemption.
    """
    pvm = object()
    entrypoint = _configured(mocker, ["Admin"])
    mocker.patch(
        "superset.extensions.security_manager",
        SimpleNamespace(
            find_permission_view_menu=lambda *_args: pvm,
            get_all_roles=lambda: (_ for _ in ()).throw(RuntimeError("read-only")),
        ),
    )

    entrypoint._align_approval_permission()
