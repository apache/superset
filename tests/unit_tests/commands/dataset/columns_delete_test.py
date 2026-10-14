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
"""
`DELETE /api/v1/dataset/<pk>/column/<column_id>` removes a column without
going through `DatasetDAO.update`, so the partition filter mapping's repairs
have to be invoked by the command itself.
"""

from __future__ import annotations

from flask_appbuilder.security.sqla.models import Role, User
from marshmallow import ValidationError
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session

from superset.commands.dataset.columns.delete import DeleteDatasetColumnCommand
from superset.commands.dataset.update import UpdateDatasetCommand
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.daos.dataset import DatasetDAO
from superset.extensions import db
from superset.models.core import Database
from superset.utils.core import override_user
from tests.unit_tests.conftest import with_feature_flags


def _admin() -> User:
    return User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )


def _mapped_dataset() -> SqlaTable:
    """A persisted dataset mapping `event_time` onto the `dt_epoch` partition."""
    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member
    database = Database(database_name="pfm_coldel_db", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    dataset = SqlaTable(
        table_name="pfm_coldel",
        database=database,
        schema="main",
        main_dttm_col="event_time",
        columns=[
            TableColumn(column_name="event_time", is_dttm=True, type="TIMESTAMP"),
            TableColumn(column_name="dt_epoch", type="BIGINT"),
        ],
    )
    dataset.partition_column = "dt_epoch"
    dataset.partition_mapped_column = "event_time"
    dataset.columns[0].partition_value_transform = "unix_timestamp(:value)"
    dataset.columns[0].partition_transform_is_monotonic = True
    with override_user(_admin()):
        db.session.add(dataset)
        db.session.flush()
    return dataset


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_deleting_the_partition_column_clears_the_mapping(
    mocker: MockerFixture, session: Session
) -> None:
    """
    Deleting the designated partition column through this endpoint left
    `partition_column` naming a column that is gone, so the dataset could not
    be saved again.
    """
    dataset = _mapped_dataset()
    partition_column = next(
        column for column in dataset.columns if column.column_name == "dt_epoch"
    )
    mocker.patch(
        "superset.commands.dataset.columns.delete.security_manager.raise_for_editorship"
    )
    # Only the dataset lookup is stubbed: `find_dataset_column` resolves the
    # column through `DatasetDAO.find_by_id`, which applies an ownership filter
    # these tests have no real logged-in user for. The column query itself, and
    # both repair helpers, stay real -- they are what is under test.
    mocker.patch.object(DatasetDAO, "find_by_id", return_value=dataset)

    with override_user(_admin()):
        DeleteDatasetColumnCommand(dataset.id, partition_column.id).run()

    assert dataset.partition_column is None
    assert dataset.partition_mapped_column is None


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_a_description_only_put_survives_the_column_delete(
    mocker: MockerFixture, session: Session
) -> None:
    """
    The repair is what keeps the dataset editable: a later PUT carrying no
    `columns` payload validates against the model's remaining columns, so an
    unrepaired reference made every ordinary edit fail.
    """
    dataset = _mapped_dataset()
    partition_column = next(
        column for column in dataset.columns if column.column_name == "dt_epoch"
    )
    mocker.patch(
        "superset.commands.dataset.columns.delete.security_manager.raise_for_editorship"
    )
    # Only the dataset lookup is stubbed: `find_dataset_column` resolves the
    # column through `DatasetDAO.find_by_id`, which applies an ownership filter
    # these tests have no real logged-in user for. The column query itself, and
    # both repair helpers, stay real -- they are what is under test.
    mocker.patch.object(DatasetDAO, "find_by_id", return_value=dataset)
    mocker.patch("superset.commands.dataset.update.validate_stored_expression")

    with override_user(_admin()):
        DeleteDatasetColumnCommand(dataset.id, partition_column.id).run()

    command = UpdateDatasetCommand(dataset.id, {"description": "just a note"})
    command._model = dataset  # noqa: SLF001
    exceptions: list[ValidationError] = []
    command._validate_partition_mapping(exceptions)  # noqa: SLF001

    assert exceptions == []


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_deleting_the_mapped_column_disarms_the_transform_left_behind(
    mocker: MockerFixture, session: Session
) -> None:
    """
    The dangling repair can *move* which column is mapped -- dropping the
    mapped column clears the override and the mapping falls back to
    `main_dttm_col` -- which is why the second call runs against the mapping it
    leaves behind, as `RefreshDatasetCommand` does.
    """
    dataset = _mapped_dataset()
    parked = TableColumn(column_name="other_time", is_dttm=True, type="TIMESTAMP")
    parked.partition_value_transform = "to_unixtime(:value)"
    parked.partition_transform_is_monotonic = True
    dataset.columns.append(parked)
    dataset.main_dttm_col = "other_time"
    with override_user(_admin()):
        db.session.flush()

    mapped_column = next(
        column for column in dataset.columns if column.column_name == "event_time"
    )
    mocker.patch(
        "superset.commands.dataset.columns.delete.security_manager.raise_for_editorship"
    )
    # Only the dataset lookup is stubbed: `find_dataset_column` resolves the
    # column through `DatasetDAO.find_by_id`, which applies an ownership filter
    # these tests have no real logged-in user for. The column query itself, and
    # both repair helpers, stay real -- they are what is under test.
    mocker.patch.object(DatasetDAO, "find_by_id", return_value=dataset)

    with override_user(_admin()):
        DeleteDatasetColumnCommand(dataset.id, mapped_column.id).run()

    transforms = {
        column.column_name: column.partition_value_transform
        for column in dataset.columns
    }
    assert transforms["other_time"] is None
