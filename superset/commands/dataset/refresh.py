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
from superset.connectors.sqla.models import SqlaTable
from superset.daos.dataset import DatasetDAO
from superset.datasets.datetime_format_detector import DatetimeFormatDetector
from superset.exceptions import (
    SupersetGenericDBErrorException,
    SupersetSecurityException,
)
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


def _has_jinja_markers(sql: str) -> bool:
    """Check for Jinja template markers (``{%`` or ``{{``) in a SQL string."""
    return "{%" in sql or "{{" in sql


class RefreshDatasetCommand(BaseCommand):
    def __init__(self, model_id: int):
        self._model_id = model_id
        self._model: Optional[SqlaTable] = None

    @transaction(on_error=partial(on_error, reraise=DatasetRefreshFailedError))
    def run(self) -> Model:
        self.validate()
        assert self._model
        try:
            self._model.fetch_metadata()
        except SupersetGenericDBErrorException as ex:
            # Only soften when the dataset SQL contains Jinja templates —
            # those cannot be validated at save time because the template
            # context is empty and sqlglot then rejects the unrendered
            # ``{% if %}`` blocks. The row is already persisted by
            # ``UpdateDatasetCommand`` before this refresh runs, so
            # surfacing an "Invalid SQL" toast for that specific case is
            # misleading. Genuine DB errors (connection failures, driver
            # errors, permission errors — also wrapped as
            # ``SupersetGenericDBErrorException`` by
            # ``get_columns_description``) must still bubble up so the
            # operator sees them. See #38012.
            if self._model.sql and _has_jinja_markers(self._model.sql):
                logger.warning(
                    "Dataset column refresh skipped for %s: %s "
                    "(Jinja templates cannot be validated at save time)",
                    self._model.table_name,
                    ex.message,
                )
            else:
                raise

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
