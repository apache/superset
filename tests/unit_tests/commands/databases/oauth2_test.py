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

import logging
import traceback
from typing import Any
from unittest.mock import MagicMock

import jwt
import pytest
from flask import current_app
from pytest_mock import MockerFixture
from requests.exceptions import HTTPError

from superset.commands.database.exceptions import DatabaseNotFoundError
from superset.commands.database.oauth2 import OAuth2StoreTokenCommand
from superset.daos.database import DatabaseUserOAuth2TokensDAO
from superset.databases.schemas import OAuth2ProviderResponseSchema
from superset.exceptions import OAuth2Error, OAuth2RejectedError
from superset.models.core import Database
from superset.utils.oauth2 import decode_oauth2_state, encode_oauth2_state


@pytest.fixture
def mock_database(mocker: MockerFixture) -> MagicMock:
    database = mocker.MagicMock(spec=Database)
    database.id = 123
    database.db_engine_spec.engine = "postgresql"
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
    mocker.patch("superset.commands.database.oauth2.get_user_id", return_value=1)
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
    mocker.patch("superset.commands.database.oauth2.get_user_id", return_value=1)
    mocker.patch.object(DatabaseUserOAuth2TokensDAO, "get_database", return_value=None)

    command = OAuth2StoreTokenCommand(mock_parameters)
    with pytest.raises(DatabaseNotFoundError, match="Database not found"):
        command.validate()


@pytest.mark.parametrize("error", ["access_denied", "provider-sentinel\r\nFORGED LOG"])
def test_validate_oauth2_error(
    mock_parameters: OAuth2ProviderResponseSchema,
    error: str,
) -> None:
    """Reject provider errors without reflecting their text in responses or logs."""
    mock_parameters["error"] = error
    command = OAuth2StoreTokenCommand(mock_parameters)
    with pytest.raises(OAuth2RejectedError) as exc_info:
        command.validate()
    assert exc_info.value.status == 400
    assert exc_info.value.to_dict()["message"] == (
        "The OAuth2 provider denied the request"
    )
    assert error not in str(exc_info.value.to_dict())
    assert error not in "".join(traceback.format_exception(exc_info.value))


def test_validate_missing_state(
    mock_parameters: OAuth2ProviderResponseSchema,
) -> None:
    """Reject callbacks missing state with HTTP 400."""
    del mock_parameters["state"]
    command = OAuth2StoreTokenCommand(mock_parameters)
    with pytest.raises(OAuth2RejectedError) as exc_info:
        command.validate()
    assert exc_info.value.status == 400


def test_validate_invalid_state(
    mock_parameters: OAuth2ProviderResponseSchema,
) -> None:
    """Reject callbacks with an invalid JWT with HTTP 400."""
    mock_parameters["state"] = "not-a-valid-jwt"
    command = OAuth2StoreTokenCommand(mock_parameters)
    with pytest.raises(OAuth2RejectedError) as exc_info:
        command.validate()
    assert exc_info.value.status == 400


@pytest.mark.parametrize("database_id", [None, "not-an-integer"])
def test_validate_invalid_state_payload(
    mock_parameters: OAuth2ProviderResponseSchema,
    database_id: str | None,
) -> None:
    """Reject signed state with missing or invalid required fields with HTTP 400."""
    payload = dict(decode_oauth2_state(mock_parameters["state"]))
    if database_id is None:
        del payload["database_id"]
    else:
        payload["database_id"] = database_id
    mock_parameters["state"] = jwt.encode(
        payload,
        current_app.config["SECRET_KEY"],
        algorithm=current_app.config["DATABASE_OAUTH2_JWT_ALGORITHM"],
    )
    with pytest.raises(OAuth2RejectedError) as exc_info:
        OAuth2StoreTokenCommand(mock_parameters).validate()
    assert exc_info.value.status == 400
    assert exc_info.value.to_dict()["message"] == (
        "The OAuth2 state parameter is invalid"
    )


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
    mocker.patch("superset.commands.database.oauth2.get_user_id", return_value=1)
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


def test_run_logs_token_exchange_failure(
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
    mock_database: MagicMock,
    mock_parameters: OAuth2ProviderResponseSchema,
) -> None:
    mock_parameters["code"] = "oauth-code-sentinel"
    mock_database.get_oauth2_config.return_value["client_secret"] = (
        "client-secret-sentinel"  # noqa: S105
    )
    mocker.patch.object(
        DatabaseUserOAuth2TokensDAO,
        "get_database",
        return_value=mock_database,
    )
    mocker.patch("superset.commands.database.oauth2.get_user_id", return_value=1)
    mock_database.db_engine_spec.get_oauth2_token.side_effect = HTTPError(
        "provider-payload-sentinel"
    )

    with (
        caplog.at_level(logging.ERROR, logger="superset.commands.database.oauth2"),
        pytest.raises(OAuth2Error) as exc_info,
    ):
        OAuth2StoreTokenCommand(mock_parameters).run()

    assert (
        "OAuth2 token exchange failed: database_id=123 engine=postgresql "
        "error_type=HTTPError"
    ) in caplog.messages
    assert "oauth-code-sentinel" not in caplog.text
    assert "client-secret-sentinel" not in caplog.text
    assert "provider-payload-sentinel" not in caplog.text
    assert "provider-payload-sentinel" not in "".join(
        traceback.format_exception(exc_info.value)
    )


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
    mocker.patch("superset.commands.database.oauth2.get_user_id", return_value=1)
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


def test_validate_rejects_state_not_bound_to_session(
    mocker: MockerFixture,
    mock_parameters: OAuth2ProviderResponseSchema,
) -> None:
    """
    The callback must only store tokens for the user who initiated the
    dance: a state minted for another user, or presented without an
    authenticated session, is rejected before any token exchange.
    """
    command = OAuth2StoreTokenCommand(mock_parameters)

    mocker.patch("superset.commands.database.oauth2.get_user_id", return_value=2)
    with pytest.raises(OAuth2RejectedError) as exc_info:
        command.validate()
    assert exc_info.value.status == 400

    mocker.patch("superset.commands.database.oauth2.get_user_id", return_value=None)
    with pytest.raises(OAuth2RejectedError) as exc_info:
        command.validate()
    assert exc_info.value.status == 400
