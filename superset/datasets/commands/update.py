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
from superset.commands.exceptions import UpdateFailedError
from superset.connectors.sqla.models import SqlaTable
from superset.datasets.commands.base import populate_owners
from superset.datasets.commands.exceptions import (
    DatabaseChangeValidationError,
    DatasetExistsValidationError,
    DatasetForbiddenError,
    DatasetInvalidError,
    DatasetNotFoundError,
    DatasetUpdateFailedError,
)
from superset.datasets.dao import DatasetDAO
from superset.exceptions import SupersetSecurityException
from superset.views.base import check_ownership

logger = logging.getLogger(__name__)


class UpdateDatasetCommand(BaseCommand):
    def __init__(self, user: User, model_id: int, data: Dict):
        self._actor = user
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[SqlaTable] = None

    def run(self):
        self.validate()
        try:
            dataset = DatasetDAO.update(self._model, self._properties)
        except UpdateFailedError as e:
            logger.exception(e.exception)
            raise DatasetUpdateFailedError()
        return dataset

    def validate(self) -> None:
        exceptions = list()
        owner_ids: Optional[List[int]] = self._properties.get("owners")
        # Validate/populate model exists
        self._model = DatasetDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatasetNotFoundError()
        # Check ownership
        try:
            check_ownership(self._model)
        except SupersetSecurityException:
            raise DatasetForbiddenError()

        database_id = self._properties.get("database", None)
        table_name = self._properties.get("table_name", None)
        # Validate uniqueness
        if not DatasetDAO.validate_update_uniqueness(
            self._model.database_id, self._model_id, table_name
        ):
            exceptions.append(DatasetExistsValidationError(table_name))
        # Validate/Populate database not allowed to change
        if database_id and database_id != self._model:
            exceptions.append(DatabaseChangeValidationError())
        # Validate/Populate owner
        try:
            owners = populate_owners(self._actor, owner_ids)
            self._properties["owners"] = owners
        except ValidationError as e:
            exceptions.append(e)
        if exceptions:
            exception = DatasetInvalidError()
            exception.add_list(exceptions)
            raise exception
