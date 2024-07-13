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

from superset import security_manager
from superset.commands.base import BaseCommand, UpdateMixin
from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardInvalidError,
    DashboardNotFoundError,
    DashboardSlugExistsValidationError,
    DashboardUpdateFailedError,
)
from superset.commands.utils import populate_roles, update_tags, validate_tags
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.tags.models import ObjectType
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateDashboardCommand(UpdateMixin, BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[Dashboard] = None

    @transaction(on_error=partial(on_error, reraise=DashboardUpdateFailedError))
    def run(self) -> Model:
        self.validate()
        assert self._model

        # Update tags
        if (tags := self._properties.pop("tags", None)) is not None:
            update_tags(ObjectType.dashboard, self._model.id, self._model.tags, tags)

        dashboard = DashboardDAO.update(self._model, self._properties)
        if self._properties.get("json_metadata"):
            DashboardDAO.set_dash_metadata(
                dashboard,
                data=json.loads(self._properties.get("json_metadata", "{}")),
            )

        return dashboard

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        owner_ids: Optional[list[int]] = self._properties.get("owners")
        roles_ids: Optional[list[int]] = self._properties.get("roles")
        slug: Optional[str] = self._properties.get("slug")
        tag_ids: Optional[list[int]] = self._properties.get("tags")

        # Validate/populate model exists
        self._model = DashboardDAO.find_by_id(self._model_id)
        if not self._model:
            raise DashboardNotFoundError()
        # Check ownership
        try:
            security_manager.raise_for_ownership(self._model)
        except SupersetSecurityException as ex:
            raise DashboardForbiddenError() from ex

        # Validate slug uniqueness
        if not DashboardDAO.validate_update_slug_uniqueness(self._model_id, slug):
            exceptions.append(DashboardSlugExistsValidationError())

        # Validate/Populate owner
        try:
            owners = self.compute_owners(
                self._model.owners,
                owner_ids,
            )
            self._properties["owners"] = owners
        except ValidationError as ex:
            exceptions.append(ex)

        # validate tags
        try:
            validate_tags(ObjectType.dashboard, self._model.tags, tag_ids)
        except ValidationError as ex:
            exceptions.append(ex)

        # Validate/Populate role
        if roles_ids is None:
            roles_ids = [role.id for role in self._model.roles]
        try:
            roles = populate_roles(roles_ids)
            self._properties["roles"] = roles
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            raise DashboardInvalidError(exceptions=exceptions)
