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

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseNotFoundError,
    UserNotFoundInSessionError,
)
from superset.db_engine_specs.base import GenericDBException
from superset.exceptions import OAuth2RedirectError
from superset.tasks.permissions import (
    _get_catalog_names,
    _get_schema_names,
    _refresh_schemas,
    _rename_database_in_permissions,
    sync_database_permissions,
    sync_permissions,
)


def test__get_catalog_names(mocker: MockerFixture):
    """
    Test the ``_get_catalog_names`` method.
    """
    mock_db = mocker.MagicMock()
    mock_db.get_all_catalog_names.return_value = {"first_catalog", "second_catalog"}

    result = _get_catalog_names(mock_db, None)

    assert result == {"first_catalog", "second_catalog"}
    mock_db.get_all_catalog_names.assert_called_once_with(
        force=True,
        ssh_tunnel=None,
    )


@pytest.mark.parametrize(
    ("exception_side_effect", "exception_raised"),
    [
        (
            OAuth2RedirectError("Missing token", "mock_tab", "mock_url"),
            OAuth2RedirectError,
        ),
        (GenericDBException, DatabaseConnectionFailedError),
    ],
)
def test__get_catalog_names_raise(
    mocker: MockerFixture,
    exception_side_effect: Exception,
    exception_raised: Exception,
):
    """
    Test the ``_get_catalog_names`` method when an exception happens.
    """
    mock_db = mocker.MagicMock()
    mock_db.get_all_catalog_names.side_effect = exception_side_effect
    with pytest.raises(exception_raised):
        _get_catalog_names(mock_db, None)


@pytest.mark.parametrize(
    ("catalog", "ssh_tunnel"),
    [
        (None, None),
        ("my_catalog", None),
        ("my_catalog", MagicMock()),
        (None, MagicMock()),
    ],
)
def test__get_schema_names(
    mocker: MockerFixture, catalog: str, ssh_tunnel: MagicMock | None
):
    """
    Test the ``_get_schema_names`` method.
    """
    mock_db = mocker.MagicMock()
    mock_db.get_all_schema_names.return_value = {"first_schema", "second_schema"}

    result = _get_schema_names(mock_db, ssh_tunnel, catalog)
    assert result == {"first_schema", "second_schema"}
    mock_db.get_all_schema_names.assert_called_once_with(
        force=True,
        catalog=catalog,
        ssh_tunnel=ssh_tunnel,
    )


@pytest.mark.parametrize(
    ("exception_side_effect", "exception_raised"),
    [
        (
            OAuth2RedirectError("Missing token", "mock_tab", "mock_url"),
            OAuth2RedirectError,
        ),
        (GenericDBException, DatabaseConnectionFailedError),
    ],
)
def test__get_schema_names_raise(
    mocker: MockerFixture,
    exception_side_effect: Exception,
    exception_raised: Exception,
):
    """
    Test the ``_get_schema_names`` method when an exception happens.
    """
    mock_db = mocker.MagicMock()
    mock_db.get_all_schema_names.side_effect = exception_side_effect
    with pytest.raises(exception_raised):
        _get_schema_names(mock_db, None, None)


def test__refresh_schemas(mocker: MockerFixture):
    """
    Test the ``_refresh_schemas`` method.
    """
    get_schem_perm_mock = mocker.patch(
        "superset.tasks.permissions.security_manager.get_schema_perm"
    )
    get_schem_perm_mock.side_effect = [
        "[same_name].[catalog].[schema1]",
        None,
        "[same_name].[catalog].[schema2]",
    ]
    find_pvm_mock = mocker.patch(
        "superset.tasks.permissions.security_manager.find_permission_view_menu"
    )
    find_pvm_mock.side_effect = [mocker.MagicMock(), None]
    add_pvm_mock = mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.add_permission_view_menu"
    )

    _refresh_schemas("same name", "same name", "catalog", ["schema1", "schema2"])

    add_pvm_mock.assert_called_once_with(
        "schema_access", "[same_name].[catalog].[schema2]"
    )


def test__rename_database_in_permissions(mocker: MockerFixture):
    """
    Test the ``_rename_database_in_permissions`` method.
    """
    get_schema_perm_mock = mocker.patch(
        "superset.tasks.permissions.security_manager.get_schema_perm"
    )
    find_pvm_mock = mocker.patch(
        "superset.tasks.permissions.security_manager.find_permission_view_menu"
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

    mock_database_dao = mocker.patch("superset.tasks.permissions.DatabaseDAO")
    mock_database_dao.get_datasets.side_effect = [
        [mock_dataset],
        [],
    ]
    mock_dataset_dao = mocker.patch("superset.tasks.permissions.DatasetDAO")
    mock_dataset_dao.get_related_objects.return_value = {"charts": [mock_chart]}

    _rename_database_in_permissions(
        1, "old_name", "new_name", "catalog", ["schema1", "schema2"]
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


def test_sync_permissions(mocker: MockerFixture):
    """
    Test the ``sync_permissions`` method.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "same_name"
    mock_db.db_engine_spec.supports_catalog = True
    mocker.patch(
        "superset.tasks.permissions._get_catalog_names",
        return_value=["catalog1", "catalog2"],
    )
    mocker.patch(
        "superset.tasks.permissions._get_schema_names",
        side_effect=[
            ["schema1_catalog_1", "schema2_catalog_1"],
            ["schema1_catalog_2", "schema2_catalog_2"],
        ],
    )
    find_pvm_mock = mocker.patch(
        "superset.tasks.permissions.security_manager.find_permission_view_menu"
    )
    add_pvm_mock = mocker.patch(
        "superset.tasks.permissions.security_manager.add_permission_view_menu"
    )
    find_pvm_mock.side_effect = [mocker.MagicMock(), None]
    mock_refresh_schemas = mocker.patch("superset.tasks.permissions._refresh_schemas")
    mock_rename_db_perm = mocker.patch(
        "superset.tasks.permissions._rename_database_in_permissions"
    )

    sync_permissions(mock_db, None, "same_name")

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


def test_sync_permissions_error_on_getting_schemas(mocker: MockerFixture):
    """
    Test the ``sync_permissions`` method when an exception is raised on
    getting the schemas for the catalog.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "same_name"
    mock_db.db_engine_spec.supports_catalog = True
    mocker.patch(
        "superset.tasks.permissions._get_catalog_names",
        return_value=["catalog1", "catalog2"],
    )
    mocker.patch(
        "superset.tasks.permissions._get_schema_names",
        side_effect=[
            DatabaseConnectionFailedError,
            ["schema1_catalog_2", "schema2_catalog_2"],
        ],
    )
    find_pvm_mock = mocker.patch(
        "superset.tasks.permissions.security_manager.find_permission_view_menu"
    )
    add_pvm_mock = mocker.patch(
        "superset.tasks.permissions.security_manager.add_permission_view_menu"
    )
    find_pvm_mock.return_value = mocker.MagicMock()
    mock_refresh_schemas = mocker.patch("superset.tasks.permissions._refresh_schemas")
    mock_rename_db_perm = mocker.patch(
        "superset.tasks.permissions._rename_database_in_permissions"
    )

    sync_permissions(mock_db, None, "same_name")

    add_pvm_mock.assert_not_called()
    mock_refresh_schemas.assert_called_once_with(
        "same_name",
        "same_name",
        "catalog2",
        ["schema1_catalog_2", "schema2_catalog_2"],
    )
    mock_rename_db_perm.assert_not_called()


def test_sync_permissions_new_db_name(mocker: MockerFixture):
    """
    Test the ``sync_permissions`` method when the database name has changed.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "New Name"
    mock_db.id = 1
    mock_db.db_engine_spec.supports_catalog = True
    mocker.patch(
        "superset.tasks.permissions._get_catalog_names", return_value=["catalog"]
    )
    mocker.patch(
        "superset.tasks.permissions._get_schema_names", return_value=["schema"]
    )
    mocker.patch(
        "superset.tasks.permissions.security_manager.find_permission_view_menu",
        return_value=mocker.MagicMock(),
    )
    mocker.patch("superset.tasks.permissions._refresh_schemas")
    mock_rename_db_perm = mocker.patch(
        "superset.tasks.permissions._rename_database_in_permissions"
    )

    sync_permissions(mock_db, None, "Old Name")

    mock_rename_db_perm.assert_called_once_with(
        1, "Old Name", "New Name", "catalog", ["schema"]
    )


def test_sync_permissions_no_catalog(mocker: MockerFixture):
    """
    Test the ``sync_permissions`` method when the DB connection
    does not supports catalogs.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "Name"
    mock_db.db_engine_spec.supports_catalog = False
    mock_get_catalog = mocker.patch("superset.tasks.permissions._get_catalog_names")
    mocker.patch(
        "superset.tasks.permissions._get_schema_names", return_value=["schema"]
    )
    mock_refresh_schemas = mocker.patch("superset.tasks.permissions._refresh_schemas")

    sync_permissions(mock_db, None, "Name")

    mock_get_catalog.assert_not_called()
    mock_refresh_schemas.assert_called_once_with("Name", "Name", None, ["schema"])


def test_sync_permissions_no_catalog_new_db_name(mocker: MockerFixture):
    """
    Test the ``sync_permissions`` method when the database name has changed
    and the DB connection does not support catalog.
    """
    mock_db = mocker.MagicMock()
    mock_db.database_name = "New Name"
    mock_db.id = 2
    mock_db.db_engine_spec.supports_catalog = False
    mock_get_catalog = mocker.patch("superset.tasks.permissions._get_catalog_names")
    mocker.patch(
        "superset.tasks.permissions._get_schema_names", return_value=["schema"]
    )
    mock_refresh_schemas = mocker.patch("superset.tasks.permissions._refresh_schemas")
    mock_rename_db_perm = mocker.patch(
        "superset.tasks.permissions._rename_database_in_permissions"
    )

    sync_permissions(mock_db, None, "Name")

    mock_get_catalog.assert_not_called()
    mock_refresh_schemas.assert_called_once_with("Name", "New Name", None, ["schema"])
    mock_rename_db_perm.assert_called_once_with(2, "Name", "New Name", None, ["schema"])


def test_sync_database_permissions(mocker: MockerFixture):
    """
    Test the ``sync_database_permissions`` method.
    """
    mock_db = mocker.MagicMock()
    mock_ssh = mocker.MagicMock()
    mock_database_dao = mocker.patch("superset.tasks.permissions.DatabaseDAO")
    mock_database_dao.find_by_id.return_value = mock_db
    mock_database_dao.get_ssh_tunnel.return_value = mock_ssh
    mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )
    mock_sync = mocker.patch("superset.tasks.permissions.sync_permissions")

    sync_database_permissions(1, "admin", "old_db_name")

    mock_sync.assert_called_once_with(mock_db, mock_ssh, "old_db_name")


def test_sync_database_permissions_raise(mocker: MockerFixture):
    """
    Test the ``sync_database_permissions`` method when there's
    an exception.
    """
    mock_db = mocker.MagicMock()
    mock_database_dao = mocker.patch("superset.tasks.permissions.DatabaseDAO")
    mock_database_dao.find_by_id.return_value = mock_db
    mock_database_dao.get_ssh_tunnel.return_value = None
    mock_user = mocker.patch(
        "superset.commands.database.sync_permissions.security_manager.get_user_by_username"
    )
    mock_sync = mocker.patch("superset.tasks.permissions.sync_permissions")

    # Error during sync
    mock_sync.side_effect = DatabaseConnectionFailedError
    with pytest.raises(DatabaseConnectionFailedError):
        sync_database_permissions(1, "admin", "old_db_name")
    mock_database_dao.reset_mock()

    # DB not found
    mock_database_dao.reset_mock()
    mock_database_dao.find_by_id.return_value = None
    with pytest.raises(DatabaseNotFoundError):
        sync_database_permissions(1, "admin", "old_db_name")
    mock_database_dao.reset_mock()
    mock_database_dao.find_by_id.return_value = mock_db

    # User not found
    mock_user.reset_mock()
    mock_user.return_value = None
    with pytest.raises(UserNotFoundInSessionError):
        sync_database_permissions(1, "admin", "old_db_name")
