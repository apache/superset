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
from typing import Dict, List, Optional

from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.exceptions import CreateFailedError
from superset.datasets.commands.base import populate_owners
from superset.datasets.commands.exceptions import (
    DatabaseNotFoundValidationError,
    DatasetCreateFailedError,
    DatasetExistsValidationError,
    DatasetInvalidError,
    TableNotFoundValidationError,
)
from superset.datasets.dao import DatasetDAO

logger = logging.getLogger(__name__)


class CreateDatasetCommand(BaseCommand):
    def __init__(self, user: User, data: Dict):
        self._actor = user
        self._properties = data.copy()

    def run(self):
        self.validate()
        try:
            dataset = DatasetDAO.create(self._properties)
        except CreateFailedError as e:
            logger.exception(e.exception)
            raise DatasetCreateFailedError()
        return dataset

    def validate(self) -> None:
        exceptions = list()
        database_id = self._properties["database"]
        table_name = self._properties["table_name"]
        schema = self._properties.get("schema", "")
        owner_ids: Optional[List[int]] = self._properties.get("owners")

        # Validate uniqueness
        if not DatasetDAO.validate_uniqueness(database_id, table_name):
            exceptions.append(DatasetExistsValidationError(table_name))

        # Validate/Populate database
        database = DatasetDAO.get_database_by_id(database_id)
        if not database:
            exceptions.append(DatabaseNotFoundValidationError())
        self._properties["database"] = database

        # Validate table exists on dataset
        if database and not DatasetDAO.validate_table_exists(
            database, table_name, schema
        ):
            exceptions.append(TableNotFoundValidationError(table_name))

        try:
            owners = populate_owners(self._actor, owner_ids)
            self._properties["owners"] = owners
        except ValidationError as e:
            exceptions.append(e)
        if exceptions:
            exception = DatasetInvalidError()
            exception.add_list(exceptions)
            raise exception
