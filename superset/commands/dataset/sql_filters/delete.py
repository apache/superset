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
from typing import Optional

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.dataset.sql_filters.exceptions import (
    DatasetFilterDeleteFailedError,
    DatasetFilterForbiddenError,
    DatasetFilterNotFoundError,
)
from superset.connectors.sqla.models import SqlFilter
from superset.daos.dataset import DatasetDAO, DatasetFilterDAO
from superset.exceptions import SupersetSecurityException
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeleteDatasetFilterCommand(BaseCommand):
    def __init__(self, dataset_id: int, model_id: int):
        self._dataset_id = dataset_id
        self._model_id = model_id
        self._model: Optional[SqlFilter] = None

    @transaction(on_error=partial(on_error, reraise=DatasetFilterDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._model
        DatasetFilterDAO.delete([self._model])

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = DatasetDAO.find_dataset_filter(self._dataset_id, self._model_id)
        if not self._model:
            raise DatasetFilterNotFoundError()
        # Check editorship
        try:
            security_manager.raise_for_editorship(self._model)
        except SupersetSecurityException as ex:
            raise DatasetFilterForbiddenError() from ex
