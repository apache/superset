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
from typing import Any

from flask_appbuilder.models.sqla import Model

from superset import is_feature_enabled, security_manager
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseExistsValidationError,
    DatabaseInvalidError,
    DatabaseNotFoundError,
    DatabaseUpdateFailedError,
)
from superset.commands.database.ssh_tunnel.create import CreateSSHTunnelCommand
from superset.commands.database.ssh_tunnel.delete import DeleteSSHTunnelCommand
from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelingNotEnabledError,
)
from superset.commands.database.ssh_tunnel.update import UpdateSSHTunnelCommand
from superset.daos.database import DatabaseDAO
from superset.daos.dataset import DatasetDAO
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.db_engine_specs.base import GenericDBException
from superset.models.core import Database
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateDatabaseCommand(BaseCommand):
    _model: Database | None

    def __init__(self, model_id: int, data: dict[str, Any]):
        self._properties = data.copy()
        self._model_id = model_id
        self._model: Database | None = None

    @transaction(on_error=partial(on_error, reraise=DatabaseUpdateFailedError))
    def run(self) -> Model:
        self._model = DatabaseDAO.find_by_id(self._model_id)

        if not self._model:
            raise DatabaseNotFoundError()

        self.validate()

        # unmask ``encrypted_extra``
        self._properties["encrypted_extra"] = (
            self._model.db_engine_spec.unmask_encrypted_extra(
                self._model.encrypted_extra,
                self._properties.pop("masked_encrypted_extra", "{}"),
            )
        )

        # if the database name changed we need to update any existing permissions,
        # since they're name based
        original_database_name = self._model.database_name

        database = DatabaseDAO.update(self._model, self._properties)
        database.set_sqlalchemy_uri(database.sqlalchemy_uri)
        ssh_tunnel = self._handle_ssh_tunnel(database)
        self._refresh_catalogs(database, original_database_name, ssh_tunnel)

        return database

    def _handle_ssh_tunnel(self, database: Database) -> SSHTunnel | None:
        """
        Delete, create, or update an SSH tunnel.
        """
        if "ssh_tunnel" not in self._properties:
            return None

        if not is_feature_enabled("SSH_TUNNELING"):
            raise SSHTunnelingNotEnabledError()

        current_ssh_tunnel = DatabaseDAO.get_ssh_tunnel(database.id)
        ssh_tunnel_properties = self._properties["ssh_tunnel"]

        if ssh_tunnel_properties is None:
            if current_ssh_tunnel:
                DeleteSSHTunnelCommand(current_ssh_tunnel.id).run()
            return None

        if current_ssh_tunnel is None:
            return CreateSSHTunnelCommand(database, ssh_tunnel_properties).run()

        return UpdateSSHTunnelCommand(
            current_ssh_tunnel.id,
            ssh_tunnel_properties,
        ).run()

    def _get_catalog_names(
        self,
        database: Database,
        ssh_tunnel: SSHTunnel | None,
    ) -> set[str]:
        """
        Helper method to load catalogs.
        """
        try:
            return database.get_all_catalog_names(
                force=True,
                ssh_tunnel=ssh_tunnel,
            )
        except GenericDBException as ex:
            raise DatabaseConnectionFailedError() from ex

    def _get_schema_names(
        self,
        database: Database,
        catalog: str | None,
        ssh_tunnel: SSHTunnel | None,
    ) -> set[str]:
        """
        Helper method to load schemas.
        """
        try:
            return database.get_all_schema_names(
                force=True,
                catalog=catalog,
                ssh_tunnel=ssh_tunnel,
            )
        except GenericDBException as ex:
            raise DatabaseConnectionFailedError() from ex

    def _refresh_catalogs(
        self,
        database: Database,
        original_database_name: str,
        ssh_tunnel: SSHTunnel | None,
    ) -> None:
        """
        Add permissions for any new catalogs and schemas.
        """
        catalogs = (
            self._get_catalog_names(database, ssh_tunnel)
            if database.db_engine_spec.supports_catalog
            else [None]
        )

        for catalog in catalogs:
            try:
                schemas = self._get_schema_names(database, catalog, ssh_tunnel)

                if catalog:
                    perm = security_manager.get_catalog_perm(
                        original_database_name,
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
                                database.database_name,
                                catalog,
                            ),
                        )
                        for schema in schemas:
                            security_manager.add_permission_view_menu(
                                "schema_access",
                                security_manager.get_schema_perm(
                                    database.database_name,
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
                database,
                original_database_name,
                catalog,
                schemas,
            )

            if original_database_name != database.database_name:
                self._rename_database_in_permissions(
                    database,
                    original_database_name,
                    catalog,
                    schemas,
                )

    def _refresh_schemas(
        self,
        database: Database,
        original_database_name: str,
        catalog: str | None,
        schemas: set[str],
    ) -> None:
        """
        Add new schemas that don't have permissions yet.
        """
        for schema in schemas:
            perm = security_manager.get_schema_perm(
                original_database_name,
                catalog,
                schema,
            )
            existing_pvm = security_manager.find_permission_view_menu(
                "schema_access",
                perm,
            )
            if not existing_pvm:
                new_name = security_manager.get_schema_perm(
                    database.database_name,
                    catalog,
                    schema,
                )
                security_manager.add_permission_view_menu("schema_access", new_name)

    def _rename_database_in_permissions(
        self,
        database: Database,
        original_database_name: str,
        catalog: str | None,
        schemas: set[str],
    ) -> None:
        new_catalog_perm_name = security_manager.get_catalog_perm(
            database.database_name,
            catalog,
        )

        # rename existing catalog permission
        if catalog:
            perm = security_manager.get_catalog_perm(
                original_database_name,
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
                database.database_name,
                catalog,
                schema,
            )

            # rename existing schema permission
            perm = security_manager.get_schema_perm(
                original_database_name,
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
                database.id,
                catalog=catalog,
                schema=schema,
            ):
                dataset.catalog_perm = new_catalog_perm_name
                dataset.schema_perm = new_schema_perm_name
                for chart in DatasetDAO.get_related_objects(dataset.id)["charts"]:
                    chart.catalog_perm = new_catalog_perm_name
                    chart.schema_perm = new_schema_perm_name

    def validate(self) -> None:
        if database_name := self._properties.get("database_name"):
            if not DatabaseDAO.validate_update_uniqueness(
                self._model_id,
                database_name,
            ):
                raise DatabaseInvalidError(exceptions=[DatabaseExistsValidationError()])
