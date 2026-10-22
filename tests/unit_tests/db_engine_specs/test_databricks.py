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
from importlib import import_module
from importlib.metadata import PackageNotFoundError, requires
from typing import Any, Optional
from unittest.mock import MagicMock
from urllib.parse import parse_qs, urlparse

import pytest
from packaging.requirements import Requirement
from pytest_mock import MockerFixture
from sqlalchemy import (
    __version__ as sqlalchemy_version,
    Boolean,
    Column,
    create_engine,
    literal_column,
    text,
)
from sqlalchemy.engine.url import make_url
from sqlalchemy.sql.elements import ColumnElement

from superset.db_engine_specs.base import BaseEngineSpec, OAuth2State
from superset.db_engine_specs.databricks import (
    DatabricksBaseEngineSpec,
    DatabricksHiveEngineSpec,
    DatabricksNativeEngineSpec,
    DatabricksPythonConnectorEngineSpec,
)
from superset.db_engine_specs.spark import SparkEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import OAuth2Error, OAuth2RedirectError
from superset.superset_typing import OAuth2ClientConfig
from superset.utils import json
from superset.utils.core import FilterOperator
from superset.utils.oauth2 import decode_oauth2_state
from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm  # noqa: F401


def test_dialect_supports_installed_sqlalchemy(mocker: MockerFixture) -> None:
    """Check optional dialect metadata and construction without network I/O."""
    try:
        declared_requirements = requires("databricks-sqlalchemy") or []
    except PackageNotFoundError:
        pytest.skip("Install apache-superset[databricks] to test the real dialect")
    requirements = [Requirement(requirement) for requirement in declared_requirements]
    sqlalchemy_requirements = [
        requirement for requirement in requirements if requirement.name == "sqlalchemy"
    ]
    assert sqlalchemy_requirements
    assert all(
        sqlalchemy_version in requirement.specifier
        for requirement in sqlalchemy_requirements
    )
    dialect = import_module("databricks.sqlalchemy")
    socket = mocker.patch("socket.socket", side_effect=AssertionError("Network I/O"))
    engine = create_engine(
        "databricks://token:test-token@localhost"
        "?http_path=/sql/1.0/warehouses/test&catalog=main&schema=default"
    )
    try:
        assert isinstance(engine.dialect, dialect.DatabricksDialect)
        _, connect_args = engine.dialect.create_connect_args(engine.url)
        assert connect_args["http_path"] == "/sql/1.0/warehouses/test"
        assert connect_args["catalog"] == "main"
        assert connect_args["schema"] == "default"
        assert connect_args["use_inline_params"] is False
        assert str(text("SELECT :value").compile(engine)) == "SELECT :value"
    finally:
        engine.dispose()
    socket.assert_not_called()


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


class _ConnectorRequestError(Exception):
    """Stand-in for ``databricks.sql.exc.RequestError`` (message + context)."""

    def __init__(self, message: str, context: dict[str, Any]) -> None:
        super().__init__(message)
        self.context = context


@pytest.mark.parametrize(
    "spec",
    [DatabricksNativeEngineSpec, DatabricksPythonConnectorEngineSpec],
)
@pytest.mark.parametrize(
    "http_code, expected",
    [(401, True), ("401", True), (403, False), (None, False)],
)
def test_needs_oauth2_detects_http_401_from_the_connector(
    mocker: MockerFixture,
    spec: Any,
    http_code: Any,
    expected: bool,
) -> None:
    """
    A rejected bearer token fails with HTTP 401 and a message that matches no
    signal ("Credential was not sent or was of an unsupported type for this
    API"); the connector's structured ``http-code`` triggers the re-auth, also
    when SQLAlchemy wraps the error. 403 (a missing permission) does not.
    """
    g = mocker.patch("superset.db_engine_specs.databricks.g")
    g.user = mocker.MagicMock()
    error = _ConnectorRequestError(
        "Error during request to server: : Credential was not sent or was of an "
        "unsupported type for this API.",
        {"method": "OpenSession", "http-code": http_code},
    )
    wrapped = mocker.MagicMock(orig=error)
    wrapped.__str__ = lambda self: str(error)

    assert spec.needs_oauth2(error) is expected
    assert spec.needs_oauth2(wrapped) is expected


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


def test_update_params_merges_connect_args(mocker: MockerFixture) -> None:
    """
    Secure ``connect_args`` (e.g. OAuth M2M credentials) are merged key by key
    into the ``connect_args`` from ``extra`` instead of replacing them.
    """
    database: MagicMock = mocker.MagicMock()
    database.impersonate_user = False
    database.encrypted_extra = json.dumps(
        {"connect_args": {"oauth_client_id": "sp", "oauth_client_secret": "secret"}}
    )
    params: dict[str, Any] = {
        "connect_args": {
            "_user_agent_entry": "Apache Superset",
            "session_configuration": {"TIMEZONE": "Asia/Kolkata"},
        }
    }

    DatabricksPythonConnectorEngineSpec.update_params_from_encrypted_extra(
        database, params
    )

    assert params == {
        "connect_args": {
            "_user_agent_entry": "Apache Superset",
            "session_configuration": {"TIMEZONE": "Asia/Kolkata"},
            "oauth_client_id": "sp",
            "oauth_client_secret": "secret",
        }
    }


def test_update_params_impersonation_keeps_only_the_user_token(
    mocker: MockerFixture,
) -> None:
    """
    With impersonation, a shared credential in the secure extra (or in
    ``extra``) must not replace the user's OAuth2 token set by
    ``impersonate_user``.
    """
    database: MagicMock = mocker.MagicMock()
    database.impersonate_user = True
    database.encrypted_extra = json.dumps(
        {"connect_args": {"access_token": "shared-pat", "http_path": "/sql/1"}}
    )
    engine_kwargs: dict[str, Any] = {
        "connect_args": {"access_token": "extra-pat", "oauth_client_secret": "s"}
    }

    # Same order as ``Database._get_sqla_engine``.
    _, engine_kwargs = DatabricksPythonConnectorEngineSpec.impersonate_user(
        database=database,
        username="user1",
        user_token="user-token",  # noqa: S106
        url=make_url("databricks://token:extra-pat@host:443?http_path=/sql/1"),
        engine_kwargs=engine_kwargs,
    )
    DatabricksPythonConnectorEngineSpec.update_params_from_encrypted_extra(
        database, engine_kwargs
    )

    assert engine_kwargs == {
        "connect_args": {"access_token": "user-token", "http_path": "/sql/1"}
    }


def test_impersonate_user_drops_shared_credentials_without_secure_extra(
    mocker: MockerFixture,
) -> None:
    """
    Shared credentials in ``extra`` are dropped even when the database has no
    secure extra (e.g. OAuth2 configured through ``DATABASE_OAUTH2_CLIENTS``),
    so only the user's token reaches the connector.
    """
    database: MagicMock = mocker.MagicMock()
    database.impersonate_user = True
    database.encrypted_extra = None
    engine_kwargs: dict[str, Any] = {
        "connect_args": {
            "_user_agent_entry": "Apache Superset",
            "auth_type": "databricks-oauth",
            "oauth_client_id": "sp",
            "oauth_client_secret": "secret",
        }
    }

    url, engine_kwargs = DatabricksPythonConnectorEngineSpec.impersonate_user(
        database=database,
        username="user1",
        user_token="user-oauth-token",  # noqa: S106
        url=make_url("databricks://token:@host:443?http_path=/sql/1"),
        engine_kwargs=engine_kwargs,
    )
    DatabricksPythonConnectorEngineSpec.update_params_from_encrypted_extra(
        database, engine_kwargs
    )

    assert url.password == "user-oauth-token"  # noqa: S105
    assert engine_kwargs == {"connect_args": {"_user_agent_entry": "Apache Superset"}}


@pytest.mark.parametrize(
    "spec",
    [DatabricksNativeEngineSpec, DatabricksPythonConnectorEngineSpec],
)
def test_start_oauth2_dance_requires_impersonation(
    mocker: MockerFixture,
    spec: Any,
) -> None:
    """
    Without impersonation the user's token is never used, so an auth failure
    (e.g. a revoked shared token) does not send the user through an
    authorization prompt; the caller raises the original error instead.
    """
    base_start = mocker.patch.object(BaseEngineSpec, "start_oauth2_dance")
    database: MagicMock = mocker.MagicMock()
    database.impersonate_user = False

    spec.start_oauth2_dance(database)
    base_start.assert_not_called()

    database.impersonate_user = True
    spec.start_oauth2_dance(database)
    base_start.assert_called_once_with(database)


def test_impersonation_with_shared_token_only_in_secure_extra(
    mocker: MockerFixture,
) -> None:
    """
    With the shared token only in the secure extra, the Python connector still
    authenticates as the user: ``impersonate_user`` puts the user's token in the
    URL password, which the dialect uses as ``access_token``, and the shared
    token is dropped rather than overriding it.
    """
    database: MagicMock = mocker.MagicMock()
    database.impersonate_user = True
    database.encrypted_extra = json.dumps(
        {"connect_args": {"access_token": "shared-pat"}}
    )
    engine_kwargs: dict[str, Any] = {"connect_args": {"http_path": "/sql/1"}}

    # Same order as ``Database._get_sqla_engine``.
    url, engine_kwargs = DatabricksPythonConnectorEngineSpec.impersonate_user(
        database=database,
        username="user1",
        user_token="user-oauth-token",  # noqa: S106
        url=make_url("databricks://token:@host:443?http_path=/sql/1"),
        engine_kwargs=engine_kwargs,
    )
    DatabricksPythonConnectorEngineSpec.update_params_from_encrypted_extra(
        database, engine_kwargs
    )

    assert url.password == "user-oauth-token"  # noqa: S105
    assert engine_kwargs["connect_args"] == {"http_path": "/sql/1"}


def test_update_params_invalid_encrypted_extra_raises(mocker: MockerFixture) -> None:
    """
    Malformed ``encrypted_extra`` JSON raises rather than silently connecting.
    """
    database = mocker.MagicMock()
    database.encrypted_extra = "{not valid json"

    with pytest.raises(json.JSONDecodeError):
        DatabricksNativeEngineSpec.update_params_from_encrypted_extra(database, {})


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
    mock_get_requester = mocker.patch(
        "superset.db_engine_specs.base.get_ssrf_safe_requester"
    )
    requests = mock_get_requester.return_value
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
        allow_redirects=False,
    )


def test_get_oauth2_token_python(
    mocker: MockerFixture,
    oauth2_config_python: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_token` for Python Connector engine.
    """
    mock_get_requester = mocker.patch(
        "superset.db_engine_specs.base.get_ssrf_safe_requester"
    )
    requests = mock_get_requester.return_value
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
        allow_redirects=False,
    )


def test_get_oauth2_fresh_token_native(
    mocker: MockerFixture,
    oauth2_config_native: OAuth2ClientConfig,
) -> None:
    """
    Test `get_oauth2_fresh_token` for Native engine.
    """
    mock_get_requester = mocker.patch(
        "superset.db_engine_specs.base.get_ssrf_safe_requester"
    )
    requests = mock_get_requester.return_value
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
        allow_redirects=False,
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
    # is_safe_host does live DNS resolution; whether these fixture hosts
    # happen to resolve depends on real-world DNS state outside test
    # control, so pin it rather than relying on that.
    mocker.patch("superset.db_engine_specs.base.is_safe_host", return_value=True)

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
    mock_get_requester = mocker.patch(
        "superset.db_engine_specs.base.get_ssrf_safe_requester"
    )
    requests = mock_get_requester.return_value
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
        allow_redirects=False,
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


def test_get_engine_spec_unrecognized_driver_prefers_python_connector() -> None:
    """
    ``get_engine_spec`` falls back to the first backend-matching spec (in module
    definition order) when the driver string matches no registered spec exactly.
    For Databricks that fallback must land on the modern Python connector, not
    the legacy Hive spec, whose ``execute()`` passes an ``async`` kwarg that the
    real ``databricks.sql.client.Cursor`` rejects (SUPERSET-PYTHON-179V,
    apache/superset#24786).
    """
    from superset.db_engine_specs import get_engine_spec
    from superset.db_engine_specs.databricks import (
        DatabricksHiveEngineSpec,
        DatabricksPythonConnectorEngineSpec,
    )

    # An unrecognized/legacy driver suffix falls through to the ambiguous
    # fallback, which must now resolve to the general-purpose connector spec.
    assert (
        get_engine_spec("databricks", "some-unrecognized-driver-name")
        is DatabricksPythonConnectorEngineSpec
    )

    # Exact driver matches must still resolve to their specific spec; the
    # relocation must not disturb exact-match resolution.
    assert get_engine_spec("databricks", "pyhive") is DatabricksHiveEngineSpec
    assert (
        get_engine_spec("databricks", "databricks-sql-python")
        is DatabricksPythonConnectorEngineSpec
    )


def test_monkeypatch_dialect_leaves_shared_colspecs_alone(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """
    The Databricks string patch must not reach dialects outside the Hive family.

    PyHive's HiveDialect inherits SQLAlchemy's shared ``DefaultDialect.colspecs``;
    writing to it changed String/Unicode/Text/Enum handling for every dialect that
    does not define its own ``colspecs``.
    """
    import enum

    import sqlalchemy as sa
    from sqlalchemy.engine.default import DefaultDialect

    pyhive = pytest.importorskip("pyhive.sqlalchemy_hive")

    from superset.db_engine_specs.databricks import monkeypatch_dialect

    class Color(enum.Enum):
        red = "red"

    class OtherDialect(DefaultDialect):
        """A dialect that relies on the shared colspecs."""

    monkeypatch.setattr(pyhive.HiveDialect, "colspecs", pyhive.HiveDialect.colspecs)
    monkeypatch_dialect()  # also ran when the module was imported

    assert sa.String not in DefaultDialect.colspecs
    other = OtherDialect()
    assert type(sa.Unicode(5).dialect_impl(other)) is sa.Unicode
    assert type(sa.Text().dialect_impl(other)) is sa.Text

    hive = pyhive.HiveDialect
    assert hive.colspecs is not DefaultDialect.colspecs
    assert hive.colspecs[sa.String].__name__ == "ContextAwareStringType"
    for dialect in (other, hive()):
        impl = sa.Enum(Color).dialect_impl(dialect)
        assert impl.result_processor(dialect, None)("red") is Color.red


def test_monkeypatch_dialect_preserves_hive_databricks_escaping(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The isolated mapping still escapes Hive-based Databricks literals."""
    import sqlalchemy as sa

    pyhive = pytest.importorskip("pyhive.sqlalchemy_hive")
    pytest.importorskip("databricks.sql")

    from pyhive.sqlalchemy_hive import HiveDialect

    from superset.db_engine_specs.databricks import monkeypatch_dialect

    class DatabricksDialect(HiveDialect):
        """Represent the legacy Hive-based Databricks dialect."""

    monkeypatch.setattr(pyhive.HiveDialect, "colspecs", pyhive.HiveDialect.colspecs)
    monkeypatch_dialect()

    assert (
        str(
            sa.literal("O'Hara").compile(
                dialect=DatabricksDialect(), compile_kwargs={"literal_binds": True}
            )
        )
        == r"'O\'Hara'"
    )


def test_use_equality_for_boolean_filters_property() -> None:
    """
    Test that Databricks engine specs enable use_equality_for_boolean_filters.
    Databricks SQL applies strict type checking: comparing a boolean column
    against an integer or a driver-rendered boolean bind fails with
    DATATYPE_MISMATCH (see #36765), so boolean filters use equality against
    explicit boolean keywords.
    """
    assert DatabricksBaseEngineSpec.use_equality_for_boolean_filters is True
    assert DatabricksNativeEngineSpec.use_equality_for_boolean_filters is True
    assert DatabricksPythonConnectorEngineSpec.use_equality_for_boolean_filters is True
    assert DatabricksHiveEngineSpec.use_equality_for_boolean_filters is True
    assert SparkEngineSpec.use_equality_for_boolean_filters is True


@pytest.mark.parametrize(
    "engine_spec",
    [
        DatabricksBaseEngineSpec,
        DatabricksNativeEngineSpec,
        DatabricksPythonConnectorEngineSpec,
        DatabricksHiveEngineSpec,
        SparkEngineSpec,
    ],
    ids=[
        "databricks_base",
        "databricks_native",
        "databricks_python_connector",
        "databricks_hive",
        "spark",
    ],
)
def test_coerce_boolean_for_sql_emits_boolean_keywords(
    engine_spec: type[BaseEngineSpec],
) -> None:
    """
    Test that boolean filter values are coerced to SQLAlchemy true()/false()
    expressions on every Databricks and Spark spec, so the compiled SQL always
    contains the TRUE/FALSE keywords and the values never reach the driver as
    bind parameters (which pyhive renders as 0/1, see #36765).
    """
    true_value = engine_spec.coerce_boolean_for_sql(True)
    assert isinstance(true_value, ColumnElement)
    assert str(true_value.compile(compile_kwargs={"literal_binds": True})) == "true"

    false_value = engine_spec.coerce_boolean_for_sql(False)
    assert isinstance(false_value, ColumnElement)
    assert str(false_value.compile(compile_kwargs={"literal_binds": True})) == "false"

    assert engine_spec.coerce_boolean_for_sql(None) is None


@pytest.mark.parametrize(
    "engine_spec",
    [
        DatabricksBaseEngineSpec,
        DatabricksNativeEngineSpec,
        DatabricksPythonConnectorEngineSpec,
        DatabricksHiveEngineSpec,
        SparkEngineSpec,
    ],
    ids=[
        "databricks_base",
        "databricks_native",
        "databricks_python_connector",
        "databricks_hive",
        "spark",
    ],
)
@pytest.mark.parametrize(
    "filter_operator,expected",
    [
        (FilterOperator.IS_TRUE, "is_test_user = true"),
        (FilterOperator.IS_FALSE, "is_test_user = false"),
    ],
)
def test_handle_boolean_filter_compiles_boolean_keywords(
    engine_spec: type[BaseEngineSpec],
    filter_operator: FilterOperator,
    expected: str,
) -> None:
    """
    Test that handle_boolean_filter produces an equality comparison against an
    explicit boolean keyword, with no bind parameters left for the driver to
    render as integers.
    """
    bool_col = Column("is_test_user", Boolean)
    result = engine_spec.handle_boolean_filter(
        bool_col,
        filter_operator,
        filter_operator == FilterOperator.IS_TRUE,
    )
    compiled = result.compile()
    assert str(compiled) == expected
    assert compiled.params == {}


def test_handle_boolean_filter_computed_column_compilation() -> None:
    """
    Test that handle_boolean_filter compiles properly on computed boolean
    expressions.
    """
    computed_col = literal_column("(total_amount > 100)")
    for engine_spec in (
        DatabricksBaseEngineSpec,
        DatabricksNativeEngineSpec,
        DatabricksPythonConnectorEngineSpec,
        DatabricksHiveEngineSpec,
        SparkEngineSpec,
    ):
        result = engine_spec.handle_boolean_filter(
            computed_col, FilterOperator.IS_TRUE, True
        )
        assert (
            str(result.compile(compile_kwargs={"literal_binds": True}))
            == "(total_amount > 100) = true"
        )


@pytest.mark.parametrize(
    "spec_cls",
    [DatabricksNativeEngineSpec, DatabricksPythonConnectorEngineSpec],
)
@pytest.mark.parametrize(
    ("aggregate", "expected_sql"),
    [
        ("MEDIAN", "median(sales)"),
        ("STDDEV_SAMP", "stddev_samp(sales)"),
        ("VAR_SAMP", "var_samp(sales)"),
    ],
)
def test_extended_aggregation_func_compiles_expected_sql(
    spec_cls: type[DatabricksBaseEngineSpec], aggregate: str, expected_sql: str
) -> None:
    """
    Verified against the Databricks SQL function reference
    (docs.databricks.com/aws/en/sql/language-manual/functions/{median,
    stddev_samp,var_samp}), not a live instance: all three are plain,
    dialect-agnostic function calls (unlike Postgres's MEDIAN, which needs
    percentile_cont/WITHIN GROUP), so there is no dialect-specific SQL
    construct to compile here.
    """
    from sqlalchemy.sql import column

    func = spec_cls.get_extended_aggregation_func(aggregate)
    assert func is not None

    compiled = str(
        func(column("sales")).compile(compile_kwargs={"literal_binds": True})
    )
    assert compiled == expected_sql


def test_databricks_hive_spec_shares_extended_aggregations() -> None:
    """
    Interactive Clusters (``DatabricksHiveEngineSpec``) run Spark SQL too, so
    the same native aggregates apply -- confirming this spec does NOT fall
    back to the inherited, unimplemented ``HiveEngineSpec``/``PrestoEngineSpec``
    default (an empty dict, i.e. "not supported on this database").
    """
    from superset.db_engine_specs.databricks import DatabricksHiveEngineSpec

    for aggregate in ("MEDIAN", "STDDEV_SAMP", "VAR_SAMP"):
        assert DatabricksHiveEngineSpec.get_extended_aggregation_func(aggregate)


def test_has_query_id_before_execute_is_false() -> None:
    """
    The cancel id can only be read off the cursor after a statement has been
    executed (``cursor.active_command_id`` is unset before that), so the id
    must be captured post-execute rather than up front.
    """
    assert DatabricksPythonConnectorEngineSpec.has_query_id_before_execute is False


def test_get_cancel_query_id_sea(mocker: MockerFixture) -> None:
    """
    On a SEA (Statement Execution API) connection, the cancel id is the
    statement id exposed by the driver's ``CommandId``.
    """
    from superset.models.sql_lab import Query

    cursor = mocker.MagicMock()
    cursor.active_command_id.to_sea_statement_id.return_value = "01ecc35f-abcd"
    cursor.connection.session.use_sea = True

    query = Query()
    assert (
        DatabricksPythonConnectorEngineSpec.get_cancel_query_id(cursor, query)
        == "01ecc35f-abcd"
    )


def test_get_cancel_query_id_no_active_command(mocker: MockerFixture) -> None:
    """
    Before a statement has been executed on the cursor, there's nothing to
    build a cancel id from.
    """
    from superset.models.sql_lab import Query

    cursor = mocker.MagicMock()
    cursor.active_command_id = None
    cursor.connection.session.use_sea = True

    query = Query()
    assert (
        DatabricksPythonConnectorEngineSpec.get_cancel_query_id(cursor, query) is None
    )


def test_get_cancel_query_id_thrift_backend_returns_none(
    mocker: MockerFixture,
) -> None:
    """
    When the connection was not established with ``use_sea=True`` (i.e. it's
    using the default Thrift backend), no cancel id is captured -- cancelling
    a Thrift command requires a secret that's never exposed through any
    public driver API, so we deliberately don't attempt it.
    """
    from superset.models.sql_lab import Query

    cursor = mocker.MagicMock()
    cursor.active_command_id.to_sea_statement_id.return_value = "01ecc35f-abcd"
    cursor.connection.session.use_sea = False

    query = Query()
    assert (
        DatabricksPythonConnectorEngineSpec.get_cancel_query_id(cursor, query) is None
    )


@pytest.fixture
def databricks_command_id(mocker: MockerFixture) -> Any:
    """
    Stand-in for ``databricks.sql.backend.types.CommandId``.

    The optional ``databricks-sql-connector`` driver isn't installed in the
    unit-test environment, so the module chain is injected into ``sys.modules``
    to let ``cancel_query``'s inline import resolve. Yields the ``CommandId``
    mock so tests can assert on ``from_sea_statement_id``.
    """
    command_id_cls = mocker.MagicMock()
    mocker.patch.dict(
        "sys.modules",
        {
            "databricks": mocker.MagicMock(),
            "databricks.sql": mocker.MagicMock(),
            "databricks.sql.backend": mocker.MagicMock(),
            "databricks.sql.backend.types": mocker.MagicMock(CommandId=command_id_cls),
        },
    )
    return command_id_cls


def test_cancel_query_sea_success(
    mocker: MockerFixture, databricks_command_id: Any
) -> None:
    """
    ``cancel_query`` sets the reconstructed SEA ``CommandId`` on the fresh
    cursor and delegates to the driver's own ``cursor.cancel()``.
    """
    from superset.models.sql_lab import Query

    cursor = mocker.MagicMock()

    query = Query()
    assert (
        DatabricksPythonConnectorEngineSpec.cancel_query(cursor, query, "01ecc35f-abcd")
        is True
    )
    databricks_command_id.from_sea_statement_id.assert_called_once_with("01ecc35f-abcd")
    assert (
        cursor.active_command_id
        == databricks_command_id.from_sea_statement_id.return_value
    )
    cursor.cancel.assert_called_once_with()


def test_cancel_query_invalid_id_returns_false(mocker: MockerFixture) -> None:
    """
    A malformed cancel id is rejected before touching the cursor at all.
    """
    from superset.models.sql_lab import Query

    cursor = mocker.MagicMock()
    query = Query()
    assert (
        DatabricksPythonConnectorEngineSpec.cancel_query(
            cursor, query, "'; DROP TABLE foo; --"
        )
        is False
    )
    cursor.cancel.assert_not_called()


def test_cancel_query_propagates_errors(
    mocker: MockerFixture, databricks_command_id: Any
) -> None:
    """
    If the cancel attempt itself fails (e.g. the fresh cursor/connection
    errors), the error must surface rather than being reported as a failed-
    but-handled cancel.
    """
    from superset.models.sql_lab import Query

    cursor = mocker.MagicMock()
    cursor.cancel.side_effect = RuntimeError("connection reset")

    query = Query()
    with pytest.raises(RuntimeError):
        DatabricksPythonConnectorEngineSpec.cancel_query(cursor, query, "01ecc35f-abcd")


class FakeSeaCursor:
    """
    Minimal SEA cursor: each ``execute_async`` publishes the next statement id,
    and the statement reports as pending for a fixed number of polls.
    """

    def __init__(self, statement_ids: list[str], pending_polls: int) -> None:
        self.connection = MagicMock()
        self.connection.session.use_sea = True
        self.backend = MagicMock()
        self.active_command_id: Any = None
        self.statement_ids = iter(statement_ids)
        self.pending_polls = pending_polls
        self.statement_id: str | None = None
        self.remaining_polls = 0
        self.cancelled: list[str | None] = []
        self.results_loaded: list[str | None] = []
        # Exceptions raised by successive status polls before they succeed.
        self.poll_errors: list[BaseException] = []

    def execute_async(self, sql: str) -> None:
        self.statement_id = next(self.statement_ids)
        self.active_command_id = MagicMock()
        self.active_command_id.to_sea_statement_id.return_value = self.statement_id
        self.remaining_polls = self.pending_polls

    def is_query_pending(self) -> bool:
        if self.poll_errors:
            raise self.poll_errors.pop(0)
        if self.remaining_polls > 0:
            self.remaining_polls -= 1
            return True
        return False

    def cancel(self) -> None:
        self.cancelled.append(self.statement_id)
        self.remaining_polls = 0

    def get_async_execution_result(self) -> None:
        self.results_loaded.append(self.statement_id)


@pytest.fixture
def sea_session(mocker: MockerFixture) -> Any:
    """Stub the metadata session and polling clock used by the SEA loop."""
    mocker.patch("superset.db_engine_specs.databricks.time.sleep")
    mocker.patch(
        "superset.db_engine_specs.databricks.app",
        config={"DB_POLL_INTERVAL_SECONDS": {}},
    )
    return mocker.patch("superset.db_engine_specs.databricks.db")


def test_execute_with_cursor_sea_finished_statement(sea_session: Any) -> None:
    """
    A statement that finishes on its own has its results loaded onto the
    cursor, and its id is retired once it's no longer running.
    """
    from superset.constants import QUERY_CANCEL_KEY
    from superset.models.sql_lab import Query
    from superset.utils.core import QueryStatus

    cursor = FakeSeaCursor(["stmt-1"], pending_polls=2)
    query = Query(status=QueryStatus.RUNNING)
    published: list[Any] = []
    sea_session.session.refresh.side_effect = lambda q: published.append(
        q.extra.get(QUERY_CANCEL_KEY)
    )

    DatabricksPythonConnectorEngineSpec.execute_with_cursor(cursor, "SELECT 1", query)

    assert "stmt-1" in published
    assert cursor.results_loaded == ["stmt-1"]
    assert cursor.cancelled == []
    assert QUERY_CANCEL_KEY not in query.extra


def test_execute_with_cursor_sea_cancels_in_flight_statement(
    sea_session: Any,
) -> None:
    """
    A stop that lands while the statement is still running on the warehouse
    cancels it through the live cursor, and no results are loaded.
    """
    from superset.constants import QUERY_CANCEL_KEY
    from superset.models.sql_lab import Query
    from superset.utils.core import QueryStatus

    cursor = FakeSeaCursor(["stmt-1"], pending_polls=100)
    query = Query(status=QueryStatus.RUNNING)
    polls = 0

    def refresh(q: Query) -> None:
        nonlocal polls
        polls += 1
        if polls == 3:
            # The stop is persisted while the statement is mid-flight, and its
            # published id is the one a stop request would cancel.
            assert q.extra.get(QUERY_CANCEL_KEY) == "stmt-1"
            q.status = QueryStatus.STOPPED

    sea_session.session.refresh.side_effect = refresh

    DatabricksPythonConnectorEngineSpec.execute_with_cursor(cursor, "SELECT 1", query)

    assert cursor.cancelled == ["stmt-1"]
    assert cursor.remaining_polls == 0
    assert cursor.results_loaded == []
    assert QUERY_CANCEL_KEY not in query.extra


def test_execute_with_cursor_sea_multi_statement_cancels_current(
    sea_session: Any,
) -> None:
    """
    On a multi-statement script, a stop cancels whichever statement is running:
    the finished statement's id is retired and never targeted.
    """
    from superset.constants import QUERY_CANCEL_KEY
    from superset.models.sql_lab import Query
    from superset.utils.core import QueryStatus

    cursor = FakeSeaCursor(["stmt-1", "stmt-2"], pending_polls=5)
    query = Query(status=QueryStatus.RUNNING)
    published: list[Any] = []
    stop_on_statement = "stmt-2"

    def refresh(q: Query) -> None:
        published.append(q.extra.get(QUERY_CANCEL_KEY))
        if q.extra.get(QUERY_CANCEL_KEY) == stop_on_statement:
            q.status = QueryStatus.STOPPED

    sea_session.session.refresh.side_effect = refresh

    spec = DatabricksPythonConnectorEngineSpec
    spec.execute_with_cursor(cursor, "SELECT 1", query)
    # Between the statements no id is published, so nothing stale is cancelled.
    assert QUERY_CANCEL_KEY not in query.extra
    spec.execute_with_cursor(cursor, "SELECT 2", query)

    assert cursor.results_loaded == ["stmt-1"]
    assert cursor.cancelled == ["stmt-2"]
    assert "stmt-1" in published
    assert "stmt-2" in published
    assert QUERY_CANCEL_KEY not in query.extra


def test_execute_with_cursor_sea_stop_between_statements(sea_session: Any) -> None:
    """
    A stop that arrives between statements finds no published id; it is routed
    to the polling loop, which cancels the next statement as soon as it polls.
    """
    from superset.constants import QUERY_EARLY_CANCEL_KEY
    from superset.models.sql_lab import Query
    from superset.utils.core import QueryStatus

    cursor = FakeSeaCursor(["stmt-1", "stmt-2"], pending_polls=5)
    query = Query(status=QueryStatus.RUNNING)

    spec = DatabricksPythonConnectorEngineSpec
    spec.execute_with_cursor(cursor, "SELECT 1", query)

    spec.prepare_cancel_query(query)
    assert query.extra.get(QUERY_EARLY_CANCEL_KEY) is True

    spec.execute_with_cursor(cursor, "SELECT 2", query)

    assert cursor.results_loaded == ["stmt-1"]
    assert cursor.cancelled == ["stmt-2"]


def test_prepare_cancel_query_with_published_id_is_noop() -> None:
    """While a statement id is published, the stop cancels it by id."""
    from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY
    from superset.models.sql_lab import Query

    query = Query()
    query.set_extra_json_key(
        DatabricksPythonConnectorEngineSpec.sea_async_execution_key, True
    )
    query.set_extra_json_key(QUERY_CANCEL_KEY, "stmt-1")

    DatabricksPythonConnectorEngineSpec.prepare_cancel_query(query)

    assert QUERY_EARLY_CANCEL_KEY not in query.extra


def test_prepare_cancel_query_thrift_is_noop() -> None:
    """
    Thrift statements never run through the polling loop, so a stop is not
    reported as handled by staging early-cancel intent.
    """
    from superset.constants import QUERY_EARLY_CANCEL_KEY
    from superset.models.sql_lab import Query

    query = Query()
    DatabricksPythonConnectorEngineSpec.prepare_cancel_query(query)

    assert QUERY_EARLY_CANCEL_KEY not in query.extra


def test_execute_with_cursor_thrift_uses_synchronous_path(
    mocker: MockerFixture,
) -> None:
    """Thrift connections keep the base synchronous execution."""
    from superset.models.sql_lab import Query

    base = mocker.patch(
        "superset.db_engine_specs.databricks."
        "DatabricksDynamicBaseEngineSpec.execute_with_cursor"
    )
    cursor = mocker.MagicMock()
    cursor.connection.session.use_sea = False
    query = Query()

    DatabricksPythonConnectorEngineSpec.execute_with_cursor(cursor, "SELECT 1", query)

    base.assert_called_once_with(cursor, "SELECT 1", query)
    cursor.execute_async.assert_not_called()


def test_execute_with_cursor_sea_soft_time_limit_cancels(sea_session: Any) -> None:
    """Hitting the task's soft time limit cancels the running statement."""
    from celery.exceptions import SoftTimeLimitExceeded

    from superset.models.sql_lab import Query
    from superset.utils.core import QueryStatus

    cursor = FakeSeaCursor(["stmt-1"], pending_polls=100)
    query = Query(status=QueryStatus.RUNNING)
    polls = 0

    def refresh(q: Query) -> None:
        nonlocal polls
        polls += 1
        if polls == 2:
            raise SoftTimeLimitExceeded()

    sea_session.session.refresh.side_effect = refresh

    with pytest.raises(SoftTimeLimitExceeded):
        DatabricksPythonConnectorEngineSpec.execute_with_cursor(
            cursor, "SELECT 1", query
        )

    assert cursor.cancelled == ["stmt-1"]


def test_execute_with_cursor_sea_transient_poll_failure_stays_cancellable(
    sea_session: Any,
) -> None:
    """
    A failed status request doesn't count as the statement finishing: its id
    stays published and a stop that follows still cancels the live statement.
    """
    from superset.constants import QUERY_CANCEL_KEY
    from superset.models.sql_lab import Query
    from superset.utils.core import QueryStatus

    cursor = FakeSeaCursor(["stmt-1"], pending_polls=100)
    cursor.poll_errors = [ConnectionResetError("connection reset by peer")]
    query = Query(status=QueryStatus.RUNNING)
    published: list[Any] = []

    def refresh(q: Query) -> None:
        published.append(q.extra.get(QUERY_CANCEL_KEY))
        if len(published) == 3:
            q.status = QueryStatus.STOPPED

    sea_session.session.refresh.side_effect = refresh

    DatabricksPythonConnectorEngineSpec.execute_with_cursor(cursor, "SELECT 1", query)

    # The poll after the failure still saw the statement's published id.
    assert published[:3] == ["stmt-1", "stmt-1", "stmt-1"]
    assert cursor.cancelled == ["stmt-1"]
    assert cursor.results_loaded == []


def test_execute_with_cursor_sea_transient_poll_failure_then_finishes(
    sea_session: Any,
) -> None:
    """Polling resumes after a failed status request and loads the results."""
    from superset.models.sql_lab import Query
    from superset.utils.core import QueryStatus

    cursor = FakeSeaCursor(["stmt-1"], pending_polls=2)
    cursor.poll_errors = [RuntimeError("503 Service Unavailable")]
    query = Query(status=QueryStatus.RUNNING)

    DatabricksPythonConnectorEngineSpec.execute_with_cursor(cursor, "SELECT 1", query)

    assert cursor.cancelled == []
    assert cursor.results_loaded == ["stmt-1"]


def test_execute_with_cursor_sea_persistent_poll_failure_cancels(
    sea_session: Any,
) -> None:
    """
    When status requests keep failing, the statement is cancelled rather than
    left running unmonitored, and the error is raised.
    """
    from superset.models.sql_lab import Query
    from superset.utils.core import QueryStatus

    spec = DatabricksPythonConnectorEngineSpec
    cursor = FakeSeaCursor(["stmt-1"], pending_polls=100)
    cursor.poll_errors = [
        RuntimeError("429 Too Many Requests") for _ in range(spec.sea_max_poll_failures)
    ]
    query = Query(status=QueryStatus.RUNNING)

    with pytest.raises(Exception, match="429 Too Many Requests"):
        spec.execute_with_cursor(cursor, "SELECT 1", query)

    assert cursor.cancelled == ["stmt-1"]
    assert cursor.results_loaded == []


def test_execute_with_cursor_sea_timeout_during_poll_cancels(
    sea_session: Any,
) -> None:
    """A Superset timeout raised during a status request cancels the statement."""
    from superset.errors import ErrorLevel, SupersetErrorType
    from superset.exceptions import SupersetTimeoutException
    from superset.models.sql_lab import Query
    from superset.utils.core import QueryStatus

    cursor = FakeSeaCursor(["stmt-1"], pending_polls=100)
    cursor.poll_errors = [
        SupersetTimeoutException(
            error_type=SupersetErrorType.BACKEND_TIMEOUT_ERROR,
            message="timed out",
            level=ErrorLevel.ERROR,
        )
    ]
    query = Query(status=QueryStatus.RUNNING)

    with pytest.raises(SupersetTimeoutException):
        DatabricksPythonConnectorEngineSpec.execute_with_cursor(
            cursor, "SELECT 1", query
        )

    assert cursor.cancelled == ["stmt-1"]


def test_execute_with_cursor_sea_failed_statement_keeps_server_error(
    sea_session: Any,
) -> None:
    """
    A statement that fails on the warehouse surfaces the server's error code
    and message, as the synchronous path does, not the driver's generic
    "Operation status FAILED" error from ``get_async_execution_result``.
    """
    from superset.models.sql_lab import Query
    from superset.utils.core import QueryStatus

    server_error = "Command failed: PARSE_SYNTAX_ERROR - syntax error at or near 'FOO'"
    cursor = FakeSeaCursor(["stmt-1"], pending_polls=1)
    cursor.get_async_execution_result = MagicMock(  # type: ignore[method-assign]
        side_effect=RuntimeError(
            "get_execution_result failed with Operation status CommandState.FAILED"
        )
    )
    cursor.backend._check_command_not_in_failed_or_closed_state.side_effect = (
        RuntimeError(server_error)
    )
    query = Query(status=QueryStatus.RUNNING)

    with pytest.raises(Exception, match="PARSE_SYNTAX_ERROR") as excinfo:
        DatabricksPythonConnectorEngineSpec.execute_with_cursor(
            cursor, "SELECT FOO", query
        )

    assert "Operation status" not in str(excinfo.value)
    status = cursor.backend._poll_query.return_value.status
    cursor.backend._poll_query.assert_called_once_with(cursor.active_command_id)
    cursor.backend._check_command_not_in_failed_or_closed_state.assert_called_once_with(
        status, cursor.active_command_id
    )


def test_execute_with_cursor_sea_failed_statement_without_detail(
    sea_session: Any,
) -> None:
    """
    If the server's error can't be retrieved, the driver's own error is raised
    rather than the statement being reported as successful.
    """
    from superset.models.sql_lab import Query
    from superset.utils.core import QueryStatus

    cursor = FakeSeaCursor(["stmt-1"], pending_polls=1)
    cursor.get_async_execution_result = MagicMock(  # type: ignore[method-assign]
        side_effect=RuntimeError("Operation status CommandState.FAILED")
    )
    cursor.backend._poll_query.side_effect = ConnectionResetError("reset")
    query = Query(status=QueryStatus.RUNNING)

    with pytest.raises(Exception, match="Operation status CommandState.FAILED"):
        DatabricksPythonConnectorEngineSpec.execute_with_cursor(
            cursor, "SELECT FOO", query
        )
