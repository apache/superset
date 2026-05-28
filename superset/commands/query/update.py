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

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand, UpdateMixin
from superset.commands.query.exceptions import (
    SavedQueryInvalidError,
    SavedQueryNotFoundError,
    SavedQueryUpdateFailedError,
)
from superset.daos.query import SavedQueryDAO
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateSavedQueryCommand(UpdateMixin, BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[Model] = None

    @transaction(on_error=partial(on_error, reraise=SavedQueryUpdateFailedError))
    def run(self) -> Model:
        self.validate()
        assert self._model is not None
        saved_query = SavedQueryDAO.update(self._model, attributes=self._properties)
        return saved_query

    def validate(self) -> None:
        exceptions: list[ValidationError] = []

        self._model = SavedQueryDAO.find_by_id(self._model_id)
        if not self._model:
            raise SavedQueryNotFoundError()

        if (db_id := self._properties.get("db_id")) is not None:
            from superset.extensions import db, security_manager
            from superset.models.core import Database

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
