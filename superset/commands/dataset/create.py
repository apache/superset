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

from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.dataset.exceptions import (
    DatabaseNotFoundValidationError,
    DatasetCreateFailedError,
    DatasetDataAccessIsNotAllowed,
    DatasetExistsValidationError,
    DatasetInvalidError,
    TableNotFoundValidationError,
)
from superset.daos.dataset import DatasetDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import security_manager
from superset.sql_parse import Table
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateDatasetCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=DatasetCreateFailedError))
    def run(self) -> Model:
        self.validate()

        dataset = DatasetDAO.create(attributes=self._properties)
        dataset.fetch_metadata()
        return dataset

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        database_id = self._properties["database"]
        schema = self._properties.get("schema")
        catalog = self._properties.get("catalog")
        sql = self._properties.get("sql")
        owner_ids: Optional[list[int]] = self._properties.get("owners")

        table = Table(self._properties["table_name"], schema, catalog)

        # Validate uniqueness
        if not DatasetDAO.validate_uniqueness(database_id, table):
            exceptions.append(DatasetExistsValidationError(table))

        # Validate/Populate database
        database = DatasetDAO.get_database_by_id(database_id)
        if not database:
            exceptions.append(DatabaseNotFoundValidationError())
        self._properties["database"] = database

        # Validate table exists on dataset if sql is not provided
        # This should be validated when the dataset is physical
        if (
            database
            and not sql
            and not DatasetDAO.validate_table_exists(database, table)
        ):
            exceptions.append(TableNotFoundValidationError(table))

        if sql:
            try:
                security_manager.raise_for_access(
                    database=database,
                    sql=sql,
                    catalog=catalog,
                    schema=schema,
                )
            except SupersetSecurityException as ex:
                exceptions.append(DatasetDataAccessIsNotAllowed(ex.error.message))
        try:
            owners = self.populate_owners(owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            raise DatasetInvalidError(exceptions=exceptions)
