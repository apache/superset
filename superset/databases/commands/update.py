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
from typing import Any, Dict, List, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset import is_feature_enabled
from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAOCreateFailedError, DAOUpdateFailedError
from superset.databases.commands.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseExistsValidationError,
    DatabaseInvalidError,
    DatabaseNotFoundError,
    DatabaseUpdateFailedError,
)
from superset.databases.dao import DatabaseDAO
from superset.databases.ssh_tunnel.commands.create import CreateSSHTunnelCommand
from superset.databases.ssh_tunnel.commands.exceptions import (
    SSHTunnelCreateFailedError,
    SSHTunnelingNotEnabledError,
    SSHTunnelInvalidError,
    SSHTunnelUpdateFailedError,
)
from superset.databases.ssh_tunnel.commands.update import UpdateSSHTunnelCommand
from superset.extensions import db, security_manager
from superset.models.core import Database
from superset.utils.core import DatasourceType

logger = logging.getLogger(__name__)


class UpdateDatabaseCommand(BaseCommand):
    def __init__(self, model_id: int, data: Dict[str, Any]):
        self._properties = data.copy()
        self._model_id = model_id
        self._model: Optional[Database] = None

    def run(self) -> Model:
        self.validate()
        if not self._model:
            raise DatabaseNotFoundError()
        old_database_name = self._model.database_name

        # unmask ``encrypted_extra``
        self._properties[
            "encrypted_extra"
        ] = self._model.db_engine_spec.unmask_encrypted_extra(
            self._model.encrypted_extra,
            self._properties.pop("masked_encrypted_extra", "{}"),
        )

        try:
            database = DatabaseDAO.update(self._model, self._properties, commit=False)
            database.set_sqlalchemy_uri(database.sqlalchemy_uri)
            # adding a new database we always want to force refresh schema list
            # TODO Improve this simplistic implementation for catching DB conn fails
            try:
                schemas = database.get_all_schema_names()
            except Exception as ex:
                db.session.rollback()
                raise DatabaseConnectionFailedError() from ex

            # Update database schema permissions
            new_schemas: List[str] = []

            for schema in schemas:
                old_view_menu_name = security_manager.get_schema_perm(
                    old_database_name, schema
                )
                new_view_menu_name = security_manager.get_schema_perm(
                    database.database_name, schema
                )
                schema_pvm = security_manager.find_permission_view_menu(
                    "schema_access", old_view_menu_name
                )
                # Update the schema permission if the database name changed
                if schema_pvm and old_database_name != database.database_name:
                    schema_pvm.view_menu.name = new_view_menu_name

                    self._propagate_schema_permissions(
                        old_view_menu_name, new_view_menu_name
                    )
                else:
                    new_schemas.append(schema)
            for schema in new_schemas:
                security_manager.add_permission_view_menu(
                    "schema_access", security_manager.get_schema_perm(database, schema)
                )

            if ssh_tunnel_properties := self._properties.get("ssh_tunnel"):
                if not is_feature_enabled("SSH_TUNNELING"):
                    db.session.rollback()
                    raise SSHTunnelingNotEnabledError()
                existing_ssh_tunnel_model = DatabaseDAO.get_ssh_tunnel(database.id)
                if existing_ssh_tunnel_model is None:
                    # We couldn't found an existing tunnel so we need to create one
                    try:
                        CreateSSHTunnelCommand(database.id, ssh_tunnel_properties).run()
                    except (SSHTunnelInvalidError, SSHTunnelCreateFailedError) as ex:
                        # So we can show the original message
                        raise ex
                    except Exception as ex:
                        raise DatabaseUpdateFailedError() from ex
                else:
                    # We found an existing tunnel so we need to update it
                    try:
                        UpdateSSHTunnelCommand(
                            existing_ssh_tunnel_model.id, ssh_tunnel_properties
                        ).run()
                    except (SSHTunnelInvalidError, SSHTunnelUpdateFailedError) as ex:
                        # So we can show the original message
                        raise ex
                    except Exception as ex:
                        raise DatabaseUpdateFailedError() from ex

            db.session.commit()

        except (DAOUpdateFailedError, DAOCreateFailedError) as ex:
            raise DatabaseUpdateFailedError() from ex
        return database

    @staticmethod
    def _propagate_schema_permissions(
        old_view_menu_name: str, new_view_menu_name: str
    ) -> None:
        from superset.connectors.sqla.models import (  # pylint: disable=import-outside-toplevel
            SqlaTable,
        )
        from superset.models.slice import (  # pylint: disable=import-outside-toplevel
            Slice,
        )

        # Update schema_perm on all datasets
        datasets = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.schema_perm == old_view_menu_name)
            .all()
        )
        for dataset in datasets:
            dataset.schema_perm = new_view_menu_name
            charts = db.session.query(Slice).filter(
                Slice.datasource_type == DatasourceType.TABLE,
                Slice.datasource_id == dataset.id,
            )
            # Update schema_perm on all charts
            for chart in charts:
                chart.schema_perm = new_view_menu_name

    def validate(self) -> None:
        exceptions: List[ValidationError] = []
        # Validate/populate model exists
        self._model = DatabaseDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatabaseNotFoundError()
        database_name: Optional[str] = self._properties.get("database_name")
        if database_name:
            # Check database_name uniqueness
            if not DatabaseDAO.validate_update_uniqueness(
                self._model_id, database_name
            ):
                exceptions.append(DatabaseExistsValidationError())
        if exceptions:
            exception = DatabaseInvalidError()
            exception.add_list(exceptions)
            raise exception
