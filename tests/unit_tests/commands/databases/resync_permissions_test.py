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
from __future__ import annotations

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.exceptions import DatabaseConnectionFailedError
from superset.commands.database.resync_permissions import ResyncPermissionsCommand
from superset.db_engine_specs.base import GenericDBException
from superset.exceptions import OAuth2RedirectError


def test_resync_permissions_command_validate(mocker: MockerFixture):
    """
    Test the ``validate`` method.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "current name"
    mock_ssh = mocker.MagicMock()
    mock_databasedao = mocker.patch(
        "superset.commands.database.resync_permissions.DatabaseDAO"
    )
    mock_databasedao.find_by_id.return_value = mock_db
    mock_databasedao.get_ssh_tunnel.return_value = mock_ssh
    mocker.patch(
        "superset.commands.database.resync_permissions.ping", return_value=True
    )

    cmmd = ResyncPermissionsCommand(1)
    cmmd.validate()

    assert cmmd.db_connection == mock_db
    assert cmmd.old_db_connection_name == "current name"
    assert cmmd.db_connection_ssh_tunnel == mock_ssh
    mock_databasedao.find_by_id.assert_called_once_with(1)
    mock_databasedao.get_ssh_tunnel.assert_called_once_with(1)


def test_resync_permissions_command_validate_passing_all_values(mocker: MockerFixture):
    """
    Test the ``validate`` method when providing all arguments to the constructor.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "current name"
    mock_ssh = mocker.MagicMock()
    mock_databasedao = mocker.patch(
        "superset.commands.database.resync_permissions.DatabaseDAO"
    )
    mocker.patch(
        "superset.commands.database.resync_permissions.ping", return_value=True
    )

    cmmd = ResyncPermissionsCommand(
        1,
        old_db_connection_name="old name",
        db_connection=mock_db,
        ssh_tunnel=mock_ssh,
    )
    cmmd.validate()

    assert cmmd.db_connection == mock_db
    assert cmmd.old_db_connection_name == "old name"
    assert cmmd.db_connection_ssh_tunnel == mock_ssh
    mock_databasedao.find_by_id.assert_not_called()
    mock_databasedao.get_ssh_tunnel.assert_not_called()


def test_resync_permissions_command_validate_raise(mocker: MockerFixture):
    """
    Test the ``validate`` method when an exception is raised.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "current name"
    mock_ssh = mocker.MagicMock()
    mock_ping = mocker.patch(
        "superset.commands.database.resync_permissions.ping", return_value=False
    )

    cmmd = ResyncPermissionsCommand(
        1,
        db_connection=mock_db,
        ssh_tunnel=mock_ssh,
    )
    with pytest.raises(DatabaseConnectionFailedError):
        cmmd.validate()

    mock_ping.reset_mock()
    mock_ping.side_effect = Exception

    with pytest.raises(DatabaseConnectionFailedError):
        cmmd.validate()


def test_resync_permissions_command_run(mocker: MockerFixture):
    """
    Test the ``_refresh_catalogs`` method.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "same_name"
    mock_db.db_engine_spec.supports_catalog = True
    find_pvm_mock = mocker.patch(
        "superset.commands.database.utils.security_manager.find_permission_view_menu"
    )
    add_pvm_mock = mocker.patch(
        "superset.commands.database.utils.security_manager.add_permission_view_menu"
    )
    find_pvm_mock.side_effect = [mocker.MagicMock(), None]
    schemas_list = [
        ["schema1_catalog_1", "schema2_catalog_1"],
        ["schema1_catalog_2", "schema2_catalog_2"],
    ]

    cmmd = ResyncPermissionsCommand(1, "same_name", mock_db, None)
    mocker.patch.object(
        cmmd, "_get_catalog_names", return_value=["catalog1", "catalog2"]
    )
    mocker.patch.object(cmmd, "_get_schema_names", side_effect=schemas_list)
    mock_refresh_schemas = mocker.patch.object(cmmd, "_refresh_schemas")
    mock_rename_db_perm = mocker.patch.object(cmmd, "_rename_database_in_permissions")
    cmmd.run()

    add_pvm_mock.assert_has_calls(
        [
            mocker.call("catalog_access", "[same_name].[catalog2]"),
            mocker.call("schema_access", "[same_name].[catalog2].[schema1_catalog_2]"),
            mocker.call("schema_access", "[same_name].[catalog2].[schema2_catalog_2]"),
        ]
    )
    mock_refresh_schemas.assert_called_once_with(
        "same_name",
        "same_name",
        "catalog1",
        ["schema1_catalog_1", "schema2_catalog_1"],
    )
    mock_rename_db_perm.assert_not_called()


def test_resync_permissions_command_run_raise_on_getting_schemas(mocker: MockerFixture):
    """
    Test the ``run`` method when an exception is raised on getting the schemas
    for the catalog.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "same_name"
    mock_db.db_engine_spec.supports_catalog = True
    find_pvm_mock = mocker.patch(
        "superset.commands.database.utils.security_manager.find_permission_view_menu"
    )
    add_pvm_mock = mocker.patch(
        "superset.commands.database.utils.security_manager.add_permission_view_menu"
    )
    find_pvm_mock.return_value = mocker.MagicMock()
    schemas_list = [
        DatabaseConnectionFailedError,
        ["schema1_catalog_2", "schema2_catalog_2"],
    ]

    cmmd = ResyncPermissionsCommand(1, "same_name", mock_db, None)
    mocker.patch.object(
        cmmd, "_get_catalog_names", return_value=["catalog1", "catalog2"]
    )
    mocker.patch.object(cmmd, "_get_schema_names", side_effect=schemas_list)
    mock_refresh_schemas = mocker.patch.object(cmmd, "_refresh_schemas")
    mock_rename_db_perm = mocker.patch.object(cmmd, "_rename_database_in_permissions")
    cmmd.run()

    add_pvm_mock.assert_not_called()
    mock_refresh_schemas.assert_called_once_with(
        "same_name",
        "same_name",
        "catalog2",
        ["schema1_catalog_2", "schema2_catalog_2"],
    )
    mock_rename_db_perm.assert_not_called()


def test_resync_permissions_command_run_new_db_name(mocker: MockerFixture):
    """
    Test the ``run`` method when the database name has changed.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "New Name"
    mock_db.db_engine_spec.supports_catalog = True
    mocker.patch(
        "superset.commands.database.utils.security_manager.find_permission_view_menu",
        return_value=mocker.MagicMock(),
    )

    cmmd = ResyncPermissionsCommand(1, "Old Name", mock_db, None)
    mocker.patch.object(cmmd, "_get_catalog_names", return_value=["catalog"])
    mocker.patch.object(cmmd, "_get_schema_names", return_value=["schema"])
    mocker.patch.object(cmmd, "_refresh_schemas")
    mock_rename_db_perm = mocker.patch.object(cmmd, "_rename_database_in_permissions")
    cmmd.run()

    mock_rename_db_perm.assert_called_once_with(
        "Old Name", "New Name", "catalog", ["schema"]
    )


def test_resync_permissions_command_run_no_catalog(mocker: MockerFixture):
    """
    Test the ``run`` method when the DB connection does not supports catalogs.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "Name"
    mock_db.db_engine_spec.supports_catalog = False

    cmmd = ResyncPermissionsCommand(1, "Name", mock_db, None)
    mocker.patch.object(cmmd, "_get_schema_names", return_value=["schema"])
    mock_refresh_schemas = mocker.patch.object(cmmd, "_refresh_schemas")
    cmmd.run()

    mock_refresh_schemas.assert_called_once_with("Name", "Name", None, ["schema"])


def test_resync_permissions_command_run_no_catalog_raise_on_getting_schemas(
    mocker: MockerFixture,
):
    """
    Test the ``run`` method when an exception is raised on getting the schemas
    for a DB connection that does not support catalog.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "Name"
    mock_db.db_engine_spec.supports_catalog = False

    cmmd = ResyncPermissionsCommand(1, "Name", mock_db, None)
    mocker.patch.object(
        cmmd, "_get_schema_names", side_effect=DatabaseConnectionFailedError
    )
    with pytest.raises(DatabaseConnectionFailedError):
        cmmd.run()


def test_resync_permissions_command_run_no_catalog_new_db_name(mocker: MockerFixture):
    """
    Test the ``run`` method when the database name has changed and the DB connection
    does not support catalog.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "New Name"
    mock_db.db_engine_spec.supports_catalog = False

    cmmd = ResyncPermissionsCommand(1, "Name", mock_db, None)
    mocker.patch.object(cmmd, "_get_schema_names", return_value=["schema"])
    mock_refresh_schemas = mocker.patch.object(cmmd, "_refresh_schemas")
    mock_rename_db = mocker.patch.object(cmmd, "_rename_database_in_permissions")
    cmmd.run()

    mock_refresh_schemas.assert_called_once_with("Name", "New Name", None, ["schema"])
    mock_rename_db.assert_called_once_with("Name", "New Name", None, ["schema"])


def test_resync_permissions_command_get_catalog_names(mocker: MockerFixture):
    """
    Test the ``_get_catalog_names`` method.
    """
    mock_db = mocker.MagicMock()
    mock_db.get_all_catalog_names.return_value = {"catalog1", "catalog2"}

    cmmd = ResyncPermissionsCommand(1, "DB Connection Name", mock_db, None)
    result = cmmd._get_catalog_names(mock_db)

    assert result == {"catalog1", "catalog2"}
    mock_db.get_all_catalog_names.assert_called_once_with(
        force=True,
        ssh_tunnel=None,
    )


def test_resync_permissions_command_get_catalog_names_oauth2_exception(
    mocker: MockerFixture,
):
    """
    Test the ``_get_catalog_names`` method when an OAuth2 exception
    is raised.
    """
    mock_db = mocker.MagicMock()
    mock_db.get_all_catalog_names.side_effect = OAuth2RedirectError(
        "Missing token", "mock_tab", "mock_url"
    )

    cmmd = ResyncPermissionsCommand(1, "DB Connection Name", mock_db, None)
    with pytest.raises(OAuth2RedirectError):
        cmmd._get_catalog_names(mock_db)


def test_resync_permissions_command_get_catalog_names_generic_db_exception(
    mocker: MockerFixture,
):
    """
    Test the ``_get_catalog_names`` method when an OAuth2 exception
    is raised.
    """
    mock_db = mocker.MagicMock()
    mock_db.get_all_catalog_names.side_effect = GenericDBException

    cmmd = ResyncPermissionsCommand(1, "DB Connection Name", mock_db, None)
    with pytest.raises(DatabaseConnectionFailedError):
        cmmd._get_catalog_names(mock_db)


def test_resync_permissions_command_get_schema_names(mocker: MockerFixture):
    """
    Test the ``_get_schema_names`` method.
    """
    mock_db = mocker.MagicMock()
    mock_db.get_all_schema_names.return_value = {"schema1", "schema2"}

    cmmd = ResyncPermissionsCommand(1, "DB Connection Name", mock_db, None)
    result = cmmd._get_schema_names(mock_db, "my_catalog")

    assert result == {"schema1", "schema2"}
    mock_db.get_all_schema_names.assert_called_once_with(
        force=True,
        catalog="my_catalog",
        ssh_tunnel=None,
    )


def test_resync_permissions_command_get_schema_names_oauth2_exception(
    mocker: MockerFixture,
):
    """
    Test the ``_get_schema_names`` method when an OAuth2 exception
    is raised.
    """
    mock_db = mocker.MagicMock()
    mock_db.get_all_schema_names.side_effect = OAuth2RedirectError(
        "Missing token", "mock_tab", "mock_url"
    )

    cmmd = ResyncPermissionsCommand(1, "DB Connection Name", mock_db, None)
    with pytest.raises(OAuth2RedirectError):
        cmmd._get_schema_names(mock_db, "my_catalog")


def test_resync_permissions_command_get_schema_names_generic_db_exception(
    mocker: MockerFixture,
):
    """
    Test the ``_get_schema_names`` method when an OAuth2 exception
    is raised.
    """
    mock_db = mocker.MagicMock()
    mock_db.get_all_schema_names.side_effect = GenericDBException

    cmmd = ResyncPermissionsCommand(1, "DB Connection Name", mock_db, None)
    with pytest.raises(DatabaseConnectionFailedError):
        cmmd._get_schema_names(mock_db, None)


def test_resync_permissions_command_refresh_schemas(mocker: MockerFixture):
    """
    Test the ``_refresh_schemas`` method.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "same_name"
    get_schem_perm_mock = mocker.patch(
        "superset.commands.database.resync_permissions.security_manager.get_schema_perm"
    )
    get_schem_perm_mock.side_effect = [
        "[same_name].[catalog].[schema1]",
        None,
        "[same_name].[catalog].[schema2]",
    ]
    find_pvm_mock = mocker.patch(
        "superset.commands.database.resync_permissions.security_manager.find_permission_view_menu"
    )
    find_pvm_mock.side_effect = [mocker.MagicMock(), None]
    add_pvm_mock = mocker.patch(
        "superset.commands.database.resync_permissions.security_manager.add_permission_view_menu"
    )

    cmmd = ResyncPermissionsCommand(1, "same_name", mock_db, None)
    cmmd._refresh_schemas("same_name", "same_name", "catalog", ["schema1", "schema2"])

    add_pvm_mock.assert_called_once_with(
        "schema_access", "[same_name].[catalog].[schema2]"
    )


def test_resync_permissions_command_rename_database_in_permissions(
    mocker: MockerFixture,
):
    """
    Test the ``_rename_database_in_permissions`` method.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "new_name"
    find_pvm_mock = mocker.patch(
        "superset.commands.database.resync_permissions.security_manager.find_permission_view_menu"
    )
    get_schema_perm_mock = mocker.patch(
        "superset.commands.database.resync_permissions.security_manager.get_schema_perm"
    )
    mock_catalog_perm = mocker.MagicMock()
    mock_catalog_perm.view_menu.name = "[old_name].[catalog]"
    mock_schema_perm = mocker.MagicMock()
    mock_schema_perm.view_menu.name = "[old_name].[catalog].[schema1]"
    find_pvm_mock.side_effect = [
        mock_catalog_perm,
        mock_schema_perm,
        None,
    ]
    get_schema_perm_mock.side_effect = [
        "[new_name].[catalog].[schema1]",
        "[old_name].[catalog].[schema1]",
        "[new_name].[catalog].[schema2]",
        "[old_name].[catalog].[schema2]",
    ]

    mock_dataset = mocker.MagicMock()
    mock_dataset.id = 1
    mock_dataset.catalog_perm = "[old_name].[catalog]"
    mock_dataset.schema_perm = "[old_name].[catalog].[schema1]"
    mock_chart = mocker.MagicMock()
    mock_chart.catalog_perm = "[old_name].[catalog]"
    mock_chart.schema_perm = "[old_name].[catalog].[schema1]"

    mock_database_dao = mocker.patch(
        "superset.commands.database.resync_permissions.DatabaseDAO"
    )
    mock_database_dao.get_datasets.side_effect = [
        [mock_dataset],
        [],
    ]
    mock_dataset_dao = mocker.patch(
        "superset.commands.database.resync_permissions.DatasetDAO"
    )
    mock_dataset_dao.get_related_objects.return_value = {"charts": [mock_chart]}

    cmmd = ResyncPermissionsCommand(1, "old_name", mock_db, None)
    cmmd._rename_database_in_permissions(
        "old_name", "new_name", "catalog", ["schema1", "schema2"]
    )

    find_pvm_mock.assert_has_calls(
        [
            mocker.call("catalog_access", "[old_name].[catalog]"),
            mocker.call("schema_access", "[old_name].[catalog].[schema1]"),
            mocker.call("schema_access", "[old_name].[catalog].[schema2]"),
        ]
    )

    assert mock_catalog_perm.view_menu.name == "[new_name].[catalog]"
    assert mock_schema_perm.view_menu.name == "[new_name].[catalog].[schema1]"
    assert mock_dataset.catalog_perm == "[new_name].[catalog]"
    assert mock_dataset.schema_perm == "[new_name].[catalog].[schema1]"
    assert mock_chart.catalog_perm == "[new_name].[catalog]"
    assert mock_chart.schema_perm == "[new_name].[catalog].[schema1]"
