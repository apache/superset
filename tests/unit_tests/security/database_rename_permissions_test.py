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
"""Database rename when the old database or dataset permission is missing."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from flask_appbuilder.security.sqla.models import PermissionView
from sqlalchemy import inspect
from sqlalchemy.orm.session import Session

from superset import db, security_manager

if TYPE_CHECKING:
    from pytest_mock import MockerFixture

    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database


def _create_database_with_dataset() -> tuple[Database, SqlaTable]:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member

    database = Database(database_name="examples", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()
    dataset = SqlaTable(table_name="my_table", database=database)
    db.session.add(dataset)
    db.session.flush()
    return database, dataset


def _delete_view_menu(name: str) -> None:
    """Delete a view menu and its permission views without touching the ORM."""
    view_menu = security_manager.find_view_menu(name)
    assert view_menu is not None
    view_menu_table = security_manager.viewmenu_model.__table__
    permission_view_table = security_manager.permissionview_model.__table__
    db.session.execute(
        permission_view_table.delete().where(
            permission_view_table.c.view_menu_id == view_menu.id
        )
    )
    db.session.execute(
        view_menu_table.delete().where(view_menu_table.c.id == view_menu.id)
    )


@pytest.mark.parametrize(
    "missing",
    [
        pytest.param({"database"}, id="database"),
        pytest.param({"dataset"}, id="dataset"),
        pytest.param({"database", "dataset"}, id="database-and-dataset"),
    ],
)
def test_rename_database_with_missing_permission(
    session: Session, missing: set[str]
) -> None:
    """
    Renaming a database whose old database or dataset permission is missing
    recreates the permission under the new name instead of failing with
    ``'NoneType' object has no attribute 'id'``.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    database, dataset = _create_database_with_dataset()
    dataset_id = dataset.id
    assert dataset.schema is None
    chart = Slice(
        slice_name="rename_chart",
        datasource_id=dataset_id,
        datasource_type="table",
        viz_type="table",
    )
    db.session.add(chart)
    db.session.flush()
    chart_id = chart.id
    assert chart.perm == f"[examples].[my_table](id:{dataset_id})"
    if "database" in missing:
        _delete_view_menu(f"[examples].(id:{database.id})")
    if "dataset" in missing:
        _delete_view_menu(f"[examples].[my_table](id:{dataset_id})")

    database.database_name = "examples_renamed"
    db.session.flush()

    assert security_manager.find_permission_view_menu(
        "database_access",
        f"[examples_renamed].(id:{database.id})",
    )
    new_dataset_perm = f"[examples_renamed].[my_table](id:{dataset_id})"
    assert security_manager.find_permission_view_menu(
        "datasource_access", new_dataset_perm
    )
    assert (
        security_manager.find_view_menu(f"[examples].[my_table](id:{dataset_id})")
        is None
    )
    db.session.expire_all()
    assert db.session.get(SqlaTable, dataset_id).perm == new_dataset_perm
    assert db.session.get(Slice, chart_id).perm == new_dataset_perm


def test_database_permission_update_skips_hook_when_view_menu_missing(
    session: Session, mocker: MockerFixture
) -> None:
    """Do not invoke the update hook with a missing database view-menu readback."""
    from superset.models.core import Database

    database, _ = _create_database_with_dataset()
    target = Database(id=database.id, database_name="examples_renamed")
    connection = session.connection()
    # A successful UPDATE is visible on the same connection; inject a missing
    # readback to exercise the defensive guard independently of database behavior.
    find_view_menu = mocker.patch.object(
        security_manager, "_find_view_menu_on_sqla_event", return_value=None
    )
    update_hook = mocker.patch.object(security_manager, "on_view_menu_after_update")

    result = security_manager._update_vm_database_access(
        inspect(Database), connection, "examples", target
    )

    assert result is None
    find_view_menu.assert_called_once_with(
        connection, f"[examples_renamed].(id:{database.id})"
    )
    update_hook.assert_not_called()


def test_database_rename_merges_existing_destination_grants(session: Session) -> None:
    """A pre-existing destination must retain both old and new role grants."""
    from superset.commands.database.utils import add_pvm

    database, _ = _create_database_with_dataset()
    old_permission = security_manager.find_permission_view_menu(
        "database_access", database.get_perm()
    )
    new_permission = add_pvm(
        session, security_manager, "database_access", f"[renamed].(id:{database.id})"
    )
    assert old_permission is not None
    assert new_permission is not None
    roles = [
        security_manager.role_model(name="source_only", permissions=[old_permission]),
        security_manager.role_model(
            name="destination_only", permissions=[new_permission]
        ),
        security_manager.role_model(
            name="both_permissions", permissions=[old_permission, new_permission]
        ),
    ]
    session.add_all(roles)
    session.commit()
    destination_id = new_permission.id

    assert database.database_name == "examples"
    database.database_name = "renamed"
    session.commit()
    session.expire_all()

    for role in roles:
        assert [permission.id for permission in role.permissions] == [destination_id]
    assert (
        security_manager.find_permission_view_menu(
            "database_access", f"[examples].(id:{database.id})"
        )
        is None
    )


@pytest.mark.parametrize("old_name", ["old", "old_%"])
def test_database_delete_preserves_extended_prefix_grants(
    session: Session, old_name: str
) -> None:
    """Deleting a database must not delete another database's prefixed grants."""
    from superset.commands.database.utils import add_pvm
    from superset.models.core import Database

    Database.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    database = Database(database_name=old_name, sqlalchemy_uri="sqlite://")
    foreign = Database(database_name=f"{old_name}].[x", sqlalchemy_uri="sqlite://")
    wildcard_neighbor = Database(database_name="old_other", sqlalchemy_uri="sqlite://")
    session.add_all([database, foreign, wildcard_neighbor])
    session.flush()
    own_permissions: list[PermissionView] = []
    foreign_permissions: list[PermissionView] = []
    for owner, permissions in (
        (database, own_permissions),
        (foreign, foreign_permissions),
        (wildcard_neighbor, foreign_permissions),
    ):
        for permission, suffix in (
            ("schema_access", "[main]"),
            ("schema_access", "[cat].[main]"),
            ("catalog_access", "[cat]"),
        ):
            pvm = add_pvm(
                session,
                security_manager,
                permission,
                f"[{owner.database_name}].{suffix}",
            )
            assert pvm is not None
            permissions.append(pvm)
    role = security_manager.role_model(
        name="prefix_viewer", permissions=own_permissions + foreign_permissions
    )
    session.add(role)
    session.commit()
    expected = {permission.id for permission in foreign_permissions}

    session.delete(database)
    session.commit()
    session.expire_all()

    assert {permission.id for permission in role.permissions} == expected
