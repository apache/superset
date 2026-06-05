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


def _mock_dataset(catalog: str | None, default_catalog: str) -> MagicMock:
    """A SqlaTable-shaped mock with controllable catalog values."""
    model = MagicMock()
    model.id = 1
    model.database_id = 7
    model.schema = "public"
    model.table_name = "users"
    model.catalog = catalog
    model.database.get_default_catalog.return_value = default_catalog
    return model


def test_has_active_logical_duplicate_normalizes_unset_catalog(
    app_context: None,
) -> None:
    """A row stored with ``catalog = None`` is matched against the database
    default catalog, the same rule ``validate_uniqueness`` applies.

    This is the gap the soft-delete reviews flagged: restore/re-import
    compared the raw stored ``catalog`` while create/update normalized it, so
    a soft-deleted ``catalog = NULL`` row and an active default-catalog twin
    could be treated as different physical tables.
    """
    model = _mock_dataset(catalog=None, default_catalog="default_cat")

    with patch("superset.daos.dataset.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.first.return_value = None

        assert DatasetDAO.has_active_logical_duplicate(model) is False

    # Normalization must consult the database default when catalog is unset.
    model.database.get_default_catalog.assert_called_once()


def test_has_active_logical_duplicate_keeps_explicit_catalog(
    app_context: None,
) -> None:
    """When the row carries an explicit catalog, the default is not consulted."""
    model = _mock_dataset(catalog="explicit_cat", default_catalog="default_cat")

    with patch("superset.daos.dataset.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.first.return_value = None

        assert DatasetDAO.has_active_logical_duplicate(model) is False

    model.database.get_default_catalog.assert_not_called()


def test_has_active_logical_duplicate_true_when_twin_found(
    app_context: None,
) -> None:
    """A matching active row makes the helper report a duplicate."""
    model = _mock_dataset(catalog="explicit_cat", default_catalog="default_cat")

    with patch("superset.daos.dataset.db") as mock_db:
        mock_db.session.query.return_value.filter.return_value.first.return_value = (
            MagicMock()
        )

        assert DatasetDAO.has_active_logical_duplicate(model) is True
