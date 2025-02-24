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
from typing import Iterable

from flask import current_app, g

from superset import security_manager
from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseNotFoundError,
    UserNotFoundInSessionError,
)
from superset.daos.database import DatabaseDAO
from superset.daos.dataset import DatasetDAO
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.db_engine_specs.base import GenericDBException
from superset.exceptions import OAuth2RedirectError
from superset.extensions import celery_app
from superset.models.core import Database

logger = logging.getLogger(__name__)


@celery_app.task(name="sync_database_permissions", soft_time_limit=600)
def sync_database_permissions(
    database_id: int, username: str, old_db_connection_name: str
) -> None:
    with current_app.test_request_context():
        try:
            user = security_manager.get_user_by_username(username)
            if not user:
                raise UserNotFoundInSessionError()
            g.user = user
            logger.info(
                "Syncing permissions for DB connection %s while impersonating user %s",
                database_id,
                user.id,
            )

            db_connection = DatabaseDAO.find_by_id(database_id)
            if not db_connection:
                raise DatabaseNotFoundError()
            ssh_tunnel = DatabaseDAO.get_ssh_tunnel(database_id)

            sync_permissions(db_connection, ssh_tunnel, old_db_connection_name)

        except Exception:
            logger.error(
                "An error occurred while syncing permissions for DB connection ID %s",
                database_id,
                exc_info=True,
            )
            raise


def sync_permissions(
    db_connection: Database,
    ssh_tunnel: SSHTunnel | None,
    old_db_connection_name: str,
) -> None:
    """
    Syncs the permissions for a DB connection.
    """
    catalogs = (
        _get_catalog_names(db_connection, ssh_tunnel)
        if db_connection.db_engine_spec.supports_catalog
        else [None]
    )
    new_db_connection_name = db_connection.database_name

    for catalog in catalogs:
        try:
            schemas = _get_schema_names(db_connection, ssh_tunnel, catalog)

            if catalog:
                perm = security_manager.get_catalog_perm(
                    old_db_connection_name,
                    catalog,
                )
                existing_pvm = security_manager.find_permission_view_menu(
                    "catalog_access",
                    perm,
                )
                if not existing_pvm:
                    # new catalog
                    security_manager.add_permission_view_menu(
                        "catalog_access",
                        security_manager.get_catalog_perm(
                            new_db_connection_name,
                            catalog,
                        ),
                    )
                    for schema in schemas:
                        security_manager.add_permission_view_menu(
                            "schema_access",
                            security_manager.get_schema_perm(
                                new_db_connection_name,
                                catalog,
                                schema,
                            ),
                        )
                    continue
        except DatabaseConnectionFailedError:
            logger.warning("Error processing catalog %s", catalog or "(default)")
            continue

        # add possible new schemas in catalog
        _refresh_schemas(
            old_db_connection_name, new_db_connection_name, catalog, schemas
        )

        if old_db_connection_name != new_db_connection_name:
            _rename_database_in_permissions(
                db_connection.id,
                old_db_connection_name,
                new_db_connection_name,
                catalog,
                schemas,
            )


def _get_catalog_names(
    db_connection: Database, ssh_tunnel: SSHTunnel | None
) -> set[str]:
    """
    Helper method to load catalogs.
    """
    try:
        return db_connection.get_all_catalog_names(
            force=True,
            ssh_tunnel=ssh_tunnel,
        )
    except OAuth2RedirectError:
        # raise OAuth2 exceptions as-is
        raise
    except GenericDBException as ex:
        raise DatabaseConnectionFailedError() from ex


def _get_schema_names(
    db_connection: Database, ssh_tunnel: SSHTunnel | None, catalog: str | None
) -> set[str]:
    """
    Helper method to load schemas.
    """
    try:
        return db_connection.get_all_schema_names(
            force=True,
            catalog=catalog,
            ssh_tunnel=ssh_tunnel,
        )
    except OAuth2RedirectError:
        # raise OAuth2 exceptions as-is
        raise
    except GenericDBException as ex:
        raise DatabaseConnectionFailedError() from ex


def _refresh_schemas(
    old_db_connection_name: str,
    new_db_connection_name: str,
    catalog: str | None,
    schemas: Iterable[str],
) -> None:
    """
    Add new schemas that don't have permissions yet.
    """
    for schema in schemas:
        perm = security_manager.get_schema_perm(
            old_db_connection_name,
            catalog,
            schema,
        )
        existing_pvm = security_manager.find_permission_view_menu(
            "schema_access",
            perm,
        )
        if not existing_pvm:
            new_name = security_manager.get_schema_perm(
                new_db_connection_name,
                catalog,
                schema,
            )
            security_manager.add_permission_view_menu("schema_access", new_name)


def _rename_database_in_permissions(
    db_connection_id: int,
    old_db_connection_name: str,
    new_db_connection_name: str,
    catalog: str | None,
    schemas: Iterable[str],
) -> None:
    new_catalog_perm_name = security_manager.get_catalog_perm(
        new_db_connection_name,
        catalog,
    )

    # rename existing catalog permission
    if catalog:
        perm = security_manager.get_catalog_perm(
            old_db_connection_name,
            catalog,
        )
        existing_pvm = security_manager.find_permission_view_menu(
            "catalog_access",
            perm,
        )
        if existing_pvm:
            existing_pvm.view_menu.name = new_catalog_perm_name

    for schema in schemas:
        new_schema_perm_name = security_manager.get_schema_perm(
            new_db_connection_name,
            catalog,
            schema,
        )

        # rename existing schema permission
        perm = security_manager.get_schema_perm(
            old_db_connection_name,
            catalog,
            schema,
        )
        existing_pvm = security_manager.find_permission_view_menu(
            "schema_access",
            perm,
        )
        if existing_pvm:
            existing_pvm.view_menu.name = new_schema_perm_name

        # rename permissions on datasets and charts
        for dataset in DatabaseDAO.get_datasets(
            db_connection_id,
            catalog=catalog,
            schema=schema,
        ):
            dataset.catalog_perm = new_catalog_perm_name
            dataset.schema_perm = new_schema_perm_name
            for chart in DatasetDAO.get_related_objects(dataset.id)["charts"]:
                chart.catalog_perm = new_catalog_perm_name
                chart.schema_perm = new_schema_perm_name
