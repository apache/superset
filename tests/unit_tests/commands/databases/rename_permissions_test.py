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
# pylint: disable=import-outside-toplevel
"""Regression coverage for ambiguous and case-insensitive permission renames."""

import copy
from collections.abc import Iterator

import pytest
from flask_appbuilder.security.sqla.models import PermissionView
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session

from tests.unit_tests.fixtures.assets_configs import databases_config


@pytest.fixture
def session_engine(mocker: MockerFixture) -> Iterator[Engine]:
    """Use a case-insensitive view-menu column, like MySQL's default collation."""
    from flask_appbuilder.security.sqla.models import ViewMenu

    mocker.patch.object(ViewMenu.__table__.c.name.type, "collation", "NOCASE")
    engine = create_engine("sqlite://")
    yield engine
    engine.dispose()


@pytest.mark.parametrize("entry_point", ["import", "sync"])
def test_case_only_database_rename_preserves_grants(
    mocker: MockerFixture, session: Session, entry_point: str
) -> None:
    """A collation-equivalent destination must not be merged into itself."""
    from superset import db, security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.commands.database.sync_permissions import SyncPermissionsCommand
    from superset.commands.database.utils import add_pvm
    from superset.models.slice import Slice

    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    mocker.patch.object(security_manager, "can_access", return_value=True)
    Slice.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    config = copy.deepcopy(databases_config["databases/examples.yaml"])
    database = import_database(copy.deepcopy(config))
    database_perm = security_manager.get_database_perm(database.id, "examples")
    assert database_perm is not None
    names = {
        "database_access": database_perm,
        "schema_access": "[examples].[cat].[main]",
        "catalog_access": "[examples].[cat]",
    }
    permissions: list[PermissionView] = []
    for permission, name in names.items():
        pvm = add_pvm(session, security_manager, permission, name)
        assert pvm is not None
        permissions.append(pvm)
    role = security_manager.role_model(name="case_viewer", permissions=permissions)
    session.add(role)
    session.commit()
    ids = {p.permission.name: p.id for p in permissions}
    # Prove the database collation resolves the destination to the source row.
    for permission, name in names.items():
        assert (
            security_manager.find_permission_view_menu(
                permission, name.replace("examples", "EXAMPLES")
            ).id
            == ids[permission]
        )

    if entry_point == "import":
        config["database_name"] = "EXAMPLES"
        import_database(config, overwrite=True)
    else:
        assert database.database_name == "examples"
        database.database_name = "EXAMPLES"
        db.session.flush()
        command = SyncPermissionsCommand(
            database.id, None, old_db_connection_name="examples", db_connection=database
        )
        command._rename_database_in_permissions("cat", ["main"])
    session.commit()
    session.expire_all()

    assert {p.id for p in role.permissions} == set(ids.values())
    for permission, name in names.items():
        renamed = security_manager.find_permission_view_menu(
            permission, name.replace("examples", "EXAMPLES")
        )
        assert renamed is not None
        assert renamed.id == ids[permission]
        assert renamed.view_menu.name == name.replace("examples", "EXAMPLES")


@pytest.mark.parametrize("old_name", ["old", "old_%"])
def test_import_rename_leaves_extended_database_prefix_grants(
    mocker: MockerFixture, session: Session, old_name: str
) -> None:
    """A database name extending the source prefix owns its own permissions."""
    from superset import security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.commands.database.utils import add_pvm
    from superset.models.core import Database
    from superset.models.slice import Slice

    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    mocker.patch.object(security_manager, "can_access", return_value=True)
    Slice.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    config = copy.deepcopy(databases_config["databases/examples.yaml"])
    config["database_name"] = old_name
    import_database(copy.deepcopy(config))
    foreign_name = f"{old_name}].[x"
    session.add(Database(database_name=foreign_name, sqlalchemy_uri="sqlite://"))
    session.flush()
    permissions: list[PermissionView] = []
    for name in (old_name, foreign_name):
        for permission, suffix in (
            ("catalog_access", "[cat]"),
            ("schema_access", "[cat].[main]"),
            ("schema_access", "[main]"),
        ):
            pvm = add_pvm(session, security_manager, permission, f"[{name}].{suffix}")
            assert pvm is not None
            permissions.append(pvm)
    role = security_manager.role_model(name="prefix_viewer", permissions=permissions)
    session.add(role)
    session.commit()
    expected = {
        p.id: p.view_menu.name.replace(f"[{old_name}].", "[new].", 1)
        if i < 3
        else p.view_menu.name
        for i, p in enumerate(permissions)
    }

    config["database_name"] = "new"
    import_database(config, overwrite=True)
    session.commit()
    session.expire_all()

    assert {p.id: p.view_menu.name for p in role.permissions} == expected
