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

from flask import current_app as app
from flask_appbuilder.security.sqla.models import (
    Permission,
    PermissionView,
    ViewMenu,
)
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from superset import security_manager
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.db_engine_specs.base import GenericDBException
from superset.models.core import Database
from superset.security.manager import SupersetSecurityManager
from superset.utils.core import timeout

logger = logging.getLogger(__name__)


def ping(engine: Engine) -> bool:
    try:
        time_delta = app.config["TEST_DATABASE_CONNECTION_TIMEOUT"]
        with timeout(int(time_delta.total_seconds())):
            with closing(engine.raw_connection()) as conn:
                return engine.dialect.do_ping(conn)
    except (sqlite3.ProgrammingError, RuntimeError):
        # SQLite can't run on a separate thread, so ``utils.timeout`` fails
        # RuntimeError catches the equivalent error from duckdb.
        return engine.dialect.do_ping(engine)


def add_permissions(database: Database, ssh_tunnel: SSHTunnel | None) -> None:
    """
    Add DAR for catalogs and schemas.
    """
    # TODO: Migrate this to use the non-commiting add_pvm helper instead
    if database.db_engine_spec.supports_catalog:
        catalogs = database.get_all_catalog_names(
            cache=False,
            ssh_tunnel=ssh_tunnel,
        )

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
            for schema in database.get_all_schema_names(
                catalog=catalog,
                cache=False,
                ssh_tunnel=ssh_tunnel,
            ):
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
