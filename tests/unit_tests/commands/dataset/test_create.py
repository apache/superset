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
from unittest.mock import Mock, patch

import pytest
from marshmallow import ValidationError

from superset.commands.dataset.create import CreateDatasetCommand
from superset.commands.dataset.exceptions import DatasetInvalidError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetParseError
from superset.models.core import Database


def test_create_dataset_invalid_sql_parse_error():
    """Test that invalid SQL returns a 4xx error when caught as SupersetParseError."""
    mock_database = Mock(spec=Database)
    mock_database.id = 1
    mock_database.db_engine_spec.engine = "postgresql"
    mock_database.get_default_catalog.return_value = None

    with patch(
        "superset.commands.dataset.create.DatasetDAO.get_database_by_id",
        return_value=mock_database,
    ):
        with patch(
            "superset.commands.dataset.create.DatasetDAO.validate_uniqueness",
            return_value=True,
        ):
            with patch(
                "superset.commands.dataset.create.security_manager.raise_for_access",
                side_effect=SupersetParseError(
                    sql="SELECT INVALID SQL SYNTAX",
                    engine="postgresql",
                    message="Invalid SQL syntax: unexpected token 'INVALID'",
                ),
            ):
                with patch(
                    "superset.commands.dataset.create.CreateDatasetCommand.populate_owners",
                    return_value=[],
                ):
                    command = CreateDatasetCommand(
                        {
                            "database": 1,
                            "table_name": "test_virtual_dataset",
                            "sql": "SELECT INVALID SQL SYNTAX",
                        }
                    )

                    with pytest.raises(DatasetInvalidError) as exc_info:
                        command.validate()

                    # Verify the exception contains the correct validation error
                    validation_errors = exc_info.value._exceptions
                    assert len(validation_errors) == 1
                    assert isinstance(validation_errors[0], ValidationError)
                    assert validation_errors[0].field_name == "sql"
                    assert "Invalid SQL:" in str(validation_errors[0].messages[0])
                    assert "unexpected token 'INVALID'" in str(
                        validation_errors[0].messages[0]
                    )


def test_create_dataset_valid_sql_with_access_error():
    """
    Test that security exceptions work correctly
    """
    mock_database = Mock(spec=Database)
    mock_database.id = 1
    mock_database.db_engine_spec.engine = "postgresql"
    mock_database.get_default_catalog.return_value = None

    from superset.exceptions import SupersetSecurityException

    with patch(
        "superset.commands.dataset.create.DatasetDAO.get_database_by_id",
        return_value=mock_database,
    ):
        with patch(
            "superset.commands.dataset.create.DatasetDAO.validate_uniqueness",
            return_value=True,
        ):
            with patch(
                "superset.commands.dataset.create.security_manager.raise_for_access",
                side_effect=SupersetSecurityException(
                    SupersetError(
                        error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                        message="User does not have access to table 'secret_table'",
                        level=ErrorLevel.ERROR,
                    )
                ),
            ):
                with patch(
                    "superset.commands.dataset.create.CreateDatasetCommand.populate_owners",
                    return_value=[],
                ):
                    command = CreateDatasetCommand(
                        {
                            "database": 1,
                            "table_name": "test_virtual_dataset",
                            "sql": "SELECT * FROM secret_table",
                        }
                    )

                    with pytest.raises(DatasetInvalidError) as exc_info:
                        command.validate()

                    # Verify the security error is handled correctly (existing behavior)
                    validation_errors = exc_info.value._exceptions
                    assert len(validation_errors) == 1
                    # This should be a DatasetDataAccessIsNotAllowed error
                    from superset.commands.dataset.exceptions import (
                        DatasetDataAccessIsNotAllowed,
                    )

                    assert isinstance(
                        validation_errors[0], DatasetDataAccessIsNotAllowed
                    )
                    assert validation_errors[0].field_name == "sql"
                    assert "User does not have access to table 'secret_table'" in str(
                        validation_errors[0].messages[0]
                    )


def test_create_dataset_physical_table_no_parse_error():
    """Test that physical tables (no SQL) don't trigger parsing."""
    mock_database = Mock(spec=Database)
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = None

    with patch(
        "superset.commands.dataset.create.DatasetDAO.get_database_by_id",
        return_value=mock_database,
    ):
        with patch(
            "superset.commands.dataset.create.DatasetDAO.validate_uniqueness",
            return_value=True,
        ):
            with patch(
                "superset.commands.dataset.create.DatasetDAO.validate_table_exists",
                return_value=True,
            ):
                with patch(
                    "superset.commands.dataset.create.CreateDatasetCommand.populate_owners",
                    return_value=[],
                ):
                    command = CreateDatasetCommand(
                        {
                            "database": 1,
                            "table_name": "physical_table",
                            # No SQL provided - this is a physical table
                        }
                    )

                    # Should not raise any parsing errors
                    command.validate()
