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
# pylint: disable=unused-argument, import-outside-toplevel, protected-access

from datetime import datetime
from typing import Optional
from urllib.parse import parse_qs, urlparse

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs.databricks import (
    DatabricksNativeEngineSpec,
    DatabricksPythonConnectorEngineSpec,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import OAuth2RedirectError
from superset.superset_typing import OAuth2ClientConfig
from superset.utils import json
from superset.utils.oauth2 import decode_oauth2_state
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


def test_get_parameters_from_uri() -> None:
    """
    Test that the result from ``get_parameters_from_uri`` is JSON serializable.
    """
    from superset.db_engine_specs.databricks import (
        DatabricksNativeEngineSpec,
        DatabricksNativeParametersType,
    )

    parameters = DatabricksNativeEngineSpec.get_parameters_from_uri(
        "databricks+connector://token:abc12345@my_hostname:1234/test"
    )
    assert parameters == DatabricksNativeParametersType(
        {
            "access_token": "abc12345",
            "host": "my_hostname",
            "port": 1234,
            "database": "test",
            "encryption": False,
        }
    )
    assert json.loads(json.dumps(parameters)) == parameters


def test_build_sqlalchemy_uri() -> None:
    """
    test that the parameters are can correctly be compiled into a
    sqlalchemy_uri
    """
    from superset.db_engine_specs.databricks import (
        DatabricksNativeEngineSpec,
        DatabricksNativeParametersType,
    )

    parameters = DatabricksNativeParametersType(
        {
            "access_token": "abc12345",
            "host": "my_hostname",
            "port": 1234,
            "database": "test",
            "encryption": False,
        }
    )
    encrypted_extra = None
    sqlalchemy_uri = DatabricksNativeEngineSpec.build_sqlalchemy_uri(
        parameters, encrypted_extra
    )
    assert sqlalchemy_uri == (
        "databricks+connector://token:abc12345@my_hostname:1234/test"
    )


def test_parameters_json_schema() -> None:
    """
    test that the parameters schema can be converted to json
    """
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    json_schema = DatabricksNativeEngineSpec.parameters_json_schema()

    assert json_schema == {
        "type": "object",
        "properties": {
            "access_token": {"type": "string"},
            "database": {"type": "string"},
            "encryption": {
                "description": "Use an encrypted connection to the database",
                "type": "boolean",
            },
            "host": {"type": "string"},
            "http_path": {"type": "string"},
            "port": {
                "description": "Database port",
                "maximum": 65536,
                "minimum": 0,
                "type": "integer",
            },
        },
        "required": ["access_token", "database", "host", "http_path", "port"],
    }


def test_get_extra_params(mocker: MockerFixture) -> None:
    """
    Test the ``get_extra_params`` method.
    """
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    database = mocker.MagicMock()

    database.extra = {}
    assert DatabricksNativeEngineSpec.get_extra_params(database) == {
        "engine_params": {
            "connect_args": {
                "http_headers": [("User-Agent", "Apache Superset")],
                "_user_agent_entry": "Apache Superset",
            }
        }
    }

    database.extra = json.dumps(
        {
            "engine_params": {
                "connect_args": {
                    "http_headers": [("User-Agent", "Custom user agent")],
                    "_user_agent_entry": "Custom user agent",
                    "foo": "bar",
                }
            }
        }
    )
    assert DatabricksNativeEngineSpec.get_extra_params(database) == {
        "engine_params": {
            "connect_args": {
                "http_headers": [["User-Agent", "Custom user agent"]],
                "_user_agent_entry": "Custom user agent",
                "foo": "bar",
            }
        }
    }

    # it should also remove whitespace from http_path
    database.extra = json.dumps(
        {
            "engine_params": {
                "connect_args": {
                    "http_headers": [("User-Agent", "Custom user agent")],
                    "_user_agent_entry": "Custom user agent",
                    "http_path": "/some_path_here_with_whitespace ",
                }
            }
        }
    )
    assert DatabricksNativeEngineSpec.get_extra_params(database) == {
        "engine_params": {
            "connect_args": {
                "http_headers": [["User-Agent", "Custom user agent"]],
                "_user_agent_entry": "Custom user agent",
                "http_path": "/some_path_here_with_whitespace",
            }
        }
    }


def test_extract_errors() -> None:
    """
    Test that custom error messages are extracted correctly.
    """

    msg = ": mismatched input 'from_'. Expecting: "
    result = DatabricksNativeEngineSpec.extract_errors(Exception(msg))

    assert result == [
        SupersetError(
            message=": mismatched input 'from_'. Expecting: ",
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Databricks (legacy)",
                "issue_codes": [
                    {
                        "code": 1002,
                        "message": "Issue 1002 - The database returned an unexpected error.",  # noqa: E501
                    }
                ],
            },
        )
    ]


def test_extract_errors_with_context() -> None:
    """
    Test that custom error messages are extracted correctly with context.
    """

    msg = ": mismatched input 'from_'. Expecting: "
    context = {"hostname": "foo"}
    result = DatabricksNativeEngineSpec.extract_errors(Exception(msg), context)

    assert result == [
        SupersetError(
            message=": mismatched input 'from_'. Expecting: ",
            error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
            level=ErrorLevel.ERROR,
            extra={
                "engine_name": "Databricks (legacy)",
                "issue_codes": [
                    {
                        "code": 1002,
                        "message": "Issue 1002 - The database returned an unexpected error.",  # noqa: E501
                    }
                ],
            },
        )
    ]


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST('2019-01-02' AS DATE)"),
        (
            "TimeStamp",
            "CAST('2019-01-02 03:04:05.678900' AS TIMESTAMP)",
        ),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str,
    expected_result: Optional[str],
    dttm: datetime,  # noqa: F811
) -> None:
    from superset.db_engine_specs.databricks import (
        DatabricksNativeEngineSpec as spec,  # noqa: N813
    )

    assert_convert_dttm(spec, target_type, expected_result, dttm)


def test_get_prequeries(mocker: MockerFixture) -> None:
    """
    Test the ``get_prequeries`` method.
    """
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    database = mocker.MagicMock()

    assert DatabricksNativeEngineSpec.get_prequeries(database) == []
    assert DatabricksNativeEngineSpec.get_prequeries(database, schema="test") == [
        "USE SCHEMA `test`",
    ]
    assert DatabricksNativeEngineSpec.get_prequeries(database, catalog="test") == [
        "USE CATALOG `test`",
    ]
    assert DatabricksNativeEngineSpec.get_prequeries(
        database, catalog="foo", schema="bar"
    ) == [
        "USE CATALOG `foo`",
        "USE SCHEMA `bar`",
    ]

    assert DatabricksNativeEngineSpec.get_prequeries(
        database, catalog="with-hyphen", schema="hyphen-again"
    ) == [
        "USE CATALOG `with-hyphen`",
        "USE SCHEMA `hyphen-again`",
    ]

    assert DatabricksNativeEngineSpec.get_prequeries(
        database, catalog="`escaped-hyphen`", schema="`hyphen-escaped`"
    ) == [
        "USE CATALOG `escaped-hyphen`",
        "USE SCHEMA `hyphen-escaped`",
    ]


# OAuth2 Tests


def test_oauth2_attributes() -> None:
    """
    Test that OAuth2 attributes are properly set for both engine specs.
    """
    # Test DatabricksNativeEngineSpec
    assert DatabricksNativeEngineSpec.supports_oauth2 is True
    assert DatabricksNativeEngineSpec.oauth2_exception is OAuth2RedirectError
    assert DatabricksNativeEngineSpec.oauth2_scope == "sql"
    assert (
        DatabricksNativeEngineSpec.oauth2_authorization_request_uri
        == "https://accounts.cloud.databricks.com/oidc/accounts/{}/v1/authorize"
    )
    assert (
        DatabricksNativeEngineSpec.oauth2_token_request_uri
        == "https://accounts.cloud.databricks.com/oidc/accounts/{}/v1/token"  # noqa: S105
    )

    # Test DatabricksPythonConnectorEngineSpec
    assert DatabricksPythonConnectorEngineSpec.supports_oauth2 is True
    assert DatabricksPythonConnectorEngineSpec.oauth2_exception is OAuth2RedirectError
    assert DatabricksPythonConnectorEngineSpec.oauth2_scope == "sql"
    assert (
        DatabricksPythonConnectorEngineSpec.oauth2_authorization_request_uri
        == "https://accounts.cloud.databricks.com/oidc/accounts/{}/v1/authorize"
    )
    assert (
        DatabricksPythonConnectorEngineSpec.oauth2_token_request_uri
        == "https://accounts.cloud.databricks.com/oidc/accounts/{}/v1/token"  # noqa: S105
    )


def test_impersonate_user_with_token(mocker: MockerFixture) -> None:
    """
    Test impersonate_user method with OAuth2 token for DatabricksNativeEngineSpec.
    """
    database = mocker.MagicMock()
    original_url = make_url(
        "databricks+connector://token:original-token@host:443/database"
    )
    engine_kwargs = {"connect_args": {"access_token": "original-token"}}

    # Test with user token
    url, kwargs = DatabricksNativeEngineSpec.impersonate_user(
        database=database,
        username="user1",
        user_token="user-oauth-token",  # noqa: S106
        url=original_url,
        engine_kwargs=engine_kwargs,
    )

    # Check that the password (token) was updated in the URL
    assert url.password == "user-oauth-token"  # noqa: S105
    # Check that access_token was updated in connect_args
    assert kwargs["connect_args"]["access_token"] == "user-oauth-token"  # noqa: S105


def test_impersonate_user_without_token(mocker: MockerFixture) -> None:
    """
    Test impersonate_user method without OAuth2 token.
    """
    database = mocker.MagicMock()
    original_url = make_url(
        "databricks+connector://token:original-token@host:443/database"
    )
    engine_kwargs = {"connect_args": {"access_token": "original-token"}}

    # Test without user token
    url, kwargs = DatabricksNativeEngineSpec.impersonate_user(
        database=database,
        username="user1",
        user_token=None,
        url=original_url,
        engine_kwargs=engine_kwargs,
    )

    # Check that nothing was changed
    assert url.password == "original-token"  # noqa: S105
    assert kwargs["connect_args"]["access_token"] == "original-token"  # noqa: S105


def test_impersonate_user_python_connector(mocker: MockerFixture) -> None:
    """
    Test impersonate_user method for DatabricksPythonConnectorEngineSpec.
    """
    database = mocker.MagicMock()
    original_url = make_url(
        "databricks://token:original-token@host:443?http_path=path&catalog=main&schema=default"
    )
    engine_kwargs = {"connect_args": {"access_token": "original-token"}}

    # Test with user token
    url, kwargs = DatabricksPythonConnectorEngineSpec.impersonate_user(
        database=database,
        username="user1",
        user_token="user-oauth-token",  # noqa: S106
        url=original_url,
        engine_kwargs=engine_kwargs,
    )

    # Check that the password (token) was updated in the URL
    assert url.password == "user-oauth-token"  # noqa: S105
    # Check that access_token was updated in connect_args
    assert kwargs["connect_args"]["access_token"] == "user-oauth-token"  # noqa: S105


@pytest.fixture
def oauth2_config_native() -> OAuth2ClientConfig:
    """
    Config for Databricks Native OAuth2.
    """
    return {
        "id": "databricks-client-id",
        "secret": "databricks-client-secret",
        "scope": "sql",
        "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "authorization_request_uri": "https://accounts.cloud.databricks.com/oidc/accounts/12345/v1/authorize",
        "token_request_uri": "https://accounts.cloud.databricks.com/oidc/accounts/12345/v1/token",
        "request_content_type": "json",
    }


@pytest.fixture
def oauth2_config_python() -> OAuth2ClientConfig:
    """
    Config for Databricks Python Connector OAuth2.
    """
    return {
        "id": "databricks-client-id",
        "secret": "databricks-client-secret",
        "scope": "sql",
        "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "authorization_request_uri": "https://accounts.cloud.databricks.com/oidc/accounts/12345/v1/authorize",
        "token_request_uri": "https://accounts.cloud.databricks.com/oidc/accounts/12345/v1/token",
        "request_content_type": "json",
    }


def test_is_oauth2_enabled_no_config_native(mocker: MockerFixture) -> None:
    """
    Test `is_oauth2_enabled` when OAuth2 is not configured for Native engine.
    """
    mocker.patch(
        "flask.current_app.config",
        new={"DATABASE_OAUTH2_CLIENTS": {}},
    )

    assert DatabricksNativeEngineSpec.is_oauth2_enabled() is False


def test_is_oauth2_enabled_config_native(mocker: MockerFixture) -> None:
    """
    Test `is_oauth2_enabled` when OAuth2 is configured for Native engine.
    """
    mocker.patch(
        "flask.current_app.config",
        new={
            "DATABASE_OAUTH2_CLIENTS": {
                "Databricks (legacy)": {
                    "id": "client-id",
                    "secret": "client-secret",
                },
            }
        },
    )

    assert DatabricksNativeEngineSpec.is_oauth2_enabled() is True


def test_is_oauth2_enabled_no_config_python(mocker: MockerFixture) -> None:
    """
    Test `is_oauth2_enabled` when OAuth2 is not configured for Python Connector engine.
    """
    mocker.patch(
        "flask.current_app.config",
        new={"DATABASE_OAUTH2_CLIENTS": {}},
    )

    assert DatabricksPythonConnectorEngineSpec.is_oauth2_enabled() is False


def test_is_oauth2_enabled_config_python(mocker: MockerFixture) -> None:
    """
    Test `is_oauth2_enabled` when OAuth2 is configured for Python Connector engine.
    """
    mocker.patch(
        "flask.current_app.config",
        new={
            "DATABASE_OAUTH2_CLIENTS": {
                "Databricks": {
                    "id": "client-id",
                    "secret": "client-secret",
                },
            }
        },
    )

    assert DatabricksPythonConnectorEngineSpec.is_oauth2_enabled() is True


def test_get_oauth2_authorization_uri_native(
    mocker: MockerFixture,
    oauth2_config_native: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_authorization_uri` for Native engine.
    """
    from superset.db_engine_specs.base import OAuth2State

    state: OAuth2State = {
        "database_id": 1,
        "user_id": 1,
        "default_redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "tab_id": "1234",
    }

    url = DatabricksNativeEngineSpec.get_oauth2_authorization_uri(
        oauth2_config_native, state
    )
    parsed = urlparse(url)
    assert parsed.netloc == "accounts.cloud.databricks.com"
    assert parsed.path == "/oidc/accounts/12345/v1/authorize"

    query = parse_qs(parsed.query)
    assert query["scope"][0] == "sql"
    encoded_state = query["state"][0].replace("%2E", ".")
    assert decode_oauth2_state(encoded_state) == state


def test_get_oauth2_authorization_uri_python(
    mocker: MockerFixture,
    oauth2_config_python: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_authorization_uri` for Python Connector engine.
    """
    from superset.db_engine_specs.base import OAuth2State

    state: OAuth2State = {
        "database_id": 1,
        "user_id": 1,
        "default_redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "tab_id": "1234",
    }

    url = DatabricksPythonConnectorEngineSpec.get_oauth2_authorization_uri(
        oauth2_config_python, state
    )
    parsed = urlparse(url)
    assert parsed.netloc == "accounts.cloud.databricks.com"
    assert parsed.path == "/oidc/accounts/12345/v1/authorize"

    query = parse_qs(parsed.query)
    assert query["scope"][0] == "sql"
    encoded_state = query["state"][0].replace("%2E", ".")
    assert decode_oauth2_state(encoded_state) == state


def test_get_oauth2_token_native(
    mocker: MockerFixture,
    oauth2_config_native: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_token` for Native engine.
    """
    requests = mocker.patch("superset.db_engine_specs.base.requests")
    requests.post().json.return_value = {
        "access_token": "access-token",
        "expires_in": 3600,
        "scope": "sql",
        "token_type": "Bearer",
        "refresh_token": "refresh-token",
    }

    assert DatabricksNativeEngineSpec.get_oauth2_token(
        oauth2_config_native, "authorization-code"
    ) == {
        "access_token": "access-token",
        "expires_in": 3600,
        "scope": "sql",
        "token_type": "Bearer",
        "refresh_token": "refresh-token",
    }
    requests.post.assert_called_with(
        "https://accounts.cloud.databricks.com/oidc/accounts/12345/v1/token",
        json={
            "code": "authorization-code",
            "client_id": "databricks-client-id",
            "client_secret": "databricks-client-secret",
            "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
            "grant_type": "authorization_code",
        },
        timeout=30.0,
    )


def test_get_oauth2_token_python(
    mocker: MockerFixture,
    oauth2_config_python: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_token` for Python Connector engine.
    """
    requests = mocker.patch("superset.db_engine_specs.base.requests")
    requests.post().json.return_value = {
        "access_token": "access-token",
        "expires_in": 3600,
        "scope": "sql",
        "token_type": "Bearer",
        "refresh_token": "refresh-token",
    }

    assert DatabricksPythonConnectorEngineSpec.get_oauth2_token(
        oauth2_config_python, "authorization-code"
    ) == {
        "access_token": "access-token",
        "expires_in": 3600,
        "scope": "sql",
        "token_type": "Bearer",
        "refresh_token": "refresh-token",
    }
    requests.post.assert_called_with(
        "https://accounts.cloud.databricks.com/oidc/accounts/12345/v1/token",
        json={
            "code": "authorization-code",
            "client_id": "databricks-client-id",
            "client_secret": "databricks-client-secret",
            "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
            "grant_type": "authorization_code",
        },
        timeout=30.0,
    )


def test_get_oauth2_fresh_token_native(
    mocker: MockerFixture,
    oauth2_config_native: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_fresh_token` for Native engine.
    """
    requests = mocker.patch("superset.db_engine_specs.base.requests")
    requests.post().json.return_value = {
        "access_token": "new-access-token",
        "expires_in": 3600,
        "scope": "sql",
        "token_type": "Bearer",
        "refresh_token": "new-refresh-token",
    }

    assert DatabricksNativeEngineSpec.get_oauth2_fresh_token(
        oauth2_config_native, "old-refresh-token"
    ) == {
        "access_token": "new-access-token",
        "expires_in": 3600,
        "scope": "sql",
        "token_type": "Bearer",
        "refresh_token": "new-refresh-token",
    }
    requests.post.assert_called_with(
        "https://accounts.cloud.databricks.com/oidc/accounts/12345/v1/token",
        json={
            "client_id": "databricks-client-id",
            "client_secret": "databricks-client-secret",
            "refresh_token": "old-refresh-token",
            "grant_type": "refresh_token",
        },
        timeout=30.0,
    )


def test_get_oauth2_fresh_token_python(
    mocker: MockerFixture,
    oauth2_config_python: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_fresh_token` for Python Connector engine.
    """
    requests = mocker.patch("superset.db_engine_specs.base.requests")
    requests.post().json.return_value = {
        "access_token": "new-access-token",
        "expires_in": 3600,
        "scope": "sql",
        "token_type": "Bearer",
        "refresh_token": "new-refresh-token",
    }

    assert DatabricksPythonConnectorEngineSpec.get_oauth2_fresh_token(
        oauth2_config_python, "old-refresh-token"
    ) == {
        "access_token": "new-access-token",
        "expires_in": 3600,
        "scope": "sql",
        "token_type": "Bearer",
        "refresh_token": "new-refresh-token",
    }
    requests.post.assert_called_with(
        "https://accounts.cloud.databricks.com/oidc/accounts/12345/v1/token",
        json={
            "client_id": "databricks-client-id",
            "client_secret": "databricks-client-secret",
            "refresh_token": "old-refresh-token",
            "grant_type": "refresh_token",
        },
        timeout=30.0,
    )
