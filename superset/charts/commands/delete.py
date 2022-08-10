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
from flask_babel import lazy_gettext as _

from superset import security_manager
from superset.charts.commands.exceptions import (
    ChartDeleteFailedError,
    ChartDeleteFailedReportsExistError,
    ChartForbiddenError,
    ChartNotFoundError,
)
from superset.charts.dao import ChartDAO
from superset.commands.base import BaseCommand
from superset.dao.exceptions import DAODeleteFailedError
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reports.dao import ReportScheduleDAO

logger = logging.getLogger(__name__)


class DeleteChartCommand(BaseCommand):
    def __init__(self, model_id: int):
        self._model_id = model_id
        self._model: Optional[Slice] = None

    def run(self) -> Model:
        self.validate()
        try:
            Dashboard.clear_cache_for_slice(slice_id=self._model_id)
            chart = ChartDAO.delete(self._model)
        except DAODeleteFailedError as ex:
            logger.exception(ex.exception)
            raise ChartDeleteFailedError() from ex
        return chart

    def validate(self) -> None:
        # Validate/populate model exists
        self._model = ChartDAO.find_by_id(self._model_id)
        if not self._model:
            raise ChartNotFoundError()
        # Check there are no associated ReportSchedules
        reports = ReportScheduleDAO.find_by_chart_id(self._model_id)
        if reports:
            report_names = [report.name for report in reports]
            raise ChartDeleteFailedReportsExistError(
                _("There are associated alerts or reports: %s" % ",".join(report_names))
            )
        # Check ownership
        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise ChartForbiddenError() from ex
