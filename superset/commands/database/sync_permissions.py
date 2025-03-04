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
from functools import partial
from typing import Iterable

from flask import current_app, g

from superset import app, security_manager
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseConnectionSyncPermissionsError,
    DatabaseNotFoundError,
    UserNotFoundInSessionError,
)
from superset.commands.database.utils import (
    add_pvm,
    add_vm,
    ping,
)
from superset.daos.database import DatabaseDAO
from superset.daos.dataset import DatasetDAO
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.db_engine_specs.base import GenericDBException
from superset.exceptions import OAuth2RedirectError
from superset.extensions import celery_app, db
from superset.models.core import Database
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class SyncPermissionsCommand(BaseCommand):
    """
    Command to sync database permissions.

    This command can be called either via its dedicated endpoint, or as part of
    another command. If async mode is enabled, the command is executed through
    a celery task, otherwise it's executed synchronously.
    """

    def __init__(
        self,
        model_id: int,
        username: str | None,
        old_db_connection_name: str | None = None,
        db_connection: Database | None = None,
        ssh_tunnel: SSHTunnel | None = None,
    ):
        """
        Constructor method.
        """
        self.db_connection_id = model_id
        self.username = username
        self._old_db_connection_name: str | None = old_db_connection_name
        self._db_connection: Database | None = db_connection
        self.db_connection_ssh_tunnel: SSHTunnel | None = ssh_tunnel

        self.async_mode: bool = app.config["SYNC_DB_PERMISSIONS_IN_ASYNC_MODE"]

    @property
    def db_connection(self) -> Database:
        if not self._db_connection:
            raise DatabaseNotFoundError()
        return self._db_connection

    @property
    def old_db_connection_name(self) -> str:
        return (
            self._old_db_connection_name
            if self._old_db_connection_name is not None
            else self.db_connection.database_name
        )

    def validate(self) -> None:
        self._db_connection = (
            self._db_connection
            if self._db_connection
            else DatabaseDAO.find_by_id(self.db_connection_id)
        )
        if not self._db_connection:
            raise DatabaseNotFoundError()

        if not self.db_connection_ssh_tunnel:
            self.db_connection_ssh_tunnel = DatabaseDAO.get_ssh_tunnel(
                self.db_connection_id
            )

        # Need user info to impersonate for OAuth2 connections
        if not self.username or not security_manager.get_user_by_username(
            self.username
        ):
            raise UserNotFoundInSessionError()

        with self.db_connection.get_sqla_engine(
            override_ssh_tunnel=self.db_connection_ssh_tunnel
        ) as engine:
            try:
                alive = ping(engine)
            except Exception as err:
                raise DatabaseConnectionFailedError() from err

        if not alive:
            raise DatabaseConnectionFailedError()

    def run(self) -> None:
        """
        Triggers the perm sync in sync or async mode.
        """
        self.validate()
        if self.async_mode:
            sync_database_permissions_task.delay(
                self.db_connection_id, self.username, self.old_db_connection_name
            )
            return

        self.sync_database_permissions()

    @transaction(
        on_error=partial(on_error, reraise=DatabaseConnectionSyncPermissionsError)
    )
    def sync_database_permissions(self) -> None:
        """
        Syncs the permissions for a DB connection.
        """
        catalogs = (
            self._get_catalog_names()
            if self.db_connection.db_engine_spec.supports_catalog
            else [None]
        )

        for catalog in catalogs:
            try:
                schemas = self._get_schema_names(catalog)

                if catalog:
                    perm = security_manager.get_catalog_perm(
                        self.old_db_connection_name,
                        catalog,
                    )
                    existing_pvm = security_manager.find_permission_view_menu(
                        "catalog_access",
                        perm,
                    )
                    if not existing_pvm:
                        # new catalog
                        add_pvm(
                            db.session,
                            security_manager,
                            "catalog_access",
                            security_manager.get_catalog_perm(
                                self.db_connection.database_name,
                                catalog,
                            ),
                        )
                        for schema in schemas:
                            add_pvm(
                                db.session,
                                security_manager,
                                "schema_access",
                                security_manager.get_schema_perm(
                                    self.db_connection.database_name,
                                    catalog,
                                    schema,
                                ),
                            )
                        continue
            except DatabaseConnectionFailedError:
                logger.warning("Error processing catalog %s", catalog or "(default)")
                continue

            # add possible new schemas in catalog
            self._refresh_schemas(catalog, schemas)

            if self.old_db_connection_name != self.db_connection.database_name:
                self._rename_database_in_permissions(catalog, schemas)

    def _get_catalog_names(self) -> set[str]:
        """
        Helper method to load catalogs.
        """
        try:
            return self.db_connection.get_all_catalog_names(
                force=True,
                ssh_tunnel=self.db_connection_ssh_tunnel,
            )
        except OAuth2RedirectError:
            # raise OAuth2 exceptions as-is
            raise
        except GenericDBException as ex:
            raise DatabaseConnectionFailedError() from ex

    def _get_schema_names(self, catalog: str | None) -> set[str]:
        """
        Helper method to load schemas.
        """
        try:
            return self.db_connection.get_all_schema_names(
                force=True,
                catalog=catalog,
                ssh_tunnel=self.db_connection_ssh_tunnel,
            )
        except OAuth2RedirectError:
            # raise OAuth2 exceptions as-is
            raise
        except GenericDBException as ex:
            raise DatabaseConnectionFailedError() from ex

    def _refresh_schemas(self, catalog: str | None, schemas: Iterable[str]) -> None:
        """
        Add new schemas that don't have permissions yet.
        """
        for schema in schemas:
            perm = security_manager.get_schema_perm(
                self.old_db_connection_name,
                catalog,
                schema,
            )
            existing_pvm = security_manager.find_permission_view_menu(
                "schema_access",
                perm,
            )
            if not existing_pvm:
                new_name = security_manager.get_schema_perm(
                    self.db_connection.name,
                    catalog,
                    schema,
                )
                add_pvm(db.session, security_manager, "schema_access", new_name)

    def _rename_database_in_permissions(
        self, catalog: str | None, schemas: Iterable[str]
    ) -> None:
        # rename existing catalog permission
        if catalog:
            new_catalog_perm_name = security_manager.get_catalog_perm(
                self.db_connection.name,
                catalog,
            )
            new_catalog_vm = add_vm(db.session, security_manager, new_catalog_perm_name)
            perm = security_manager.get_catalog_perm(
                self.old_db_connection_name,
                catalog,
            )
            existing_pvm = security_manager.find_permission_view_menu(
                "catalog_access",
                perm,
            )
            if existing_pvm:
                existing_pvm.view_menu = new_catalog_vm

        for schema in schemas:
            new_schema_perm_name = security_manager.get_schema_perm(
                self.db_connection.name,
                catalog,
                schema,
            )

            # rename existing schema permission
            perm = security_manager.get_schema_perm(
                self.old_db_connection_name,
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
                self.db_connection_id,
                catalog=catalog,
                schema=schema,
            ):
                dataset.catalog_perm = new_catalog_perm_name
                dataset.schema_perm = new_schema_perm_name
                for chart in DatasetDAO.get_related_objects(dataset.id)["charts"]:
                    chart.catalog_perm = new_catalog_perm_name
                    chart.schema_perm = new_schema_perm_name


@celery_app.task(name="sync_database_permissions", soft_time_limit=600)
def sync_database_permissions_task(
    database_id: int, username: str, old_db_connection_name: str
) -> None:
    """
    Celery task that triggers the SyncPermissionsCommand in async mode.
    """
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

            SyncPermissionsCommand(
                database_id,
                username,
                old_db_connection_name=old_db_connection_name,
                db_connection=db_connection,
                ssh_tunnel=ssh_tunnel,
            ).sync_database_permissions()

            logger.info(
                "Successfully synced permissions for DB connection %s",
                database_id,
            )

        except Exception:
            logger.error(
                "An error occurred while syncing permissions for DB connection ID %s",
                database_id,
                exc_info=True,
            )
