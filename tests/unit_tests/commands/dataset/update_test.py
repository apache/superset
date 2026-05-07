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

from typing import Any, cast

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset.commands.dataset.exceptions import (
    DatabaseNotFoundValidationError,
    DatasetExistsValidationError,
    DatasetForbiddenError,
    DatasetInvalidError,
    DatasetNotFoundError,
    MultiCatalogDisabledValidationError,
)
from superset.commands.dataset.update import UpdateDatasetCommand, validate_folders
from superset.commands.exceptions import OwnersNotFoundValidationError
from superset.datasets.schemas import FolderSchema
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from tests.unit_tests.conftest import with_feature_flags


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


def test_update_dataset_sql_authorized_schema(mocker: MockerFixture) -> None:
    """
    Test that updating a dataset with SQL works when user has schema access.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mock_database = mocker.MagicMock()
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = "catalog"
    mock_database.allow_multi_catalog = False

    mock_dataset = mocker.MagicMock()
    mock_dataset.database = mock_database
    mock_dataset.catalog = "catalog"
    mock_dataset.schema = "public"
    mock_dataset.table_name = "test_table"
    mock_dataset.owners = []  # No owners to avoid ownership computation issues

    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.get_database_by_id.return_value = mock_database
    mock_dataset_dao.validate_update_uniqueness.return_value = True
    mock_dataset_dao.update.return_value = mock_dataset

    # Mock successful ownership check
    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership",
    )

    # Mock security manager methods for owner computation
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)

    # Mock security manager to allow access to the schema
    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_access",
    )

    # Update dataset with SQL - should work when user has access
    result = UpdateDatasetCommand(
        1, {"sql": "SELECT * FROM public.allowed_table"}
    ).run()

    # Verify the update was called
    assert result == mock_dataset
    mock_dataset_dao.update.assert_called_once()


def test_update_dataset_sql_unauthorized_schema(mocker: MockerFixture) -> None:
    """
    Test that updating a dataset with SQL to an unauthorized schema raises an error.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mock_database = mocker.MagicMock()
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = "catalog"
    mock_database.allow_multi_catalog = False

    mock_dataset = mocker.MagicMock()
    mock_dataset.database = mock_database
    mock_dataset.catalog = "catalog"
    mock_dataset.schema = "public"
    mock_dataset.table_name = "test_table"
    mock_dataset.owners = []  # No owners to avoid ownership computation issues

    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.get_database_by_id.return_value = mock_database
    mock_dataset_dao.validate_update_uniqueness.return_value = True

    # Mock successful ownership check
    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership",
    )

    # Mock security manager methods for owner computation
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)

    # Mock security manager to raise error for SQL schema access
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

    # Try to update dataset with SQL querying an unauthorized schema
    with pytest.raises(DatasetInvalidError) as excinfo:
        UpdateDatasetCommand(
            1, {"sql": "SELECT * FROM restricted_schema.sensitive_table"}
        ).run()

    # Check that the appropriate error message is in the exceptions
    assert any(
        "You don't have access to the 'restricted_schema' schema" in str(exc)
        for exc in excinfo.value._exceptions
    )


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
def test_update_dataset_validation_errors(
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


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders(mocker: MockerFixture) -> None:
    """
    Test the folder validation.
    """
    metrics = [mocker.MagicMock(metric_name="metric1", uuid="uuid1")]
    columns = [
        mocker.MagicMock(column_name="column1", uuid="uuid2"),
        mocker.MagicMock(column_name="column2", uuid="uuid3"),
    ]

    validate_folders(folders=[], metrics=metrics, columns=columns)

    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": "uuid4",
                "type": "folder",
                "name": "My folder",
                "children": [
                    {
                        "uuid": "uuid1",
                        "type": "metric",
                        "name": "metric1",
                    },
                    {
                        "uuid": "uuid2",
                        "type": "column",
                        "name": "column1",
                    },
                    {
                        "uuid": "uuid3",
                        "type": "column",
                        "name": "column2",
                    },
                ],
            },
        ],
    )
    validate_folders(folders=folders, metrics=metrics, columns=columns)


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_cycle(mocker: MockerFixture) -> None:
    """
    Test that we can detect cycles in the folder structure.
    """
    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": "uuid1",
                "type": "folder",
                "name": "My folder",
                "children": [
                    {
                        "uuid": "uuid2",
                        "type": "folder",
                        "name": "My other folder",
                        "children": [
                            {
                                "uuid": "uuid1",
                                "type": "folder",
                                "name": "My folder",
                                "children": [],
                            },
                        ],
                    },
                ],
            },
        ],
    )

    with pytest.raises(ValidationError) as excinfo:
        validate_folders(folders=folders, metrics=[], columns=[])
    assert str(excinfo.value) == "Cycle detected: uuid1 appears in its ancestry"


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_inter_cycle(mocker: MockerFixture) -> None:
    """
    Test that we can detect cycles between folders.
    """
    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": "uuid1",
                "type": "folder",
                "name": "My folder",
                "children": [
                    {
                        "uuid": "uuid2",
                        "type": "folder",
                        "name": "My other folder",
                        "children": [],
                    },
                ],
            },
            {
                "uuid": "uuid2",
                "type": "folder",
                "name": "My other folder",
                "children": [
                    {
                        "uuid": "uuid1",
                        "type": "folder",
                        "name": "My folder",
                        "children": [],
                    },
                ],
            },
        ],
    )

    with pytest.raises(ValidationError) as excinfo:
        validate_folders(folders=folders, metrics=[], columns=[])
    assert str(excinfo.value) == "Duplicate UUID in folder structure: uuid2"


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_duplicates(mocker: MockerFixture) -> None:
    """
    Test that metrics and columns belong to a single folder.
    """
    metrics = [mocker.MagicMock(metric_name="count", uuid="uuid2")]
    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": "uuid1",
                "type": "folder",
                "name": "My folder",
                "children": [
                    {
                        "uuid": "uuid2",
                        "type": "metric",
                        "name": "count",
                    },
                ],
            },
            {
                "uuid": "uuid2",
                "type": "folder",
                "name": "My other folder",
                "children": [
                    {
                        "uuid": "uuid2",
                        "type": "metric",
                        "name": "count",
                    },
                ],
            },
        ],
    )

    with pytest.raises(ValidationError) as excinfo:
        validate_folders(folders=folders, metrics=metrics, columns=[])
    assert str(excinfo.value) == "Duplicate UUID in folder structure: uuid2"


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_duplicate_name_not_siblings(mocker: MockerFixture) -> None:
    """
    Duplicate folder names are allowed if folders are not siblings.
    """
    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": "uuid1",
                "type": "folder",
                "name": "Sales",
                "children": [
                    {
                        "uuid": "uuid2",
                        "type": "folder",
                        "name": "Core",
                        "children": [],
                    },
                ],
            },
            {
                "uuid": "uuid3",
                "type": "folder",
                "name": "Engineering",
                "children": [
                    {
                        "uuid": "uuid4",
                        "type": "folder",
                        "name": "Core",
                        "children": [],
                    },
                ],
            },
        ],
    )

    validate_folders(folders=folders, metrics=[], columns=[])


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_duplicate_name_siblings(mocker: MockerFixture) -> None:
    """
    Duplicate folder names are not allowed if folders are siblings.
    """
    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": "uuid1",
                "type": "folder",
                "name": "Sales",
                "children": [
                    {
                        "uuid": "uuid2",
                        "type": "folder",
                        "name": "Core",
                        "children": [],
                    },
                ],
            },
            {
                "uuid": "uuid3",
                "type": "folder",
                "name": "Sales",
                "children": [
                    {
                        "uuid": "uuid4",
                        "type": "folder",
                        "name": "Other",
                        "children": [],
                    },
                ],
            },
        ],
    )

    with pytest.raises(ValidationError) as excinfo:
        validate_folders(folders=folders, metrics=[], columns=[])
    assert str(excinfo.value) == "Duplicate folder name: Sales"


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_invalid_names(mocker: MockerFixture) -> None:
    """
    Test that we can detect reserved folder names.
    """
    folders_with_metrics = cast(
        list[FolderSchema],
        [
            {
                "uuid": "uuid1",
                "type": "folder",
                "name": "Metrics",
                "children": [],
            },
        ],
    )
    folders_with_columns = cast(
        list[FolderSchema],
        [
            {
                "uuid": "uuid1",
                "type": "folder",
                "name": "Columns",
                "children": [],
            },
        ],
    )

    with pytest.raises(ValidationError) as excinfo:
        validate_folders(folders=folders_with_metrics, metrics=[], columns=[])
    assert str(excinfo.value) == "Folder cannot have name 'Metrics'"

    with pytest.raises(ValidationError) as excinfo:
        validate_folders(folders=folders_with_columns, metrics=[], columns=[])
    assert str(excinfo.value) == "Folder cannot have name 'Columns'"


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_invalid_uuid(mocker: MockerFixture) -> None:
    """
    Test that we can detect invalid UUIDs.
    """
    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": "uuid4",
                "type": "folder",
                "name": "My folder",
                "children": [
                    {
                        "uuid": "uuid2",
                        "type": "metric",
                        "name": "metric1",
                    },
                ],
            },
        ],
    )

    with pytest.raises(ValidationError):
        FolderSchema(many=True).load(folders)
