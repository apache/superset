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
from superset.commands.dataset.columns.exceptions import (
    DatasetColumnDeleteFailedError,
    DatasetColumnForbiddenError,
    DatasetColumnNotFoundError,
)
from superset.connectors.sqla.models import TableColumn
from superset.daos.dataset import DatasetColumnDAO, DatasetDAO
from superset.exceptions import SupersetSecurityException
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class DeleteDatasetColumnCommand(BaseCommand):
    def __init__(self, dataset_id: int, model_id: int):
        self._dataset_id = dataset_id
        self._model_id = model_id
        self._model: Optional[TableColumn] = None

    @transaction(on_error=partial(on_error, reraise=DatasetColumnDeleteFailedError))
    def run(self) -> None:
        self.validate()
        assert self._model
        table = self._model.table
        deleted_name = self._model.column_name

        # This path removes a column without going through `DatasetDAO.update`,
        # so none of the partition filter mapping's repairs runs on its own.
        # Deleting the designated partition column left `partition_column`
        # naming a column that no longer exists, and the next PUT -- including a
        # description-only one, which carries no `columns` payload and so
        # validates against the model's remaining columns -- was rejected.
        #
        # Ahead of the delete as well as after it, for the reason
        # `RefreshDatasetCommand` does the same: the one-transform invariant is
        # resolved against whichever column the mapping currently names, so one
        # call can only enforce it against one of the two resolutions a
        # deletion has. Deleting the *mapped* column clears the override and
        # the mapping falls back to `main_dttm_col`; asked only afterwards, the
        # cleanup finds that column effective and keeps a transform some
        # earlier writer stranded on it, which then goes live from a deletion
        # nobody meant as a mapping change.
        if table is not None:
            DatasetDAO.clear_unmapped_partition_transforms(table)

        DatasetColumnDAO.delete([self._model])

        if table is not None:
            DatasetDAO.clear_dangling_partition_mapping(
                table,
                {
                    column.column_name
                    for column in table.columns
                    if column.column_name != deleted_name
                },
            )
            # The second of the two; see the first, above the delete.
            DatasetDAO.clear_unmapped_partition_transforms(table)

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = DatasetDAO.find_dataset_column(self._dataset_id, self._model_id)
        if not self._model:
            raise DatasetColumnNotFoundError()
        # Check editorship
        try:
            security_manager.raise_for_editorship(self._model)
        except SupersetSecurityException as ex:
            raise DatasetColumnForbiddenError() from ex
