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
from sqlalchemy.exc import SQLAlchemyError

from superset.commands.base import BaseCommand, CreateMixin
from superset.dao.exceptions import DAOCreateFailedError
from superset.datamanage.commands.exceptions import (
    DatabaseNotFoundValidationError,
    DatamanageCreateFailedError,
    DatamanageExistsValidationError,
    DatamanageInvalidError,
    TableNotFoundValidationError,
)
from superset.datamanage.dao import DatamanageDAO
from superset.extensions import db

logger = logging.getLogger(__name__)


class CreateDatamanageCommand(CreateMixin, BaseCommand):
    def __init__(self, data: Dict[str, Any]):
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()
        try:
            # Creates SqlaTable (Datamanage)
            datamanage = DatamanageDAO.create(self._properties, commit=False)
            # Updates columns and metrics from the datamanage
            datamanage.fetch_metadata(commit=False)
            db.session.commit()
        except (SQLAlchemyError, DAOCreateFailedError) as ex:
            logger.warning(ex, exc_info=True)
            db.session.rollback()
            raise DatamanageCreateFailedError() from ex
        return datamanage

    def validate(self) -> None:
        exceptions: List[ValidationError] = []
        database_id = self._properties["database"]
        table_name = self._properties["table_name"]
        schema = self._properties.get("schema", None)
        sql = self._properties.get("sql", None)
        owner_ids: Optional[List[int]] = self._properties.get("owners")

        # Validate uniqueness
        if not DatamanageDAO.validate_uniqueness(database_id, schema, table_name):
            exceptions.append(DatamanageExistsValidationError(table_name))

        # Validate/Populate database
        database = DatamanageDAO.get_database_by_id(database_id)
        if not database:
            exceptions.append(DatabaseNotFoundValidationError())
        self._properties["database"] = database

        # Validate table exists on datamanage if sql is not provided
        # This should be validated when the datamanage is physical
        if (
            database
            and not sql
            and not DatamanageDAO.validate_table_exists(database, table_name, schema)
        ):
            exceptions.append(TableNotFoundValidationError(table_name))

        try:
            owners = self.populate_owners(owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            exception = DatamanageInvalidError()
            exception.add_list(exceptions)
            raise exception
