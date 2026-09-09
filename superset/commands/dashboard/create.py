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
from typing import Any

from flask import current_app
from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.dashboard.exceptions import (
    DashboardCreateFailedError,
    DashboardInvalidError,
    DashboardSlugExistsValidationError,
)
from superset.commands.utils import populate_subjects
from superset.daos.dashboard import DashboardDAO
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateDashboardCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]) -> None:
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=DashboardCreateFailedError))
    def run(self) -> Model:
        self.validate()
        dashboard = DashboardDAO.create(attributes=self._properties)
        # Link charts referenced in the layout to the dashboard so that
        # ``dashboard.slices`` is populated, mirroring the update path. Without
        # this, charts created through the REST API render with no definition
        # until the dashboard is edited and re-saved in the UI (see #32966).
        if json_metadata := self._properties.get("json_metadata"):
            DashboardDAO.set_dash_metadata(
                dashboard,
                data=json.loads(json_metadata),
            )
        if after_create := current_app.config.get("AFTER_ASSET_CREATE"):
            after_create(dashboard, "dashboard")
        return dashboard

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        # An absent slug must stay ``None`` (not default to ``""``):
        # ``validate_slug_uniqueness`` deliberately checks empty strings, so
        # coercing absent → "" would run the check as ``slug == ""`` and 422
        # every slugless create once any empty-string-slug row exists. This
        # mirrors the update path, which also passes ``None`` through.
        slug: str | None = self._properties.get("slug")

        # Validate slug uniqueness
        if not DashboardDAO.validate_slug_uniqueness(slug):
            exceptions.append(DashboardSlugExistsValidationError())

        populate_subjects(self._properties, exceptions)

        if exceptions:
            raise DashboardInvalidError(exceptions=exceptions)
