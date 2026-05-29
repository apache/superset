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
from typing import Any

from flask import g
from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.query.exceptions import (
    SavedQueryCreateFailedError,
    SavedQueryInvalidError,
)
from superset.daos.query import SavedQueryDAO
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateSavedQueryCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=SavedQueryCreateFailedError))
    def run(self) -> Model:
        self.validate()
        self._properties["user_id"] = g.user.id
        saved_query = SavedQueryDAO.create(attributes=self._properties)
        return saved_query

    def validate(self) -> None:
        from superset.extensions import db, security_manager
        from superset.models.core import Database

        exceptions: list[ValidationError] = []

        db_id = self._properties.get("db_id")
        if db_id is None:
            exceptions.append(ValidationError("db_id is required", field_name="db_id"))
            raise SavedQueryInvalidError(exceptions=exceptions)

        database = db.session.query(Database).filter_by(id=db_id).first()

        if not database:
            exceptions.append(
                ValidationError(
                    f"Database with ID {db_id} not found", field_name="db_id"
                )
            )
            raise SavedQueryInvalidError(exceptions=exceptions)

        if not security_manager.can_access_database(database):
            exceptions.append(
                ValidationError(
                    f"Access denied to database {database.database_name}",
                    field_name="db_id",
                )
            )
            raise SavedQueryInvalidError(exceptions=exceptions)
