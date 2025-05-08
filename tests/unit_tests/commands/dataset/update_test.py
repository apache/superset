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
from typing import Any
from unittest.mock import MagicMock

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset import db
from superset.commands.dataset.exceptions import (
    DatabaseNotFoundValidationError,
    DatasetExistsValidationError,
    DatasetForbiddenError,
    DatasetInvalidError,
    DatasetNotFoundError,
    MultiCatalogDisabledValidationError,
)
from superset.commands.dataset.update import UpdateDatasetCommand
from superset.commands.exceptions import OwnersNotFoundValidationError
from superset.connectors.sqla.models import SqlaTable
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.core import Database


def test_update_dataset_not_found(mocker: MockerFixture) -> None:
    """
    Test updating an unexisting ID raises a `DatasetNotFoundError`.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mock_dataset_dao.find_by_id.return_value = None

    with pytest.raises(DatasetNotFoundError):
        UpdateDatasetCommand(1, {"name": "test"}).run()


def test_update_dataset_forbidden(mocker: MockerFixture) -> None:
    """
    Test try updating a dataset without permission raises a `DatasetForbiddenError`.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mock_dataset_dao.find_by_id.return_value = mocker.MagicMock()

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership",
        side_effect=SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
                message="Sample message",
                level=ErrorLevel.ERROR,
            )
        ),
    )

    with pytest.raises(DatasetForbiddenError):
        UpdateDatasetCommand(1, {"name": "test"}).run()


@pytest.mark.parametrize(
    ("payload, exception, error_msg"),
    [
        (
            {"database_id": 2},
            DatabaseNotFoundValidationError,
            "Database does not exist",
        ),
        (
            {"catalog": "test"},
            MultiCatalogDisabledValidationError,
            "Only the default catalog is supported for this connection",
        ),
        (
            {"table_name": "table", "schema": "schema"},
            DatasetExistsValidationError,
            "Dataset catalog.schema.table already exists",
        ),
        (
            {"owners": [1]},
            OwnersNotFoundValidationError,
            "Owners are invalid",
        ),
    ],
)
def test_update_validation_errors(
    payload: dict[str, Any],
    exception: Exception,
    error_msg: str,
    mocker: MockerFixture,
) -> None:
    """
    Test validation errors for the `UpdateDatasetCommand`.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership",
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)
    mocker.patch(
        "superset.commands.utils.security_manager.get_user_by_id", return_value=None
    )
    mock_database = mocker.MagicMock()
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = "catalog"
    mock_database.allow_multi_catalog = False
    mock_dataset = mocker.MagicMock()
    mock_dataset.database = mock_database
    mock_dataset.catalog = "catalog"
    mock_dataset_dao.find_by_id.return_value = mock_dataset

    if exception == DatabaseNotFoundValidationError:
        mock_dataset_dao.get_database_by_id.return_value = None
    else:
        mock_dataset_dao.get_database_by_id.return_value = mock_database

    if exception == DatasetExistsValidationError:
        mock_dataset_dao.validate_update_uniqueness.return_value = False
    else:
        mock_dataset_dao.validate_update_uniqueness.return_value = True

    with pytest.raises(DatasetInvalidError) as excinfo:
        UpdateDatasetCommand(1, payload).run()
    assert any(error_msg in str(exc) for exc in excinfo.value._exceptions)


@pytest.mark.usefixture("session")
def test_update_validate_roles_when_in_payload(mocker: MockerFixture) -> None:
    """When the payload contains "roles", `populate_roles` is called and
    the resolved roles are stored in `command._properties["roles"]`."""
    SqlaTable.metadata.create_all(db.session.get_bind())
    database = Database(database_name="my_db_3", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="bar", schema="foo", database=database)
    db.session.add_all([database, dataset])
    db.session.commit()

    mock_g = mocker.patch("superset.security.manager.g")
    mock_g.user = MagicMock()

    # Allow DAO to see the created datasource
    mocker.patch(
        "superset.views.base.security_manager.can_access_all_datasources",
        return_value=True,
    )

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership",
        return_value=None,
    )
    mocker.patch.object(UpdateDatasetCommand, "compute_owners", return_value=[])

    resolved_roles = [MagicMock(id=1), MagicMock(id=2)]
    populate_roles_mock = mocker.patch(
        "superset.commands.dataset.update.populate_roles",
        return_value=resolved_roles,
    )

    command = UpdateDatasetCommand(
        dataset.id,
        {
            "table_name": "bar",
            "schema": "foo",
            "roles": [1, 2],
        },
    )
    command.validate()

    populate_roles_mock.assert_called_once_with([1, 2])
    assert command._properties["roles"] == resolved_roles


@pytest.mark.usefixture("session")
def test_update_does_not_validate_roles_when_not_in_payload(
    mocker: MockerFixture,
) -> None:
    SqlaTable.metadata.create_all(db.session.get_bind())
    database = Database(database_name="my_db_2", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="bar", schema="foo", database=database)
    db.session.add_all([database, dataset])
    db.session.commit()

    mock_g = mocker.patch("superset.security.manager.g")
    mock_g.user = MagicMock()

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership",
        return_value=None,
    )
    mocker.patch.object(UpdateDatasetCommand, "compute_owners", return_value=[])

    # autorise la visibilité de la datasource créée pour le DAO
    mocker.patch(
        "superset.views.base.security_manager.can_access_all_datasources",
        return_value=True,
    )

    populate_roles_mock = mocker.patch(
        "superset.commands.dataset.update.populate_roles",
        side_effect=ValidationError("populate_roles should not be called"),
    )

    command = UpdateDatasetCommand(
        dataset.id,
        {
            "table_name": "bar",
            "schema": "foo",
        },
    )
    command.validate()

    populate_roles_mock.assert_not_called()
    assert "roles" not in command._properties


@pytest.mark.usefixture("session")
def test_update_dataset_sql_authorized(mocker: MockerFixture) -> None:
    """Updating the SQL of a dataset succeeds when the user has access to it."""
    SqlaTable.metadata.create_all(db.session.get_bind())
    database = Database(database_name="my_db_4", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(
        table_name="bar", schema="foo", database=database, sql="SELECT 1"
    )
    db.session.add_all([database, dataset])
    db.session.commit()

    mock_g = mocker.patch("superset.security.manager.g")
    mock_g.user = MagicMock()

    mocker.patch(
        "superset.views.base.security_manager.can_access_all_datasources",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership",
        return_value=None,
    )
    mocker.patch.object(UpdateDatasetCommand, "compute_owners", return_value=[])

    raise_for_access_mock = mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_access",
        return_value=None,
    )

    command = UpdateDatasetCommand(
        dataset.id,
        {
            "table_name": "bar",
            "schema": "foo",
            "sql": "SELECT * FROM allowed_table",
        },
    )
    command.validate()

    raise_for_access_mock.assert_called_once()


@pytest.mark.usefixture("session")
def test_update_dataset_sql_unauthorized(mocker: MockerFixture) -> None:
    """Updating the SQL of a dataset raises when the user lacks access to it."""
    SqlaTable.metadata.create_all(db.session.get_bind())
    database = Database(database_name="my_db_5", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(
        table_name="bar", schema="foo", database=database, sql="SELECT 1"
    )
    db.session.add_all([database, dataset])
    db.session.commit()

    mock_g = mocker.patch("superset.security.manager.g")
    mock_g.user = MagicMock()

    mocker.patch(
        "superset.views.base.security_manager.can_access_all_datasources",
        return_value=True,
    )
    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership",
        return_value=None,
    )
    mocker.patch.object(UpdateDatasetCommand, "compute_owners", return_value=[])

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
                message="You don't have access to the 'restricted_schema' schema",
                level=ErrorLevel.ERROR,
            )
        ),
    )

    command = UpdateDatasetCommand(
        dataset.id,
        {
            "table_name": "bar",
            "schema": "foo",
            "sql": "SELECT * FROM restricted_schema.sensitive_table",
        },
    )

    with pytest.raises(DatasetInvalidError) as excinfo:
        command.validate()

    assert any(
        "You don't have access to the 'restricted_schema' schema" in str(exc)
        for exc in excinfo.value._exceptions
    )
