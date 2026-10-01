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
"""Migration-level regression tests for the #44626 follow-up (custom roles
keeping the legacy password-view permissions after upgrade).

Imports the real dated migration module -- date-prefixed filenames aren't
valid Python identifiers, so ``importlib.import_module`` is used instead of a
plain ``import`` (see
``tests/unit_tests/migrations/test_deprecated_permissions_33272.py`` for the
same pattern).
"""

from __future__ import annotations

from importlib import import_module

import pytest
from sqlalchemy.orm import Session

from superset.migrations.shared.security_converge import (
    Base,
    Permission,
    PermissionView,
    Pvm,
    Role,
    ViewMenu,
)

migration = import_module(
    "superset.migrations.versions."
    "2026-09-30_00-00_d623a0cb6bb0_sweep_legacy_password_view_perms_from_all_roles"
)

# The real migration constant -- never hand-copied.
PVM_LIST = migration.PVM_LIST


@pytest.fixture(autouse=True)
def setup_tables(session: Session) -> None:
    """``security_converge`` freezes its own partial declarative ``Base`` (see
    its module docstring), so the shared in-memory SQLite ``session`` fixture
    needs its tables created explicitly."""
    engine = session.get_bind()
    Base.metadata.create_all(engine)


def _make_pvm(session: Session, view_name: str, permission_name: str) -> PermissionView:
    view = session.query(ViewMenu).filter_by(name=view_name).one_or_none()
    if view is None:
        view = ViewMenu(name=view_name)
        session.add(view)
    permission = session.query(Permission).filter_by(name=permission_name).one_or_none()
    if permission is None:
        permission = Permission(name=permission_name)
        session.add(permission)
    session.flush()
    pvm = PermissionView(view_menu=view, permission=permission)
    session.add(pvm)
    session.flush()
    return pvm


def test_pvm_list_covers_both_legacy_views_and_the_launcher_actions() -> None:
    """Pins the real list against accidental edits: both legacy
    ``SimpleFormView``s' own permissions, and the two ``UserDBModelView``
    launcher actions that redirected to them."""
    assert set(PVM_LIST) == {
        Pvm("ResetPasswordView", "can_this_form_get"),
        Pvm("ResetPasswordView", "can_this_form_post"),
        Pvm("ResetMyPasswordView", "can_this_form_get"),
        Pvm("ResetMyPasswordView", "can_this_form_post"),
        Pvm("UserDBModelView", "resetpasswords"),
        Pvm("UserDBModelView", "resetmypassword"),
    }


def test_sweeps_stale_perm_from_a_custom_role_not_just_builtins(
    session: Session,
) -> None:
    """The exact gap this migration closes: ``sync_role_definitions`` only
    ever re-derives the built-in Admin/Alpha/Gamma/sql_lab roles, so a custom
    (operator-defined) role that held ``resetmypassword`` before upgrading
    keeps it forever without this sweep. Seeds a custom role holding one
    legacy PVM plus one unrelated, valid permission, and asserts the legacy
    one is gone -- from every role, not just the synced built-ins -- while the
    unrelated permission survives untouched."""
    target = Pvm("UserDBModelView", "resetmypassword")
    assert target in PVM_LIST, "test assumes this PVM_LIST entry still exists"

    legacy_pvm = _make_pvm(session, target.view, target.permission)
    unrelated_pvm = _make_pvm(session, "UserDBModelView", "can_list")
    custom_role = Role(name="ReportViewer", permissions=[legacy_pvm, unrelated_pvm])
    session.add(custom_role)
    session.commit()

    migration.do_upgrade(session)
    session.commit()

    # the legacy PVM and its role association are gone
    assert (
        session.query(PermissionView)
        .join(Permission)
        .filter(Permission.name == "resetmypassword")
        .count()
        == 0
    )
    # its Permission is now orphaned (nothing else used "resetmypassword")
    assert session.query(Permission).filter_by(name="resetmypassword").count() == 0

    # the custom role keeps its other (untargeted) permission, unchanged
    custom_role = session.query(Role).filter_by(name="ReportViewer").one()
    assert len(custom_role.permissions) == 1
    assert custom_role.permissions[0].permission.name == "can_list"

    # the unrelated valid PVM, and the still-shared view menu, survive
    remaining_unrelated = session.get(PermissionView, unrelated_pvm.id)
    assert remaining_unrelated is not None
    assert remaining_unrelated.permission.name == "can_list"
    assert session.query(ViewMenu).filter_by(name="UserDBModelView").count() == 1


def test_sweeps_both_legacy_views_own_form_permissions(session: Session) -> None:
    """The two ``SimpleFormView``s' own permissions are removed too, including
    the now fully-orphaned ``ResetPasswordView``/``ResetMyPasswordView`` view
    menus once nothing else references them."""
    pvms = [
        _make_pvm(session, pvm.view, pvm.permission)
        for pvm in PVM_LIST
        if pvm.view in ("ResetPasswordView", "ResetMyPasswordView")
    ]
    role = Role(name="Admin", permissions=pvms)
    session.add(role)
    session.commit()

    migration.do_upgrade(session)
    session.commit()

    for view_name in ("ResetPasswordView", "ResetMyPasswordView"):
        assert session.query(ViewMenu).filter_by(name=view_name).count() == 0

    role = session.query(Role).filter_by(name="Admin").one()
    assert role.permissions == []


def test_is_idempotent(session: Session) -> None:
    """Running the migration twice must not raise or leave inconsistent
    state -- the second pass finds nothing left to resolve."""
    target = PVM_LIST[0]
    _make_pvm(session, target.view, target.permission)
    session.commit()

    migration.do_upgrade(session)
    session.commit()
    migration.do_upgrade(session)
    session.commit()

    assert (
        session.query(PermissionView)
        .join(Permission)
        .join(ViewMenu)
        .filter(
            Permission.name == target.permission,
            ViewMenu.name == target.view,
        )
        .count()
        == 0
    )


def test_downgrade_is_a_no_op(session: Session) -> None:
    """The dead permissions have no code path that can recreate or check
    them, so downgrade deliberately restores nothing."""
    migration.do_downgrade(session)
    session.commit()
    assert session.query(PermissionView).count() == 0
