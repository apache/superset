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
import socket
import ssl
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any
from uuid import uuid4

from flask_babel import gettext as _
from marshmallow import ValidationError
from requests import exceptions as requests_exceptions
from sqlalchemy.exc import (
    DBAPIError,
    IntegrityError,
    NoSuchModuleError,
    TimeoutError as SQLAlchemyTimeoutError,
)
from urllib3 import exceptions as urllib3_exceptions

from superset import db, security_manager
from superset.commands.dataset.exceptions import MultiCatalogDisabledValidationError
from superset.commands.exceptions import (
    CommandException,
    ForbiddenError,
    ImportFailedError,
)
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.exceptions import SupersetDBAPIError
from superset.errors import SupersetErrorType
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetErrorException,
    SupersetErrorsException,
    SupersetSecurityException,
)
from superset.models.core import Database

logger = logging.getLogger(__name__)


class ImportAssetError(ImportFailedError):
    """An import failure with safe asset context and a recovery action."""


class ImportBundleError(ImportFailedError):
    """A bundle is missing a required asset."""

    status = 400


def _exception_chain(ex: Exception) -> list[Exception]:
    """Follow driver wrappers without assuming a particular DBAPI implementation."""
    pending = [ex]
    result = []
    seen: set[int] = set()
    while pending:
        error = pending.pop()
        if id(error) in seen:
            continue
        seen.add(id(error))
        result.append(error)
        for nested in (
            error.__cause__,
            error.__context__,
            getattr(error, "orig", None),
            getattr(error, "reason", None),
            *error.args,
        ):
            if isinstance(nested, Exception):
                pending.append(nested)
    return result


def _transport_error_type(ex: Exception) -> SupersetErrorType | None:
    """Recognize HTTP transports used by warehouse and query-engine drivers."""
    errors = _exception_chain(ex)
    for error in errors:
        if (
            type(error).__module__ == "trino.exceptions"
            and type(error).__name__ == "TrinoAuthError"
        ):
            return SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR
        if isinstance(error, requests_exceptions.HTTPError):
            status = error.response.status_code if error.response is not None else None
            if status in {401, 403}:
                return SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR
        if isinstance(
            error, (requests_exceptions.Timeout, urllib3_exceptions.TimeoutError)
        ):
            return SupersetErrorType.CONNECTION_DATABASE_TIMEOUT
    for error in errors:
        if isinstance(
            error,
            (
                requests_exceptions.ConnectionError,
                urllib3_exceptions.NewConnectionError,
                urllib3_exceptions.MaxRetryError,
                ConnectionError,
                socket.gaierror,
            ),
        ) or (
            type(error).__module__ == "trino.exceptions"
            and type(error).__name__ == "TrinoConnectionError"
        ):
            return SupersetErrorType.CONNECTION_HOST_DOWN_ERROR
    return None


def _database_error_type(
    ex: Exception, config: dict[str, Any]
) -> SupersetErrorType | None:
    """Classify with engine rules; never expose driver messages or parameters."""
    if isinstance(ex, SupersetErrorException):
        return ex.error.error_type
    if isinstance(ex, SupersetErrorsException) and ex.errors:
        return ex.errors[0].error_type
    if config and (transport_type := _transport_error_type(ex)):
        return transport_type
    if not config.get("sqlalchemy_uri"):
        return None
    try:
        spec = Database.get_db_engine_spec(make_url_safe(config["sqlalchemy_uri"]))
        errors = spec.extract_errors(ex)
        return errors[0].error_type if errors else None
    except Exception:  # pylint: disable=broad-except
        # A classifier must not replace the import failure with a second error.
        return None


def _recovery_message(ex: Exception, config: dict[str, Any]) -> str | None:
    """Return a fixed recovery message for a recognized failure."""
    if isinstance(ex, NoSuchModuleError) or (
        config and isinstance(ex, ModuleNotFoundError)
    ):
        return _(
            "The database driver could not be loaded. Ask an administrator to"
            " install the required driver, then retry the import."
        )
    if isinstance(ex, ForbiddenError):
        return _(
            "%(reason)s Ask the asset owner or an administrator for the required "
            "access, then retry.",
            reason=ex.message,
        )
    if isinstance(ex, SupersetSecurityException):
        return _(
            "You do not have permission to import this asset. Ask its owner "
            "or an administrator for the required access, then retry."
        )
    if isinstance(ex, OAuth2RedirectError):
        return _(
            "The database requires authorization. Open the database "
            "connection, sign in with its authentication provider, then retry"
            " the import."
        )
    if isinstance(ex, MultiCatalogDisabledValidationError):
        return _(
            "The dataset uses a catalog that this connection does not allow. "
            "Use the connection's default catalog, or ask an administrator to"
            " enable access to the required catalog."
        )
    if isinstance(ex, ValidationError):
        return _(
            "The asset configuration is invalid. Review this file's fields "
            "and references. Re-export the assets from a compatible Superset "
            "version, then retry with the new file."
        )
    if any(
        isinstance(
            error,
            (ssl.SSLError, requests_exceptions.SSLError, urllib3_exceptions.SSLError),
        )
        for error in _exception_chain(ex)
    ):
        return _(
            "The database TLS connection failed. Ask an administrator to "
            "check the certificate and connection security settings, then "
            "retry."
        )
    if isinstance(ex, (TimeoutError, SQLAlchemyTimeoutError)):
        return _(
            "The database connection timed out. Check database availability "
            "and network access, then retry the import."
        )

    if config and any(
        type(error).__module__ == "snowflake.connector.errors"
        and getattr(error, "errno", None) == 250001
        for error in _exception_chain(ex)
    ):
        return _(
            "The Snowflake connection could not be established. Check the account "
            "identifier, connection address, network access, and authentication "
            "settings, then retry the import."
        )
    return _database_recovery_message(ex, config)


def _database_recovery_message(ex: Exception, config: dict[str, Any]) -> str | None:
    """Choose a recovery action from a structured engine error category."""
    error_type = _database_error_type(ex, config)
    if error_type in {
        SupersetErrorType.CONNECTION_INVALID_USERNAME_ERROR,
        SupersetErrorType.CONNECTION_INVALID_PASSWORD_ERROR,
        SupersetErrorType.CONNECTION_ACCESS_DENIED_ERROR,
        SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
    }:
        return _(
            "The database rejected the connection credentials or required "
            "connection details are missing. Check the database "
            "authentication settings and test the connection, then retry the "
            "import."
        )
    if error_type == SupersetErrorType.CONNECTION_DATABASE_PERMISSIONS_ERROR:
        return _(
            "The database account does not have the required permissions. Ask"
            " a database administrator to grant access to the required "
            "database, schema, and tables, then retry."
        )
    if error_type in {
        SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
        SupersetErrorType.CONNECTION_INVALID_PORT_ERROR,
        SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
        SupersetErrorType.CONNECTION_HOST_DOWN_ERROR,
        SupersetErrorType.CONNECTION_DATABASE_TIMEOUT,
    }:
        return _(
            "Superset could not reach the database. Check the host, port, "
            "network access, and database availability, then retry the "
            "import."
        )
    if error_type in {
        SupersetErrorType.CONNECTION_UNKNOWN_DATABASE_ERROR,
        SupersetErrorType.SCHEMA_DOES_NOT_EXIST_ERROR,
        SupersetErrorType.TABLE_DOES_NOT_EXIST_ERROR,
    }:
        return _(
            "A referenced database, schema, or table is unavailable. Check "
            "that it exists in the destination connection and that the "
            "database account can access it, then retry."
        )
    if (
        config
        and not isinstance(ex, IntegrityError)
        and isinstance(ex, (DBAPIError, SupersetDBAPIError, ConnectionError))
    ):
        return _(
            "A database operation failed. Test the destination database "
            "connection and check its credentials and permissions. If it "
            "still fails, contact an administrator with the reference below."
        )
    return None


@contextmanager
def import_error_context(
    asset: str,
    database_config: dict[str, Any] | None = None,
    *,
    use_existing: bool = True,
) -> Iterator[None]:
    """Add safe context while retaining validation and credential prompt contracts."""
    # Importers consume fields such as sqlalchemy_uri from the input mapping.
    # Retain the engine identity for errors raised after that mutation.
    config = (database_config or {}).copy()
    if config:
        # A UUID match can reuse a connection whose name and URI differ from
        # the source export. Resolve context before an import can mutate it.
        existing = (
            db.session.query(Database).filter_by(uuid=config["uuid"]).first()
            if config.get("uuid") and use_existing
            else None
        )
        name = (
            existing.database_name
            if existing and security_manager.can_access_database(existing)
            else config.get("database_name")
        )
        if name:
            asset = (
                _('database "%(name)s" (%(file)s)', name=name, file=asset)
                if asset.startswith("databases/")
                else _('%(file)s (database "%(name)s")', name=name, file=asset)
            )
        if existing:
            config["sqlalchemy_uri"] = existing.sqlalchemy_uri
    try:
        yield
    except CommandException as ex:
        if not isinstance(ex, ForbiddenError):
            raise
        raise _asset_error(ex, asset, config) from ex
    except Exception as ex:
        raise _asset_error(ex, asset, config) from ex


def _asset_error(ex: Exception, asset: str, config: dict[str, Any]) -> ImportAssetError:
    """Log the original failure and return only approved text to the client."""
    reference = uuid4().hex
    recovery = _recovery_message(ex, config)
    logger.exception("Import failed for %s (reference %s)", asset, reference)
    error = ImportAssetError(
        _(
            "Could not import %(asset)s. %(recovery)s Reference: %(reference)s",
            asset=asset,
            recovery=recovery
            or _(
                "An unexpected error occurred. Contact an administrator with "
                "this reference and the time of the import."
            ),
            reference=reference,
        )
    )
    error.status = (
        403
        if isinstance(ex, (ForbiddenError, SupersetSecurityException))
        else (400 if recovery else 500)
    )
    return error
