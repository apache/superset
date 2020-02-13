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
from flask_appbuilder.security.sqla.models import User
from marshmallow import UnmarshalResult, ValidationError

from superset.commands.base import BaseCommand, CommandValidateReturn
from superset.datasets.commands.base import populate_owners
from superset.datasets.commands.exceptions import (
    DatabaseNotFoundValidationError,
    DatasetCreateFailedError,
    DatasetExistsValidationError,
    DatasetInvalidError,
    TableNotFoundValidationError,
)
from superset.datasets.dao import DatasetDAO


class CreateDatasetCommand(BaseCommand):
    def __init__(self, user: User, unmarshal: UnmarshalResult):
        self._actor = user
        self._properties = unmarshal.data.copy()
        self._errors = unmarshal.errors

    def run(self):
        is_valid, exceptions = self.validate()
        if not is_valid:
            for exception in exceptions:
                self._errors.update(exception.normalized_messages())
            raise DatasetInvalidError()

        dataset = DatasetDAO.create(self._properties)

        if not dataset:
            raise DatasetCreateFailedError()
        return dataset

    def validate(self) -> CommandValidateReturn:
        is_valid, exceptions = super().validate()
        database_id = self._properties["database"]
        table_name = self._properties["table_name"]
        schema = self._properties.get("schema", "")

        # Validate uniqueness
        if not DatasetDAO.validate_uniqueness(database_id, table_name):
            exceptions.append(DatasetExistsValidationError(table_name))
            is_valid = False

        # Validate/Populate database
        database = DatasetDAO.get_database_by_id(database_id)
        if not database:
            exceptions.append(DatabaseNotFoundValidationError())
            is_valid = False
        self._properties["database"] = database

        # Validate table exists on dataset
        if database and not DatasetDAO.validate_table_exists(
            database, table_name, schema
        ):
            exceptions.append(TableNotFoundValidationError(table_name))
            is_valid = False

        try:
            owners = populate_owners(self._actor, self._properties.get("owners"))
            self._properties["owners"] = owners
        except ValidationError as e:
            exceptions.append(e)
            is_valid = False
        return is_valid, exceptions
