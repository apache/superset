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
Additional tests for SQL validation in UpdateDatasetCommand.

These tests specifically cover the _validate_sql_access method added to validate
user permissions when updating dataset SQL queries.
"""

import pytest
from pytest_mock import MockerFixture

from superset.commands.dataset.exceptions import (
    DatasetInvalidError,
)
from superset.commands.dataset.update import UpdateDatasetCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetParseError, SupersetSecurityException


def test_update_dataset_sql_skips_validation_when_no_sql(
    mocker: MockerFixture,
) -> None:
    """
    Test that SQL validation is skipped when SQL is not in the update payload.
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
    mock_dataset.owners = []

    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.validate_update_uniqueness.return_value = True
    mock_dataset_dao.update.return_value = mock_dataset

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership"
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)

    # Mock raise_for_access - it should NOT be called
    mock_raise_for_access = mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_access"
    )

    # Update without SQL - just change description
    result = UpdateDatasetCommand(1, {"description": "Updated description"}).run()

    assert result == mock_dataset
    # Verify raise_for_access was NOT called since no SQL in payload
    mock_raise_for_access.assert_not_called()


def test_update_dataset_sql_calls_security_check(mocker: MockerFixture) -> None:
    """
    Test that SQL validation calls security manager with correct parameters.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mock_database = mocker.MagicMock()
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = "main_catalog"
    mock_database.allow_multi_catalog = False

    mock_dataset = mocker.MagicMock()
    mock_dataset.database = mock_database
    mock_dataset.catalog = "main_catalog"
    mock_dataset.schema = "analytics"
    mock_dataset.table_name = "users"
    mock_dataset.owners = []

    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.validate_update_uniqueness.return_value = True
    mock_dataset_dao.update.return_value = mock_dataset

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership"
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)

    mock_raise_for_access = mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_access"
    )

    # Update with SQL
    UpdateDatasetCommand(1, {"sql": "SELECT * FROM analytics.users"}).run()

    # Verify raise_for_access was called with correct parameters
    mock_raise_for_access.assert_called_once_with(
        database=mock_database,
        schema="analytics",
        catalog="main_catalog",
    )


def test_update_dataset_sql_with_parse_error(mocker: MockerFixture) -> None:
    """
    Test that SQL parse errors are caught and converted to ValidationError.
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
    mock_dataset.owners = []

    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.validate_update_uniqueness.return_value = True

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership"
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)

    # Mock parse error
    parse_error = SupersetParseError("Invalid SQL syntax: unexpected token")
    parse_error.error = SupersetError(
        error_type=SupersetErrorType.INVALID_SQL_ERROR,
        message="Invalid SQL syntax: unexpected token",
        level=ErrorLevel.ERROR,
    )
    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_access",
        side_effect=parse_error,
    )

    # Try to update with invalid SQL
    with pytest.raises(DatasetInvalidError) as excinfo:
        UpdateDatasetCommand(1, {"sql": "SELECT FROM WHERE"}).run()

    # Verify the error message contains parse error information
    errors = excinfo.value._exceptions
    assert len(errors) > 0
    assert any("Invalid SQL" in str(err) for err in errors)


def test_update_dataset_sql_with_different_schemas(mocker: MockerFixture) -> None:
    """
    Test SQL validation uses the correct schema from the update payload.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mock_database = mocker.MagicMock()
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = "catalog"
    mock_database.allow_multi_catalog = False

    mock_dataset = mocker.MagicMock()
    mock_dataset.database = mock_database
    mock_dataset.catalog = "catalog"
    mock_dataset.schema = "old_schema"
    mock_dataset.table_name = "test_table"
    mock_dataset.owners = []

    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.validate_update_uniqueness.return_value = True
    mock_dataset_dao.update.return_value = mock_dataset

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership"
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)

    mock_raise_for_access = mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_access"
    )

    # Update both schema and SQL - should validate against NEW schema
    UpdateDatasetCommand(
        1, {"schema": "new_schema", "sql": "SELECT * FROM new_schema.table"}
    ).run()

    # Verify raise_for_access was called with the NEW schema
    mock_raise_for_access.assert_called_once_with(
        database=mock_database,
        schema="new_schema",
        catalog="catalog",
    )


def test_update_dataset_sql_with_database_change(mocker: MockerFixture) -> None:
    """
    Test SQL validation uses the new database when database_id is changed.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")

    old_database = mocker.MagicMock()
    old_database.id = 1
    old_database.get_default_catalog.return_value = "old_catalog"
    old_database.allow_multi_catalog = False

    new_database = mocker.MagicMock()
    new_database.id = 2
    new_database.get_default_catalog.return_value = "new_catalog"
    new_database.allow_multi_catalog = False

    mock_dataset = mocker.MagicMock()
    mock_dataset.database = old_database
    mock_dataset.catalog = "old_catalog"
    mock_dataset.schema = "public"
    mock_dataset.table_name = "test_table"
    mock_dataset.owners = []

    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.get_database_by_id.return_value = new_database
    mock_dataset_dao.validate_update_uniqueness.return_value = True
    mock_dataset_dao.update.return_value = mock_dataset

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership"
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)

    mock_raise_for_access = mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_access"
    )

    # Update database and SQL - should validate against NEW database
    UpdateDatasetCommand(
        1, {"database_id": 2, "sql": "SELECT * FROM public.table"}
    ).run()

    # Verify raise_for_access was called with the NEW database and catalog
    mock_raise_for_access.assert_called_once_with(
        database=new_database,
        schema="public",
        catalog="new_catalog",
    )


def test_update_dataset_sql_security_exception_includes_message(
    mocker: MockerFixture,
) -> None:
    """
    Test that the security exception message is preserved in the validation error.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mock_database = mocker.MagicMock()
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = "catalog"
    mock_database.allow_multi_catalog = False

    mock_dataset = mocker.MagicMock()
    mock_dataset.database = mock_database
    mock_dataset.catalog = "catalog"
    mock_dataset.schema = "restricted"
    mock_dataset.table_name = "test_table"
    mock_dataset.owners = []

    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.validate_update_uniqueness.return_value = True

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership"
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)

    # Mock security exception with specific message
    custom_error_message = "Access denied to restricted schema for user gamma"
    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                message=custom_error_message,
                level=ErrorLevel.ERROR,
            )
        ),
    )

    # Try to update with SQL querying restricted schema
    with pytest.raises(DatasetInvalidError) as excinfo:
        UpdateDatasetCommand(1, {"sql": "SELECT * FROM restricted.data"}).run()

    # Verify the custom error message is in the exception
    errors = excinfo.value._exceptions
    assert len(errors) > 0
    assert any(custom_error_message in str(err) for err in errors)


@pytest.mark.parametrize(
    ("sql_query", "expected_schema", "expected_catalog"),
    [
        ("SELECT * FROM public.users", "public", "catalog"),
        ("SELECT id FROM analytics.events", "analytics", "catalog"),
        (None, "public", "catalog"),  # No SQL, uses existing schema
    ],
)
def test_update_dataset_sql_validation_with_various_queries(
    sql_query: str | None,
    expected_schema: str,
    expected_catalog: str,
    mocker: MockerFixture,
) -> None:
    """
    Parametrized test for SQL validation with different query patterns.
    """
    mock_dataset_dao = mocker.patch("superset.commands.dataset.update.DatasetDAO")
    mock_database = mocker.MagicMock()
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = "catalog"
    mock_database.allow_multi_catalog = False

    mock_dataset = mocker.MagicMock()
    mock_dataset.database = mock_database
    mock_dataset.catalog = "catalog"
    mock_dataset.schema = expected_schema
    mock_dataset.table_name = "test_table"
    mock_dataset.owners = []

    mock_dataset_dao.find_by_id.return_value = mock_dataset
    mock_dataset_dao.validate_update_uniqueness.return_value = True
    mock_dataset_dao.update.return_value = mock_dataset

    mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_ownership"
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)

    mock_raise_for_access = mocker.patch(
        "superset.commands.dataset.update.security_manager.raise_for_access"
    )

    payload = {}
    if sql_query:
        payload["sql"] = sql_query

    UpdateDatasetCommand(1, payload).run()

    if sql_query:
        # SQL validation should be called
        mock_raise_for_access.assert_called_once_with(
            database=mock_database,
            schema=expected_schema,
            catalog=expected_catalog,
        )
    else:
        # No SQL, validation should not be called
        mock_raise_for_access.assert_not_called()
