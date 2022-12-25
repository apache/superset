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
from typing import Optional

from flask_appbuilder.models.sqla import Model

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.connectors.sqla.models import TableColumn
from superset.dao.exceptions import DAODeleteFailedError
from superset.datamanage.columns.commands.exceptions import (
    DatamanageColumnDeleteFailedError,
    DatamanageColumnForbiddenError,
    DatamanageColumnNotFoundError,
)
from superset.datamanage.dao import DatamanageDAO
from superset.exceptions import SupersetSecurityException

logger = logging.getLogger(__name__)


class DeleteDatamanageColumnCommand(BaseCommand):
    def __init__(self, datamanage_id: int, model_id: int):
        self._datamanage_id = datamanage_id
        self._model_id = model_id
        self._model: Optional[TableColumn] = None

    def run(self) -> Model:
        self.validate()
        try:
            if not self._model:
                raise DatamanageColumnNotFoundError()
            column = DatamanageDAO.delete_column(self._model)
            return column
        except DAODeleteFailedError as ex:
            logger.exception(ex.exception)
            raise DatamanageColumnDeleteFailedError() from ex

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = DatamanageDAO.find_datamanage_column(self._datamanage_id, self._model_id)
        if not self._model:
            raise DatamanageColumnNotFoundError()
        # Check ownership
        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise DatamanageColumnForbiddenError() from ex
