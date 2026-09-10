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

import pytest
from sqlalchemy.orm import Session

from superset.migrations.shared.security_converge import (
    add_pvms,
    Base,
    delete_pvms,
    migrate_roles,
    Permission,
    PermissionView,
    Pvm,
    Role,
    ViewMenu,
)


@pytest.fixture(autouse=True)
def setup_tables(session: Session) -> None:
    """
    ``security_converge`` freezes its own partial declarative ``Base`` (see the
    module docstring: "Partial freeze of the current metadata db schema"), so
    the shared in-memory SQLite ``session`` fixture needs its tables created
    explicitly -- they are not part of the main Superset ``Base``.
    """
    engine = session.get_bind()
    Base.metadata.create_all(engine)


def _make_pvm(session: Session, view_name: str, permission_name: str) -> PermissionView:
    view = ViewMenu(name=view_name)
    permission = Permission(name=permission_name)
    session.add_all([view, permission])
    session.flush()
    pvm = PermissionView(view_menu=view, permission=permission)
    session.add(pvm)
    session.flush()
    return pvm


def test_delete_pvms_removes_pvm_and_role_association(session: Session) -> None:
    """
    An old PVM attached to a role: after ``delete_pvms``, both the PVM and the
    role association are gone.
    """
    pvm = _make_pvm(session, "Superset", "can_old_thing")
    role = Role(name="Gamma", permissions=[pvm])
    session.add(role)
    session.commit()

    delete_pvms(session, [Pvm("Superset", "can_old_thing")])
    session.commit()

    assert session.query(PermissionView).count() == 0
    role = session.query(Role).filter_by(name="Gamma").one()
    assert role.permissions == []


def test_delete_pvms_deletes_orphaned_permission_and_view_menu(
    session: Session,
) -> None:
    """
    When the deleted PVM was the only one referencing its Permission/ViewMenu,
    both become orphans and are deleted too.
    """
    _make_pvm(session, "Superset", "can_old_thing")
    session.commit()

    delete_pvms(session, [Pvm("Superset", "can_old_thing")])
    session.commit()

    assert session.query(Permission).filter_by(name="can_old_thing").count() == 0
    assert session.query(ViewMenu).filter_by(name="Superset").count() == 0


def test_delete_pvms_preserves_shared_permission(session: Session) -> None:
    """
    If the underlying Permission is still referenced by another PVM (a
    different view menu reusing the same permission name), it must survive --
    only the specific targeted PVM (and its now-orphaned ViewMenu) is removed.
    """
    shared_permission = Permission(name="can_read")
    view_a = ViewMenu(name="Superset")
    view_b = ViewMenu(name="Chart")
    session.add_all([shared_permission, view_a, view_b])
    session.flush()
    pvm_a = PermissionView(view_menu=view_a, permission=shared_permission)
    pvm_b = PermissionView(view_menu=view_b, permission=shared_permission)
    session.add_all([pvm_a, pvm_b])
    session.commit()

    delete_pvms(session, [Pvm("Superset", "can_read")])
    session.commit()

    # only pvm_b (Chart/can_read) remains
    remaining = session.query(PermissionView).all()
    assert len(remaining) == 1
    assert remaining[0].view_menu.name == "Chart"
    assert remaining[0].permission.name == "can_read"
    # the shared permission survives because pvm_b still references it
    assert session.query(Permission).filter_by(name="can_read").count() == 1
    # the targeted view menu, no longer referenced by any PVM, is deleted
    assert session.query(ViewMenu).filter_by(name="Superset").count() == 0
    assert session.query(ViewMenu).filter_by(name="Chart").count() == 1


def test_delete_pvms_is_idempotent(session: Session) -> None:
    """
    Running ``delete_pvms`` twice with the same input: the second run is a
    silent no-op (the PVM no longer resolves), no exception, no inconsistent
    state.
    """
    pvm = _make_pvm(session, "Superset", "can_old_thing")
    role = Role(name="Gamma", permissions=[pvm])
    session.add(role)
    session.commit()

    delete_pvms(session, [Pvm("Superset", "can_old_thing")])
    session.commit()

    # second run against a DB that's already been cleaned -- must not raise
    delete_pvms(session, [Pvm("Superset", "can_old_thing")])
    session.commit()

    assert session.query(PermissionView).count() == 0
    assert session.query(Permission).count() == 0
    assert session.query(ViewMenu).count() == 0


def test_delete_pvms_does_not_touch_unrelated_object_spec_pvm(
    session: Session,
) -> None:
    """
    A dynamic/object-style permission (``database_access`` on a per-database
    view menu) sharing a permission NAME with something plausible, but on a
    view menu that is never in the deletion list, must be left untouched. This
    is what actually protects OBJECT_SPEC_PERMISSIONS: ``delete_pvms`` only
    ever operates on the explicit pairs it's given, never a name-based sweep,
    so unrelated ``database_access`` rows are simply never in the input.
    """
    _make_pvm(session, "[my_db].(id:1)", "database_access")
    session.commit()

    # None of these targets is the object-spec PVM created above.
    delete_pvms(session, [Pvm("Superset", "can_datasources")])
    session.commit()

    remaining = session.query(PermissionView).one()
    assert remaining.view_menu.name == "[my_db].(id:1)"
    assert remaining.permission.name == "database_access"


def test_delete_pvms_does_not_touch_pvms_outside_input(session: Session) -> None:
    """
    A permission not in the deletion (or rename) list at all, e.g.
    ``can_csv``, is untouched by ``delete_pvms``.
    """
    _make_pvm(session, "Superset", "can_csv")
    session.commit()

    delete_pvms(session, [Pvm("Superset", "can_available_domains")])
    session.commit()

    remaining = session.query(PermissionView).one()
    assert remaining.view_menu.name == "Superset"
    assert remaining.permission.name == "can_csv"


def test_migrate_roles_renames_permission_and_migrates_role(session: Session) -> None:
    """
    For the rename migration: exercises a representative subset of its
    ``PVM_MAP`` via the existing, unmodified ``migrate_roles``/``add_pvms``.
    A role holding an old PVM ends up holding the successor PVM instead, and
    the old PVM (and its now-orphaned Permission/ViewMenu) is gone.
    """
    old_pvm = _make_pvm(session, "Superset", "can_explore_json")
    role = Role(name="Gamma", permissions=[old_pvm])
    session.add(role)
    session.commit()

    pvm_map = {
        Pvm("Superset", "can_explore_json"): (Pvm("Chart", "can_read"),),
    }
    # Mirrors do_upgrade() in the rename migration: seed the successor first.
    add_pvms(session, {"Chart": ("can_read",)})
    migrate_roles(session, pvm_map)
    session.commit()

    role = session.query(Role).filter_by(name="Gamma").one()
    assert len(role.permissions) == 1
    assert role.permissions[0].view_menu.name == "Chart"
    assert role.permissions[0].permission.name == "can_read"

    assert (
        session.query(PermissionView)
        .join(Permission)
        .filter(Permission.name == "can_explore_json")
        .count()
        == 0
    )
    assert session.query(ViewMenu).filter_by(name="Superset").count() == 0
