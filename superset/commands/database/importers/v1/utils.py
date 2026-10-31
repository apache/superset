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

from superset import db, is_feature_enabled, security_manager
from superset.commands.database.exceptions import DatabaseInvalidError
from superset.commands.database.utils import (
    add_permissions,
    import_connection_identity_changed,
    ssh_tunnel_rebind_unsafe,
)
from superset.commands.exceptions import ImportFailedError, ImportRefusedError
from superset.constants import EMBEDDED_CREDENTIALS_KEY, PASSWORD_MASK
from superset.databases.schemas import embedded_credentials_stranded
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.databases.utils import (
    embedded_credentials_error,
    embedded_credentials_incomplete,
    embedded_credentials_missing_fields,
    embedded_credentials_present,
    make_url_safe,
)
from superset.db_engine_specs import BaseEngineSpec
from superset.db_engine_specs.exceptions import SupersetDBAPIError
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetSecurityException,
)
from superset.models.core import Database
from superset.security.analytics_db_safety import check_sqlalchemy_uri
from superset.utils import json

logger = logging.getLogger(__name__)


def _refuse_stored_secret_reuse(existing: Database, config: dict[str, Any]) -> None:
    """
    Refuse an overwrite that changes the connection endpoint without fresh
    credentials.

    Database UUIDs are not secrets -- they appear in every exported bundle --
    so an import must not be able to repoint an existing connection at a new
    host while the stored password (or SSH tunnel key) is silently kept: the
    next connection would hand the real credential to the new endpoint.
    """
    if import_connection_identity_changed(existing, config):
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

    if ssh_tunnel_rebind_unsafe(existing.ssh_tunnel, config.get("ssh_tunnel")):
        raise ImportFailedError(
            f"Import would change the SSH tunnel endpoint of database "
            f"'{existing.database_name}' without providing new tunnel "
            "credentials. Re-enter the SSH tunnel credentials to "
            "confirm the change."
        )


def _refuse_unusable_embedded_credentials(  # pylint: disable=too-many-arguments
    database_name: str,
    encrypted_extra: dict[str, Any],
    engine_spec: type[BaseEngineSpec],
    existing: Database | None,
    impersonate_user: bool,
    *,
    authored: bool,
) -> None:
    """
    Hold an imported embedded guest credential to the rules the dialog and API do.

    ``encrypted_extra`` is the Secure Extra the connection will have after the
    import, its masked secrets already revealed. ``authored`` says whether the
    file supplied it; when it doesn't, the stored one stays attached and only the
    file's ``impersonate_user`` can strand it.
    """
    credentials = encrypted_extra.get(EMBEDDED_CREDENTIALS_KEY)
    if not (
        is_feature_enabled("EMBEDDED_CREDENTIAL_FALLBACK")
        and is_feature_enabled("EMBEDDED_SUPERSET")
    ):
        if authored:
            _refuse_embedded_credentials_while_disabled(
                database_name, credentials, existing
            )
        return

    if authored:
        _refuse_incomplete_embedded_credentials(database_name, credentials, engine_spec)
        if message := embedded_credentials_error(engine_spec, credentials, None):
            raise ImportRefusedError(
                f"Embedded guest credentials of database '{database_name}' can't "
                f"be used. {message}"
            )

    if embedded_credentials_stranded(engine_spec, encrypted_extra, impersonate_user):
        raise ImportRefusedError(
            f"Embedded guest credentials of database '{database_name}' only apply "
            'to connections that use OAuth2 with "Impersonate logged in user" '
            "turned on. Turn on impersonation and configure OAuth2 client "
            "information, or clear the embedded credentials."
        )


def _refuse_embedded_credentials_while_disabled(
    database_name: str,
    credentials: Any,
    existing: Database | None,
) -> None:
    """
    Refuse a new or changed credential while the fallback is off, as the API does.

    Nothing validates a credential while the fallback is off, and one stored then
    goes live, unchecked, the moment it is turned on. Re-importing the stored
    credential unchanged, or clearing it, is accepted.
    """
    if not embedded_credentials_present(credentials):
        return
    if existing is not None and existing.encrypted_extra:
        stored = json.loads(existing.encrypted_extra)
        if isinstance(stored, dict) and credentials == stored.get(
            EMBEDDED_CREDENTIALS_KEY
        ):
            return
    raise ImportRefusedError(
        f"Embedded guest credentials of database '{database_name}' can't be added "
        "or changed while the embedded credential fallback is turned off. Leave "
        "the stored credentials unchanged or clear them."
    )


def _refuse_incomplete_embedded_credentials(
    database_name: str,
    credentials: Any,
    engine_spec: type[BaseEngineSpec],
) -> None:
    """
    Refuse a half-filled embedded guest credential.

    Only the secrets that arrive masked are revealed from the stored credential,
    so one the file leaves out entirely (e.g. a key-pair credential without its
    private key) would replace the stored credential with one no embedded
    viewer can log in with.
    """
    if not embedded_credentials_incomplete(
        credentials, engine_spec.validate_embedded_credentials
    ):
        return

    sensitive_fields = engine_spec.encrypted_extra_sensitive_fields
    labels = sensitive_fields if isinstance(sensitive_fields, dict) else {}
    missing = [
        field + (f" ({labels[field]})" if field in labels else "")
        for field in embedded_credentials_missing_fields(credentials)
    ]
    raise ImportRefusedError(
        f"Embedded guest credentials of database '{database_name}' are invalid "
        "or incomplete."
        + (f" Missing: {', '.join(missing)}." if missing else "")
        + " Provide all required fields or clear them to leave embedded viewers "
        "unconfigured."
    )


def _sync_permissions_best_effort(database: Database) -> None:
    """
    Sync catalog/schema permissions for ``database``, tolerating a transient
    or OAuth2 failure rather than letting it fail the import.
    """
    try:
        add_permissions(database)
    except (SupersetDBAPIError, OAuth2RedirectError) as ex:
        # ``add_permissions()`` calls ``get_all_catalog_names()`` outside of
        # its own per-catalog error handling, so any DBAPI error mapped from
        # that initial catalog discovery -- not just a connection failure --
        # must be tolerated here too, or it fails the whole import.
        logger.warning(ex.message)


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
            if can_write:
                # Chart/dataset/saved-query/dashboard bundles that reference
                # an already-imported database reach this branch; without
                # this, a schema added to the live connection since the
                # database was first imported would never get a first-time
                # grant through this path either. ``add_permissions()`` does
                # a live, uncached metadata scan, so this can be slow for
                # cross-catalog-enabled engines -- see its own comment.
                _sync_permissions_best_effort(existing)
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
            and not import_connection_identity_changed(existing, config)
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

    # A file without Secure Extra leaves the stored one attached, embedded
    # credential included, so the rest of the file is checked against that.
    authored = "encrypted_extra" in config
    if encrypted_extra := (
        config.get("encrypted_extra")
        if authored
        else existing.encrypted_extra
        if existing
        else None
    ):
        engine_spec = (
            existing.db_engine_spec
            if existing
            else Database.get_db_engine_spec(make_url_safe(config["sqlalchemy_uri"]))
        )
        payload = json.loads(encrypted_extra)

        # Never store a mask as if it were the secret: the schema asks for any
        # value that cannot be revealed, so one left here is a bug, not input.
        if masked_encrypted_extra and (
            still_masked := json.get_masked_fields(
                payload,
                engine_spec.encrypted_extra_sensitive_field_paths(),
            )
        ):
            raise ImportFailedError(
                "Must provide value for masked_encrypted_extra field: "
                + ", ".join(still_masked)
            )

        if isinstance(payload, dict):
            _refuse_unusable_embedded_credentials(
                config["database_name"],
                payload,
                engine_spec,
                existing,
                config.get(
                    "impersonate_user",
                    existing.impersonate_user if existing else False,
                ),
                authored=authored,
            )

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

    _sync_permissions_best_effort(database)

    return database
