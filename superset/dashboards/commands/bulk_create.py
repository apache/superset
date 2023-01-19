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
from marshmallow import ValidationError

from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.utils import populate_roles
from superset.dao.exceptions import DAOCreateFailedError
from superset.dashboards.commands.exceptions import (
    DashboardCreateFailedError,
    DashboardInvalidError,
    DashboardSlugExistsValidationError,
)
from superset.dashboards.dao import DashboardDAO

logger = logging.getLogger(__name__)


class BulkCreateDashboardCommand(CreateMixin, BaseCommand):
    def __init__(self, data: List[Dict[str, Any]]):
        self._properties = data.copy()

    def run(self) -> List[Model]:
        self.validate()
        try:
            dashboards = DashboardDAO.bulk_create(self._properties, commit=False)
            dashboards = DashboardDAO.bulk_update_charts_owners(dashboards, commit=True)
        except DAOCreateFailedError as ex:
            logger.exception(ex.exception)
            raise DashboardCreateFailedError() from ex
        return dashboards

    def validate(self) -> None:
        exceptions: List[ValidationError] = []

        for dashboard_properties in self._properties:
            owner_ids: Optional[List[int]] = dashboard_properties.get("owners")
            role_ids: Optional[List[int]] = dashboard_properties.get("roles")
            slug: str = dashboard_properties.get("slug", "")

            # Validate slug uniqueness
            if not DashboardDAO.validate_slug_uniqueness(slug):
                exceptions.append(DashboardSlugExistsValidationError())

            try:
                owners = self.populate_owners(owner_ids)
                dashboard_properties["owners"] = owners
            except ValidationError as ex:
                exceptions.append(ex)
            if exceptions:
                exception = DashboardInvalidError()
                exception.add_list(exceptions)
                raise exception

            try:
                roles = populate_roles(role_ids)
                dashboard_properties["roles"] = roles
            except ValidationError as ex:
                exceptions.append(ex)
            if exceptions:
                exception = DashboardInvalidError()
                exception.add_list(exceptions)
                raise exception
