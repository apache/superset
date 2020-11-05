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
from typing import Any, Dict, List, Optional

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.utils import populate_owners
from superset.dao.exceptions import DAOUpdateFailedError
from superset.models.reports import ReportSchedule
from superset.reports.commands.exceptions import (
    ReportScheduleInvalidError,
    ReportScheduleLabelUniquenessValidationError,
    ReportScheduleNotFoundError,
    ReportScheduleUpdateFailedError,
)
from superset.reports.dao import ReportScheduleDAO

logger = logging.getLogger(__name__)


class UpdateReportScheduleCommand(BaseCommand):
    def __init__(self, user: User, model_id: int, data: Dict[str, Any]):
        self._actor = user
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[ReportSchedule] = None

    def run(self) -> Model:
        self.validate()
        try:
            report_schedule = ReportScheduleDAO.update(self._model, self._properties)
        except DAOUpdateFailedError as ex:
            logger.exception(ex.exception)
            raise ReportScheduleUpdateFailedError()
        return report_schedule

    def validate(self) -> None:
        exceptions: List[ValidationError] = list()
        owner_ids: Optional[List[int]] = self._properties.get("owners")

        label = self._properties.get("label", "")
        self._model = ReportScheduleDAO.find_by_id(self._model_id)

        if not self._model:
            raise ReportScheduleNotFoundError()

        if not ReportScheduleDAO.validate_update_uniqueness(
            label, report_schedule_id=self._model_id
        ):
            exceptions.append(ReportScheduleLabelUniquenessValidationError())

        # Validate/Populate owner
        if owner_ids is None:
            owner_ids = [owner.id for owner in self._model.owners]
        try:
            owners = populate_owners(self._actor, owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            exception = ReportScheduleInvalidError()
            exception.add_list(exceptions)
            raise exception
