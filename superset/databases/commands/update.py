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

from superset.databases.commands.base import BaseDatabaseCommand
from superset.dao.exceptions import DAOUpdateFailedError
from superset.databases.commands.exceptions import (
    DatabaseUpdateFailedError,
    DatabaseNotFoundError,
    DatabaseInvalidError,
)
from superset.databases.dao import DatabaseDAO
from superset.extensions import db, security_manager
from superset.models.core import Database

logger = logging.getLogger(__name__)


class UpdateDatabaseCommand(BaseDatabaseCommand):
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
            for schema in database.get_all_schema_names():
                security_manager.add_permission_view_menu(
                    "schema_access", security_manager.get_schema_perm(database, schema)
                )
            db.session.commit()

        except DAOUpdateFailedError as ex:
            logger.exception(ex.exception)
            raise DatabaseUpdateFailedError()
        return database

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = DatabaseDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatabaseNotFoundError()

        exceptions: List[ValidationError] = list()
        sqlalchemy_uri: Optional[str] = self._properties.get("sqlalchemy_uri")
        encrypted_extra: Optional[str] = self._properties.get("encrypted_extra")
        extra: Optional[str] = self._properties.get("extra")
        server_cert: Optional[str] = self._properties.get("server_cert")

        # Check that encrypted extra is valid JSON
        self._validate_encrypted_extra(exceptions, encrypted_extra)
        # check if extra is valid JSON
        self._validate_extra(exceptions, extra)
        # Check unsafe SQLAlchemy URI
        self._validate_sqlalchemy_uri(exceptions, sqlalchemy_uri)
        # Validate server certificate
        self._validate_server_cert(exceptions, server_cert)

        if exceptions:
            exception = DatabaseInvalidError()
            exception.add_list(exceptions)
            raise exception
