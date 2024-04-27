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
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset import is_feature_enabled
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
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
from superset.daos.exceptions import DAOCreateFailedError, DAOUpdateFailedError
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

        try:
            database = DatabaseDAO.update(
                self._model,
                self._properties,
                commit=False,
            )
            database.set_sqlalchemy_uri(database.sqlalchemy_uri)

            try:
                self._handle_ssh_tunnel(database)
            except SSHTunnelError:
                raise
            except Exception as ex:
                raise DatabaseUpdateFailedError() from ex

        except (DAOUpdateFailedError, DAOCreateFailedError) as ex:
            raise DatabaseUpdateFailedError() from ex

        return database

    def _handle_ssh_tunnel(self, database: Database) -> None:
        """
        Delete, create, or update an SSH tunnel.
        """
        if not is_feature_enabled("SSH_TUNNELING"):
            db.session.rollback()
            raise SSHTunnelingNotEnabledError()

        if "ssh_tunnel" not in self._properties:
            return

        current_ssh_tunnel = DatabaseDAO.get_ssh_tunnel(database.id)
        ssh_tunnel_properties = self._properties["ssh_tunnel"]

        if ssh_tunnel_properties is None:
            if current_ssh_tunnel:
                DeleteSSHTunnelCommand(current_ssh_tunnel.id).run()
            return

        if current_ssh_tunnel is None:
            CreateSSHTunnelCommand(database, ssh_tunnel_properties).run()
            return

        UpdateSSHTunnelCommand(
            current_ssh_tunnel.id,
            ssh_tunnel_properties,
        ).run()

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
