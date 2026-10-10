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
"""Dataset API parity for SqlFilter: schemas, DAO upsert, and delete command."""

from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db
from superset.commands.dataset.exceptions import (
    DatasetFiltersDuplicateValidationError,
    DatasetFiltersExistsValidationError,
    DatasetFiltersNotFoundValidationError,
    DatasetInvalidError,
)
from superset.commands.dataset.sql_filters.delete import DeleteDatasetFilterCommand
from superset.commands.dataset.sql_filters.exceptions import (
    DatasetFilterForbiddenError,
    DatasetFilterNotFoundError,
)
from superset.commands.dataset.update import UpdateDatasetCommand
from superset.connectors.sqla.models import SqlaTable, SqlFilter
from superset.daos.dataset import DatasetDAO
from superset.datasets.schemas import (
    DatasetFiltersPutSchema,
    DatasetPutSchema,
    ImportV1DatasetSchema,
    ImportV1FilterSchema,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.core import Database


def test_filters_put_schema_requires_name_and_expression() -> None:
    with pytest.raises(ValidationError):
        DatasetFiltersPutSchema().load({"filter_name": "active"})
    with pytest.raises(ValidationError):
        DatasetFiltersPutSchema().load({"expression": "status = 1"})

    loaded = DatasetFiltersPutSchema().load(
        {"filter_name": "active", "expression": "status = 1"}
    )
    assert loaded["filter_name"] == "active"
    assert loaded["expression"] == "status = 1"


def test_dataset_put_schema_accepts_filters() -> None:
    loaded = DatasetPutSchema().load(
        {
            "filters": [
                {"filter_name": "active", "expression": "status = 'active'"},
            ]
        }
    )
    assert loaded["filters"][0]["filter_name"] == "active"


def test_import_v1_filter_schema_parses_extra_string() -> None:
    loaded = ImportV1FilterSchema().load(
        {
            "filter_name": "active",
            "expression": "status = 1",
            "extra": '{"certified_by": "me"}',
        }
    )
    assert loaded["extra"] == {"certified_by": "me"}


def test_import_v1_filter_schema_tolerates_malformed_extra() -> None:
    loaded = ImportV1FilterSchema().load(
        {
            "filter_name": "active",
            "expression": "status = 1",
            "extra": "{not-json",
        }
    )
    assert loaded["extra"] is None


def test_import_v1_dataset_schema_accepts_filters() -> None:
    loaded = ImportV1DatasetSchema().load(
        {
            "table_name": "my_table",
            "uuid": str(uuid4()),
            "database_uuid": str(uuid4()),
            "version": "1.0.0",
            "filters": [
                {"filter_name": "active", "expression": "status = 1"},
            ],
        }
    )
    assert loaded["filters"][0]["filter_name"] == "active"


def test_import_v1_dataset_schema_rejects_duplicate_filter_uuids() -> None:
    duplicate = str(uuid4())
    with pytest.raises(ValidationError) as excinfo:
        ImportV1DatasetSchema().load(
            {
                "table_name": "my_table",
                "uuid": str(uuid4()),
                "database_uuid": str(uuid4()),
                "version": "1.0.0",
                "filters": [
                    {
                        "filter_name": "a",
                        "expression": "a = 1",
                        "uuid": duplicate,
                    },
                    {
                        "filter_name": "b",
                        "expression": "b = 1",
                        "uuid": duplicate,
                    },
                ],
            }
        )
    assert "filters" in excinfo.value.messages
    assert duplicate in str(excinfo.value.messages["filters"])


def test_delete_dataset_filter_not_found(mocker: MockerFixture) -> None:
    mocker.patch(
        "superset.commands.dataset.sql_filters.delete.DatasetDAO.find_dataset_filter",
        return_value=None,
    )
    with pytest.raises(DatasetFilterNotFoundError):
        DeleteDatasetFilterCommand(1, 99).run()


def test_delete_dataset_filter_forbidden(mocker: MockerFixture) -> None:
    mock_filter = MagicMock()
    mocker.patch(
        "superset.commands.dataset.sql_filters.delete.DatasetDAO.find_dataset_filter",
        return_value=mock_filter,
    )
    mocker.patch(
        "superset.commands.dataset.sql_filters.delete.security_manager.raise_for_editorship",
        side_effect=SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
                message="forbidden",
                level=ErrorLevel.ERROR,
            )
        ),
    )
    with pytest.raises(DatasetFilterForbiddenError):
        DeleteDatasetFilterCommand(1, 2).run()


def test_delete_dataset_filter_success(mocker: MockerFixture) -> None:
    mock_filter = MagicMock()
    mocker.patch(
        "superset.commands.dataset.sql_filters.delete.DatasetDAO.find_dataset_filter",
        return_value=mock_filter,
    )
    mocker.patch(
        "superset.commands.dataset.sql_filters.delete.security_manager.raise_for_editorship",
    )
    mock_dao_delete = mocker.patch(
        "superset.commands.dataset.sql_filters.delete.DatasetFilterDAO.delete",
    )
    DeleteDatasetFilterCommand(1, 2).run()
    mock_dao_delete.assert_called_once_with([mock_filter])


def test_update_dataset_rejects_duplicate_filter_names(mocker: MockerFixture) -> None:
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_editorship",
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)
    mocker.patch(
        "superset.commands.utils.security_manager.get_user_by_id", return_value=None
    )
    mock_database = mocker.MagicMock()
    mock_database.id = 1
    mock_database.backend = "sqlite"
    mock_database.allow_multi_catalog = False
    mock_database.get_default_catalog.return_value = "catalog"
    mock_dataset = mocker.MagicMock()
    mock_dataset.database = mock_database
    mock_dataset.catalog = "catalog"
    mock_dataset.schema = None
    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.get_database_by_id.return_value = mock_database
    mock_dataset_dao.validate_update_uniqueness.return_value = True

    with pytest.raises(DatasetInvalidError) as excinfo:
        UpdateDatasetCommand(
            1,
            {
                "filters": [
                    {"filter_name": "active", "expression": "a = 1"},
                    {"filter_name": "active", "expression": "b = 1"},
                ]
            },
        ).run()
    assert any(
        isinstance(exc, DatasetFiltersDuplicateValidationError)
        for exc in excinfo.value._exceptions
    )


def test_update_dataset_rejects_missing_filter_ids(mocker: MockerFixture) -> None:
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_editorship",
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)
    mocker.patch(
        "superset.commands.utils.security_manager.get_user_by_id", return_value=None
    )
    mock_database = mocker.MagicMock()
    mock_database.id = 1
    mock_database.backend = "sqlite"
    mock_database.allow_multi_catalog = False
    mock_database.get_default_catalog.return_value = "catalog"
    mock_dataset = mocker.MagicMock()
    mock_dataset.database = mock_database
    mock_dataset.catalog = "catalog"
    mock_dataset.schema = None
    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.get_database_by_id.return_value = mock_database
    mock_dataset_dao.validate_update_uniqueness.return_value = True
    mock_dataset_dao.validate_filters_exist.return_value = False
    mock_dataset_dao.validate_filters_uniqueness.return_value = True

    with pytest.raises(DatasetInvalidError) as excinfo:
        UpdateDatasetCommand(
            1,
            {
                "filters": [
                    {"id": 99, "filter_name": "active", "expression": "a = 1"},
                ]
            },
        ).run()
    assert any(
        isinstance(exc, DatasetFiltersNotFoundValidationError)
        for exc in excinfo.value._exceptions
    )


def test_update_dataset_rejects_existing_filter_names(mocker: MockerFixture) -> None:
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_editorship",
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)
    mocker.patch(
        "superset.commands.utils.security_manager.get_user_by_id", return_value=None
    )
    mock_database = mocker.MagicMock()
    mock_database.id = 1
    mock_database.backend = "sqlite"
    mock_database.allow_multi_catalog = False
    mock_database.get_default_catalog.return_value = "catalog"
    mock_dataset = mocker.MagicMock()
    mock_dataset.database = mock_database
    mock_dataset.catalog = "catalog"
    mock_dataset.schema = None
    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.get_database_by_id.return_value = mock_database
    mock_dataset_dao.validate_update_uniqueness.return_value = True
    mock_dataset_dao.validate_filters_exist.return_value = True
    mock_dataset_dao.validate_filters_uniqueness.return_value = False

    with pytest.raises(DatasetInvalidError) as excinfo:
        UpdateDatasetCommand(
            1,
            {
                "filters": [
                    {"filter_name": "active", "expression": "a = 1"},
                ]
            },
        ).run()
    assert any(
        isinstance(exc, DatasetFiltersExistsValidationError)
        for exc in excinfo.value._exceptions
    )


def _dataset_with_filter(session: Session) -> tuple[SqlaTable, SqlFilter]:
    SqlaTable.metadata.create_all(db.session.get_bind())
    database = Database(database_name="filter_db", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="filter_table", database=database)
    sql_filter = SqlFilter(
        filter_name="active",
        expression="status = 'active'",
        table=dataset,
    )
    db.session.add(dataset)
    db.session.add(sql_filter)
    db.session.flush()
    return dataset, sql_filter


def test_dao_update_filters_creates_updates_and_deletes(session: Session) -> None:
    dataset, existing = _dataset_with_filter(session)
    DatasetDAO.update_filters(
        dataset,
        [
            {
                "id": existing.id,
                "filter_name": "active",
                "expression": "status = 'yes'",
            },
            {"filter_name": "vip", "expression": "tier = 'vip'"},
        ],
    )
    db.session.flush()
    db.session.refresh(dataset)

    names = {
        sql_filter.filter_name: sql_filter.expression for sql_filter in dataset.filters
    }
    assert names["active"] == "status = 'yes'"
    assert names["vip"] == "tier = 'vip'"
    assert len(dataset.filters) == 2


def test_dao_validate_filters_exist_and_uniqueness(session: Session) -> None:
    dataset, existing = _dataset_with_filter(session)
    assert DatasetDAO.validate_filters_exist(dataset.id, [existing.id]) is True
    assert DatasetDAO.validate_filters_exist(dataset.id, [existing.id, 999999]) is False
    assert DatasetDAO.validate_filters_uniqueness(dataset.id, ["missing"]) is True
    assert DatasetDAO.validate_filters_uniqueness(dataset.id, ["active"]) is False


def test_find_dataset_filter_requires_matching_dataset(
    session: Session, mocker: MockerFixture
) -> None:
    dataset, existing = _dataset_with_filter(session)
    other = SqlaTable(table_name="other_table", database=dataset.database)
    db.session.add(other)
    db.session.flush()

    mocker.patch.object(DatasetDAO, "find_by_id", return_value=dataset)
    assert DatasetDAO.find_dataset_filter(dataset.id, existing.id) is existing

    mocker.patch.object(DatasetDAO, "find_by_id", return_value=other)
    assert DatasetDAO.find_dataset_filter(other.id, existing.id) is None


def test_sqla_table_data_includes_filters(session: Session) -> None:
    dataset, existing = _dataset_with_filter(session)
    payload = dataset.data
    assert any(
        item["filter_name"] == existing.filter_name and item["id"] == existing.id
        for item in payload["filters"]
    )
