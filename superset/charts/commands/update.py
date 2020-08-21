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

from superset.charts.commands.exceptions import (
    ChartForbiddenError,
    ChartInvalidError,
    ChartNotFoundError,
    ChartUpdateFailedError,
    DashboardsNotFoundValidationError,
    DatasourceTypeUpdateRequiredValidationError,
)
from superset.charts.dao import ChartDAO
from superset.commands.base import BaseCommand
from superset.commands.utils import get_datasource_by_id, populate_owners
from superset.dao.exceptions import DAOUpdateFailedError
from superset.dashboards.dao import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.models.slice import Slice
from superset.views.base import check_ownership

logger = logging.getLogger(__name__)


class UpdateChartCommand(BaseCommand):
    def __init__(self, user: User, model_id: int, data: Dict[str, Any]):
        self._actor = user
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[Slice] = None

    def run(self) -> Model:
        self.validate()
        try:
            chart = ChartDAO.update(self._model, self._properties)
        except DAOUpdateFailedError as ex:
            logger.exception(ex.exception)
            raise ChartUpdateFailedError()
        return chart

    def validate(self) -> None:
        exceptions: List[ValidationError] = list()
        dashboard_ids = self._properties.get("dashboards", [])
        owner_ids: Optional[List[int]] = self._properties.get("owners")

        # Validate if datasource_id is provided datasource_type is required
        datasource_id = self._properties.get("datasource_id")
        if datasource_id is not None:
            datasource_type = self._properties.get("datasource_type", "")
            if not datasource_type:
                exceptions.append(DatasourceTypeUpdateRequiredValidationError())

        # Validate/populate model exists
        self._model = ChartDAO.find_by_id(self._model_id)
        if not self._model:
            raise ChartNotFoundError()
        # Check ownership
        try:
            check_ownership(self._model)
        except SupersetSecurityException:
            raise ChartForbiddenError()

        # Validate/Populate datasource
        if datasource_id is not None:
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

        # Validate/Populate owner
        try:
            owners = populate_owners(self._actor, owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            exception = ChartInvalidError()
            exception.add_list(exceptions)
            raise exception
