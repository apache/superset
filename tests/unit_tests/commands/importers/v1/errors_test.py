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
import ssl

import pytest
from marshmallow import ValidationError
from sqlalchemy.exc import NoSuchModuleError, OperationalError

from superset.commands.dataset.exceptions import MultiCatalogDisabledValidationError
from superset.commands.exceptions import CommandInvalidError, ForbiddenError
from superset.commands.importers.v1.errors import import_error_context, ImportAssetError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import OAuth2RedirectError, SupersetErrorException


@pytest.mark.parametrize(
    "uri,message,expected",
    [
        (
            "postgresql://user@host/db",
            'password authentication failed for user "secret-user"',
            "credentials",
        ),
        (
            "mysql://user@host/db",
            "Access denied for user 'secret-user'@'private-host'",
            "credentials",
        ),
        (
            "postgresql://user@host/db",
            (
                'could not translate host name "private-host" to address: '
                "nodename nor servname provided, or not known"
            ),
            "could not reach",
        ),
        (
            "mysql://user@host/db",
            "Unknown MySQL server host 'private-host'",
            "could not reach",
        ),
        ("snowflake://user@host/db", "251006: Password is empty", "credentials"),
    ],
)
def test_database_import_error_is_actionable_and_redacted(
    uri: str, message: str, expected: str
) -> None:
    """Different engines provide safe instructions, without driver text or SQL."""
    cause = OperationalError(
        "SELECT 'secret-sql'", {"password": "secret-param"}, Exception(message)
    )
    with pytest.raises(ImportAssetError) as caught:
        with import_error_context("databases/example.yaml", {"sqlalchemy_uri": uri}):
            raise cause
    assert expected in caught.value.message
    assert "databases/example.yaml" in caught.value.message
    assert "retry" in caught.value.message or "Test" in caught.value.message
    assert caught.value.status == 400
    assert caught.value.__cause__ is cause
    for secret in (
        "secret-sql",
        "secret-param",
        "secret-user",
        "private-host",
        message,
    ):
        assert secret not in caught.value.message


@pytest.mark.parametrize(
    "cause,expected,status",
    [
        (NoSuchModuleError("secret-driver-path"), "install the required driver", 400),
        (TimeoutError("secret-host"), "timed out", 400),
        (ssl.SSLError("secret-certificate"), "TLS connection failed", 400),
        (
            OAuth2RedirectError("secret-url", "secret-tab", "secret-redirect"),
            "sign in",
            400,
        ),
        (ForbiddenError("Cannot create charts."), "required access", 403),
        (MultiCatalogDisabledValidationError(), "default catalog", 400),
        (ValidationError("secret-config"), "configuration is invalid", 400),
    ],
)
def test_import_failure_has_context_and_next_step(
    cause: Exception, expected: str, status: int
) -> None:
    """Recognized failures retain useful status and omit internal details."""
    with pytest.raises(ImportAssetError) as caught:
        with import_error_context("datasets/example.yaml"):
            raise cause
    assert expected in caught.value.message
    assert "datasets/example.yaml" in caught.value.message
    assert "secret-" not in caught.value.message
    assert caught.value.status == status


def test_unknown_import_error_has_log_reference(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """An unexpected failure gives support a reference without exposing its text."""
    with caplog.at_level(logging.ERROR), pytest.raises(ImportAssetError) as caught:
        with import_error_context("charts/example.yaml"):
            raise RuntimeError("password=secret-token")
    reference = caught.value.message.split("Reference: ")[1]
    assert len(reference) == 32
    assert reference in caplog.text
    assert "Contact an administrator" in caught.value.message
    assert "secret-token" not in caught.value.message
    assert caught.value.status == 500


def test_import_password_prompt_is_preserved() -> None:
    """Structured credential validation must still reach the existing dialog."""
    cause = CommandInvalidError(
        exceptions=[
            ValidationError(
                {
                    "databases/example.yaml": {
                        "_schema": ["Must provide a password for the database"]
                    }
                }
            )
        ]
    )
    with pytest.raises(CommandInvalidError) as caught:
        with import_error_context("dashboard bundle"):
            raise cause
    assert caught.value is cause


@pytest.mark.parametrize(
    "error_type,expected",
    [
        (SupersetErrorType.CONNECTION_INVALID_PASSWORD_ERROR, "credentials"),
        (SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR, "grant access"),
        (SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR, "Check that it exists"),
        (SupersetErrorType.CONNECTION_HOST_DOWN_ERROR, "could not reach"),
    ],
)
def test_structured_database_error_uses_safe_recovery(
    error_type: SupersetErrorType, expected: str
) -> None:
    """Engine-specific metadata never leaks into the response."""
    cause = SupersetErrorException(
        SupersetError(
            message="secret-driver-message",
            error_type=error_type,
            level=ErrorLevel.ERROR,
            extra={"password": "secret-value"},
        )
    )
    with pytest.raises(ImportAssetError) as caught:
        with import_error_context("databases/example.yaml"):
            raise cause
    assert expected in caught.value.message
    assert "secret-" not in caught.value.message


def test_import_error_retains_engine_after_config_is_consumed() -> None:
    """Database import removes the URI before permission discovery can fail."""
    config = {"sqlalchemy_uri": "postgresql://user@host/db"}

    def fail_after_consuming_config() -> None:
        with import_error_context("databases/example.yaml", config):
            config.pop("sqlalchemy_uri")
            raise OperationalError(
                None,
                None,
                Exception('password authentication failed for user "hidden-user"'),
            )

    with pytest.raises(ImportAssetError) as caught:
        fail_after_consuming_config()
    assert "rejected the connection credentials" in caught.value.message
    assert "hidden-user" not in caught.value.message


@pytest.mark.parametrize(
    "driver", ["trino", "pyhive.presto", "snowflake.connector.errors"]
)
@pytest.mark.parametrize("failure", ["connection", "tls", "authentication"])
def test_http_driver_failures(driver: str, failure: str) -> None:
    """Real optional driver wrappers retain HTTP transport recovery and redact URLs."""
    from requests import exceptions, Response

    module = pytest.importorskip(driver)
    transport: Exception
    if failure == "connection":
        transport = exceptions.ConnectionError("https://secret-host/?password=secret")
        expected = "could not reach"
    elif failure == "tls":
        transport = exceptions.SSLError("secret-certificate")
        expected = "TLS connection failed"
    else:
        response = Response()
        response.status_code = 401
        transport = exceptions.HTTPError("secret-token", response=response)
        expected = "credentials"
    if driver == "trino":
        cause = module.exceptions.TrinoConnectionError("failed to execute: secret")
        uri = "trino://user@host/catalog"
    elif driver == "pyhive.presto":
        cause = module.DatabaseError(transport)
        uri = "presto://user@host/catalog"
    else:
        cause = module.OperationalError(msg="secret-account", errno=250003)
        uri = "snowflake://user@host/db"
    cause.__context__ = transport
    with pytest.raises(ImportAssetError) as caught:
        with import_error_context("databases/example.yaml", {"sqlalchemy_uri": uri}):
            raise cause
    assert expected in caught.value.message
    assert caught.value.status == 400
    assert "secret" not in caught.value.message


def test_snowflake_connection_failure_without_transport_cause() -> None:
    """A connector's standalone connection error still has account-specific advice."""
    errors = pytest.importorskip("snowflake.connector.errors")
    cause = errors.OperationalError(
        msg="secret-account failed to connect", errno=250001
    )
    with pytest.raises(ImportAssetError) as caught:
        with import_error_context(
            "databases/example.yaml", {"sqlalchemy_uri": "snowflake://user@host/db"}
        ):
            raise cause
    assert caught.value.status == 400
    assert "account identifier" in caught.value.message
    assert "secret-account" not in caught.value.message


def test_trino_auth_failure_without_transport_cause() -> None:
    """Trino's authentication wrapper has a credential recovery step."""
    errors = pytest.importorskip("trino.exceptions")
    with pytest.raises(ImportAssetError) as caught:
        with import_error_context(
            "databases/example.yaml", {"sqlalchemy_uri": "trino://user@host/catalog"}
        ):
            raise errors.TrinoAuthError("secret-token")
    assert caught.value.status == 400
    assert "credentials" in caught.value.message
    assert "secret-token" not in caught.value.message
