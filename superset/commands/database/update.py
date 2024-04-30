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
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

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
    SSHTunnelError,
    SSHTunnelingNotEnabledError,
)
from superset.commands.database.ssh_tunnel.update import UpdateSSHTunnelCommand
from superset.daos.database import DatabaseDAO
from superset.daos.dataset import DatasetDAO
from superset.daos.exceptions import DAOCreateFailedError, DAOUpdateFailedError
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.extensions import db
from superset.models.core import Database

logger = logging.getLogger(__name__)


class UpdateDatabaseCommand(BaseCommand):
    _model: Optional[Database]

    def __init__(self, model_id: int, data: dict[str, Any]):
        self._properties = data.copy()
        self._model_id = model_id
        self._model: Optional[Database] = None

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

        try:
            database = DatabaseDAO.update(
                self._model,
                self._properties,
                commit=False,
            )
            database.set_sqlalchemy_uri(database.sqlalchemy_uri)
            ssh_tunnel = self._handle_ssh_tunnel(database)
            self._refresh_schemas(database, original_database_name, ssh_tunnel)
        except SSHTunnelError as ex:
            # allow exception to bubble for debugbing information
            raise ex
        except (DAOUpdateFailedError, DAOCreateFailedError) as ex:
            raise DatabaseUpdateFailedError() from ex

        return database

    def _handle_ssh_tunnel(self, database: Database) -> SSHTunnel | None:
        """
        Delete, create, or update an SSH tunnel.
        """
        if "ssh_tunnel" not in self._properties:
            return None

        if not is_feature_enabled("SSH_TUNNELING"):
            db.session.rollback()
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

    def _refresh_schemas(
        self,
        database: Database,
        original_database_name: str,
        ssh_tunnel: Optional[SSHTunnel],
    ) -> None:
        """
        Add permissions for any new schemas.
        """
        try:
            schemas = database.get_all_schema_names(ssh_tunnel=ssh_tunnel)
        except Exception as ex:
            db.session.rollback()
            raise DatabaseConnectionFailedError() from ex

        for schema in schemas:
            original_vm = security_manager.get_schema_perm(
                original_database_name,
                schema,
            )
            existing_pvm = security_manager.find_permission_view_menu(
                "schema_access",
                original_vm,
            )
            if not existing_pvm:
                # new schema
                security_manager.add_permission_view_menu(
                    "schema_access",
                    security_manager.get_schema_perm(database.database_name, schema),
                )
                continue

            if original_database_name == database.database_name:
                continue

            # rename existing schema permission
            existing_pvm.view_menu.name = security_manager.get_schema_perm(
                database.database_name,
                schema,
            )

            # rename permissions on datasets and charts
            for dataset in DatabaseDAO.get_datasets(
                database.id,
                catalog=None,
                schema=schema,
            ):
                dataset.schema_perm = existing_pvm.view_menu.name
                for chart in DatasetDAO.get_related_objects(dataset.id)["charts"]:
                    chart.schema_perm = existing_pvm.view_menu.name

        db.session.commit()

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        database_name: Optional[str] = self._properties.get("database_name")
        if database_name:
            # Check database_name uniqueness
            if not DatabaseDAO.validate_update_uniqueness(
                self._model_id, database_name
            ):
                exceptions.append(DatabaseExistsValidationError())
        if exceptions:
            raise DatabaseInvalidError(exceptions=exceptions)
