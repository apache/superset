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

from flask import current_app
from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset import is_feature_enabled
from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseCreateFailedError,
    DatabaseExistsValidationError,
    DatabaseInvalidError,
    DatabaseRequiredFieldValidationError,
)
from superset.commands.database.ssh_tunnel.create import CreateSSHTunnelCommand
from superset.commands.database.ssh_tunnel.exceptions import (
    SSHTunnelCreateFailedError,
    SSHTunnelDatabasePortError,
    SSHTunnelingNotEnabledError,
    SSHTunnelInvalidError,
)
from superset.commands.database.test_connection import TestConnectionDatabaseCommand
from superset.daos.database import DatabaseDAO
from superset.daos.exceptions import DAOCreateFailedError
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.exceptions import SupersetErrorsException
from superset.extensions import db, event_logger, security_manager
from superset.models.core import Database

logger = logging.getLogger(__name__)
stats_logger = current_app.config["STATS_LOGGER"]


class CreateDatabaseCommand(BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()

        try:
            # Test connection before starting create transaction
            TestConnectionDatabaseCommand(self._properties).run()
        except (
            SupersetErrorsException,
            SSHTunnelingNotEnabledError,
            SSHTunnelDatabasePortError,
        ) as ex:
            event_logger.log_with_context(
                action=f"db_creation_failed.{ex.__class__.__name__}",
                engine=self._properties.get("sqlalchemy_uri", "").split(":")[0],
            )
            # So we can show the original message
            raise
        except Exception as ex:
            event_logger.log_with_context(
                action=f"db_creation_failed.{ex.__class__.__name__}",
                engine=self._properties.get("sqlalchemy_uri", "").split(":")[0],
            )
            raise DatabaseConnectionFailedError() from ex

        # when creating a new database we don't need to unmask encrypted extra
        self._properties["encrypted_extra"] = self._properties.pop(
            "masked_encrypted_extra",
            "{}",
        )

        ssh_tunnel: Optional[SSHTunnel] = None

        try:
            database = self._create_database()

            if ssh_tunnel_properties := self._properties.get("ssh_tunnel"):
                if not is_feature_enabled("SSH_TUNNELING"):
                    raise SSHTunnelingNotEnabledError()

                ssh_tunnel = CreateSSHTunnelCommand(
                    database, ssh_tunnel_properties
                ).run()

            db.session.commit()

            # add catalog/schema permissions
            if database.db_engine_spec.supports_catalog:
                catalogs = database.get_all_catalog_names(
                    cache=False,
                    ssh_tunnel=ssh_tunnel,
                )
                for catalog in catalogs:
                    security_manager.add_permission_view_menu(
                        "catalog_access",
                        security_manager.get_catalog_perm(
                            database.database_name, catalog
                        ),
                    )
            else:
                # add a dummy catalog for DBs that don't support them
                catalogs = [None]

            for catalog in catalogs:
                try:
                    self.add_schema_permissions(database, catalog, ssh_tunnel)
                except Exception:  # pylint: disable=broad-except
                    logger.warning("Error processing catalog '%s'", catalog)
                    continue

        except (
            SSHTunnelInvalidError,
            SSHTunnelCreateFailedError,
            SSHTunnelingNotEnabledError,
            SSHTunnelDatabasePortError,
        ) as ex:
            db.session.rollback()
            event_logger.log_with_context(
                action=f"db_creation_failed.{ex.__class__.__name__}.ssh_tunnel",
                engine=self._properties.get("sqlalchemy_uri", "").split(":")[0],
            )
            # So we can show the original message
            raise
        except (
            DAOCreateFailedError,
            DatabaseInvalidError,
            Exception,
        ) as ex:
            db.session.rollback()
            event_logger.log_with_context(
                action=f"db_creation_failed.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            raise DatabaseCreateFailedError() from ex

        if ssh_tunnel:
            stats_logger.incr("db_creation_success.ssh_tunnel")

        return database

    def add_schema_permissions(
        self,
        database: Database,
        catalog: str,
        ssh_tunnel: Optional[SSHTunnel],
    ) -> None:
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

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        sqlalchemy_uri: Optional[str] = self._properties.get("sqlalchemy_uri")
        database_name: Optional[str] = self._properties.get("database_name")
        if not sqlalchemy_uri:
            exceptions.append(DatabaseRequiredFieldValidationError("sqlalchemy_uri"))
        if not database_name:
            exceptions.append(DatabaseRequiredFieldValidationError("database_name"))
        else:
            # Check database_name uniqueness
            if not DatabaseDAO.validate_uniqueness(database_name):
                exceptions.append(DatabaseExistsValidationError())

        if exceptions:
            exception = DatabaseInvalidError()
            exception.extend(exceptions)
            event_logger.log_with_context(
                # pylint: disable=consider-using-f-string
                action="db_connection_failed.{}.{}".format(
                    exception.__class__.__name__,
                    ".".join(exception.get_list_classnames()),
                )
            )
            raise exception

    def _create_database(self) -> Database:
        database = DatabaseDAO.create(attributes=self._properties, commit=False)
        database.set_sqlalchemy_uri(database.sqlalchemy_uri)
        return database
