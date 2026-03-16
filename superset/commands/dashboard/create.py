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
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.dashboard.exceptions import (
    DashboardCreateFailedError,
    DashboardInvalidError,
    DashboardSlugExistsValidationError,
)
from superset.commands.utils import populate_roles
from superset.daos.dashboard import DashboardDAO
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateDashboardCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]) -> None:
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=DashboardCreateFailedError))
    def run(self) -> Model:
        self.validate()
        return DashboardDAO.create(attributes=self._properties)

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        owner_ids: Optional[list[int]] = self._properties.get("owners")
        role_ids: Optional[list[int]] = self._properties.get("roles")
        slug: str = self._properties.get("slug", "")

        # Validate slug uniqueness
        if not DashboardDAO.validate_slug_uniqueness(slug):
            exceptions.append(DashboardSlugExistsValidationError())

        try:
            owners = self.populate_owners(owner_ids)
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            raise DashboardInvalidError(exceptions=exceptions)

        try:
            roles = populate_roles(role_ids)
            self._properties["roles"] = roles
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            raise DashboardInvalidError(exceptions=exceptions)
