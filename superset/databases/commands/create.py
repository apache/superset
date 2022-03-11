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
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAOCreateFailedError
from superset.databases.commands.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseCreateFailedError,
    DatabaseExistsValidationError,
    DatabaseInvalidError,
    DatabaseRequiredFieldValidationError,
)
from superset.databases.commands.test_connection import TestConnectionDatabaseCommand
from superset.databases.dao import DatabaseDAO
from superset.extensions import db, event_logger, security_manager

logger = logging.getLogger(__name__)


class CreateDatabaseCommand(BaseCommand):
    def __init__(self, user: User, data: Dict[str, Any]):
        self._actor = user
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()

        try:
            # Test connection before starting create transaction
            TestConnectionDatabaseCommand(self._actor, self._properties).run()
        except Exception as ex:
            event_logger.log_with_context(
                action=f"db_creation_failed.{ex.__class__.__name__}",
                engine=self._properties.get("sqlalchemy_uri", "").split(":")[0],
            )
            raise DatabaseConnectionFailedError() from ex

        try:
            database = DatabaseDAO.create(self._properties, commit=False)
            database.set_sqlalchemy_uri(database.sqlalchemy_uri)

            # adding a new database we always want to force refresh schema list
            schemas = database.get_all_schema_names(cache=False)
            for schema in schemas:
                security_manager.add_permission_view_menu(
                    "schema_access", security_manager.get_schema_perm(database, schema)
                )
            security_manager.add_permission_view_menu("database_access", database.perm)
            db.session.commit()
        except DAOCreateFailedError as ex:
            db.session.rollback()
            event_logger.log_with_context(
                action=f"db_creation_failed.{ex.__class__.__name__}",
                engine=database.db_engine_spec.__name__,
            )
            raise DatabaseCreateFailedError() from ex
        return database

    def validate(self) -> None:
        exceptions: List[ValidationError] = []
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
            exception.add_list(exceptions)
            event_logger.log_with_context(
                action="db_connection_failed.{}.{}".format(
                    exception.__class__.__name__,
                    ".".join(exception.get_list_classnames()),
                )
            )
            raise exception
