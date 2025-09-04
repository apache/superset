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
    from uuid import UUID

    metric_uuid = UUID("11111111-1111-1111-1111-111111111111")
    column_uuid1 = UUID("22222222-2222-2222-2222-222222222222")
    column_uuid2 = UUID("33333333-3333-3333-3333-333333333333")
    folder_uuid = UUID("44444444-4444-4444-4444-444444444444")

    metrics = [mocker.MagicMock(metric_name="metric1", uuid=metric_uuid)]
    columns = [
        mocker.MagicMock(column_name="column1", uuid=column_uuid1),
        mocker.MagicMock(column_name="column2", uuid=column_uuid2),
    ]

    # Create valid UUIDs set from metrics and columns
    valid_uuids = {metric.uuid for metric in metrics} | {
        column.uuid for column in columns
    }
    validate_folders(folders=[], valid_uuids=valid_uuids)

    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": str(folder_uuid),
                "type": "folder",
                "name": "My folder",
                "children": [
                    {
                        "uuid": str(metric_uuid),
                        "type": "metric",
                        "name": "metric1",
                    },
                    {
                        "uuid": str(column_uuid1),
                        "type": "column",
                        "name": "column1",
                    },
                    {
                        "uuid": str(column_uuid2),
                        "type": "column",
                        "name": "column2",
                    },
                ],
            },
        ],
    )
    validate_folders(folders=folders, valid_uuids=valid_uuids)


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_cycle(mocker: MockerFixture) -> None:
    """
    Test that we can detect cycles in the folder structure.
    """
    from uuid import UUID

    folder_uuid1 = UUID("11111111-1111-1111-1111-111111111111")
    folder_uuid2 = UUID("22222222-2222-2222-2222-222222222222")

    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": str(folder_uuid1),
                "type": "folder",
                "name": "My folder",
                "children": [
                    {
                        "uuid": str(folder_uuid2),
                        "type": "folder",
                        "name": "My other folder",
                        "children": [
                            {
                                "uuid": str(folder_uuid1),
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
        validate_folders(folders=folders, valid_uuids=set())
    assert (
        str(excinfo.value) == f"Cycle detected: {folder_uuid1} appears in its ancestry"
    )


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_inter_cycle(mocker: MockerFixture) -> None:
    """
    Test that we can detect cycles between folders.
    """
    from uuid import UUID

    folder_uuid1 = UUID("11111111-1111-1111-1111-111111111111")
    folder_uuid2 = UUID("22222222-2222-2222-2222-222222222222")

    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": str(folder_uuid1),
                "type": "folder",
                "name": "My folder",
                "children": [
                    {
                        "uuid": str(folder_uuid2),
                        "type": "folder",
                        "name": "My other folder",
                        "children": [],
                    },
                ],
            },
            {
                "uuid": str(folder_uuid2),
                "type": "folder",
                "name": "My other folder",
                "children": [
                    {
                        "uuid": str(folder_uuid1),
                        "type": "folder",
                        "name": "My folder",
                        "children": [],
                    },
                ],
            },
        ],
    )

    with pytest.raises(ValidationError) as excinfo:
        validate_folders(folders=folders, valid_uuids=set())
    assert str(excinfo.value) == f"Duplicate UUID in folder structure: {folder_uuid2}"


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_duplicates(mocker: MockerFixture) -> None:
    """
    Test that metrics and columns belong to a single folder.
    """
    from uuid import UUID

    metric_uuid = UUID("22222222-2222-2222-2222-222222222222")
    folder_uuid1 = UUID("11111111-1111-1111-1111-111111111111")
    metrics = [mocker.MagicMock(metric_name="count", uuid=metric_uuid)]
    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": str(folder_uuid1),
                "type": "folder",
                "name": "My folder",
                "children": [
                    {
                        "uuid": str(metric_uuid),
                        "type": "metric",
                        "name": "count",
                    },
                ],
            },
            {
                "uuid": str(metric_uuid),
                "type": "folder",
                "name": "My other folder",
                "children": [
                    {
                        "uuid": str(metric_uuid),
                        "type": "metric",
                        "name": "count",
                    },
                ],
            },
        ],
    )

    with pytest.raises(ValidationError) as excinfo:
        validate_folders(
            folders=folders, valid_uuids={metric.uuid for metric in metrics}
        )
    assert str(excinfo.value) == f"Duplicate UUID in folder structure: {metric_uuid}"


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_duplicate_name_not_siblings(mocker: MockerFixture) -> None:
    """
    Duplicate folder names are allowed if folders are not siblings.
    """
    from uuid import UUID

    uuid1 = UUID("11111111-1111-1111-1111-111111111111")
    uuid2 = UUID("22222222-2222-2222-2222-222222222222")
    uuid3 = UUID("33333333-3333-3333-3333-333333333333")
    uuid4 = UUID("44444444-4444-4444-4444-444444444444")

    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": str(uuid1),
                "type": "folder",
                "name": "Sales",
                "children": [
                    {
                        "uuid": str(uuid2),
                        "type": "folder",
                        "name": "Core",
                        "children": [],
                    },
                ],
            },
            {
                "uuid": str(uuid3),
                "type": "folder",
                "name": "Engineering",
                "children": [
                    {
                        "uuid": str(uuid4),
                        "type": "folder",
                        "name": "Core",
                        "children": [],
                    },
                ],
            },
        ],
    )

    validate_folders(folders=folders, valid_uuids=set())


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_duplicate_name_siblings(mocker: MockerFixture) -> None:
    """
    Duplicate folder names are not allowed if folders are siblings.
    """
    from uuid import UUID

    uuid1 = UUID("11111111-1111-1111-1111-111111111111")
    uuid2 = UUID("22222222-2222-2222-2222-222222222222")
    uuid3 = UUID("33333333-3333-3333-3333-333333333333")
    uuid4 = UUID("44444444-4444-4444-4444-444444444444")

    folders = cast(
        list[FolderSchema],
        [
            {
                "uuid": str(uuid1),
                "type": "folder",
                "name": "Sales",
                "children": [
                    {
                        "uuid": str(uuid2),
                        "type": "folder",
                        "name": "Core",
                        "children": [],
                    },
                ],
            },
            {
                "uuid": str(uuid3),
                "type": "folder",
                "name": "Sales",
                "children": [
                    {
                        "uuid": str(uuid4),
                        "type": "folder",
                        "name": "Other",
                        "children": [],
                    },
                ],
            },
        ],
    )

    with pytest.raises(ValidationError) as excinfo:
        validate_folders(folders=folders, valid_uuids=set())
    assert str(excinfo.value) == "Duplicate folder name: Sales"


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_invalid_names(mocker: MockerFixture) -> None:
    """
    Test that we can detect reserved folder names.
    """
    from uuid import UUID

    uuid1 = UUID("11111111-1111-1111-1111-111111111111")
    uuid2 = UUID("22222222-2222-2222-2222-222222222222")

    folders_with_metrics = cast(
        list[FolderSchema],
        [
            {
                "uuid": str(uuid1),
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
                "uuid": str(uuid2),
                "type": "folder",
                "name": "Columns",
                "children": [],
            },
        ],
    )

    with pytest.raises(ValidationError) as excinfo:
        validate_folders(folders=folders_with_metrics, valid_uuids=set())
    assert str(excinfo.value) == "Folder cannot have name 'Metrics'"

    with pytest.raises(ValidationError) as excinfo:
        validate_folders(folders=folders_with_columns, valid_uuids=set())
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


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_with_new_metrics_only_uses_new_uuids(
    mocker: MockerFixture,
) -> None:
    """
    Test that when new metrics are provided, validation uses only the new metric UUIDs.
    """
    from uuid import UUID

    # Mock existing metrics on the model
    existing_metric_uuid = UUID("11111111-2222-3333-4444-555555555555")
    existing_metrics = [mocker.MagicMock(uuid=existing_metric_uuid)]

    # New metrics in the payload
    new_metric_uuid = UUID("99999999-8888-7777-6666-555555555555")
    new_metrics = [{"uuid": str(new_metric_uuid), "metric_name": "new_metric"}]

    # Folder referencing the new metric (should work)
    folder_uuid_1 = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    folders_with_new = [
        {
            "uuid": str(folder_uuid_1),
            "type": "folder",
            "name": "Test Folder",
            "children": [
                {
                    "uuid": str(new_metric_uuid),
                    "type": "metric",
                    "name": "new_metric",
                }
            ],
        }
    ]

    # Create mock model with existing metrics
    mock_model = mocker.MagicMock()
    mock_model.metrics = existing_metrics
    mock_model.columns = []

    # Test with new metrics - should work
    command = UpdateDatasetCommand(
        1, {"metrics": new_metrics, "folders": folders_with_new}
    )
    command._model = mock_model

    # This should not raise an error
    try:
        command._validate_semantics([])
    except Exception as e:
        pytest.fail(f"Should not have raised an error: {e}")


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_no_new_metrics_uses_existing(mocker: MockerFixture) -> None:
    """
    Test that when no new metrics are provided, existing metrics are used.
    """
    from uuid import UUID

    # Mock existing metrics on the model
    existing_metric_uuid = UUID("11111111-2222-3333-4444-555555555555")
    existing_metrics = [mocker.MagicMock(uuid=existing_metric_uuid)]

    # Folder referencing the existing metric
    folder_uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    folders = [
        {
            "uuid": str(folder_uuid),
            "type": "folder",
            "name": "Test Folder",
            "children": [
                {
                    "uuid": str(existing_metric_uuid),
                    "type": "metric",
                    "name": "existing_metric",
                }
            ],
        }
    ]

    # Create mock model
    mock_model = mocker.MagicMock()
    mock_model.metrics = existing_metrics
    mock_model.columns = []

    # Test without providing new metrics - should use existing ones
    command = UpdateDatasetCommand(1, {"folders": folders})  # No metrics key
    command._model = mock_model

    # This should not raise an error since existing metrics are used
    try:
        command._validate_semantics([])
    except Exception as e:
        pytest.fail(f"Should not have raised an error: {e}")


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_mixed_metrics_and_columns(mocker: MockerFixture) -> None:
    """
    Test validation with both new metrics and new columns.
    """
    from uuid import UUID

    # Mock existing data
    existing_metric_uuid = UUID("11111111-1111-1111-1111-111111111111")
    existing_column_uuid = UUID("22222222-2222-2222-2222-222222222222")
    existing_metrics = [mocker.MagicMock(uuid=existing_metric_uuid)]
    existing_columns = [mocker.MagicMock(uuid=existing_column_uuid)]

    # New data in payload
    new_metric_uuid = UUID("99999999-9999-9999-9999-999999999999")
    new_column_uuid = UUID("88888888-8888-8888-8888-888888888888")
    new_metrics = [{"uuid": str(new_metric_uuid), "metric_name": "new_metric"}]
    new_columns = [{"uuid": str(new_column_uuid), "column_name": "new_column"}]

    # Folders referencing the new data
    folder_uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    folders = [
        {
            "uuid": str(folder_uuid),
            "type": "folder",
            "name": "Mixed Folder",
            "children": [
                {
                    "uuid": str(new_metric_uuid),
                    "type": "metric",
                    "name": "new_metric",
                },
                {
                    "uuid": str(new_column_uuid),
                    "type": "column",
                    "name": "new_column",
                },
            ],
        }
    ]

    # Create mock model
    mock_model = mocker.MagicMock()
    mock_model.metrics = existing_metrics
    mock_model.columns = existing_columns

    # Test with both new metrics and columns
    command = UpdateDatasetCommand(
        1, {"metrics": new_metrics, "columns": new_columns, "folders": folders}
    )
    command._model = mock_model

    # Should work since folders reference the new UUIDs
    try:
        command._validate_semantics([])
    except Exception as e:
        pytest.fail(f"Should not have raised an error: {e}")


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_partial_override(mocker: MockerFixture) -> None:
    """
    Test that providing only new metrics uses new metrics + existing columns,
    and vice versa.
    """
    from uuid import UUID

    # Mock existing data
    existing_metric_uuid = UUID("11111111-1111-1111-1111-111111111111")
    existing_column_uuid = UUID("22222222-2222-2222-2222-222222222222")
    existing_metrics = [mocker.MagicMock(uuid=existing_metric_uuid)]
    existing_columns = [mocker.MagicMock(uuid=existing_column_uuid)]

    # Only new metrics, no new columns
    new_metric_uuid = UUID("99999999-9999-9999-9999-999999999999")
    new_metrics = [{"uuid": str(new_metric_uuid), "metric_name": "new_metric"}]

    # Folders referencing new metric + existing column
    folder_uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    folders = [
        {
            "uuid": str(folder_uuid),
            "type": "folder",
            "name": "Partial Override Folder",
            "children": [
                {
                    "uuid": str(new_metric_uuid),
                    "type": "metric",
                    "name": "new_metric",
                },
                {
                    "uuid": str(existing_column_uuid),
                    "type": "column",
                    "name": "existing_column",
                },
            ],
        }
    ]

    # Create mock model
    mock_model = mocker.MagicMock()
    mock_model.metrics = existing_metrics
    mock_model.columns = existing_columns

    # Test with only new metrics (columns should use existing)
    command = UpdateDatasetCommand(
        1,
        {
            "metrics": new_metrics,  # Override metrics
            # No columns key - should use existing columns
            "folders": folders,
        },
    )
    command._model = mock_model

    # Should work: new metric + existing column
    try:
        command._validate_semantics([])
    except Exception as e:
        pytest.fail(f"Should not have raised an error: {e}")


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_invalid_uuid_format(mocker: MockerFixture) -> None:
    """
    Test that invalid UUID formats are caught properly.
    """
    from uuid import UUID

    # Folder with invalid UUID format
    folder_uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    folders = [
        {
            "uuid": str(folder_uuid),
            "type": "folder",
            "name": "Test Folder",
            "children": [
                {
                    "uuid": "not-a-valid-uuid-format",  # Invalid UUID
                    "type": "metric",
                    "name": "bad_metric",
                }
            ],
        }
    ]

    # Create mock model
    mock_model = mocker.MagicMock()
    mock_model.metrics = []
    mock_model.columns = []

    command = UpdateDatasetCommand(1, {"folders": folders})
    command._model = mock_model

    # The invalid UUID should cause a ValueError to be raised during validation
    with pytest.raises((ValueError, ValidationError)) as exc_info:
        command._validate_semantics([])

    # Should be a ValueError about badly formed UUID
    assert "badly formed hexadecimal UUID string" in str(exc_info.value)


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_uuid_types_enforced(mocker: MockerFixture) -> None:
    """
    Test that the new implementation enforces proper UUID types.
    """
    from uuid import UUID

    # Valid UUID for folders
    folder_uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    metric_uuid = UUID("bbbbbbbb-cccc-dddd-eeee-ffffffffffff")

    # Test with proper UUID - should work
    folders = [
        {
            "uuid": str(folder_uuid),
            "type": "folder",
            "name": "Test Folder",
            "children": [
                {
                    "uuid": str(metric_uuid),
                    "type": "metric",
                    "name": "test_metric",
                }
            ],
        }
    ]

    mock_model = mocker.MagicMock()
    mock_model.metrics = [mocker.MagicMock(uuid=metric_uuid)]
    mock_model.columns = []

    command = UpdateDatasetCommand(1, {"folders": folders})
    command._model = mock_model

    # Should work with proper UUIDs
    try:
        command._validate_semantics([])
    except Exception as e:
        pytest.fail(f"Should not have raised an error with proper UUIDs: {e}")


@with_feature_flags(DATASET_FOLDERS=True)
def test_validate_folders_metrics_vs_columns_behavior(mocker: MockerFixture) -> None:
    """
    Test the specific behavior when providing metrics vs columns in payload.
    """
    from uuid import UUID

    # UUIDs
    folder_uuid = UUID("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
    existing_metric_uuid = UUID("11111111-1111-1111-1111-111111111111")
    existing_column_uuid = UUID("22222222-2222-2222-2222-222222222222")
    new_metric_uuid = UUID("33333333-3333-3333-3333-333333333333")

    # Mock model
    mock_model = mocker.MagicMock()
    mock_model.metrics = [mocker.MagicMock(uuid=existing_metric_uuid)]
    mock_model.columns = [mocker.MagicMock(uuid=existing_column_uuid)]

    # Test 1: No new metrics/columns provided - should use existing ones
    folders_existing = [
        {
            "uuid": str(folder_uuid),
            "type": "folder",
            "name": "Test Folder",
            "children": [
                {
                    "uuid": str(existing_metric_uuid),
                    "type": "metric",
                    "name": "existing_metric",
                },
                {
                    "uuid": str(existing_column_uuid),
                    "type": "column",
                    "name": "existing_column",
                },
            ],
        }
    ]

    command1 = UpdateDatasetCommand(1, {"folders": folders_existing})
    command1._model = mock_model

    try:
        command1._validate_semantics([])
    except Exception as e:
        pytest.fail(f"Should work with existing UUIDs when no new metrics/columns: {e}")

    # Test 2: New metrics provided - test behavior
    new_metrics = [{"uuid": str(new_metric_uuid), "metric_name": "new_metric"}]
    folders_new = [
        {
            "uuid": str(folder_uuid),
            "type": "folder",
            "name": "Test Folder",
            "children": [
                {
                    "uuid": str(new_metric_uuid),
                    "type": "metric",
                    "name": "new_metric",
                }
            ],
        }
    ]

    command2 = UpdateDatasetCommand(1, {"metrics": new_metrics, "folders": folders_new})
    command2._model = mock_model

    try:
        command2._validate_semantics([])
    except Exception as e:
        pytest.fail(f"Should work with new metric UUIDs when new metrics provided: {e}")
