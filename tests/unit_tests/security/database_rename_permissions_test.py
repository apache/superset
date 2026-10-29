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
from sqlalchemy.orm.session import Session

from superset import db, security_manager

if TYPE_CHECKING:
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

    database, dataset = _create_database_with_dataset()
    dataset_id = dataset.id
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
