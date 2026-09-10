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
"""Migration-level regression tests for apache/superset#33272.

``tests/unit_tests/migrations/shared/security_converge_test.py`` exercises
``delete_pvms``/``migrate_roles`` directly with small hand-rolled examples.
These tests instead import the two chained dated migrations themselves --
``2026-09-10_00-00_..._delete_deprecated_permissions_33272`` and
``2026-09-10_00-01_..._rename_deprecated_permissions_33272`` -- and run their
REAL ``PVM_LIST``/``PVM_MAP``/``NEW_PVMS``/``do_upgrade`` objects, rather than
a hand-copied subset. If either migration's list is ever edited, these tests
automatically exercise the updated list instead of silently testing stale
data.

Follows the existing convention (see e.g.
``tests/unit_tests/migrations/test_databend_secure_to_sslmode.py``) for
importing a dated migration module: date-prefixed filenames aren't valid
Python identifiers, so a plain ``import`` statement can't reference them --
``importlib.import_module`` with the dotted string path is used instead.
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

delete_migration = import_module(
    "superset.migrations.versions."
    "2026-09-10_00-00_1f5f4fb8bfc1_delete_deprecated_permissions_33272"
)
rename_migration = import_module(
    "superset.migrations.versions."
    "2026-09-10_00-01_3ce9a4572f8a_rename_deprecated_permissions_33272"
)

# The real migration constants -- never hand-copied.
PVM_LIST = delete_migration.PVM_LIST
PVM_MAP = rename_migration.PVM_MAP
NEW_PVMS = rename_migration.NEW_PVMS


@pytest.fixture(autouse=True)
def setup_tables(session: Session) -> None:
    """
    ``security_converge`` freezes its own partial declarative ``Base`` (see
    its module docstring), so the shared in-memory SQLite ``session`` fixture
    needs its tables created explicitly.
    """
    engine = session.get_bind()
    Base.metadata.create_all(engine)


def _make_pvm(session: Session, view_name: str, permission_name: str) -> PermissionView:
    """
    Like ``security_converge``'s own ``_add_view_menu``/``_add_permission``,
    this reuses an existing ``ViewMenu``/``Permission`` row with the same name
    rather than blindly inserting a duplicate -- both columns are unique, and
    some tests below deliberately create two PVMs sharing the same view menu
    (e.g. two ``"Superset"`` entries).
    """
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


def test_delete_migration_real_pvm_list_removes_deprecated_pvm_only(
    session: Session,
) -> None:
    """
    Run the actual deletion migration's ``do_upgrade`` (which calls
    ``delete_pvms(session, PVM_LIST)`` against the REAL 25-entry list) over a
    DB seeded with:
      - one representative real ``PVM_LIST`` entry, attached to a role
      - one valid/unrelated PVM (not in ``PVM_LIST``), which must survive
      - one dynamic/object-specific PVM (``database_access`` on a per-db view
        menu), which must survive because ``PVM_LIST`` never contains it
    """
    target = Pvm("Superset", "can_select_star")
    assert target in PVM_LIST, "test assumes this PVM_LIST entry still exists"

    deprecated_pvm = _make_pvm(session, target.view, target.permission)
    role = Role(name="Gamma", permissions=[deprecated_pvm])
    session.add(role)

    unrelated_pvm = _make_pvm(session, "Superset", "can_csv")
    dynamic_pvm = _make_pvm(session, "[my_db].(id:1)", "database_access")
    session.commit()

    delete_migration.do_upgrade(session)
    session.commit()

    # the deprecated PVM and its role association are gone
    assert (
        session.query(PermissionView)
        .join(Permission)
        .filter(Permission.name == "can_select_star")
        .count()
        == 0
    )
    role = session.query(Role).filter_by(name="Gamma").one()
    assert role.permissions == []
    # its Permission is now orphaned (no other PVM used "can_select_star")
    assert session.query(Permission).filter_by(name="can_select_star").count() == 0

    # the unrelated valid PVM survives untouched
    remaining_unrelated = session.get(PermissionView, unrelated_pvm.id)
    assert remaining_unrelated is not None
    assert remaining_unrelated.view_menu.name == "Superset"
    assert remaining_unrelated.permission.name == "can_csv"

    # the dynamic/object-specific PVM survives untouched
    remaining_dynamic = session.get(PermissionView, dynamic_pvm.id)
    assert remaining_dynamic is not None
    assert remaining_dynamic.view_menu.name == "[my_db].(id:1)"
    assert remaining_dynamic.permission.name == "database_access"

    # "Superset" view menu survives -- unrelated_pvm still references it
    assert session.query(ViewMenu).filter_by(name="Superset").count() == 1


def test_delete_migration_is_idempotent_with_real_pvm_list(session: Session) -> None:
    """
    Running the real deletion migration twice must not raise or leave
    inconsistent state -- the second pass finds nothing left to resolve.
    """
    target = PVM_LIST[0]
    _make_pvm(session, target.view, target.permission)
    session.commit()

    delete_migration.do_upgrade(session)
    session.commit()
    delete_migration.do_upgrade(session)
    session.commit()

    assert (
        session.query(PermissionView)
        .join(Permission)
        .filter(Permission.name == target.permission)
        .count()
        == 0
    )


def test_rename_migration_real_pvm_map_migrates_role_to_verified_successor(
    session: Session,
) -> None:
    """
    Run the actual rename migration's ``do_upgrade`` (``add_pvms(NEW_PVMS)``
    then ``migrate_roles(PVM_MAP)`` with the REAL 12-entry map) over a DB
    seeded with one representative real old PVM from ``PVM_MAP``, attached to
    a role.

    Asserts: the role ends up holding the actual verified successor
    (``can_execute_sql_query`` on ``SQLLab``); the old PVM (and its
    now-orphaned Permission/ViewMenu) is gone; the successor PVM itself
    survives (it's a shared, actively-used permission).
    """
    old_key = Pvm("Superset", "can_sql_json")
    assert old_key in PVM_MAP, "test assumes this PVM_MAP entry still exists"
    successors = PVM_MAP[old_key]
    assert successors == (Pvm("SQLLab", "can_execute_sql_query"),), (
        "test assumes this is still the verified successor mapping"
    )

    old_pvm = _make_pvm(session, old_key.view, old_key.permission)
    role = Role(name="Gamma", permissions=[old_pvm])
    session.add(role)
    session.commit()

    rename_migration.do_upgrade(session)
    session.commit()

    # role now holds the verified successor instead of the old PVM
    role = session.query(Role).filter_by(name="Gamma").one()
    assert len(role.permissions) == 1
    assert role.permissions[0].view_menu.name == "SQLLab"
    assert role.permissions[0].permission.name == "can_execute_sql_query"

    # the old PVM is gone
    assert (
        session.query(PermissionView)
        .join(Permission)
        .filter(Permission.name == "can_sql_json")
        .count()
        == 0
    )
    # its Permission was orphaned (nothing else referenced "can_sql_json")
    assert session.query(Permission).filter_by(name="can_sql_json").count() == 0
    # its ViewMenu ("Superset") was orphaned too -- only this test's old_pvm
    # referenced it, and add_pvms(NEW_PVMS) never creates a "Superset" entry
    assert session.query(ViewMenu).filter_by(name="Superset").count() == 0

    # the successor PVM itself is a live, shared permission and must survive
    assert (
        session.query(PermissionView)
        .join(Permission)
        .join(ViewMenu)
        .filter(
            Permission.name == "can_execute_sql_query",
            ViewMenu.name == "SQLLab",
        )
        .count()
        == 1
    )


def test_rename_migration_new_pvms_all_creatable(session: Session) -> None:
    """
    Sanity check on the real ``NEW_PVMS`` used to pre-seed successors: every
    (view, permission) pair it declares must actually be creatable/resolvable
    via ``add_pvms``, and every successor referenced anywhere in ``PVM_MAP``'s
    values must appear somewhere in ``NEW_PVMS`` (so ``migrate_roles`` can
    never resolve a target to ``None`` for lack of the successor existing).
    """
    from superset.migrations.shared.security_converge import add_pvms

    add_pvms(session, NEW_PVMS)
    session.commit()

    for view_name, permissions in NEW_PVMS.items():
        for permission_name in permissions:
            assert (
                session.query(PermissionView)
                .join(Permission)
                .join(ViewMenu)
                .filter(
                    Permission.name == permission_name,
                    ViewMenu.name == view_name,
                )
                .count()
                == 1
            )

    for successors in PVM_MAP.values():
        for successor in successors:
            assert successor.permission in NEW_PVMS.get(successor.view, ()), (
                f"{successor} is a PVM_MAP successor but missing from NEW_PVMS"
            )
