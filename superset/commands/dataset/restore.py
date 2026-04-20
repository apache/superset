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
"""Command to restore a soft-deleted dataset."""

import logging
from functools import partial

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetNotFoundError,
    DatasetRestoreFailedError,
)
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dataset import DatasetDAO
from superset.exceptions import SupersetSecurityException
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class RestoreDatasetCommand(BaseCommand):
    """Restore a soft-deleted dataset by clearing its ``deleted_at`` field."""

    def __init__(self, model_uuid: str):
        self._model_uuid = model_uuid
        self._model: SqlaTable | None = None

    @transaction(on_error=partial(on_error, reraise=DatasetRestoreFailedError))
    def run(self) -> None:
        self.validate()
        assert self._model
        self._model.restore()

    def validate(self) -> None:
        self._model = DatasetDAO.find_by_id(
            self._model_uuid,
            id_column="uuid",
            skip_base_filter=True,
            skip_visibility_filter=True,
        )

        if self._model is None or self._model.deleted_at is None:
            raise DatasetNotFoundError()

        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise DatasetForbiddenError() from ex
