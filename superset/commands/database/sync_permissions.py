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

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseConnectionSyncPermissionsError,
    DatabaseNotFoundError,
)
from superset.commands.database.utils import ping
from superset.daos.database import DatabaseDAO
from superset.daos.dataset import DatasetDAO
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.db_engine_specs.base import GenericDBException
from superset.exceptions import OAuth2RedirectError
from superset.models.core import Database
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class SyncPermissionsCommand(BaseCommand):
    """
    Command to sync database permissions.
    """

    def __init__(
        self,
        model_id: int,
        old_db_connection_name: str | None = None,
        db_connection: Database | None = None,
        ssh_tunnel: SSHTunnel | None = None,
    ):
        """
        Constructor method.
        """
        self.db_connection_id = model_id
        self.old_db_connection_name: str | None = old_db_connection_name
        self.db_connection: Database | None = db_connection
        self.db_connection_ssh_tunnel: SSHTunnel | None = ssh_tunnel

    def validate(self) -> None:
        if not self.db_connection:
            database = DatabaseDAO.find_by_id(self.db_connection_id)
            if not database:
                raise DatabaseNotFoundError()
            self.db_connection = database

        if not self.old_db_connection_name:
            self.old_db_connection_name = self.db_connection.database_name

        if not self.db_connection_ssh_tunnel:
            self.db_connection_ssh_tunnel = DatabaseDAO.get_ssh_tunnel(
                self.db_connection_id
            )

        with self.db_connection.get_sqla_engine() as engine:
            try:
                alive = ping(engine)
            except Exception as err:
                raise DatabaseConnectionFailedError() from err

        if not alive:
            raise DatabaseConnectionFailedError()

    @transaction(
        on_error=partial(on_error, reraise=DatabaseConnectionSyncPermissionsError)
    )
    def run(self) -> None:
        """
        Syncs the permissions for a DB connection.
        """
        self.validate()

        # Make mypy happy (these are already checked in validate)
        assert self.db_connection
        assert self.old_db_connection_name

        catalogs = (
            self._get_catalog_names(self.db_connection)
            if self.db_connection.db_engine_spec.supports_catalog
            else [None]
        )

        for catalog in catalogs:
            try:
                schemas = self._get_schema_names(self.db_connection, catalog)

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
                        security_manager.add_permission_view_menu(
                            "catalog_access",
                            security_manager.get_catalog_perm(
                                self.db_connection.database_name,
                                catalog,
                            ),
                        )
                        for schema in schemas:
                            security_manager.add_permission_view_menu(
                                "schema_access",
                                security_manager.get_schema_perm(
                                    self.db_connection.database_name,
                                    catalog,
                                    schema,
                                ),
                            )
                        continue
            except DatabaseConnectionFailedError:
                # more than one catalog, move to next
                if catalog:
                    logger.warning("Error processing catalog %s", catalog)
                    continue
                raise

            # add possible new schemas in catalog
            self._refresh_schemas(
                self.old_db_connection_name,
                self.db_connection.database_name,
                catalog,
                schemas,
            )

            if self.old_db_connection_name != self.db_connection.database_name:
                self._rename_database_in_permissions(
                    self.old_db_connection_name,
                    self.db_connection.database_name,
                    catalog,
                    schemas,
                )

    def _get_catalog_names(self, db_connection: Database) -> set[str]:
        """
        Helper method to load catalogs.
        """
        try:
            return db_connection.get_all_catalog_names(
                force=True,
                ssh_tunnel=self.db_connection_ssh_tunnel,
            )
        except OAuth2RedirectError:
            # raise OAuth2 exceptions as-is
            raise
        except GenericDBException as ex:
            raise DatabaseConnectionFailedError() from ex

    def _get_schema_names(
        self, db_connection: Database, catalog: str | None
    ) -> set[str]:
        """
        Helper method to load schemas.
        """
        try:
            return db_connection.get_all_schema_names(
                force=True,
                catalog=catalog,
                ssh_tunnel=self.db_connection_ssh_tunnel,
            )
        except OAuth2RedirectError:
            # raise OAuth2 exceptions as-is
            raise
        except GenericDBException as ex:
            raise DatabaseConnectionFailedError() from ex

    def _refresh_schemas(
        self,
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
        self,
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
                self.db_connection_id,
                catalog=catalog,
                schema=schema,
            ):
                dataset.catalog_perm = new_catalog_perm_name
                dataset.schema_perm = new_schema_perm_name
                for chart in DatasetDAO.get_related_objects(dataset.id)["charts"]:
                    chart.catalog_perm = new_catalog_perm_name
                    chart.schema_perm = new_schema_perm_name
