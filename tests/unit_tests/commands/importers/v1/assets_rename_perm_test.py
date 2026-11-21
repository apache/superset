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
"""Permission strings of datasets and charts after an import renames a database."""

import copy
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from tests.unit_tests.fixtures.assets_configs import (
    charts_config_1,
    databases_config,
    datasets_config,
)

DATABASE_FILE = "databases/examples.yaml"
RENAMED_DATABASE_NAME = "examples_renamed"


def _renamed(configs: dict[str, Any]) -> dict[str, Any]:
    configs = copy.deepcopy(configs)
    configs[DATABASE_FILE]["database_name"] = RENAMED_DATABASE_NAME
    return configs


@pytest.mark.parametrize("bundle_has_assets", [True, False])
@pytest.mark.parametrize("assets_loaded", [True, False])
def test_import_renamed_database_resyncs_schema_perms(
    mocker: MockerFixture,
    session: Session,
    bundle_has_assets: bool,
    assets_loaded: bool,
) -> None:
    """
    An import that renames an existing database leaves no dataset or chart with
    the previous database name in its permission strings, whether the bundle
    carries the datasets and charts or only the database, and whether they are
    already loaded in the session. A grant on the schema moves to the new name.
    """
    from superset import db, security_manager
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    Slice.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member

    initial = {
        **copy.deepcopy(databases_config),
        **copy.deepcopy(datasets_config),
        **copy.deepcopy(charts_config_1),
    }
    ImportAssetsCommand._import(initial)
    db.session.commit()

    datasets = db.session.query(SqlaTable).all()
    charts = db.session.query(Slice).all()
    assert datasets
    assert charts
    assert all(d.schema_perm == "[examples].[main]" for d in datasets)
    assert all(c.schema_perm == "[examples].[main]" for c in charts)
    schema_pvm = security_manager.find_permission_view_menu(
        "schema_access", "[examples].[main]"
    )
    assert schema_pvm
    pvm_id = schema_pvm.id
    if not assets_loaded:
        db.session.expire_all()

    if bundle_has_assets:
        renamed = {
            **_renamed(databases_config),
            **copy.deepcopy(datasets_config),
            **copy.deepcopy(charts_config_1),
        }
    else:
        renamed = _renamed(databases_config)
    ImportAssetsCommand._import(renamed)
    db.session.commit()
    db.session.expire_all()

    renamed_pvm = security_manager.find_permission_view_menu(
        "schema_access", f"[{RENAMED_DATABASE_NAME}].[main]"
    )
    assert renamed_pvm
    assert renamed_pvm.id == pvm_id
    assert not security_manager.find_permission_view_menu(
        "schema_access", "[examples].[main]"
    )

    database = db.session.query(Database).one()
    assert database.database_name == RENAMED_DATABASE_NAME
    for dataset in db.session.query(SqlaTable).all():
        assert dataset.perm.startswith(f"[{RENAMED_DATABASE_NAME}]."), dataset.perm
        assert dataset.schema_perm == f"[{RENAMED_DATABASE_NAME}].[main]"
    for chart in db.session.query(Slice).all():
        assert chart.perm.startswith(f"[{RENAMED_DATABASE_NAME}]."), chart.perm
        assert chart.schema_perm == f"[{RENAMED_DATABASE_NAME}].[main]"


def test_import_renamed_database_resyncs_catalog_perms(
    mocker: MockerFixture, session: Session
) -> None:
    """
    The catalog permission follows the rename too, for datasets and charts under a
    catalog, including a soft-deleted dataset that may be restored later.
    """
    from superset import db, security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.helpers import skip_visibility_filter
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    Slice.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member

    config = copy.deepcopy(databases_config[DATABASE_FILE])
    database = import_database(config)
    dataset = SqlaTable(
        table_name="t1", catalog="cat", schema="main", database=database
    )
    db.session.add(dataset)
    db.session.flush()
    chart = Slice(
        slice_name="c1",
        datasource_id=dataset.id,
        datasource_type="table",
        viz_type="table",
    )
    db.session.add(chart)
    db.session.commit()
    assert dataset.catalog_perm == "[examples].[cat]"
    assert chart.schema_perm == "[examples].[cat].[main]"
    dataset.soft_delete()
    db.session.commit()

    renamed = copy.deepcopy(databases_config[DATABASE_FILE])
    renamed["database_name"] = RENAMED_DATABASE_NAME
    import_database(renamed, overwrite=True)
    db.session.commit()
    db.session.expire_all()

    assert db.session.query(Database).one().database_name == RENAMED_DATABASE_NAME
    with skip_visibility_filter(db.session, SqlaTable):
        dataset = db.session.query(SqlaTable).one()
    chart = db.session.query(Slice).one()
    for target in (dataset, chart):
        assert target.catalog_perm == f"[{RENAMED_DATABASE_NAME}].[cat]"
        assert target.schema_perm == f"[{RENAMED_DATABASE_NAME}].[cat].[main]"
    assert security_manager.find_permission_view_menu(
        "catalog_access", f"[{RENAMED_DATABASE_NAME}].[cat]"
    )
    assert not security_manager.find_permission_view_menu(
        "catalog_access", "[examples].[cat]"
    )


@pytest.mark.parametrize("entry_point", ["import", "sync"])
@pytest.mark.parametrize("soft_deleted", [False, True])
def test_database_rename_updates_untouched_chart_permissions(
    mocker: MockerFixture,
    session: Session,
    entry_point: str,
    soft_deleted: bool,
) -> None:
    """Persist chart permissions even when no chart save invokes its model hook."""
    from sqlalchemy import select

    from superset import db, security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.commands.database.sync_permissions import SyncPermissionsCommand
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    Slice.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member
    database = import_database(copy.deepcopy(databases_config[DATABASE_FILE]))
    dataset = SqlaTable(
        table_name="untouched", catalog="cat", schema="main", database=database
    )
    db.session.add(dataset)
    db.session.flush()
    chart = Slice(
        slice_name="untouched",
        datasource_id=dataset.id,
        datasource_type="table",
        viz_type="table",
    )
    db.session.add(chart)
    db.session.commit()
    database_id, chart_id = database.id, chart.id
    if soft_deleted:
        dataset.soft_delete()
        db.session.commit()
    db.session.expunge_all()

    if entry_point == "import":
        # The bundle contains no datasets or charts to trigger their save hooks.
        config = copy.deepcopy(databases_config[DATABASE_FILE])
        config["database_name"] = RENAMED_DATABASE_NAME
        import_database(config, overwrite=True)
    else:
        database = db.session.query(Database).filter_by(id=database_id).one()
        database.database_name = RENAMED_DATABASE_NAME
        db.session.flush()
        command = SyncPermissionsCommand(
            database.id, None, old_db_connection_name="examples", db_connection=database
        )
        command._rename_database_in_permissions("cat", ["main"])
    db.session.commit()

    # Read stored columns directly: loading/saving a chart must not repair them.
    stored = db.session.execute(
        select(Slice.schema_perm, Slice.catalog_perm).where(Slice.id == chart_id)
    ).one()
    assert tuple(stored) == (
        f"[{RENAMED_DATABASE_NAME}].[cat].[main]",
        f"[{RENAMED_DATABASE_NAME}].[cat]",
    )


@pytest.mark.parametrize("entry_point", ["import", "sync"])
@pytest.mark.parametrize("database_permission_exists", [False, True])
@pytest.mark.parametrize(
    "permission,old_name,new_name,perm_field",
    [
        (
            "schema_access",
            "[examples].[cat].[main]",
            "[examples_renamed].[cat].[main]",
            "schema_perm",
        ),
        (
            "catalog_access",
            "[examples].[cat]",
            "[examples_renamed].[cat]",
            "catalog_perm",
        ),
    ],
)
def test_rename_collision_preserves_role_grants(
    mocker: MockerFixture,
    session: Session,
    entry_point: str,
    database_permission_exists: bool,
    permission: str,
    old_name: str,
    new_name: str,
    perm_field: str,
) -> None:
    """Merge grants on colliding permissions without dropping or duplicating grants."""
    from superset import db, security_manager
    from superset.commands.database.importers.v1.utils import import_database
    from superset.commands.database.sync_permissions import SyncPermissionsCommand
    from superset.commands.database.utils import add_pvm
    from superset.commands.importers.v1.assets import ImportAssetsCommand
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.slice import Slice

    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch("superset.commands.database.importers.v1.utils.add_permissions")
    Slice.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member
    database = import_database(copy.deepcopy(databases_config[DATABASE_FILE]))
    dataset = SqlaTable(
        table_name="t1", catalog="cat", schema="main", database=database
    )
    db.session.add(dataset)
    db.session.commit()
    if database_permission_exists:
        # Exercise the database rename hook's destination-collision branch too.
        add_pvm(
            db.session,
            security_manager,
            "database_access",
            security_manager.get_database_perm(database.id, RENAMED_DATABASE_NAME),
        )
    source = security_manager.find_permission_view_menu(permission, old_name)
    destination = add_pvm(db.session, security_manager, permission, new_name)
    assert source
    assert destination
    source_role = security_manager.role_model(name="source_viewer")
    destination_role = security_manager.role_model(name="destination_viewer")
    shared_role = security_manager.role_model(name="shared_viewer")
    source_role.permissions = [source]
    destination_role.permissions = [destination]
    shared_role.permissions = [source, destination]
    db.session.add_all([source_role, destination_role, shared_role])
    db.session.commit()
    destination_id = destination.id

    if entry_point == "import":
        ImportAssetsCommand._import(_renamed(databases_config))
    else:
        assert database.database_name == "examples"
        database.database_name = RENAMED_DATABASE_NAME
        db.session.flush()
        command = SyncPermissionsCommand(
            database.id, None, old_db_connection_name="examples", db_connection=database
        )
        command._rename_database_in_permissions("cat", ["main"])
    db.session.commit()
    db.session.expire_all()

    assert getattr(dataset, perm_field) == new_name
    destination = security_manager.find_permission_view_menu(permission, new_name)
    assert destination
    assert destination.id == destination_id
    for role in (source_role, destination_role, shared_role):
        assert [p.id for p in role.permissions] == [destination_id]
    assert not security_manager.find_permission_view_menu(permission, old_name)
    assert not security_manager.find_view_menu(old_name)


@pytest.mark.parametrize("destination_has_permission", [True, False])
def test_rename_permission_keeps_shared_view_menu(
    session: Session, destination_has_permission: bool
) -> None:
    """Retire only the source PVM; another permission still owns its view menu."""
    from superset import db, security_manager
    from superset.commands.database.utils import (
        add_pvm,
        add_vm,
        rename_permission_view_menu,
    )
    from superset.models.slice import Slice

    Slice.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member
    source = add_pvm(db.session, security_manager, "schema_access", "[old].[main]")
    other = add_pvm(db.session, security_manager, "other_access", "[old].[main]")
    add_vm(db.session, security_manager, "[new].[main]")
    if destination_has_permission:
        add_pvm(db.session, security_manager, "schema_access", "[new].[main]")
    assert source
    assert other
    role = security_manager.role_model(name="viewer")
    role.permissions = [source]
    db.session.add(role)
    db.session.commit()
    other_id = other.id

    rename_permission_view_menu(source, "[new].[main]")
    db.session.commit()
    db.session.expire_all()
    destination = security_manager.find_permission_view_menu(
        "schema_access", "[new].[main]"
    )
    assert destination
    assert [p.id for p in role.permissions] == [destination.id]
    assert not security_manager.find_permission_view_menu(
        "schema_access", "[old].[main]"
    )
    other = security_manager.find_permission_view_menu("other_access", "[old].[main]")
    assert other
    assert other.id == other_id
    # A second sync must not drop grants or delete the destination.
    rename_permission_view_menu(destination, "[new].[main]")
    rename_permission_view_menu(destination, None)
    db.session.commit()
    assert [p.id for p in role.permissions] == [destination.id]
