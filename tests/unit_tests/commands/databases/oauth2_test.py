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

from typing import Any, cast
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.commands.database.exceptions import DatabaseNotFoundError
from superset.commands.database.oauth2 import OAuth2StoreTokenCommand
from superset.daos.database import DatabaseUserOAuth2TokensDAO
from superset.databases.schemas import OAuth2ProviderResponseSchema
from superset.exceptions import OAuth2Error
from superset.models.core import Database
from superset.superset_typing import OAuth2State
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


def test_run_pre_create_caches_token_in_kv(mocker: MockerFixture) -> None:
    """
    With ``state.database_id is None`` the command reads the engine + config
    from the pre-create KV entry, exchanges the code, and writes the token
    back to KV — *not* to ``database_user_oauth2_tokens``.
    """
    state: OAuth2State = {
        "user_id": 1,
        "database_id": None,
        "default_redirect_uri": "http://localhost:8088/api/v1/oauth2/",
        "tab_id": "3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a3a",
        "engine": "semanticapi",
    }
    parameters: dict[str, Any] = {
        "code": "the-code",
        "state": encode_oauth2_state(state),
    }

    kv_dao = mocker.patch("superset.commands.database.oauth2.KeyValueDAO")
    kv_dao.get_value.side_effect = [
        {"engine": "semanticapi", "config": {"id": "x", "secret": "y"}},  # validate()
        None,  # code_verifier lookup
    ]

    engine_spec = mocker.MagicMock()
    engine_spec.engine = "semanticapi"
    engine_spec.get_oauth2_token.return_value = {
        "access_token": "fresh-token",
        "expires_in": 3600,
        "refresh_token": "refresh",
    }
    mocker.patch(
        "superset.commands.database.oauth2.get_engine_spec",
        return_value=engine_spec,
    )

    dao_get_db = mocker.patch.object(DatabaseUserOAuth2TokensDAO, "get_database")
    dao_create = mocker.patch.object(DatabaseUserOAuth2TokensDAO, "create")

    result = OAuth2StoreTokenCommand(
        cast(OAuth2ProviderResponseSchema, parameters),
    ).run()

    assert result is None
    dao_get_db.assert_not_called()
    dao_create.assert_not_called()
    kv_dao.upsert_entry.assert_called_once()
    upsert_kwargs = kv_dao.upsert_entry.call_args.kwargs
    assert upsert_kwargs["value"]["access_token"] == "fresh-token"  # noqa: S105
    assert upsert_kwargs["value"]["user_id"] == 1


def test_run_pre_create_missing_kv_entry(mocker: MockerFixture) -> None:
    """
    Pre-create flow with no cached entry should fail with a clear OAuth2Error.
    """
    state: OAuth2State = {
        "user_id": 1,
        "database_id": None,
        "default_redirect_uri": "http://localhost:8088/api/v1/oauth2/",
        "tab_id": "3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a3a",
    }
    parameters: dict[str, Any] = {"code": "x", "state": encode_oauth2_state(state)}

    kv_dao = mocker.patch("superset.commands.database.oauth2.KeyValueDAO")
    kv_dao.get_value.return_value = None

    with pytest.raises(OAuth2Error) as exc_info:
        OAuth2StoreTokenCommand(
            cast(OAuth2ProviderResponseSchema, parameters),
        ).validate()
    assert "Pre-create OAuth2 context" in exc_info.value.error.extra["error"]


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
