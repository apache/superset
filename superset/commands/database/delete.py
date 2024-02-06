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

from flask_babel import lazy_gettext as _

from superset.commands.base import BaseCommand
from superset.commands.database.exceptions import (
    DatabaseDeleteDatasetsExistFailedError,
    DatabaseDeleteFailedError,
    DatabaseDeleteFailedReportsExistError,
    DatabaseNotFoundError,
)
from superset.daos.database import DatabaseDAO
from superset.daos.exceptions import DAODeleteFailedError
from superset.daos.report import ReportScheduleDAO
from superset.models.core import Database

logger = logging.getLogger(__name__)


class DeleteDatabaseCommand(BaseCommand):
    def __init__(self, model_id: int):
        self._model_id = model_id
        self._model: Optional[Database] = None

    def run(self) -> None:
        self.validate()
        assert self._model

        try:
            DatabaseDAO.delete([self._model])
        except DAODeleteFailedError as ex:
            logger.exception(ex.exception)
            raise DatabaseDeleteFailedError() from ex

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = DatabaseDAO.find_by_id(self._model_id)
        if not self._model:
            raise DatabaseNotFoundError()
        # Check there are no associated ReportSchedules

        if reports := ReportScheduleDAO.find_by_database_id(self._model_id):
            report_names = [report.name for report in reports]
            raise DatabaseDeleteFailedReportsExistError(
                _(f"There are associated alerts or reports: {','.join(report_names)}")
            )
        # Check if there are datasets for this database
        if self._model.tables:
            raise DatabaseDeleteDatasetsExistFailedError()
