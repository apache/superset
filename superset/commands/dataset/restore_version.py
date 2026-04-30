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
"""Command that restores a dataset (and its columns/metrics) to a previous
version."""

from __future__ import annotations

import logging
from functools import partial
from uuid import UUID

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetNotFoundError,
    DatasetUpdateFailedError,
)
from superset.connectors.sqla.models import SqlaTable
from superset.daos.version import VersionDAO
from superset.exceptions import SupersetSecurityException
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class RestoreDatasetVersionCommand(BaseCommand):
    """Revert a dataset (and its columns + metrics) to a previous version.

    See :class:`superset.commands.chart.restore_version.RestoreChartVersionCommand`
    for the general contract.
    """

    def __init__(self, dataset_uuid: UUID, version_uuid: UUID) -> None:
        self._uuid = dataset_uuid
        self._version_uuid = version_uuid
        self._dataset: SqlaTable | None = None

    @transaction(on_error=partial(on_error, reraise=DatasetUpdateFailedError))
    def run(self) -> SqlaTable:
        self.validate()
        version_number = VersionDAO.resolve_version_uuid(
            SqlaTable, self._uuid, self._version_uuid
        )
        if version_number is None:
            raise DatasetNotFoundError()
        dataset = VersionDAO.restore_version(SqlaTable, self._uuid, version_number)
        if dataset is None:
            raise DatasetNotFoundError()
        return dataset

    def validate(self) -> None:
        dataset = VersionDAO._find_active_entity_by_uuid(  # pylint: disable=protected-access
            SqlaTable, self._uuid
        )
        if dataset is None:
            raise DatasetNotFoundError()
        try:
            security_manager.raise_for_ownership(dataset)
        except SupersetSecurityException as ex:
            raise DatasetForbiddenError() from ex
        self._dataset = dataset
