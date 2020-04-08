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
from typing import Dict, List, Optional

from flask_appbuilder.models.sqla import Model
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError

from superset.commands.base import BaseCommand
from superset.commands.utils import populate_owners
from superset.dao.exceptions import DAOCreateFailedError
from superset.dashboards.commands.exceptions import (
    DashboardCreateFailedError,
    DashboardInvalidError,
    DashboardSlugExistsValidationError,
)
from superset.dashboards.dao import DashboardDAO

logger = logging.getLogger(__name__)


class CreateDashboardCommand(BaseCommand):
    def __init__(self, user: User, data: Dict):
        self._actor = user
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()
        try:
            dashboard = DashboardDAO.create(self._properties)
        except DAOCreateFailedError as ex:
            logger.exception(ex.exception)
            raise DashboardCreateFailedError()
        return dashboard

    def validate(self) -> None:
        exceptions = list()
        owner_ids: Optional[List[int]] = self._properties.get("owners")
        slug: str = self._properties.get("slug", "")

        # Validate slug uniqueness
        if not DashboardDAO.validate_slug_uniqueness(slug):
            exceptions.append(DashboardSlugExistsValidationError())

        try:
            owners = populate_owners(self._actor, owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            exception = DashboardInvalidError()
            exception.add_list(exceptions)
            raise exception
