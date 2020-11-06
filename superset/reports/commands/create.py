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
import json
import logging
from typing import Any, Callable, cast, Dict, List, Optional, Type

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError

from superset.charts.dao import ChartDAO
from superset.commands.base import BaseCommand
from superset.commands.utils import populate_owners
from superset.dao.exceptions import DAOCreateFailedError
from superset.dashboards.dao import DashboardDAO
from superset.databases.dao import DatabaseDAO
from superset.models.reports import ReportScheduleType
from superset.reports.commands.exceptions import (
    ChartNotFoundValidationError,
    DashboardNotFoundValidationError,
    DatabaseNotFoundValidationError,
    ReportScheduleCreateFailedError,
    ReportScheduleInvalidError,
    ReportScheduleLabelUniquenessValidationError,
)
from superset.reports.dao import ReportScheduleDAO

logger = logging.getLogger(__name__)


class CreateReportScheduleCommand(BaseCommand):
    def __init__(self, user: User, data: Dict[str, Any]):
        self._actor = user
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()
        try:
            report_schedule = ReportScheduleDAO.create(self._properties)
        except DAOCreateFailedError as ex:
            logger.exception(ex.exception)
            raise ReportScheduleCreateFailedError()
        return report_schedule

    def validate(self) -> None:
        exceptions: List[ValidationError] = list()
        owner_ids: Optional[List[int]] = self._properties.get("owners")
        label = self._properties.get("label", "")
        report_type = self._properties.get("type", ReportScheduleType.ALERT)

        # Validate label uniqueness
        if not ReportScheduleDAO.validate_update_uniqueness(label):
            exceptions.append(ReportScheduleLabelUniquenessValidationError())

        # TODO validate relations based on the report type

        try:
            owners = populate_owners(self._actor, owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            exception = ReportScheduleInvalidError()
            exception.add_list(exceptions)
            raise exception
