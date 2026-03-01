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

from superset.commands.database.exceptions import DatabaseInvalidError
from superset.commands.database.test_connection import TestConnectionDatabaseCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import OAuth2RedirectError, SupersetTimeoutException


def test_command(mocker: MockerFixture) -> None:
    """
    Test the happy path of the command.
    """
    user = mocker.MagicMock()
    user.email = "alice@example.org"
    mocker.patch("superset.db_engine_specs.gsheets.g", user=user)
    mocker.patch("superset.db_engine_specs.gsheets.create_engine")

    database = mocker.MagicMock()
    database.db_engine_spec.__name__ = "GSheetsEngineSpec"
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.return_value = True

    DatabaseDAO = mocker.patch("superset.commands.database.test_connection.DatabaseDAO")  # noqa: N806
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "sqlalchemy_uri": "gsheets://",
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = TestConnectionDatabaseCommand(properties)
    command.run()


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
    database.start_oauth2_dance.side_effect = OAuth2RedirectError(
        "url",
        "tab_id",
        "redirect_uri",
    )
    database.db_engine_spec.__name__ = "GSheetsEngineSpec"
    with database.get_sqla_engine() as engine:
        engine.dialect.do_ping.side_effect = Exception("OAuth2 needed")

    DatabaseDAO = mocker.patch("superset.commands.database.test_connection.DatabaseDAO")  # noqa: N806
    DatabaseDAO.build_db_for_connection_test.return_value = database

    properties = {
        "sqlalchemy_uri": "gsheets://",
        "engine": "gsheets",
        "driver": "gsheets",
        "catalog": {"test": "https://example.org/"},
    }
    command = TestConnectionDatabaseCommand(properties)
    with pytest.raises(OAuth2RedirectError) as excinfo:
        command.run()
    assert excinfo.value.error == SupersetError(
        message="You don't have permission to access the data.",
        error_type=SupersetErrorType.OAUTH2_REDIRECT,
        level=ErrorLevel.WARNING,
        extra={"url": "url", "tab_id": "tab_id", "redirect_uri": "redirect_uri"},
    )


def test_command_with_masking(mocker: MockerFixture) -> None:
    """
    Test that the command masks the sqlalchemy_uri in metadata.
    """
    database = mocker.MagicMock()
    # Use a URI with a password that should be masked
    database.sqlalchemy_uri = "postgresql://user:secret_password@localhost/db"
    database.db_engine_spec.__name__ = "PostgresEngineSpec"

    # Mock ping to raise a Timeout exception
    mocker.patch(
        "superset.commands.database.test_connection.ping",
        side_effect=SupersetTimeoutException(
            error_type=SupersetErrorType.CONNECTION_DATABASE_TIMEOUT,
            message="Timeout",
            level=ErrorLevel.ERROR,
        ),
    )

    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.test_connection.DatabaseDAO"
    )
    DatabaseDAO.build_db_for_connection_test.return_value = database

    command = TestConnectionDatabaseCommand({"sqlalchemy_uri": database.sqlalchemy_uri})

    with pytest.raises(SupersetTimeoutException) as excinfo:
        command.run()

    # Verify that the password is NOT in the extra metadata
    sqlalchemy_uri = excinfo.value.error.extra["sqlalchemy_uri"]
    assert "secret_password" not in sqlalchemy_uri
    assert "***" in sqlalchemy_uri
    assert "localhost" in sqlalchemy_uri


def test_command_with_masking_database_invalid_error(mocker: MockerFixture) -> None:
    """
    Test that the command handles DatabaseInvalidError when masking the sqlalchemy_uri.
    """
    database = mocker.MagicMock()
    database.sqlalchemy_uri = "invalid-uri"
    database.db_engine_spec.__name__ = "PostgresEngineSpec"

    # Mock ping to raise a Timeout exception
    mocker.patch(
        "superset.commands.database.test_connection.ping",
        side_effect=SupersetTimeoutException(
            error_type=SupersetErrorType.CONNECTION_DATABASE_TIMEOUT,
            message="Timeout",
            level=ErrorLevel.ERROR,
        ),
    )

    # Mock make_url_safe to return valid URLs for __init__ and early run() block
    # and then raise DatabaseInvalidError (for the masking logic at the end of run())
    from superset.databases.utils import make_url_safe as real_make_url_safe

    mocker.patch(
        "superset.commands.database.test_connection.make_url_safe",
        side_effect=[
            real_make_url_safe("postgresql://valid-uri"),
            real_make_url_safe("postgresql://valid-uri"),
            DatabaseInvalidError(),
        ],
    )

    DatabaseDAO = mocker.patch(  # noqa: N806
        "superset.commands.database.test_connection.DatabaseDAO"
    )
    DatabaseDAO.build_db_for_connection_test.return_value = database

    command = TestConnectionDatabaseCommand({"sqlalchemy_uri": database.sqlalchemy_uri})

    with pytest.raises(SupersetTimeoutException) as excinfo:
        command.run()

    # Verify that the safe_uri fallback is used
    assert excinfo.value.error.extra["sqlalchemy_uri"] == "<invalid database URI>"
