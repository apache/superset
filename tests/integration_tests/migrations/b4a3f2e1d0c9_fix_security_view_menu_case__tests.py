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
from importlib import import_module

import pytest

from superset import db
from superset.migrations.shared.security_converge import (
    _add_permission,
    _add_permission_view,
    PermissionView,
    Role,
    ViewMenu,
)

migration_module = import_module(
    "superset.migrations.versions."
    "2026-05-29_00-00_b4a3f2e1d0c9_fix_security_view_menu_case"
)

do_upgrade = migration_module.do_upgrade


def _clear_security_view_menus() -> None:
    """
    Drop any pre-seeded ``security``/``Security`` view menus (and their PVMs) so
    each test can assert against a state it fully controls. The bootstrapped
    metadata DB ships with a ``Security`` menu (and, mirroring the MySQL bug,
    sometimes a lowercase ``security`` one too), which would otherwise collide
    with the unique constraint on ``ab_view_menu.name``.
    """
    vms = (
        db.session.query(ViewMenu)
        .filter(ViewMenu.name.in_(["security", "Security"]))
        .all()
    )
    for vm in vms:
        pvms = (
            db.session.query(PermissionView)
            .filter(PermissionView.view_menu_id == vm.id)
            .all()
        )
        for pvm in pvms:
            for role in list(pvm.role):
                role.permissions.remove(pvm)
            db.session.delete(pvm)
        db.session.flush()
        db.session.delete(vm)
    db.session.commit()


def _make_view_menu(name: str) -> ViewMenu:
    vm = ViewMenu(name=name)
    db.session.add(vm)
    db.session.flush()
    return vm


def _security_row_names() -> set[str]:
    """
    Exact-case names of any ``security``/``Security`` view-menu rows.

    Compares in Python because a SQL ``name`` filter is case-insensitive on
    MySQL's default collation (the very behaviour this migration works around),
    so ``filter_by(name="security")`` would also match ``"Security"``.
    """
    return {
        vm.name
        for vm in db.session.query(ViewMenu).all()
        if vm.name in ("security", "Security")
    }


def _skip_if_case_insensitive_unique_key() -> None:
    """
    Skip scenarios that require both ``security`` and ``Security`` rows.

    MySQL's default case-insensitive unique key on ``ab_view_menu.name`` cannot
    hold both spellings at once, so the duplicate-row state (a SQLite/PostgreSQL
    artifact, per the migration docstring) cannot be arranged there.
    """
    if db.session.get_bind().dialect.name == "mysql":
        pytest.skip(
            "MySQL's case-insensitive unique key cannot hold both "
            "'security' and 'Security' rows"
        )


_TEST_ROLE_NAMES = ("mysql_security_role", "dup_security_role")


def _clear_test_roles() -> None:
    for name in _TEST_ROLE_NAMES:
        role = db.session.query(Role).filter_by(name=name).one_or_none()
        if role is not None:
            db.session.delete(role)
    db.session.commit()


@pytest.fixture
def _clean_security():
    _clear_test_roles()
    _clear_security_view_menus()
    yield
    _clear_test_roles()
    _clear_security_view_menus()


@pytest.mark.usefixtures("app_context", "_clean_security")
def test_upgrade_renames_lonely_lowercase_row() -> None:
    # Arrange: only the incorrect lowercase "security" row exists.
    lower = _make_view_menu("security")
    permission = _add_permission(db.session, "menu_access")
    pvm = _add_permission_view(db.session, permission, lower)
    role = Role(name="mysql_security_role")
    role.permissions.append(pvm)
    db.session.add(role)
    db.session.commit()
    lower_id = lower.id
    pvm_id = pvm.id

    # Act
    do_upgrade(db.session)

    # Assert: the row was renamed in place, so its id and PVM/role are intact.
    renamed = db.session.query(ViewMenu).filter_by(id=lower_id).one()
    assert renamed.name == "Security"
    assert _security_row_names() == {"Security"}
    refreshed_role = db.session.query(Role).filter_by(name="mysql_security_role").one()
    assert pvm_id in {p.id for p in refreshed_role.permissions}

    # Cleanup role (view menu / pvm handled by the fixture teardown).
    db.session.delete(refreshed_role)
    db.session.commit()


@pytest.mark.usefixtures("app_context", "_clean_security")
def test_upgrade_merges_duplicate_rows_and_preserves_role_permissions() -> None:
    _skip_if_case_insensitive_unique_key()
    # Arrange: both "Security" and "security" exist. The lowercase row carries
    # one overlapping permission (also on the upper row) and one unique
    # permission, each bound to a role.
    upper = _make_view_menu("Security")
    lower = _make_view_menu("security")

    overlap_perm = _add_permission(db.session, "menu_access")
    unique_perm = _add_permission(db.session, "can_test_security_case_migration")

    upper_overlap_pvm = _add_permission_view(db.session, overlap_perm, upper)
    lower_overlap_pvm = _add_permission_view(db.session, overlap_perm, lower)
    lower_unique_pvm = _add_permission_view(db.session, unique_perm, lower)

    role = Role(name="dup_security_role")
    role.permissions.append(lower_overlap_pvm)
    role.permissions.append(lower_unique_pvm)
    db.session.add(role)
    db.session.commit()

    upper_id = upper.id
    upper_overlap_pvm_id = upper_overlap_pvm.id

    # Act
    do_upgrade(db.session)

    # Assert: the duplicate lowercase row is gone and only "Security" survives.
    assert _security_row_names() == {"Security"}

    refreshed_role = db.session.query(Role).filter_by(name="dup_security_role").one()
    role_pvm_ids = {pvm.id for pvm in refreshed_role.permissions}

    # The overlapping binding was migrated to the surviving upper PVM.
    assert upper_overlap_pvm_id in role_pvm_ids
    # The unique PVM was re-homed onto the surviving "Security" row, keeping it.
    surviving_unique = (
        db.session.query(PermissionView)
        .filter_by(permission_id=unique_perm.id, view_menu_id=upper_id)
        .one()
    )
    assert surviving_unique.id in role_pvm_ids
    # ...and no copy lingers on the deleted lowercase row's id.
    assert (
        db.session.query(PermissionView).filter_by(permission_id=unique_perm.id).count()
        == 1
    )

    # Cleanup role (view menu / pvm handled by the fixture teardown).
    db.session.delete(refreshed_role)
    db.session.commit()


@pytest.mark.usefixtures("app_context", "_clean_security")
def test_upgrade_is_noop_without_lowercase_row() -> None:
    # A clean install has only the correctly-cased "Security" row.
    _make_view_menu("Security")
    db.session.commit()

    do_upgrade(db.session)

    assert _security_row_names() == {"Security"}
