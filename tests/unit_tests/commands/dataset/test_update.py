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

from typing import cast
from unittest.mock import MagicMock

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset import db
from superset.commands.dataset.exceptions import DatasetInvalidError
from superset.commands.dataset.update import UpdateDatasetCommand, validate_folders
from superset.connectors.sqla.models import SqlaTable
from superset.datasets.schemas import FolderSchema
from superset.models.core import Database
from tests.unit_tests.conftest import with_feature_flags


@pytest.mark.usefixture("session")
def test_update_uniqueness_error(mocker: MockerFixture) -> None:
    """
    Test uniqueness validation in dataset update command.
    """
    SqlaTable.metadata.create_all(db.session.get_bind())

    # First, make sure session is clean
    db.session.rollback()

    try:
        # Set up test data
        database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
        bar = SqlaTable(table_name="bar", schema="foo", database=database)
        baz = SqlaTable(table_name="baz", schema="qux", database=database)
        db.session.add_all([database, bar, baz])
        db.session.commit()

        # Set up mocks
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

        # Run the test that should fail
        with pytest.raises(DatasetInvalidError):
            UpdateDatasetCommand(
                bar.id,
                {
                    "table_name": "baz",
                    "schema": "qux",
                },
            ).run()
    except Exception:
        db.session.rollback()
        raise
    finally:
        # Clean up - this will run even if the test fails
        try:
            db.session.query(SqlaTable).filter(
                SqlaTable.table_name.in_(["bar", "baz"]),
                SqlaTable.schema.in_(["foo", "qux"]),
            ).delete(synchronize_session=False)
            db.session.query(Database).filter(Database.database_name == "my_db").delete(
                synchronize_session=False
            )
            db.session.commit()
        except Exception:
            db.session.rollback()


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
