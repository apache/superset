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
from superset.dao.exceptions import DAOUpdateFailedError
from superset.databases.commands.exceptions import (
    DatabaseConnectionFailedError,
    DatabaseExistsValidationError,
    DatabaseInvalidError,
    DatabaseNotFoundError,
    DatabaseUpdateFailedError,
)
from superset.databases.dao import DatabaseDAO
from superset.extensions import db, security_manager
from superset.models.core import Database

logger = logging.getLogger(__name__)


class UpdateDatabaseCommand(BaseCommand):
    def __init__(self, user: User, model_id: int, data: Dict[str, Any]):
        self._actor = user
        self._properties = data.copy()
        self._model_id = model_id
        self._model: Optional[Database] = None

    def run(self) -> Model:
        self.validate()
        try:
            database = DatabaseDAO.update(self._model, self._properties, commit=False)
            database.set_sqlalchemy_uri(database.sqlalchemy_uri)
            security_manager.add_permission_view_menu("database_access", database.perm)
            # adding a new database we always want to force refresh schema list
            # TODO Improve this simplistic implementation for catching DB conn fails
            try:
                schemas = database.get_all_schema_names()
            except Exception as ex:
                db.session.rollback()
                raise DatabaseConnectionFailedError() from ex
            for schema in schemas:
                security_manager.add_permission_view_menu(
                    "schema_access", security_manager.get_schema_perm(database, schema)
                )
            db.session.commit()

        except DAOUpdateFailedError as ex:
            logger.exception(ex.exception)
            raise DatabaseUpdateFailedError() from ex
        return database

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
