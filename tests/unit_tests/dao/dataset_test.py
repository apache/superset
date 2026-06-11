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

import copy
from datetime import datetime
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from freezegun import freeze_time
from sqlalchemy.orm.session import Session

from superset.daos.base import BaseDAO
from superset.daos.dataset import DatasetDAO
from superset.sql.parse import Table


def test_validate_update_uniqueness(session: Session) -> None:
    """
    Test the `validate_update_uniqueness` static method.

    In particular, allow datasets with the same name in the same database as long as they
    are in different schemas
    """  # noqa: E501
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    dataset1 = SqlaTable(
        table_name="my_dataset",
        schema="main",
        database=database,
    )
    dataset2 = SqlaTable(
        table_name="my_dataset",
        schema="dev",
        database=database,
    )
    db.session.add_all([database, dataset1, dataset2])
    db.session.flush()

    assert (
        DatasetDAO.validate_update_uniqueness(
            database=database,
            table=Table(dataset1.table_name, dataset1.schema),
            dataset_id=dataset1.id,
        )
        is True
    )

    assert (
        DatasetDAO.validate_update_uniqueness(
            database=database,
            table=Table(dataset1.table_name, dataset2.schema),
            dataset_id=dataset1.id,
        )
        is False
    )

    assert (
        DatasetDAO.validate_update_uniqueness(
            database=database,
            table=Table(dataset1.table_name),
            dataset_id=dataset1.id,
        )
        is True
    )


@freeze_time("2025-01-01 00:00:00")
@patch.object(DatasetDAO, "update_columns")
@patch.object(DatasetDAO, "update_metrics")
@patch.object(BaseDAO, "update")
@pytest.mark.parametrize(
    "attributes,expected_attributes",
    [
        (
            {
                "columns": [{"id": 1, "name": "col1"}],
                "metrics": [{"id": 1, "name": "metric1"}],
            },
            {"changed_on": datetime(2025, 1, 1, 0, 0, 0)},
        ),
        (
            {
                "columns": [{"id": 1, "name": "col1"}],
                "metrics": [{"id": 1, "name": "metric1"}],
                "description": "test description",
            },
            {
                "description": "test description",
                "changed_on": datetime(2025, 1, 1, 0, 0, 0),
            },
        ),
        (
            {
                "columns": [{"id": 1, "name": "col1"}],
            },
            {"changed_on": datetime(2025, 1, 1, 0, 0, 0)},
        ),
        (
            {
                "columns": [{"id": 1, "name": "col1"}],
                "description": "test description",
            },
            {
                "description": "test description",
                "changed_on": datetime(2025, 1, 1, 0, 0, 0),
            },
        ),
        (
            {
                "metrics": [{"id": 1, "name": "metric1"}],
            },
            {"changed_on": datetime(2025, 1, 1, 0, 0, 0)},
        ),
        (
            {
                "metrics": [{"id": 1, "name": "metric1"}],
                "description": "test description",
            },
            {
                "description": "test description",
                "changed_on": datetime(2025, 1, 1, 0, 0, 0),
            },
        ),
        (
            {"description": "test description"},
            {"description": "test description"},
        ),
    ],
)
def test_update_dataset_related_metadata_updates_changed_on(
    base_update_mock: MagicMock,
    update_metrics_mock: MagicMock,
    update_columns_mock: MagicMock,
    attributes: dict[str, Any],
    expected_attributes: dict[str, Any],
) -> None:
    """
    Test that the changed_on property is updated when a metric or column is updated.
    """
    item = MagicMock()
    DatasetDAO.update(item, copy.deepcopy(attributes))

    if "columns" in attributes:
        update_columns_mock.assert_called_once_with(
            item, attributes["columns"], override_columns=False
        )
    else:
        update_columns_mock.assert_not_called()

    if "metrics" in attributes:
        update_metrics_mock.assert_called_once_with(item, attributes["metrics"])
    else:
        update_metrics_mock.assert_not_called()

    base_update_mock.assert_called_once_with(item, expected_attributes)


def test_override_columns_ignores_payload_pk(session: Session) -> None:
    """``_override_columns`` matches by natural key (``column_name``) and
    must never honour a payload ``id``: setattr-ing it onto a name-matched
    row would rewrite a live primary key, and a *renamed* column whose
    payload still carries its old ``id`` would INSERT with a live PK while
    the old-named row is deleted in the same flush — INSERTs flush before
    DELETEs, so that collides on the PK constraint (sqlalchemy-review #6).
    """
    from superset import db
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(
        table_name="my_dataset",
        database=database,
        columns=[
            TableColumn(column_name="kept"),
            TableColumn(column_name="renamed_from"),
        ],
    )
    db.session.add_all([database, dataset])
    db.session.flush()
    kept_pk = dataset.columns[0].id
    renamed_pk = dataset.columns[1].id

    DatasetDAO._override_columns(
        dataset,
        [
            # Foreign id on a name-matched column: must not rewrite the PK.
            {"column_name": "kept", "id": 99999, "verbose_name": "Kept"},
            # Rename carrying the old row's live id: must INSERT with a
            # fresh PK (pre-fix this raised IntegrityError mid-flush).
            {"column_name": "renamed_to", "id": renamed_pk},
        ],
    )
    db.session.flush()

    # Query the table directly: the new row is added via its ``table_id``
    # FK, not appended to the (now stale) ``dataset.columns`` collection.
    columns_by_name = {
        c.column_name: c
        for c in db.session.query(TableColumn).filter(
            TableColumn.table_id == dataset.id
        )
    }
    assert set(columns_by_name) == {"kept", "renamed_to"}
    assert columns_by_name["kept"].id == kept_pk
    assert columns_by_name["kept"].verbose_name == "Kept"
    assert columns_by_name["renamed_to"].id != renamed_pk
