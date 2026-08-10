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
from functools import partial
from typing import Any

from flask import current_app, g
from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset import security_manager
from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.chart.exceptions import (
    ChartCreateFailedError,
    ChartForbiddenError,
    ChartInvalidError,
    DashboardsForbiddenError,
    DashboardsNotFoundValidationError,
)
from superset.commands.utils import get_datasource_by_id, populate_subjects
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateChartCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

        if params_str := self._properties.get("params"):
            params = json.loads(params_str)
            if isinstance(params, dict) and "viz_type" in params:
                # Only fall back to params when no top-level viz_type was supplied;
                # an explicit top-level field takes precedence.
                self._properties.setdefault("viz_type", params["viz_type"])

    @transaction(on_error=partial(on_error, reraise=ChartCreateFailedError))
    def run(self) -> Model:
        self.validate()
        self._properties["last_saved_at"] = datetime.now()
        self._properties["last_saved_by"] = g.user
        chart = ChartDAO.create(attributes=self._properties)
        if after_create := current_app.config.get("AFTER_ASSET_CREATE"):
            after_create(chart, "chart")
        return chart

    def validate(self) -> None:
        exceptions = []
        datasource_type = self._properties["datasource_type"]
        datasource_id = self._properties["datasource_id"]
        dashboard_ids = self._properties.get("dashboards", [])

        # Validate/Populate datasource
        try:
            datasource = get_datasource_by_id(datasource_id, datasource_type)
            self._properties["datasource_name"] = datasource.name
            security_manager.raise_for_access(datasource=datasource)
        except SupersetSecurityException as ex:
            raise ChartForbiddenError() from ex
        except ValidationError as ex:
            exceptions.append(ex)

        # Validate/Populate dashboards
        dashboards = DashboardDAO.find_by_ids(dashboard_ids)
        if len(dashboards) != len(dashboard_ids):
            exceptions.append(DashboardsNotFoundValidationError())
        for dash in dashboards:
            if not security_manager.is_editor(dash):
                raise DashboardsForbiddenError()
        self._properties["dashboards"] = dashboards

        populate_subjects(self._properties, exceptions)

        if exceptions:
            raise ChartInvalidError(exceptions=exceptions)
