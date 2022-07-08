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
from datetime import datetime
from typing import Any, Dict, List, Optional

from flask import g
from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.charts.commands.exceptions import (
    ChartCreateFailedError,
    ChartInvalidError,
    DashboardsNotFoundValidationError,
)
from superset.charts.dao import ChartDAO
from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.utils import get_datasource_by_id
from superset.dao.exceptions import DAOCreateFailedError
from superset.dashboards.dao import DashboardDAO

logger = logging.getLogger(__name__)


class CreateChartCommand(CreateMixin, BaseCommand):
    def __init__(self, data: Dict[str, Any]):
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()
        try:
            self._properties["last_saved_at"] = datetime.now()
            self._properties["last_saved_by"] = g.user
            chart = ChartDAO.create(self._properties)
        except DAOCreateFailedError as ex:
            logger.exception(ex.exception)
            raise ChartCreateFailedError() from ex
        return chart

    def validate(self) -> None:
        exceptions = []
        datasource_type = self._properties["datasource_type"]
        datasource_id = self._properties["datasource_id"]
        dashboard_ids = self._properties.get("dashboards", [])
        owner_ids: Optional[List[int]] = self._properties.get("owners")

        # Validate/Populate datasource
        try:
            datasource = get_datasource_by_id(datasource_id, datasource_type)
            self._properties["datasource_name"] = datasource.name
        except ValidationError as ex:
            exceptions.append(ex)

        # Validate/Populate dashboards
        dashboards = DashboardDAO.find_by_ids(dashboard_ids)
        if len(dashboards) != len(dashboard_ids):
            exceptions.append(DashboardsNotFoundValidationError())
        self._properties["dashboards"] = dashboards

        try:
            owners = self.populate_owners(owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            exception = ChartInvalidError()
            exception.add_list(exceptions)
            raise exception
