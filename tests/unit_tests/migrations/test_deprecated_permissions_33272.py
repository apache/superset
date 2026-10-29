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


def test_pvm_list_and_pvm_map_are_disjoint() -> None:
    """
    ``PVM_LIST`` (pure deletions) and ``PVM_MAP`` (renames) must never share
    an entry -- and, more strongly, no ``PVM_LIST`` entry's permission name
    should even collide with any ``NEW_PVMS`` successor permission name,
    regardless of which view menu that successor lives on (every ``PVM_LIST``
    entry's own view is "Superset", which never appears as a ``NEW_PVMS`` key,
    so a same-view lookup would never catch anything -- the check must be
    against the full, flattened set of successor permission names). Either
    violation would indicate a permission miscategorized as a pure deletion
    when it actually has a live successor -- the exact bug class this whole
    rework exists to fix.
    """
    assert set(PVM_LIST).isdisjoint(PVM_MAP.keys())
    all_new_pvms_permissions = {
        permission for permissions in NEW_PVMS.values() for permission in permissions
    }
    assert not any(pvm.permission in all_new_pvms_permissions for pvm in PVM_LIST)


def test_can_copy_dash_is_the_only_write_level_rename() -> None:
    """
    ``can_copy_dash`` is the one deliberate exception to "no rename resurrects
    a dead permission as a broader can_write grant" (see the file docstring
    and the inline comment on its ``PVM_MAP`` entry): its live successor,
    Dashboard.can_write, is a genuine 1:1 match for the still-live
    ``copy_dash`` REST route, not accidental broadening. Every other
    can_write-level rename previously found this way (can_testconn,
    can_sqllab_viz, can_import_dashboards, can_add_slices) was moved to the
    delete migration instead. This pins that policy: it fails if a future
    edit reintroduces one of those, or adds a new one, without an equally
    deliberate exception.
    """
    write_renames = {
        old_pvm
        for old_pvm, successors in PVM_MAP.items()
        if any(successor.permission == "can_write" for successor in successors)
    }
    assert write_renames == {Pvm("Superset", "can_copy_dash")}


def test_delete_migration_real_pvm_list_removes_deprecated_pvm_only(
    session: Session,
) -> None:
    """
    Run the actual deletion migration's ``do_upgrade`` (which calls
    ``delete_pvms(session, PVM_LIST)`` against the REAL, verified 6-entry
    list) over a DB seeded with a role holding both:
      - one representative real ``PVM_LIST`` entry
      - one valid/unrelated PVM (not in ``PVM_LIST``)
    plus a dynamic/object-specific PVM (``database_access`` on a per-db view
    menu), unattached to any role.

    Asserts the targeted PVM and its role association are gone, while the
    role's other (untargeted) permission, the unrelated PVM, and the dynamic
    PVM all survive completely unchanged.
    """
    target = Pvm("Superset", "can_profile")
    assert target in PVM_LIST, "test assumes this PVM_LIST entry still exists"

    deprecated_pvm = _make_pvm(session, target.view, target.permission)
    unrelated_pvm = _make_pvm(session, "Superset", "can_csv")
    role = Role(name="Gamma", permissions=[deprecated_pvm, unrelated_pvm])
    session.add(role)

    dynamic_pvm = _make_pvm(session, "[my_db].(id:1)", "database_access")
    session.commit()

    delete_migration.do_upgrade(session)
    session.commit()

    # the deprecated PVM and its role association are gone
    assert (
        session.query(PermissionView)
        .join(Permission)
        .filter(Permission.name == "can_profile")
        .count()
        == 0
    )
    # its Permission is now orphaned (no other PVM used "can_profile")
    assert session.query(Permission).filter_by(name="can_profile").count() == 0

    # the role keeps its other (untargeted) permission, unchanged
    role = session.query(Role).filter_by(name="Gamma").one()
    assert len(role.permissions) == 1
    assert role.permissions[0].view_menu.name == "Superset"
    assert role.permissions[0].permission.name == "can_csv"

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
    then ``migrate_roles(PVM_MAP)`` with the REAL, now 33-entry map) over a DB
    seeded with a role holding both:
      - one representative real old PVM from ``PVM_MAP``
      - one valid/unrelated PVM (not in ``PVM_MAP``)

    Asserts: the role ends up holding the actual verified successor
    (``can_execute_sql_query`` on ``SQLLab``) ADDED alongside the untargeted
    permission, not replacing it; the old PVM (and its now-orphaned
    Permission/ViewMenu) is gone; the successor PVM itself survives (it's a
    shared, actively-used permission).
    """
    old_key = Pvm("Superset", "can_sql_json")
    assert old_key in PVM_MAP, "test assumes this PVM_MAP entry still exists"
    successors = PVM_MAP[old_key]
    assert successors == (Pvm("SQLLab", "can_execute_sql_query"),), (
        "test assumes this is still the verified successor mapping"
    )

    old_pvm = _make_pvm(session, old_key.view, old_key.permission)
    unrelated_pvm = _make_pvm(session, "Superset", "can_csv")
    role = Role(name="Gamma", permissions=[old_pvm, unrelated_pvm])
    session.add(role)
    session.commit()

    rename_migration.do_upgrade(session)
    session.commit()

    # role now holds the verified successor ADDED alongside the untargeted
    # permission, rather than replacing it
    role = session.query(Role).filter_by(name="Gamma").one()
    held = {(p.view_menu.name, p.permission.name) for p in role.permissions}
    assert held == {("SQLLab", "can_execute_sql_query"), ("Superset", "can_csv")}

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

    # the unrelated PVM (and the now-shared "Superset" view menu it still
    # references) survives untouched
    remaining_unrelated = session.get(PermissionView, unrelated_pvm.id)
    assert remaining_unrelated is not None
    assert remaining_unrelated.view_menu.name == "Superset"
    assert remaining_unrelated.permission.name == "can_csv"


def test_rename_migration_is_idempotent_with_real_pvm_map(session: Session) -> None:
    """
    Running the real rename migration's ``do_upgrade`` twice must not raise
    or leave inconsistent state. ``migrate_roles``'s existing
    ``_find_pvm().one_or_none()`` + ``if old_pvm:`` guard already makes the
    second pass a safe no-op -- this is a regression test for that existing
    behavior against the much larger, now-33-entry ``PVM_MAP``, not a fix for
    new behavior.
    """
    old_key = next(iter(PVM_MAP))
    successors = PVM_MAP[old_key]

    old_pvm = _make_pvm(session, old_key.view, old_key.permission)
    role = Role(name="Gamma", permissions=[old_pvm])
    session.add(role)
    session.commit()

    rename_migration.do_upgrade(session)
    session.commit()
    rename_migration.do_upgrade(session)
    session.commit()

    role = session.query(Role).filter_by(name="Gamma").one()
    held = {(p.view_menu.name, p.permission.name) for p in role.permissions}
    assert held == {(s.view, s.permission) for s in successors}

    # Filter on both view and permission: PVM_MAP contains same-name,
    # different-view pairs (e.g. can_recent_activity -> Log/can_recent_activity),
    # so filtering on permission name alone could match the new successor row
    # and mask a real problem, or spuriously fail depending on which PVM_MAP
    # entry happens to be first -- pinning down both fields makes this
    # order-independent.
    assert (
        session.query(PermissionView)
        .join(Permission)
        .join(ViewMenu)
        .filter(
            Permission.name == old_key.permission,
            ViewMenu.name == old_key.view,
        )
        .count()
        == 0
    )


def test_delete_and_rename_migrations_chained_do_not_interfere(
    session: Session,
) -> None:
    """
    Runs the delete migration's ``do_upgrade`` immediately followed by the
    rename migration's ``do_upgrade`` against ONE shared session, mirroring
    how ``alembic upgrade`` actually chains them back-to-back. Seeds a role
    with one PVM from each migration's list and confirms both migrations'
    effects land correctly together. ``PVM_LIST`` and ``PVM_MAP`` are disjoint
    (see ``test_pvm_list_and_pvm_map_are_disjoint``), so this is mostly a
    structural confirmation that holds -- more valuable to pin down now given
    the much larger ``PVM_MAP``.
    """
    delete_target = PVM_LIST[0]
    rename_key = next(iter(PVM_MAP))
    rename_successors = PVM_MAP[rename_key]

    delete_pvm = _make_pvm(session, delete_target.view, delete_target.permission)
    rename_pvm = _make_pvm(session, rename_key.view, rename_key.permission)
    role = Role(name="Gamma", permissions=[delete_pvm, rename_pvm])
    session.add(role)
    session.commit()

    delete_migration.do_upgrade(session)
    rename_migration.do_upgrade(session)
    session.commit()

    # the delete target is gone entirely, with no successor created for it
    assert (
        session.query(PermissionView)
        .join(Permission)
        .filter(Permission.name == delete_target.permission)
        .count()
        == 0
    )

    # the role holds exactly the rename key's successors -- neither the
    # delete target nor the old rename key remain
    role = session.query(Role).filter_by(name="Gamma").one()
    held = {(p.view_menu.name, p.permission.name) for p in role.permissions}
    assert (delete_target.view, delete_target.permission) not in held
    assert (rename_key.view, rename_key.permission) not in held
    assert held == {(s.view, s.permission) for s in rename_successors}


def test_rename_migration_new_pvms_all_creatable(session: Session) -> None:
    """
    Sanity check on the real ``NEW_PVMS`` used to pre-seed successors: every
    (view, permission) pair it declares must actually be creatable/resolvable
    via ``add_pvms``, and every successor referenced anywhere in ``PVM_MAP``'s
    values must appear somewhere in ``NEW_PVMS`` (so ``migrate_roles`` can
    never resolve a target to ``None`` for lack of the successor existing).
    This now exercises the much larger, expanded ``NEW_PVMS``/``PVM_MAP``.
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
