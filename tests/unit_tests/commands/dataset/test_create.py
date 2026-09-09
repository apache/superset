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
from pytest_mock import MockerFixture

from superset.commands.dataset.create import CreateDatasetCommand
from superset.commands.dataset.exceptions import DatasetInvalidError
from superset.db_engine_specs.exceptions import SupersetDBAPIConnectionError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetGenericDBErrorException,
    SupersetParseError,
    SupersetTimeoutException,
)
from superset.models.core import Database


def test_create_dataset_invalid_sql_parse_error() -> None:
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
                    "superset.commands.dataset.create.populate_subjects",
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


def test_create_dataset_valid_sql_with_access_error() -> None:
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
                    "superset.commands.dataset.create.populate_subjects",
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


@patch("superset.commands.dataset.create.security_manager")
def test_create_dataset_physical_table_no_parse_error(
    mock_security_manager: Mock,
) -> None:
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
                    "superset.commands.dataset.create.populate_subjects",
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


def test_create_dataset_blocked_by_soft_deleted_twin() -> None:
    """Uniqueness failure caused by a hidden twin raises the targeted,
    single-sourced 422 (naming the twin's uuid and the restore endpoint)
    instead of the opaque "already exists" validation error."""
    from superset.commands.dataset.exceptions import (
        DatasetSoftDeletedTwinExistsError,
    )

    mock_database = Mock(spec=Database)
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = None
    twin = Mock()
    twin.uuid = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"

    with patch(
        "superset.commands.dataset.create.DatasetDAO.get_database_by_id",
        return_value=mock_database,
    ):
        with patch(
            "superset.commands.dataset.create.DatasetDAO.validate_uniqueness",
            return_value=False,
        ):
            with patch(
                "superset.commands.dataset.create."
                "DatasetDAO.find_soft_deleted_logical_duplicate",
                return_value=twin,
            ):
                command = CreateDatasetCommand(
                    {"database": 1, "table_name": "blocked_tbl"}
                )
                with pytest.raises(DatasetSoftDeletedTwinExistsError) as exc_info:
                    command.validate()

    message = str(exc_info.value)
    assert "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" in message
    assert "restore" in message.lower()
    # Executable recoveries only — no hard-delete/purge claims.
    assert "hard-delete" not in message.lower()
    assert "purge" not in message.lower()


def test_create_dataset_generic_exists_error_when_no_twin() -> None:
    """Control: uniqueness failure with no hidden twin keeps the existing
    generic validation-error path."""
    mock_database = Mock(spec=Database)
    mock_database.id = 1
    mock_database.get_default_catalog.return_value = None

    with patch(
        "superset.commands.dataset.create.DatasetDAO.get_database_by_id",
        return_value=mock_database,
    ):
        with patch(
            "superset.commands.dataset.create.DatasetDAO.validate_uniqueness",
            return_value=False,
        ):
            with patch(
                "superset.commands.dataset.create."
                "DatasetDAO.find_soft_deleted_logical_duplicate",
                return_value=None,
            ):
                with patch(
                    "superset.commands.dataset.create.DatasetDAO.validate_table_exists",
                    return_value=True,
                ):
                    with patch(
                        "superset.commands.dataset.create."
                        "security_manager.raise_for_access",
                    ):
                        with patch(
                            "superset.commands.dataset.create.populate_subjects",
                        ):
                            command = CreateDatasetCommand(
                                {"database": 1, "table_name": "existing_tbl"}
                            )
                            with pytest.raises(DatasetInvalidError):
                                command.validate()


def test_create_dataset_metadata_fetch_error_is_structured(
    mocker: MockerFixture,
) -> None:
    """A metadata-fetch failure must surface the engine's own message.

    ``run()`` executes the SQL to introspect columns; the resulting
    ``SupersetGenericDBErrorException`` used to escape as a 500 "Fatal error".
    """
    mocker.patch.object(CreateDatasetCommand, "validate")
    dataset = Mock()
    dataset.fetch_metadata.side_effect = SupersetGenericDBErrorException(
        message="Invalid SQL: Unable to parse: SELECT ...",
    )
    mocker.patch(
        "superset.commands.dataset.create.DatasetDAO.create",
        return_value=dataset,
    )

    command = CreateDatasetCommand(
        {
            "database": 1,
            "table_name": "dataset wrong",
            "sql": "SELECT ...",
        }
    )

    with pytest.raises(DatasetInvalidError) as exc_info:
        command.run()

    validation_errors = exc_info.value._exceptions
    assert len(validation_errors) == 1
    assert validation_errors[0].field_name == "sql"
    assert "Invalid SQL: Unable to parse: SELECT ..." in str(
        validation_errors[0].messages[0]
    )


def test_create_dataset_metadata_fetch_error_physical_table(
    mocker: MockerFixture,
) -> None:
    """The same conversion applies to physical datasets, keyed on ``table``."""
    mocker.patch.object(CreateDatasetCommand, "validate")
    dataset = Mock()
    dataset.fetch_metadata.side_effect = SupersetGenericDBErrorException(
        message="(psycopg2.OperationalError) could not connect to server",
    )
    mocker.patch(
        "superset.commands.dataset.create.DatasetDAO.create",
        return_value=dataset,
    )

    command = CreateDatasetCommand({"database": 1, "table_name": "physical_table"})

    with pytest.raises(DatasetInvalidError) as exc_info:
        command.run()

    validation_errors = exc_info.value._exceptions
    assert validation_errors[0].field_name == "table"
    assert "could not connect to server" in str(validation_errors[0].messages[0])


def test_create_dataset_oauth2_redirect_propagates_unchanged(
    mocker: MockerFixture,
) -> None:
    """OAuth2 redirects must not be flattened into a DatasetInvalidError."""
    mocker.patch.object(CreateDatasetCommand, "validate")
    dataset = Mock()
    oauth2_error = OAuth2RedirectError(
        url="https://example.org/oauth2/authorize",
        tab_id="tab-123",
        redirect_uri="https://superset.example.org/oauth2/redirect",
    )
    dataset.fetch_metadata.side_effect = oauth2_error
    mocker.patch(
        "superset.commands.dataset.create.DatasetDAO.create",
        return_value=dataset,
    )

    command = CreateDatasetCommand(
        {"database": 1, "table_name": "good_dataset", "sql": "SELECT 1 AS a"}
    )

    with pytest.raises(OAuth2RedirectError) as exc_info:
        command.run()

    assert exc_info.value is oauth2_error
    assert exc_info.value.error.extra["url"] == "https://example.org/oauth2/authorize"
    assert exc_info.value.error.extra["tab_id"] == "tab-123"


def test_create_dataset_timeout_propagates_unchanged(
    mocker: MockerFixture,
) -> None:
    """A query timeout is an infra failure, not bad user input: it must not
    be flattened into a 422 DatasetInvalidError on ``table``/``sql``."""
    mocker.patch.object(CreateDatasetCommand, "validate")
    dataset = Mock()
    timeout_error = SupersetTimeoutException(
        error_type=SupersetErrorType.CONNECTION_DATABASE_TIMEOUT,
        message="Connection timed out",
        level=ErrorLevel.ERROR,
    )
    dataset.fetch_metadata.side_effect = timeout_error
    mocker.patch(
        "superset.commands.dataset.create.DatasetDAO.create",
        return_value=dataset,
    )

    command = CreateDatasetCommand({"database": 1, "table_name": "physical_table"})

    with pytest.raises(SupersetTimeoutException) as exc_info:
        command.run()

    assert exc_info.value is timeout_error


def test_create_dataset_connection_error_propagates_unchanged(
    mocker: MockerFixture,
) -> None:
    """An unreachable database must not be reported as an invalid table name."""
    mocker.patch.object(CreateDatasetCommand, "validate")
    dataset = Mock()
    connection_error = SupersetDBAPIConnectionError(
        "could not connect to server: Connection refused"
    )
    dataset.fetch_metadata.side_effect = connection_error
    mocker.patch(
        "superset.commands.dataset.create.DatasetDAO.create",
        return_value=dataset,
    )

    command = CreateDatasetCommand({"database": 1, "table_name": "physical_table"})

    with pytest.raises(SupersetDBAPIConnectionError) as exc_info:
        command.run()

    assert exc_info.value is connection_error


def test_create_dataset_run_succeeds_when_metadata_fetch_works(
    mocker: MockerFixture,
) -> None:
    """Control: the happy path still returns the created dataset."""
    mocker.patch.object(CreateDatasetCommand, "validate")
    dataset = Mock()
    mocker.patch(
        "superset.commands.dataset.create.DatasetDAO.create",
        return_value=dataset,
    )

    command = CreateDatasetCommand(
        {"database": 1, "table_name": "good_dataset", "sql": "SELECT 1 AS a"}
    )

    assert command.run() is dataset
    dataset.fetch_metadata.assert_called_once()
