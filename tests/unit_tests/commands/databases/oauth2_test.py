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

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.exceptions import DatabaseNotFoundError
from superset.commands.database.oauth2 import OAuth2StoreTokenCommand
from superset.daos.database import DatabaseUserOAuth2TokensDAO
from superset.databases.schemas import OAuth2ProviderResponseSchema
from superset.exceptions import OAuth2Error
from superset.models.core import Database
from superset.utils.oauth2 import decode_oauth2_state, encode_oauth2_state


@pytest.fixture
def mock_database(mocker: MockerFixture) -> MagicMock:
    database = mocker.MagicMock(spec=Database)
    database.get_oauth2_config.return_value = {
        "client_id": "test",
        "client_secret": "secret",
    }
    database.db_engine_spec.get_oauth2_token.return_value = {
        "access_token": "test_access_token",
        "expires_in": 3600,
        "refresh_token": "test_refresh_token",
    }
    return database


@pytest.fixture
def mock_state() -> str:
    return encode_oauth2_state(
        {
            "user_id": 1,
            "database_id": 123,
            "default_redirect_uri": "http://localhost:8088/api/v1/oauth2/",
            "tab_id": "1234",
        }
    )


@pytest.fixture
def mock_parameters(mock_state: str) -> dict[str, Any]:
    return {"code": "test_code", "state": mock_state}


def test_validate_success(
    mocker: MockerFixture,
    mock_database: MagicMock,
    mock_state: str,
    mock_parameters: OAuth2ProviderResponseSchema,
) -> None:
    mocker.patch("superset.utils.oauth2.decode_oauth2_state", return_value=mock_state)
    mocker.patch.object(
        DatabaseUserOAuth2TokensDAO,
        "get_database",
        return_value=mock_database,
    )

    command = OAuth2StoreTokenCommand(mock_parameters)
    command.validate()

    assert command._database == mock_database
    assert command._state == decode_oauth2_state(mock_state)


def test_validate_database_not_found(
    mocker: MockerFixture,
    mock_parameters: OAuth2ProviderResponseSchema,
) -> None:
    mocker.patch(
        "superset.utils.oauth2.decode_oauth2_state",
        return_value={"database_id": 999},
    )
    mocker.patch.object(DatabaseUserOAuth2TokensDAO, "get_database", return_value=None)

    command = OAuth2StoreTokenCommand(mock_parameters)
    with pytest.raises(DatabaseNotFoundError, match="Database not found"):
        command.validate()


def test_validate_oauth2_error(mock_parameters: OAuth2ProviderResponseSchema) -> None:
    mock_parameters["error"] = "OAuth2 failure"
    command = OAuth2StoreTokenCommand(mock_parameters)
    with pytest.raises(OAuth2Error, match="Something went wrong while doing OAuth2"):
        command.validate()


def test_run_success(
    mocker: MockerFixture,
    mock_database: MagicMock,
    mock_state: str,
    mock_parameters: OAuth2ProviderResponseSchema,
) -> None:
    mocker.patch.object(
        DatabaseUserOAuth2TokensDAO,
        "get_database",
        return_value=mock_database,
    )
    mocker.patch.object(
        DatabaseUserOAuth2TokensDAO,
        "find_one_or_none",
        return_value=None,
    )
    mocker.patch.object(DatabaseUserOAuth2TokensDAO, "delete")
    mock_create = mocker.patch.object(
        DatabaseUserOAuth2TokensDAO,
        "create",
        return_value="new_token",
    )
    mocker.patch("superset.utils.oauth2.decode_oauth2_state", return_value=mock_state)

    command = OAuth2StoreTokenCommand(mock_parameters)
    result = command.run()

    assert result == "new_token"
    mock_create.assert_called_once()


def test_run_existing_token(
    mocker: MockerFixture,
    mock_database: MagicMock,
    mock_state: str,
    mock_parameters: OAuth2ProviderResponseSchema,
) -> None:
    mocker.patch.object(
        DatabaseUserOAuth2TokensDAO,
        "get_database",
        return_value=mock_database,
    )
    existing_token = MagicMock()
    mocker.patch.object(
        DatabaseUserOAuth2TokensDAO,
        "find_one_or_none",
        return_value=existing_token,
    )
    mock_delete = mocker.patch.object(DatabaseUserOAuth2TokensDAO, "delete")
    mock_create = mocker.patch.object(
        DatabaseUserOAuth2TokensDAO,
        "create",
        return_value="new_token",
    )
    mocker.patch("superset.utils.oauth2.decode_oauth2_state", return_value=mock_state)

    command = OAuth2StoreTokenCommand(mock_parameters)
    result = command.run()

    assert result == "new_token"
    mock_delete.assert_called_once_with([existing_token])
    mock_create.assert_called_once()
