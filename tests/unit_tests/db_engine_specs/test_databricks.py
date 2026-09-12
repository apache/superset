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
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine.url import make_url

from superset.db_engine_specs.base import OAuth2State
from superset.db_engine_specs.databricks import (
    DatabricksNativeEngineSpec,
    DatabricksPythonConnectorEngineSpec,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import OAuth2Error, OAuth2RedirectError
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
            "access_token": {"type": "string", "nullable": True},
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
        "required": ["database", "host", "http_path", "port"],
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
    "msg",
    [
        # tag only
        "[INSUFFICIENT_PERMISSIONS] Insufficient privileges: User does not "
        "have USE CATALOG on Catalog 'platform_production'.",
        # SQLSTATE only
        "Insufficient privileges: User does not have USE CATALOG on Catalog "
        "'platform_production'. SQLSTATE: 42501.",
        # SQLSTATE with irregular spacing
        "Insufficient privileges on Catalog 'platform_production'. SQLSTATE:42501",
        # both, as seen in real Databricks responses
        "[INSUFFICIENT_PERMISSIONS] Insufficient privileges: User does not "
        "have USE CATALOG on Catalog 'platform_production'. SQLSTATE: 42501.",
    ],
)
def test_extract_errors_insufficient_permissions(msg: str) -> None:
    """
    Test that Databricks catalog/schema permission errors are classified as
    a client-side, warning-level error instead of a generic server error,
    regardless of which half of the pattern is present in the raw message.
    """
    result = DatabricksNativeEngineSpec.extract_errors(Exception(msg))

    assert result == [
        SupersetError(
            message=msg,
            error_type=SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
            level=ErrorLevel.WARNING,
            extra={
                "engine_name": "Databricks (legacy)",
                "issue_codes": [
                    {
                        "code": 1017,
                        "message": "Issue 1017 - User doesn't have the proper permissions.",  # noqa: E501
                    }
                ],
            },
        )
    ]


def test_extract_errors_insufficient_permissions_covers_odbc() -> None:
    """
    The insufficient-permissions classification lives on the shared
    ``DatabricksBaseEngineSpec`` so that the ODBC ("SQL Endpoint") connector
    benefits too, not just the native/Python-connector engines.
    """
    from superset.db_engine_specs.databricks import DatabricksODBCEngineSpec

    msg = (
        "[INSUFFICIENT_PERMISSIONS] Insufficient privileges: User does not "
        "have USE CATALOG on Catalog 'platform_production'. SQLSTATE: 42501."
    )
    result = DatabricksODBCEngineSpec.extract_errors(Exception(msg))

    assert result == [
        SupersetError(
            message=msg,
            error_type=SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR,
            level=ErrorLevel.WARNING,
            extra={
                "engine_name": "Databricks SQL Endpoint",
                "issue_codes": [
                    {
                        "code": 1017,
                        "message": "Issue 1017 - User doesn't have the proper permissions.",  # noqa: E501
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
        "USE CATALOG ```escaped-hyphen```",
        "USE SCHEMA ```hyphen-escaped```",
    ]

    assert DatabricksNativeEngineSpec.get_prequeries(
        database, catalog="evil` USE CATALOG bad", schema="evil` USE SCHEMA bad"
    ) == [
        "USE CATALOG `evil`` USE CATALOG bad`",
        "USE SCHEMA `evil`` USE SCHEMA bad`",
    ]


# OAuth2 Tests


def test_oauth2_attributes() -> None:
    """
    Test that OAuth2 attributes are properly set for both engine specs.
    """
    # Test DatabricksNativeEngineSpec
    assert DatabricksNativeEngineSpec.supports_oauth2 is True
    assert DatabricksNativeEngineSpec.oauth2_scope == "sql"
    # The authorization endpoint is derived from the workspace host at runtime;
    # the token endpoint must be configured explicitly.
    assert DatabricksNativeEngineSpec.oauth2_authorization_request_uri == ""
    assert DatabricksNativeEngineSpec.oauth2_token_request_uri == ""

    # Test DatabricksPythonConnectorEngineSpec
    assert DatabricksPythonConnectorEngineSpec.supports_oauth2 is True
    assert DatabricksPythonConnectorEngineSpec.oauth2_scope == "sql"
    assert DatabricksPythonConnectorEngineSpec.oauth2_authorization_request_uri == ""
    assert DatabricksPythonConnectorEngineSpec.oauth2_token_request_uri == ""


@pytest.mark.parametrize(
    "spec",
    [DatabricksNativeEngineSpec, DatabricksPythonConnectorEngineSpec],
)
@pytest.mark.parametrize(
    "message",
    [
        "Error during request to server: HTTP 401 Unauthorized",
        "Invalid access token",
        "The access token expired",
        "UNAUTHENTICATED: token is no longer valid",
        "RuntimeError: No valid authentication settings!",
    ],
)
def test_needs_oauth2_detects_auth_failure_from_message(
    mocker: MockerFixture,
    spec: Any,
    message: str,
) -> None:
    """
    The Databricks driver has no dedicated auth exception, so `needs_oauth2`
    matches auth-failure signals in the error message to bootstrap a re-auth.
    """
    g = mocker.patch("superset.db_engine_specs.databricks.g")
    g.user = mocker.MagicMock()

    assert spec.needs_oauth2(Exception(message)) is True


@pytest.mark.parametrize(
    "spec",
    [DatabricksNativeEngineSpec, DatabricksPythonConnectorEngineSpec],
)
@pytest.mark.parametrize(
    "message",
    [
        "Table not found",
        # A bare 401 in an unrelated position must not look like an auth failure.
        "Query failed at line 401: syntax error",
    ],
)
def test_needs_oauth2_ignores_unrelated_errors(
    mocker: MockerFixture,
    spec: Any,
    message: str,
) -> None:
    """
    A non-auth driver error must not trigger the OAuth2 dance.
    """
    g = mocker.patch("superset.db_engine_specs.databricks.g")
    g.user = mocker.MagicMock()

    assert spec.needs_oauth2(Exception(message)) is False


@pytest.mark.parametrize(
    "spec",
    [DatabricksNativeEngineSpec, DatabricksPythonConnectorEngineSpec],
)
def test_needs_oauth2_matches_oauth2_redirect_error(
    mocker: MockerFixture,
    spec: Any,
) -> None:
    """
    The inherited `isinstance` check against `oauth2_exception` still holds.
    """
    g = mocker.patch("superset.db_engine_specs.databricks.g")
    g.user = mocker.MagicMock()

    ex = OAuth2RedirectError("https://example/authorize", "tab", "redirect")
    assert spec.needs_oauth2(ex) is True


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


def test_impersonate_user_without_token_forces_oauth2(mocker: MockerFixture) -> None:
    """
    Without a user token, impersonate_user clears any stored credential so the
    driver fails authentication and the OAuth2 dance is bootstrapped, rather than
    silently connecting with a stale credential.
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

    # The stored credential is cleared in both the URL and connect_args
    assert url.password == ""  # noqa: S105
    assert kwargs["connect_args"]["access_token"] == ""  # noqa: S105


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


def test_impersonate_user_python_connector_without_token_forces_oauth2(
    mocker: MockerFixture,
) -> None:
    """
    The Python connector path also clears the credential when no user token is
    available, so per-user OAuth2 is enforced rather than falling back to a stale
    connection-level token.
    """
    database = mocker.MagicMock()
    original_url = make_url(
        "databricks://token:original-token@host:443?http_path=path&catalog=main&schema=default"
    )
    engine_kwargs = {"connect_args": {"access_token": "original-token"}}

    url, kwargs = DatabricksPythonConnectorEngineSpec.impersonate_user(
        database=database,
        username="user1",
        user_token=None,
        url=original_url,
        engine_kwargs=engine_kwargs,
    )

    assert url.password == ""  # noqa: S105
    assert kwargs["connect_args"]["access_token"] == ""  # noqa: S105


def test_impersonate_user_without_connect_args_token(mocker: MockerFixture) -> None:
    """
    When ``connect_args`` carries no ``access_token`` (the URL-only auth path), the
    token is applied to the URL password and no spurious ``access_token`` key is
    introduced into ``connect_args``.
    """
    database = mocker.MagicMock()
    original_url = make_url(
        "databricks+connector://token:original-token@host:443/database"
    )
    engine_kwargs: dict[str, Any] = {"connect_args": {"http_path": "/sql/path"}}

    url, kwargs = DatabricksNativeEngineSpec.impersonate_user(
        database=database,
        username="user1",
        user_token="user-oauth-token",  # noqa: S106
        url=original_url,
        engine_kwargs=engine_kwargs,
    )

    assert url.password == "user-oauth-token"  # noqa: S105
    assert "access_token" not in kwargs["connect_args"]
    # Unrelated connect_args are preserved
    assert kwargs["connect_args"]["http_path"] == "/sql/path"


def test_update_params_strips_oauth2_client_info(mocker: MockerFixture) -> None:
    """
    ``oauth2_client_info`` is the per-database OAuth2 client config consumed by
    ``Database.get_oauth2_config``; it must not leak into the driver connection
    params, while the rest of ``encrypted_extra`` is still merged.
    """
    database = mocker.MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "oauth2_client_info": {
                "id": "client-id",
                "secret": "client-secret",
                "authorization_request_uri": "https://host/oidc/v1/authorize",
                "token_request_uri": "https://host/oidc/v1/token",
            },
            "http_headers": [["X-Custom", "value"]],
        }
    )
    params: dict[str, Any] = {}

    DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, params)

    assert "oauth2_client_info" not in params
    assert params == {"http_headers": [["X-Custom", "value"]]}


def test_update_params_no_encrypted_extra(mocker: MockerFixture) -> None:
    """
    A database without ``encrypted_extra`` leaves the params untouched.
    """
    database = mocker.MagicMock()
    database.encrypted_extra = None
    params: dict[str, Any] = {"existing": "value"}

    DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, params)

    assert params == {"existing": "value"}


def test_update_params_merges_when_no_oauth2_client_info(
    mocker: MockerFixture,
) -> None:
    """
    ``encrypted_extra`` without an ``oauth2_client_info`` block is merged in full,
    so the strip never removes legitimate driver params.
    """
    database = mocker.MagicMock()
    database.encrypted_extra = json.dumps(
        {"http_headers": [["X-Custom", "value"]], "_tls_verify_hostname": True}
    )
    params: dict[str, Any] = {}

    DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, params)

    assert params == {
        "http_headers": [["X-Custom", "value"]],
        "_tls_verify_hostname": True,
    }


def test_update_params_invalid_encrypted_extra_raises(mocker: MockerFixture) -> None:
    """
    Malformed ``encrypted_extra`` JSON raises rather than silently connecting.
    """
    database = mocker.MagicMock()
    database.encrypted_extra = "{not valid json"

    with pytest.raises(json.JSONDecodeError):
        DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, {})


def test_encrypted_extra_sensitive_fields() -> None:
    """
    Inherited ``$.*`` is kept so unrelated Encrypted Extra secrets stay masked.
    """
    from superset.db_engine_specs.databricks import DatabricksDynamicBaseEngineSpec

    paths = DatabricksDynamicBaseEngineSpec.encrypted_extra_sensitive_field_paths()
    assert "$.*" in paths
    assert "$.client_secret" in paths
    assert "$.oauth2_client_info.secret" in paths


def test_mask_encrypted_extra_client_secret() -> None:
    """
    ``$.*`` redacts every top-level Encrypted Extra value, including M2M fields
    and unrelated driver secrets.
    """
    from superset.db_engine_specs.databricks import DatabricksDynamicBaseEngineSpec

    config = json.dumps(
        {
            "auth_method": "oauth-m2m",
            "client_id": "sp-application-id",
            "client_secret": "super-secret",
            "password": "unrelated-driver-secret",
        }
    )
    assert DatabricksDynamicBaseEngineSpec.mask_encrypted_extra(config) == json.dumps(
        {
            "auth_method": "XXXXXXXXXX",
            "client_id": "XXXXXXXXXX",
            "client_secret": "XXXXXXXXXX",
            "password": "XXXXXXXXXX",
        }
    )


def test_update_params_oauth_m2m_injects_credentials_provider(
    mocker: MockerFixture,
) -> None:
    """
    Encrypted Extra M2M builds a ``credentials_provider`` and does not pass
    ``client_id`` / ``client_secret`` through as driver kwargs.
    """
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    mock_config_cls = mocker.MagicMock()
    mock_oauth = mocker.MagicMock(return_value="oauth-provider")
    mocker.patch(
        "superset.db_engine_specs.databricks._load_databricks_m2m_sdk",
        return_value=(mock_config_cls, mock_oauth, None),
    )

    database = mocker.MagicMock()
    database.url_object.host = "dbc-abc.cloud.databricks.com"
    database.encrypted_extra = json.dumps(
        {
            "auth_method": "oauth-m2m",
            "client_id": "sp-application-id",
            "client_secret": "super-secret",
            "http_headers": [["X-Custom", "value"]],
        }
    )
    params: dict[str, Any] = {}

    DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, params)

    assert "client_id" not in params
    assert "client_secret" not in params
    assert "auth_method" not in params
    assert params["http_headers"] == [["X-Custom", "value"]]
    provider = params["connect_args"]["credentials_provider"]
    assert callable(provider)

    assert provider() == "oauth-provider"
    mock_config_cls.assert_called_once_with(
        host="https://dbc-abc.cloud.databricks.com",
        client_id="sp-application-id",
        client_secret="super-secret",  # noqa: S106
    )
    mock_oauth.assert_called_once()


def test_update_params_oauth_m2m_strips_oauth2_client_info(
    mocker: MockerFixture,
) -> None:
    """
    U2M ``oauth2_client_info`` is still stripped when M2M is also configured.
    """
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    mocker.patch(
        "superset.db_engine_specs.databricks._load_databricks_m2m_sdk",
        return_value=(mocker.MagicMock(), mocker.MagicMock(), None),
    )
    database = mocker.MagicMock()
    database.url_object.host = "dbc-abc.cloud.databricks.com"
    database.encrypted_extra = json.dumps(
        {
            "auth_method": "oauth-m2m",
            "client_id": "sp-application-id",
            "client_secret": "super-secret",
            "oauth2_client_info": {
                "id": "u2m-client-id",
                "secret": "u2m-client-secret",
            },
        }
    )
    params: dict[str, Any] = {}

    DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, params)

    assert "oauth2_client_info" not in params
    assert "credentials_provider" in params["connect_args"]


def test_update_params_oauth_m2m_missing_credentials_raises(
    mocker: MockerFixture,
) -> None:
    """
    ``auth_method=oauth-m2m`` without both credentials fails with a clear error.
    """
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    database = mocker.MagicMock()
    database.encrypted_extra = json.dumps(
        {"auth_method": "oauth-m2m", "client_id": "sp-application-id"}
    )

    with pytest.raises(ValueError, match="client_id and client_secret"):
        DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, {})


def test_update_params_oauth_m2m_missing_sdk_raises(mocker: MockerFixture) -> None:
    """
    Missing ``databricks-sdk`` fails with an install hint, not a driver error.
    """
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    mocker.patch(
        "superset.db_engine_specs.databricks._load_databricks_m2m_sdk",
        side_effect=ValueError(
            "Databricks OAuth M2M requires the databricks-sdk package."
        ),
    )
    database = mocker.MagicMock()
    database.url_object.host = "dbc-abc.cloud.databricks.com"
    database.encrypted_extra = json.dumps(
        {
            "auth_method": "oauth-m2m",
            "client_id": "sp-application-id",
            "client_secret": "super-secret",
        }
    )

    with pytest.raises(ValueError, match="databricks-sdk"):
        DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, {})


def test_load_databricks_m2m_sdk_import_error(mocker: MockerFixture) -> None:
    """
    The lazy import surfaces a clear error when ``databricks-sdk`` is absent.
    """
    import builtins

    from superset.db_engine_specs.databricks import _load_databricks_m2m_sdk

    real_import = builtins.__import__

    def fake_import(name: str, *args: Any, **kwargs: Any) -> Any:
        if name == "databricks.sdk.core":
            raise ImportError("No module named databricks.sdk")
        return real_import(name, *args, **kwargs)

    mocker.patch("builtins.__import__", side_effect=fake_import)
    with pytest.raises(ValueError, match="databricks-sdk"):
        _load_databricks_m2m_sdk()


def test_update_params_azure_sp_m2m(mocker: MockerFixture) -> None:
    """
    Azure SP M2M uses ``azure_service_principal`` via credentials_provider.
    """
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    mock_config_cls = mocker.MagicMock()
    mock_oauth = mocker.MagicMock()
    mock_azure = mocker.MagicMock(return_value="azure-provider")
    mocker.patch(
        "superset.db_engine_specs.databricks._load_databricks_m2m_sdk",
        return_value=(mock_config_cls, mock_oauth, mock_azure),
    )
    database = mocker.MagicMock()
    database.url_object.host = "adb-123.azuredatabricks.net"
    database.encrypted_extra = json.dumps(
        {
            "auth_method": "azure-sp-m2m",
            "client_id": "azure-app-id",
            "client_secret": "azure-secret",
            "azure_tenant_id": "tenant-123",
        }
    )
    params: dict[str, Any] = {}

    DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, params)

    assert "client_id" not in params
    assert "client_secret" not in params
    assert "auth_type" not in params.get("connect_args", {})
    provider = params["connect_args"]["credentials_provider"]
    assert provider() == "azure-provider"
    mock_config_cls.assert_called_once_with(
        host="https://adb-123.azuredatabricks.net",
        azure_tenant_id="tenant-123",
        azure_client_id="azure-app-id",
        azure_client_secret="azure-secret",  # noqa: S106
    )
    mock_azure.assert_called_once()
    mock_oauth.assert_not_called()


def test_update_params_azure_sp_m2m_aliases(mocker: MockerFixture) -> None:
    """
    Azure-named client ID/secret keys are accepted and never passed to the driver.
    """
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    mocker.patch(
        "superset.db_engine_specs.databricks._load_databricks_m2m_sdk",
        return_value=(mocker.MagicMock(), mocker.MagicMock(), mocker.MagicMock()),
    )
    database = mocker.MagicMock()
    database.url_object.host = "adb-123.azuredatabricks.net"
    database.encrypted_extra = json.dumps(
        {
            "auth_method": "azure-sp-m2m",
            "azure_client_id": "azure-app-id",
            "azure_client_secret": "azure-secret",
            "azure_tenant_id": "tenant-123",
        }
    )
    params: dict[str, Any] = {}

    DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, params)

    assert "azure_client_id" not in params
    assert "azure_client_secret" not in params
    assert "credentials_provider" in params["connect_args"]


def test_update_params_azure_sp_m2m_missing_credentials_raises(
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    database = mocker.MagicMock()
    database.encrypted_extra = json.dumps({"auth_method": "azure-sp-m2m"})

    with pytest.raises(ValueError, match="client_id and client_secret"):
        DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, {})


def test_update_params_azure_sp_m2m_missing_tenant_raises(
    mocker: MockerFixture,
) -> None:
    from superset.db_engine_specs.databricks import DatabricksNativeEngineSpec

    database = mocker.MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "auth_method": "azure-sp-m2m",
            "client_id": "azure-app-id",
            "client_secret": "azure-secret",
        }
    )

    with pytest.raises(ValueError, match="azure_tenant_id"):
        DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, {})


def test_m2m_credentials_provider_repr_is_stable(mocker: MockerFixture) -> None:
    """
    ``repr`` is identity-stable (and secret-free) so the engine cache key matches.
    """
    from superset.db_engine_specs.databricks import _M2MCredentialsProvider

    mocker.patch(
        "superset.db_engine_specs.databricks._load_databricks_m2m_sdk",
        return_value=(mocker.MagicMock(), mocker.MagicMock(), mocker.MagicMock()),
    )
    first = _M2MCredentialsProvider(
        "https://dbc-abc.cloud.databricks.com/",
        "sp-application-id",
        "old-secret",
    )
    second = _M2MCredentialsProvider(
        "dbc-abc.cloud.databricks.com",
        "sp-application-id",
        "rotated-secret",
    )
    assert repr(first) == repr(second)
    assert "old-secret" not in repr(first)
    assert "rotated-secret" not in repr(second)


def test_get_parameters_from_uri_strips_m2m_placeholder() -> None:
    """
    The dummy ``m2m`` URI password is not treated as a personal access token.
    """
    parameters = DatabricksNativeEngineSpec.get_parameters_from_uri(
        "databricks+connector://token:m2m@my_hostname:1234/test"
    )
    assert parameters["access_token"] == ""


def test_python_connector_get_parameters_from_uri_strips_m2m_placeholder() -> None:
    """
    The dummy ``m2m`` URI password is stripped for the Python connector too.
    """
    parameters = DatabricksPythonConnectorEngineSpec.get_parameters_from_uri(
        "databricks://token:m2m@my_hostname:443"
        "?http_path=/sql/1.0/warehouses/x&catalog=main&schema=default"
    )
    assert parameters["access_token"] == ""


def test_build_sqlalchemy_uri_placeholder_without_access_token() -> None:
    """
    An empty access token becomes the ``m2m`` URI placeholder so the dialect
    still has a password while M2M auth wins at connect time.
    """
    from superset.db_engine_specs.databricks import DatabricksNativeParametersType

    parameters = DatabricksNativeParametersType(
        {
            "host": "my_hostname",
            "port": 1234,
            "database": "test",
            "encryption": False,
        }
    )
    sqlalchemy_uri = DatabricksNativeEngineSpec.build_sqlalchemy_uri(parameters, None)
    assert sqlalchemy_uri == "databricks+connector://token:m2m@my_hostname:1234/test"


def test_validate_parameters_access_token_required_without_m2m(
    mocker: MockerFixture,
) -> None:
    """
    PAT-only connections still require ``access_token``.
    """
    mocker.patch(
        "superset.db_engine_specs.databricks.is_hostname_valid", return_value=True
    )
    mocker.patch("superset.db_engine_specs.databricks.is_port_open", return_value=True)

    errors = DatabricksNativeEngineSpec.validate_parameters(
        {  # type: ignore[arg-type]
            "parameters": {
                "host": "dbc-abc.cloud.databricks.com",
                "port": 443,
                "database": "hive_metastore",
            },
            "extra": json.dumps(
                {
                    "engine_params": {
                        "connect_args": {"http_path": "/sql/1.0/warehouses/x"}
                    }
                }
            ),
        }
    )

    missing = [
        error
        for error in errors
        if error.error_type == SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR
    ]
    assert missing
    assert "access_token" in missing[0].extra["missing"]


def test_validate_parameters_access_token_optional_with_m2m(
    mocker: MockerFixture,
) -> None:
    """
    ``access_token`` is not required when Encrypted Extra has M2M credentials.
    """
    mocker.patch(
        "superset.db_engine_specs.databricks.is_hostname_valid", return_value=True
    )
    mocker.patch("superset.db_engine_specs.databricks.is_port_open", return_value=True)

    errors = DatabricksNativeEngineSpec.validate_parameters(
        {  # type: ignore[arg-type]
            "parameters": {
                "host": "dbc-abc.cloud.databricks.com",
                "port": 443,
                "database": "hive_metastore",
            },
            "extra": json.dumps(
                {
                    "engine_params": {
                        "connect_args": {"http_path": "/sql/1.0/warehouses/x"}
                    }
                }
            ),
            "masked_encrypted_extra": json.dumps(
                {
                    "auth_method": "oauth-m2m",
                    "client_id": "sp-application-id",
                    "client_secret": "super-secret",
                }
            ),
        }
    )

    missing = [
        error
        for error in errors
        if error.error_type == SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR
    ]
    assert missing == []


def test_validate_parameters_access_token_optional_with_azure_aliases(
    mocker: MockerFixture,
) -> None:
    """
    Azure-named client ID/secret keys count as complete M2M credentials.
    """
    mocker.patch(
        "superset.db_engine_specs.databricks.is_hostname_valid", return_value=True
    )
    mocker.patch("superset.db_engine_specs.databricks.is_port_open", return_value=True)

    errors = DatabricksNativeEngineSpec.validate_parameters(
        {  # type: ignore[arg-type]
            "parameters": {
                "host": "adb-123.azuredatabricks.net",
                "port": 443,
                "database": "hive_metastore",
            },
            "extra": json.dumps(
                {
                    "engine_params": {
                        "connect_args": {"http_path": "/sql/1.0/warehouses/x"}
                    }
                }
            ),
            "masked_encrypted_extra": json.dumps(
                {
                    "auth_method": "azure-sp-m2m",
                    "azure_client_id": "azure-app-id",
                    "azure_client_secret": "azure-secret",
                    "azure_tenant_id": "tenant-123",
                }
            ),
        }
    )

    missing = [
        error
        for error in errors
        if error.error_type == SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR
    ]
    assert missing == []


def test_validate_parameters_access_token_optional_with_masked_m2m(
    mocker: MockerFixture,
) -> None:
    """
    Fully redacted Encrypted Extra still makes ``access_token`` optional.
    """
    mocker.patch(
        "superset.db_engine_specs.databricks.is_hostname_valid", return_value=True
    )
    mocker.patch("superset.db_engine_specs.databricks.is_port_open", return_value=True)

    errors = DatabricksNativeEngineSpec.validate_parameters(
        {  # type: ignore[arg-type]
            "parameters": {
                "host": "dbc-abc.cloud.databricks.com",
                "port": 443,
                "database": "hive_metastore",
            },
            "extra": json.dumps(
                {
                    "engine_params": {
                        "connect_args": {"http_path": "/sql/1.0/warehouses/x"}
                    }
                }
            ),
            "masked_encrypted_extra": json.dumps(
                {
                    "auth_method": "XXXXXXXXXX",
                    "client_id": "XXXXXXXXXX",
                    "client_secret": "XXXXXXXXXX",
                }
            ),
        }
    )

    missing = [
        error
        for error in errors
        if error.error_type == SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR
    ]
    assert missing == []


def test_validate_parameters_malformed_extra_json(mocker: MockerFixture) -> None:
    """
    Invalid Extra JSON is a validation error, not a 500.
    """
    mocker.patch(
        "superset.db_engine_specs.databricks.is_hostname_valid", return_value=True
    )
    mocker.patch("superset.db_engine_specs.databricks.is_port_open", return_value=True)

    errors = DatabricksNativeEngineSpec.validate_parameters(
        {  # type: ignore[arg-type]
            "parameters": {
                "access_token": "abc12345",
                "host": "dbc-abc.cloud.databricks.com",
                "port": 443,
                "database": "hive_metastore",
            },
            "extra": "{not valid json",
        }
    )

    assert any(
        error.message == "The extra connection parameters are not valid JSON."
        and error.extra.get("invalid") == ["extra"]
        for error in errors
    )


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


def _oauth2_state() -> OAuth2State:
    """
    Build the default OAuth2 state shared by the OAuth2 tests.
    """
    state: OAuth2State = {
        "database_id": 1,
        "user_id": 1,
        "default_redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "tab_id": "1234",
    }
    return state


def _unresolved_oauth2_config() -> OAuth2ClientConfig:
    """
    Config as built by `get_oauth2_config` when no endpoints are overridden:
    the URIs default to the spec's empty class attributes.
    """
    return {
        "id": "databricks-client-id",
        "secret": "databricks-client-secret",
        "scope": "sql",
        "redirect_uri": "http://localhost:8088/api/v1/database/oauth2/",
        "authorization_request_uri": "",
        "token_request_uri": "",
        "request_content_type": "json",
    }


@pytest.mark.parametrize(
    "spec",
    [DatabricksNativeEngineSpec, DatabricksPythonConnectorEngineSpec],
)
@pytest.mark.parametrize(
    "host",
    [
        "dbc-abc.cloud.databricks.com",
        "adb-123456789.12.azuredatabricks.net",
        "123456789.gcp.databricks.com",
    ],
)
def test_get_oauth2_authorization_uri_derives_from_workspace_host(
    mocker: MockerFixture,
    spec: Any,
    host: str,
) -> None:
    """
    With no configured `authorization_request_uri`, the endpoint is derived from
    the workspace host (`https://<host>/oidc/v1/authorize`) on every cloud, with
    no account/tenant identifier required.
    """
    database = mocker.MagicMock()
    database.url_object.host = host
    mocker.patch("superset.db.session.get", return_value=database)

    url = spec.get_oauth2_authorization_uri(
        _unresolved_oauth2_config(), _oauth2_state()
    )
    parsed = urlparse(url)
    assert parsed.netloc == host
    assert parsed.path == "/oidc/v1/authorize"


@pytest.mark.parametrize(
    "spec",
    [DatabricksNativeEngineSpec, DatabricksPythonConnectorEngineSpec],
)
def test_get_oauth2_authorization_uri_preserves_configured(
    mocker: MockerFixture,
    spec: Any,
) -> None:
    """
    A fully-resolved `authorization_request_uri` is never overwritten by the
    host-derived endpoint, and no database lookup is needed.
    """
    session_get = mocker.patch("superset.db.session.get")
    config = _unresolved_oauth2_config()
    config["authorization_request_uri"] = (
        "https://accounts.cloud.databricks.com/oidc/accounts/override/v1/authorize"
    )

    url = spec.get_oauth2_authorization_uri(config, _oauth2_state())
    assert urlparse(url).path == "/oidc/accounts/override/v1/authorize"
    session_get.assert_not_called()


@pytest.mark.parametrize(
    "spec",
    [DatabricksNativeEngineSpec, DatabricksPythonConnectorEngineSpec],
)
def test_get_oauth2_authorization_uri_fails_without_host(
    mocker: MockerFixture,
    spec: Any,
) -> None:
    """
    When the endpoint must be derived but the connection has no host, fail fast
    instead of emitting an invalid `https:///oidc/v1/authorize` URL.
    """
    database = mocker.MagicMock()
    database.url_object.host = None
    mocker.patch("superset.db.session.get", return_value=database)

    with pytest.raises(OAuth2Error):
        spec.get_oauth2_authorization_uri(_unresolved_oauth2_config(), _oauth2_state())


@pytest.mark.parametrize(
    "spec",
    [DatabricksNativeEngineSpec, DatabricksPythonConnectorEngineSpec],
)
def test_get_oauth2_token_fails_without_uri(
    mocker: MockerFixture,
    spec: Any,
) -> None:
    """
    Token exchange has no database context to auto-detect the endpoint, so a
    missing `token_request_uri` fails fast rather than POSTing to `.../{}/...`.
    """
    with pytest.raises(OAuth2Error):
        spec.get_oauth2_token(_unresolved_oauth2_config(), "authorization-code")


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


def test_identifier_quote_uses_backticks() -> None:
    """Databricks SQL is Spark SQL under the hood, so identifiers are quoted
    with backticks, not the inherited ANSI double quotes."""
    assert DatabricksNativeEngineSpec.get_public_information()["identifier_quote"] == {
        "start": "`",
        "end": "`",
        "escape_by_doubling": True,
    }
    assert DatabricksPythonConnectorEngineSpec.get_public_information()[
        "identifier_quote"
    ] == {
        "start": "`",
        "end": "`",
        "escape_by_doubling": True,
    }
