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
from typing import Any

from flask import current_app as app

from superset import db, security_manager
from superset.commands.database.exceptions import DatabaseInvalidError
from superset.commands.database.utils import add_permissions
from superset.commands.exceptions import ImportFailedError
from superset.constants import PASSWORD_MASK
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.exceptions import SupersetDBAPIConnectionError
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetSecurityException,
)
from superset.models.core import Database
from superset.security.analytics_db_safety import check_sqlalchemy_uri
from superset.utils import json

logger = logging.getLogger(__name__)


def _connection_identity_changed(existing: Database, config: dict[str, Any]) -> bool:
    """Whether the import points the database at a different endpoint."""
    try:
        stored = make_url_safe(existing.sqlalchemy_uri)._replace(password=None)
        incoming = make_url_safe(config["sqlalchemy_uri"])._replace(password=None)
    except DatabaseInvalidError:
        # An unparseable URI cannot be compared: treat it as a change so
        # stored secrets never survive onto it.
        return True
    return stored != incoming


def _refuse_stored_secret_reuse(existing: Database, config: dict[str, Any]) -> None:
    """
    Refuse an overwrite that changes the connection endpoint without fresh
    credentials.

    Database UUIDs are not secrets -- they appear in every exported bundle --
    so an import must not be able to repoint an existing connection at a new
    host while the stored password (or SSH tunnel key) is silently kept: the
    next connection would hand the real credential to the new endpoint.
    """
    if _connection_identity_changed(existing, config):
        try:
            uri_password = make_url_safe(config["sqlalchemy_uri"]).password
        except DatabaseInvalidError:
            uri_password = None
        if config.get("password") in (None, PASSWORD_MASK) and uri_password in (
            None,
            PASSWORD_MASK,
        ):
            raise ImportFailedError(
                f"Import would change the connection of database "
                f"'{existing.database_name}' without providing new "
                "credentials. Re-enter the database password for the new "
                "connection to confirm the change."
            )

    if ssh_tunnel := config.get("ssh_tunnel"):
        existing_tunnel = existing.ssh_tunnel
        if existing_tunnel and (
            ssh_tunnel.get("server_address") != existing_tunnel.server_address
            or ssh_tunnel.get("server_port") != existing_tunnel.server_port
        ):
            has_fresh_credential = any(
                ssh_tunnel.get(field) not in (None, PASSWORD_MASK)
                for field in ("password", "private_key")
            )
            # A passphrase-protected private key's stored passphrase is a
            # secret in its own right: if the existing tunnel had one, a
            # repoint that supplies a fresh private_key but leaves
            # private_key_password masked/absent would keep the old
            # passphrase attached to the new key rather than requiring the
            # importer to confirm it too.
            stale_private_key_password = (
                existing_tunnel.private_key_password is not None
                and ssh_tunnel.get("private_key_password") in (None, PASSWORD_MASK)
            )
            if not has_fresh_credential or stale_private_key_password:
                raise ImportFailedError(
                    f"Import would change the SSH tunnel endpoint of database "
                    f"'{existing.database_name}' without providing new tunnel "
                    "credentials. Re-enter the SSH tunnel credentials to "
                    "confirm the change."
                )


def import_database(  # noqa: C901
    config: dict[str, Any],
    overwrite: bool = False,
    ignore_permissions: bool = False,
) -> Database:
    can_write = ignore_permissions or security_manager.can_access(
        "can_write",
        "Database",
    )
    existing = db.session.query(Database).filter_by(uuid=config["uuid"]).first()
    if existing:
        if not overwrite or not can_write:
            return existing
        config["id"] = existing.id
        # Stored secrets must not be rebound to a different endpoint: without
        # fresh credentials, an overwrite that changes where the database (or
        # its SSH tunnel) connects would exfiltrate the stored secret to the
        # new endpoint on the next connection.
        _refuse_stored_secret_reuse(existing, config)
    elif not can_write:
        raise ImportFailedError(
            "Database doesn't exist and user doesn't have permission to create databases"  # noqa: E501
        )
    # Check if this URI is allowed (skip for system imports like examples)
    if app.config["PREVENT_UNSAFE_DB_CONNECTIONS"] and not ignore_permissions:
        try:
            check_sqlalchemy_uri(make_url_safe(config["sqlalchemy_uri"]))
        except SupersetSecurityException as exc:
            raise ImportFailedError(exc.message) from exc
    # https://github.com/apache/superset/pull/16756 renamed ``csv`` to ``file``.
    # Handle both old and new field names, defaulting to True for examples database
    if "allow_csv_upload" in config:
        config["allow_file_upload"] = config.pop("allow_csv_upload")
    elif "allow_file_upload" not in config:
        # Default to True for backward compatibility
        config["allow_file_upload"] = True

    if "schemas_allowed_for_csv_upload" in config.get("extra", {}):
        config["extra"]["schemas_allowed_for_file_upload"] = config["extra"].pop(
            "schemas_allowed_for_csv_upload"
        )

    # TODO (betodealmeida): move this logic to import_from_dict
    config["extra"] = json.dumps(config["extra"])

    # Convert masked_encrypted_extra → encrypted_extra before importing.
    # For existing DBs, reveal masked sensitive values from current encrypted_extra.
    # For new DBs, schema validation already ensured no fields are still masked.
    if masked_encrypted_extra := config.pop("masked_encrypted_extra", None):
        # Never reveal stored encrypted_extra secrets into a config that
        # repoints the connection at a different endpoint.
        if (
            existing
            and existing.encrypted_extra
            and not _connection_identity_changed(existing, config)
        ):
            old_config = json.loads(existing.encrypted_extra)
            new_config = json.loads(masked_encrypted_extra)
            sensitive_fields = (
                existing.db_engine_spec.encrypted_extra_sensitive_field_paths()
            )
            revealed = json.reveal_sensitive(
                old_config,
                new_config,
                sensitive_fields,
            )
            config["encrypted_extra"] = json.dumps(revealed)
        else:
            config["encrypted_extra"] = masked_encrypted_extra

    ssh_tunnel_config = config.pop("ssh_tunnel", None)

    # set SQLAlchemy URI via `set_sqlalchemy_uri` so that the password gets masked
    sqlalchemy_uri = config.pop("sqlalchemy_uri")
    # TODO (betodealmeida): we should use the `CreateDatabaseCommand` for imports
    database: Database = Database.import_from_dict(config, recursive=False)
    database.set_sqlalchemy_uri(sqlalchemy_uri)

    if database.id is None:
        db.session.flush()

    if ssh_tunnel_config:
        ssh_tunnel_config["database_id"] = database.id
        database.ssh_tunnel = SSHTunnel.import_from_dict(
            ssh_tunnel_config,
            recursive=False,
        )

    try:
        add_permissions(database)
    except (SupersetDBAPIConnectionError, OAuth2RedirectError) as ex:
        logger.warning(ex.message)

    return database
