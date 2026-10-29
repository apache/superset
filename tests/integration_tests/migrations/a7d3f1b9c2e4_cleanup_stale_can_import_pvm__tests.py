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
    _add_view_menu,
    _find_pvm,
    Role,
)

migration_module = import_module(
    "superset.migrations.versions."
    "2026-06-23_03-23_a7d3f1b9c2e4_cleanup_stale_can_import_pvm"
)

upgrade = migration_module.do_upgrade

VIEW = "ImportExportRestApi"
STALE_PERM = "can_import"  # no trailing underscore
LIVE_PERM = "can_import_"  # trailing underscore (the real permission)


@pytest.mark.usefixtures("app_context")
def test_migration_reassigns_roles_and_removes_stale_pvm() -> None:
    # Arrange: simulate a metadata DB upgraded from an older era that still has
    # the stale ``can_import`` PVM on the ImportExportRestApi view menu, held by
    # a role.
    view_menu = _add_view_menu(db.session, VIEW)
    stale_permission = _add_permission(db.session, STALE_PERM)
    stale_pvm = _add_permission_view(db.session, stale_permission, view_menu)

    role = Role(name="stale_import_role")
    role.permissions.append(stale_pvm)
    db.session.add(role)
    db.session.commit()

    assert _find_pvm(db.session, VIEW, STALE_PERM) is not None

    # Act
    upgrade(db.session)

    # Assert: the live PVM exists, the stale one is gone, and the role kept
    # import access by being moved onto the live PVM.
    live_pvm = _find_pvm(db.session, VIEW, LIVE_PERM)
    assert live_pvm is not None
    assert _find_pvm(db.session, VIEW, STALE_PERM) is None

    refreshed_role = db.session.query(Role).filter_by(name="stale_import_role").one()
    assert live_pvm in refreshed_role.permissions

    # Cleanup
    db.session.delete(refreshed_role)
    db.session.commit()


@pytest.mark.usefixtures("app_context")
def test_migration_is_noop_on_clean_install() -> None:
    # No stale PVM present (clean install). The migration must not error and must
    # leave the live permission intact.
    assert _find_pvm(db.session, VIEW, STALE_PERM) is None

    upgrade(db.session)

    assert _find_pvm(db.session, VIEW, STALE_PERM) is None
    assert _find_pvm(db.session, VIEW, LIVE_PERM) is not None
