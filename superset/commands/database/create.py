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
from functools import partial
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
from superset.commands.database.utils import add_permissions
from superset.daos.database import DatabaseDAO
from superset.databases.ssh_tunnel.models import SSHTunnel
from superset.exceptions import OAuth2RedirectError, SupersetErrorsException
from superset.extensions import event_logger
from superset.models.core import Database
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)
stats_logger = current_app.config["STATS_LOGGER"]


class CreateDatabaseCommand(BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=DatabaseCreateFailedError))
    def run(self) -> Model:
        self.validate()

        try:
            # Test connection before starting create transaction
            TestConnectionDatabaseCommand(self._properties).run()
        except OAuth2RedirectError:
            # If we can't connect to the database due to an OAuth2 error we can still
            # save the database. Later, the user can sync permissions when setting up
            # data access rules.
            return self._create_database()
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

        ssh_tunnel: Optional[SSHTunnel] = None

        try:
            database = self._create_database()

            if ssh_tunnel_properties := self._properties.get("ssh_tunnel"):
                if not is_feature_enabled("SSH_TUNNELING"):
                    raise SSHTunnelingNotEnabledError()

                ssh_tunnel = CreateSSHTunnelCommand(
                    database, ssh_tunnel_properties
                ).run()

            # add catalog/schema permissions
            add_permissions(database, ssh_tunnel)
        except (
            SSHTunnelInvalidError,
            SSHTunnelCreateFailedError,
            SSHTunnelingNotEnabledError,
            SSHTunnelDatabasePortError,
        ) as ex:
            event_logger.log_with_context(
                action=f"db_creation_failed.{ex.__class__.__name__}.ssh_tunnel",
                engine=self._properties.get("sqlalchemy_uri", "").split(":")[0],
            )
            # So we can show the original message
            raise
        except (
            DatabaseInvalidError,
            Exception,
        ) as ex:
            event_logger.log_with_context(
                action=f"db_creation_failed.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            raise DatabaseCreateFailedError() from ex

        if ssh_tunnel:
            stats_logger.incr("db_creation_success.ssh_tunnel")

        return database

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
        # when creating a new database we don't need to unmask encrypted extra
        self._properties["encrypted_extra"] = self._properties.pop(
            "masked_encrypted_extra",
            "{}",
        )

        database = DatabaseDAO.create(attributes=self._properties)
        database.set_sqlalchemy_uri(database.sqlalchemy_uri)
        return database
