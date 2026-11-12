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

from flask import current_app
from flask_appbuilder.models.sqla import Model

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.dataset.exceptions import (
    DatasetForbiddenError,
    DatasetNotFoundError,
    DatasetRefreshFailedError,
)
from superset.commands.utils import raise_if_managed_externally
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dataset import DatasetDAO
from superset.datasets.datetime_format_detector import DatetimeFormatDetector
from superset.exceptions import (
    SupersetSecurityException,
    SupersetVirtualTableParseException,
)
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class RefreshDatasetCommand(BaseCommand):
    def __init__(self, model_id: int):
        self._model_id = model_id
        self._model: Optional[SqlaTable] = None
        # False when run() skipped the column refresh (see below), so callers
        # that report on the refresh can tell it apart from a refresh that
        # left the columns unchanged.
        self.metadata_refreshed = False

    @transaction(on_error=partial(on_error, reraise=DatasetRefreshFailedError))
    def run(self) -> Model:
        self.validate()
        assert self._model
        # Before the metadata lands as well as after, the way `DatasetDAO.update`
        # does it -- and for the reason spelled out on
        # `clear_unmapped_partition_transforms`: it reads the mapping as it
        # stands, so one call can only enforce the invariant against one of the
        # two resolutions a mapping change has.
        #
        # `fetch_metadata` can *move* the effective mapped column, by dropping
        # the column `partition_mapped_column` names (the mapping then falls
        # back to `main_dttm_col`) or by setting `main_dttm_col` itself. Run only
        # afterwards, the cleanup resolved the *new* mapping, found the newly
        # mapped column effective and skipped it -- so a transform parked there,
        # which nobody asked to activate, went live and started adding its own
        # predicate to every filter, while the previously mapped column's real
        # transform was the one erased.
        DatasetDAO.clear_unmapped_partition_transforms(self._model)
        try:
            self._model.fetch_metadata()
            self.metadata_refreshed = True
        except SupersetVirtualTableParseException as ex:
            # The virtual dataset's SQL could not be parsed or templated at
            # save time — typically Jinja blocks (e.g. ``{% if from_dttm %}``)
            # that have no runtime context here. The row has already been
            # persisted by ``UpdateDatasetCommand`` before this refresh runs,
            # so surfacing an "Invalid SQL" toast is misleading. Genuine
            # driver, connection, and permission errors still raise the
            # broader ``SupersetGenericDBErrorException`` and continue to
            # bubble up. See #38012.
            logger.warning(
                "Dataset column refresh skipped for %s: %s",
                self._model.table_name,
                ex.message,
            )

        # `fetch_metadata` writes the columns itself rather than going through
        # `DatasetDAO.update`, so neither of the mapping's own repairs runs. It
        # can drop the column `partition_column` names -- leaving a reference
        # that fails `UpdateDatasetCommand`'s validation on every later edit,
        # including a description-only PUT, which carries no columns payload and
        # so cannot reach the branch that forgives a stored-only dangle -- and
        # it can *set* `main_dttm_col`, which moves the effective mapped column
        # and can bring a parked transform live.
        #
        # No flush needed to read the columns: `fetch_metadata` reassigns the
        # relationship, so the surviving set is already correct in memory.
        DatasetDAO.clear_dangling_partition_mapping(
            self._model, {column.column_name for column in self._model.columns}
        )
        # The second of the two calls; see the first, above `fetch_metadata`.
        # This one answers for the mapping the refresh leaves behind.
        DatasetDAO.clear_unmapped_partition_transforms(self._model)

        # Detect datetime formats if feature is enabled
        if current_app.config.get("DATASET_AUTO_DETECT_DATETIME_FORMATS", True):
            try:
                detector = DatetimeFormatDetector()
                detector.detect_all_formats(self._model)
                logger.info(
                    "Detected datetime formats for dataset %s", self._model.table_name
                )
            except Exception as ex:
                logger.exception(
                    "Failed to detect datetime formats for dataset %s: %s",
                    self._model.table_name,
                    str(ex),
                )

        return self._model

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = DatasetDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatasetNotFoundError()
        # Check editorship
        try:
            security_manager.raise_for_editorship(self._model)
        except SupersetSecurityException as ex:
            raise DatasetForbiddenError() from ex

        # Refresh persists fetched column metadata onto the dataset; an
        # externally managed dataset's columns are owned by the external
        # sync, which would overwrite (or fight) the refresh.
        raise_if_managed_externally(self._model, DatasetForbiddenError)
