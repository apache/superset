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
from __future__ import annotations

import logging
import sqlite3
from contextlib import closing
from typing import Any

from flask import current_app as app
from flask_appbuilder.security.sqla.models import (
    Permission,
    PermissionView,
    ViewMenu,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from superset import security_manager
from superset.commands.database.exceptions import DatabaseInvalidError
from superset.constants import PASSWORD_MASK
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import GenericDBException
from superset.models.core import Database
from superset.security.manager import SupersetSecurityManager
from superset.utils import json
from superset.utils.core import timeout

logger = logging.getLogger(__name__)


def uri_identity_changed(existing_uri: str | None, submitted_uri: str | None) -> bool:
    """
    Whether two SQLAlchemy URIs differ once their password is stripped --
    i.e. whether the effective connection destination (driver, host, port,
    database, username, query params) changed.
    """
    try:
        stored = make_url_safe(existing_uri or "")._replace(password=None)
        incoming = make_url_safe(submitted_uri or "")._replace(password=None)
    except DatabaseInvalidError:
        # An unparseable URI cannot be compared: treat it as a change so a
        # stored secret never survives onto it.
        return True
    return stored != incoming


def engine_params_changed(
    existing_extra: str | None, submitted_extra: str | None
) -> bool:
    """
    Whether ``submitted_extra`` carries different ``engine_params`` than
    ``existing_extra``.

    ``engine_params`` (in particular ``engine_params.connect_args``) is
    merged into the actual DBAPI connect kwargs, so it can override the
    host/port/etc. carried in the SQLAlchemy URI itself. Any caller that
    conditionally reattaches a stored secret (password, encrypted_extra, SSH
    tunnel credentials) based on the URI being unchanged must also check
    this, or the destination can be silently redirected while the real
    secret rides along.
    """

    def _engine_params(serialized_extra: str | None) -> dict[str, Any]:
        try:
            return json.loads(serialized_extra or "{}").get("engine_params", {})
        except (json.JSONDecodeError, AttributeError):
            # Unparseable/non-dict `extra` cannot be compared: treat it as a
            # change so a stored secret never rides along with input that
            # can't be verified to leave the connection identity untouched.
            return {"__unparseable__": True}

    return _engine_params(submitted_extra) != _engine_params(existing_extra)


def ssh_tunnel_endpoint_changed(
    existing_tunnel: SSHTunnel | None, submitted_tunnel: dict[str, Any] | None
) -> bool:
    """
    Whether a submitted SSH tunnel config points at a different endpoint
    than the stored tunnel it would otherwise inherit credentials from.
    """
    if not submitted_tunnel or not existing_tunnel:
        return False
    return bool(
        submitted_tunnel.get("server_address") != existing_tunnel.server_address
        or submitted_tunnel.get("server_port") != existing_tunnel.server_port
    )


def ssh_tunnel_rebind_unsafe(
    existing_tunnel: SSHTunnel | None, submitted_tunnel: dict[str, Any] | None
) -> bool:
    """
    Whether a submitted SSH tunnel config repoints the tunnel at a
    different endpoint without supplying credentials fresh enough to
    justify it -- i.e. whether carrying the stored tunnel secrets over
    onto this submission would be unsafe.
    """
    if not ssh_tunnel_endpoint_changed(existing_tunnel, submitted_tunnel):
        return False

    assert submitted_tunnel is not None
    assert existing_tunnel is not None

    has_fresh_credential = any(
        submitted_tunnel.get(field) not in (None, PASSWORD_MASK)
        for field in ("password", "private_key")
    )
    # A passphrase-protected private key's stored passphrase is a secret in
    # its own right: if the existing tunnel had one, a repoint that
    # supplies a fresh private_key but leaves private_key_password
    # masked/absent would keep the old passphrase attached to the new key
    # rather than requiring the caller to confirm it too.
    stale_private_key_password = (
        existing_tunnel.private_key_password is not None
        and submitted_tunnel.get("private_key_password") in (None, PASSWORD_MASK)
    )
    return not has_fresh_credential or stale_private_key_password


def ping(engine: Engine) -> bool:
    try:
        time_delta = app.config["TEST_DATABASE_CONNECTION_TIMEOUT"]
        with timeout(int(time_delta.total_seconds())):
            with closing(engine.raw_connection()) as conn:
                return engine.dialect.do_ping(conn)
    except (sqlite3.ProgrammingError, RuntimeError):
        # SQLite can't run on a separate thread, so ``utils.timeout`` fails
        # RuntimeError catches the equivalent error from duckdb.
        with closing(engine.raw_connection()) as conn:
            return engine.dialect.do_ping(conn)


def add_permissions(database: Database) -> None:
    """
    Add DAR for catalogs and schemas.
    """
    # TODO: Migrate this to use the non-commiting add_pvm helper instead
    if database.db_engine_spec.supports_catalog:
        # Adding permissions to all catalogs (and all their schemas) can take a long
        # time (minutes, while importing a chart, eg). If the database does not
        # support cross-catalog queries (like Postgres), and the multi-catalog
        # feature is not enabled, then we only need to add permissions to the
        # default catalog.
        if (
            database.db_engine_spec.supports_cross_catalog_queries
            or database.allow_multi_catalog
        ):
            catalogs = database.get_all_catalog_names(cache=False)
        else:
            catalogs = {database.get_default_catalog()}

        for catalog in catalogs:
            security_manager.add_permission_view_menu(
                "catalog_access",
                security_manager.get_catalog_perm(
                    database.database_name,
                    catalog,
                ),
            )
    else:
        catalogs = [None]

    for catalog in catalogs:
        try:
            for schema in database.get_all_schema_names(catalog=catalog, cache=False):
                security_manager.add_permission_view_menu(
                    "schema_access",
                    security_manager.get_schema_perm(
                        database.database_name,
                        catalog,
                        schema,
                    ),
                )
        except GenericDBException:  # pylint: disable=broad-except
            logger.warning("Error processing catalog '%s'", catalog)
            continue


def add_vm(
    session: Session,
    security_manager: SupersetSecurityManager,
    view_menu_name: str | None,
) -> ViewMenu:
    """
    Similar to security_manager.add_view_menu, but without commit.

    This ensures an atomic operation.
    """
    if view_menu := security_manager.find_view_menu(view_menu_name):
        return view_menu

    view_menu = security_manager.viewmenu_model()
    view_menu.name = view_menu_name
    session.add(view_menu)
    return view_menu


def add_perm(
    session: Session,
    security_manager: SupersetSecurityManager,
    permission_name: str | None,
) -> Permission:
    """
    Similar to security_manager.add_permission, but without commit.

    This ensures an atomic operation.
    """
    if perm := security_manager.find_permission(permission_name):
        return perm

    perm = security_manager.permission_model()
    perm.name = permission_name
    session.add(perm)
    return perm


def add_pvm(
    session: Session,
    security_manager: SupersetSecurityManager,
    permission_name: str | None,
    view_menu_name: str | None,
) -> PermissionView | None:
    """
    Similar to security_manager.add_permission_view_menu, but without commit.

    This ensures an atomic operation.
    """
    if not (permission_name and view_menu_name):
        return None

    if pv := security_manager.find_permission_view_menu(
        permission_name, view_menu_name
    ):
        return pv

    vm = add_vm(session, security_manager, view_menu_name)
    perm = add_perm(session, security_manager, permission_name)
    pv = security_manager.permissionview_model()
    pv.view_menu, pv.permission = vm, perm
    session.add(pv)

    return pv
