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

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.exceptions import (
    DatabaseOfflineError,
    DatabaseTestConnectionFailedError,
    InvalidParametersError,
)
from superset.commands.database.validate import ValidateDatabaseParametersCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType


def test_command(mocker: MockerFixture) -> None:
    """
    Test the happy path of the command.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True

    DatabaseDAO = mocker.patch("superset.commands.database.validate.DatabaseDAO")
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    command.run()


def test_command_invalid(mocker: MockerFixture) -> None:
    """
    Test the command when the payload is invalid.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True

    DatabaseDAO = mocker.patch("superset.commands.database.validate.DatabaseDAO")
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "engine": "gsheets",
        "driver": "gsheets",
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(InvalidParametersError) as excinfo:
        command.run()
    assert excinfo.value.errors == [
        SupersetError(
            message="Sheet name is required",
            error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
            level=ErrorLevel.WARNING,
            extra={
                "catalog": {"idx": 0, "name": True},
                "issue_codes": [
                    {
                        "code": 1018,
                        "message": (
                            "Issue 1018 - One or more parameters needed to configure a "
                            "database are missing."
                        ),
                    }
                ],
            },
        )
    ]


def test_command_no_ping(mocker: MockerFixture) -> None:
    """
    Test the command when it can't ping the database.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = False

    DatabaseDAO = mocker.patch("superset.commands.database.validate.DatabaseDAO")
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(DatabaseOfflineError) as excinfo:
        command.run()
    assert excinfo.value.error == SupersetError(
        message="Database is offline.",
        error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
        level=ErrorLevel.ERROR,
        extra={
            "issue_codes": [
                {
                    "code": 1002,
                    "message": "Issue 1002 - The database returned an unexpected error.",
                }
            ]
        },
    )


def test_command_with_oauth2(mocker: MockerFixture) -> None:
    """
    Test the command when OAuth2 is needed.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    database.is_oauth2_enabled.return_value = True
    database.db_engine_spec.needs_oauth2.return_value = True
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.side_effect = Exception("OAuth2 needed")

    DatabaseDAO = mocker.patch("superset.commands.database.validate.DatabaseDAO")
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    command.run()


def test_command_with_oauth2_not_configured(mocker: MockerFixture) -> None:
    """
    Test the command when OAuth2 is needed but not configured in the DB.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    database.is_oauth2_enabled.return_value = False
    database.db_engine_spec.needs_oauth2.return_value = True
    database.db_engine_spec.extract_errors.return_value = [
        SupersetError(
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            message="OAuth2 is needed but not configured.",
            level=ErrorLevel.ERROR,
            extra={"engine_name": "gsheets"},
        )
    ]
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.side_effect = Exception("OAuth2 needed")

    DatabaseDAO = mocker.patch("superset.commands.database.validate.DatabaseDAO")
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = ValidateDatabaseParametersCommand(properties)
    with pytest.raises(DatabaseTestConnectionFailedError) as excinfo:
        command.run()
    assert excinfo.value.errors == [
        SupersetError(
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            message="OAuth2 is needed but not configured.",
            level=ErrorLevel.ERROR,
            extra={"engine_name": "gsheets"},
        )
    ]
