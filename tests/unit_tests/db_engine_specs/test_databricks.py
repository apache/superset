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
# ruff: noqa: S105, S106

from datetime import datetime
from typing import Any, Optional
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.engine.url import URL

from superset.db_engine_specs.base import BaseEngineSpec
from superset.db_engine_specs.databricks import (
    DatabricksAuthError,
    DatabricksBaseEngineSpec,
    DatabricksHiveEngineSpec,
    DatabricksNativeEngineSpec,
    DatabricksODBCEngineSpec,
    DatabricksPythonConnectorEngineSpec,
)
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.utils import json
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
            "access_token": {"default": "", "type": "string"},
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


# ============================================================================
# OAuth2 and Impersonation Tests
# ============================================================================


ALL_DATABRICKS_SPECS: list[type[BaseEngineSpec]] = [
    DatabricksHiveEngineSpec,
    DatabricksBaseEngineSpec,
    DatabricksODBCEngineSpec,
    DatabricksNativeEngineSpec,
    DatabricksPythonConnectorEngineSpec,
]


@pytest.mark.parametrize("spec", ALL_DATABRICKS_SPECS)
def test_oauth2_class_vars(spec: type[BaseEngineSpec]) -> None:
    """All Databricks specs should have OAuth2 support enabled."""
    assert spec.supports_oauth2 is True
    assert spec.oauth2_scope == "sql offline_access"
    assert spec.oauth2_exception is DatabricksAuthError
    assert spec.oauth2_token_request_type == "data"


def test_impersonate_user_with_oauth_token() -> None:
    """When user_token is provided, the URL password should be replaced."""
    database = MagicMock()
    url = URL.create(
        "databricks",
        username="token",
        password="original-pat",
        host="workspace.cloud.databricks.com",
        port=443,
        query={"http_path": "sql/1.0/warehouses/abc123", "catalog": "gold"},
    )
    engine_kwargs: dict[str, Any] = {
        "connect_args": {"http_path": "sql/1.0/warehouses/abc123"},
    }

    new_url, new_kwargs = DatabricksPythonConnectorEngineSpec.impersonate_user(
        database, "test_user", "oauth-access-token-xyz", url, engine_kwargs
    )

    assert new_url.password == "oauth-access-token-xyz"
    assert new_url.username == "token"
    assert new_url.host == "workspace.cloud.databricks.com"
    # connect_args should be unchanged
    assert new_kwargs["connect_args"]["http_path"] == "sql/1.0/warehouses/abc123"


def test_impersonate_user_without_token() -> None:
    """When user_token is None and OAuth not enabled, URL stays."""
    database = MagicMock()
    database.is_oauth2_enabled.return_value = False
    url = URL.create(
        "databricks",
        username="token",
        password="original-pat",
        host="workspace.cloud.databricks.com",
        port=443,
    )
    engine_kwargs: dict[str, Any] = {}

    new_url, _ = DatabricksPythonConnectorEngineSpec.impersonate_user(
        database, "test_user", None, url, engine_kwargs
    )

    assert new_url.password == "original-pat"


def test_impersonate_user_no_username() -> None:
    """When username is None, impersonation should be a no-op."""
    database = MagicMock()
    url = URL.create(
        "databricks",
        username="token",
        password="original-pat",
        host="workspace.cloud.databricks.com",
        port=443,
    )
    engine_kwargs: dict[str, Any] = {"connect_args": {"foo": "bar"}}

    new_url, new_kwargs = DatabricksPythonConnectorEngineSpec.impersonate_user(
        database, None, "some-token", url, engine_kwargs
    )

    assert new_url.password == "original-pat"
    assert new_kwargs == {"connect_args": {"foo": "bar"}}


def test_impersonate_user_no_token_triggers_oauth_dance() -> None:
    """When OAuth is enabled but no token exists, should trigger OAuth dance."""
    from unittest.mock import patch

    database = MagicMock()
    database.is_oauth2_enabled.return_value = True
    url = URL.create(
        "databricks",
        username="token",
        password="valid-pat",
        host="workspace.cloud.databricks.com",
        port=443,
    )
    engine_kwargs: dict[str, Any] = {}

    with patch.object(
        DatabricksPythonConnectorEngineSpec, "start_oauth2_dance"
    ) as mock_dance:
        DatabricksPythonConnectorEngineSpec.impersonate_user(
            database, "test_user", None, url, engine_kwargs
        )
        mock_dance.assert_called_once_with(database)


def test_impersonate_user_no_token_no_oauth_skips_dance() -> None:
    """When OAuth is NOT enabled and no token exists, should not trigger dance."""
    database = MagicMock()
    database.is_oauth2_enabled.return_value = False
    url = URL.create(
        "databricks",
        username="token",
        password="valid-pat",
        host="workspace.cloud.databricks.com",
        port=443,
    )
    engine_kwargs: dict[str, Any] = {}

    new_url, _ = DatabricksPythonConnectorEngineSpec.impersonate_user(
        database, "test_user", None, url, engine_kwargs
    )

    # PAT should remain unchanged, no dance triggered
    assert new_url.password == "valid-pat"


def test_databricks_auth_error_detection() -> None:
    """The DatabricksAuthError metaclass should match auth failures."""
    try:
        from databricks.sql.exc import RequestError as DatabricksRequestError
    except ImportError:
        pytest.skip("databricks-sql-connector not installed")

    # Should match 401
    error_401 = DatabricksRequestError("Error 401: Unauthorized access")
    assert isinstance(error_401, DatabricksAuthError)

    # Should match 403
    error_403 = DatabricksRequestError("Error 403: Forbidden")
    assert isinstance(error_403, DatabricksAuthError)

    # Should match "unauthorized"
    error_unauth = DatabricksRequestError("Unauthorized request to endpoint")
    assert isinstance(error_unauth, DatabricksAuthError)

    # Should match "invalid access token"
    error_token = DatabricksRequestError("Invalid access token provided")
    assert isinstance(error_token, DatabricksAuthError)

    # Should NOT match a generic error
    error_generic = DatabricksRequestError("Connection timeout after 30s")
    assert not isinstance(error_generic, DatabricksAuthError)


def test_get_oauth2_config_with_host(mocker: MockerFixture) -> None:
    """OIDC endpoints should be auto-derived from the host config key."""
    mocker.patch(
        "superset.db_engine_specs.databricks.app.config",
        {
            "DATABASE_OAUTH2_CLIENTS": {
                "Databricks": {
                    "id": "test-client-id",
                    "secret": "test-client-secret",
                    "host": "myworkspace.cloud.databricks.com",
                },
            },
            "DATABASE_OAUTH2_REDIRECT_URI": "http://localhost:8088/api/v1/database/oauth2/",
        },
    )

    config = DatabricksPythonConnectorEngineSpec.get_oauth2_config()

    assert config is not None
    assert config["id"] == "test-client-id"
    assert config["secret"] == "test-client-secret"
    assert config["scope"] == "sql offline_access"
    assert (
        config["authorization_request_uri"]
        == "https://myworkspace.cloud.databricks.com/oidc/v1/authorize"
    )
    assert (
        config["token_request_uri"]
        == "https://myworkspace.cloud.databricks.com/oidc/v1/token"
    )
    assert config["redirect_uri"] == "http://localhost:8088/api/v1/database/oauth2/"


def test_get_oauth2_config_with_explicit_uris(mocker: MockerFixture) -> None:
    """Explicit URIs should take precedence over host-derived ones."""
    mocker.patch(
        "superset.db_engine_specs.databricks.app.config",
        {
            "DATABASE_OAUTH2_CLIENTS": {
                "Databricks": {
                    "id": "test-client-id",
                    "secret": "test-client-secret",
                    "host": "myworkspace.cloud.databricks.com",
                    "authorization_request_uri": "https://custom-auth.example.com/authorize",
                    "token_request_uri": "https://custom-auth.example.com/token",
                },
            },
            "DATABASE_OAUTH2_REDIRECT_URI": "http://localhost:8088/api/v1/database/oauth2/",
        },
    )

    config = DatabricksPythonConnectorEngineSpec.get_oauth2_config()

    assert config is not None
    assert (
        config["authorization_request_uri"]
        == "https://custom-auth.example.com/authorize"
    )
    assert config["token_request_uri"] == "https://custom-auth.example.com/token"


def test_get_oauth2_config_not_configured(mocker: MockerFixture) -> None:
    """Should return None when Databricks is not in DATABASE_OAUTH2_CLIENTS."""
    mocker.patch(
        "superset.db_engine_specs.databricks.app.config",
        {
            "DATABASE_OAUTH2_CLIENTS": {},
        },
    )

    config = DatabricksPythonConnectorEngineSpec.get_oauth2_config()
    assert config is None


def test_needs_oauth2_with_wrapped_exception() -> None:
    """needs_oauth2 should detect auth errors in the exception cause chain."""
    from unittest.mock import patch

    # Simulate SQLAlchemy wrapping a 401 error
    inner = Exception("Error during request to server: status code 401")
    outer = Exception("(databricks.sql.exc.RequestError) wrapped")
    outer.__cause__ = inner

    with patch(
        "superset.db_engine_specs.databricks.has_request_context", return_value=True
    ):
        with patch("superset.db_engine_specs.databricks.g") as mock_g:
            mock_g.user = MagicMock()
            assert DatabricksPythonConnectorEngineSpec.needs_oauth2(outer) is True


def test_needs_oauth2_no_request_context() -> None:
    """needs_oauth2 should return False outside request context."""
    from unittest.mock import patch

    ex = Exception("status code 401")
    with patch(
        "superset.db_engine_specs.databricks.has_request_context", return_value=False
    ):
        assert DatabricksPythonConnectorEngineSpec.needs_oauth2(ex) is False


def test_update_params_strips_oauth2_client_info() -> None:
    """oauth2_client_info should not leak into engine params."""
    database = MagicMock()
    database.encrypted_extra = json.dumps(
        {
            "oauth2_client_info": {"id": "secret-id", "secret": "secret-value"},
            "some_other_param": "keep-this",
        }
    )

    params: dict[str, Any] = {}
    DatabricksPythonConnectorEngineSpec.update_params_from_encrypted_extra(
        database, params
    )

    assert "oauth2_client_info" not in params
    assert params["some_other_param"] == "keep-this"


def test_impersonation_capability_detected() -> None:
    """The impersonation capability should be detected by lib.py's has_custom_method."""
    from superset.db_engine_specs.lib import has_custom_method

    for spec in ALL_DATABRICKS_SPECS:
        assert has_custom_method(spec, "impersonate_user"), (
            f"{spec.__name__} should be detected as having custom impersonate_user"
        )
