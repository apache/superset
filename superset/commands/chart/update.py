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
from typing import Any, Optional

from flask import g
from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset import security_manager
from superset.commands.base import BaseCommand, UpdateMixin
from superset.commands.chart.exceptions import (
    ChartForbiddenError,
    ChartInvalidError,
    ChartNotFoundError,
    ChartQueryContextDatasourceMismatchValidationError,
    ChartUpdateFailedError,
    DashboardsForbiddenError,
    DashboardsNotFoundValidationError,
    DatasourceTypeUpdateRequiredValidationError,
)
from superset.commands.utils import (
    compute_subjects,
    get_datasource_by_id,
    update_tags,
    validate_tags,
)
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.tags.models import ObjectType
from superset.utils import json
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


def is_query_context_update(properties: dict[str, Any]) -> bool:
    return set(properties) == {"query_context", "query_context_generation"} and bool(
        properties.get("query_context_generation")
    )


class UpdateChartCommand(UpdateMixin, BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[Slice] = None

    @transaction(on_error=partial(on_error, reraise=ChartUpdateFailedError))
    def run(self) -> Model:
        self.validate()
        assert self._model

        # Update tags
        if (tags := self._properties.pop("tags", None)) is not None:
            update_tags(ObjectType.chart, self._model.id, self._model.tags, tags)

        if self._properties.get("query_context_generation") is None:
            self._properties["last_saved_at"] = datetime.now()
            self._properties["last_saved_by"] = g.user

        return ChartDAO.update(self._model, self._properties)

    def _validate_new_dashboard_access(
        self, requested_dashboards: list[Dashboard], exceptions: list[ValidationError]
    ) -> None:
        """
        Validate user has editorship of any NEW dashboard relationships.
        Existing relationships are preserved to maintain chart editorship rights.
        """
        if not self._model:
            return

        existing_dashboard_ids = {d.id for d in self._model.dashboards}
        requested_dashboard_ids = {d.id for d in requested_dashboards}

        if new_dashboard_ids := requested_dashboard_ids - existing_dashboard_ids:
            # For NEW dashboard relationships, verify user has editorship
            accessible_dashboards = DashboardDAO.find_by_ids(list(new_dashboard_ids))
            unauthorized_dashboard_ids = new_dashboard_ids - {
                d.id for d in accessible_dashboards
            }

            if unauthorized_dashboard_ids:
                exceptions.append(DashboardsNotFoundValidationError())

            # Additional editorship check - must match CreateChartCommand behavior
            for dash in accessible_dashboards:
                if not security_manager.is_editor(dash):
                    raise DashboardsForbiddenError()

    def _validate_query_context_datasource(
        self, exceptions: list[ValidationError]
    ) -> None:
        """
        Ensure a query-context-only update keeps the chart's own datasource.

        The submitted query context is only verified when it carries a parseable
        ``datasource`` object; a payload that references a different datasource than
        the chart's persisted one is rejected. Payloads without a datasource fall
        back to the chart's datasource at execution time and need no check.
        """
        if not self._model:
            return

        raw_query_context = self._properties.get("query_context")
        if not raw_query_context:
            return

        try:
            query_context = json.loads(raw_query_context)
        except (TypeError, ValueError):
            # TypeError covers a query_context that isn't a string (e.g. an
            # already-parsed dict); that shape is intentionally out of scope
            # here since the schema serializes it as a JSON string. ValueError
            # covers a string that failed to parse. Either way, an unverifiable
            # payload is left for downstream handling rather than guessed at.
            return

        datasource = (
            query_context.get("datasource") if isinstance(query_context, dict) else None
        )
        if not isinstance(datasource, dict):
            return

        try:
            ids_match = int(datasource["id"]) == self._model.datasource_id
        except (KeyError, TypeError, ValueError):
            ids_match = False

        # A datasource object must carry a type that matches the chart's own.
        # Treating a missing type as valid would let an id-only payload through,
        # and query-context loading reads datasource["type"] directly, so that
        # payload raises KeyError when the saved context is later replayed.
        datasource_type = datasource.get("type")
        types_match = str(datasource_type) == self._model.datasource_type

        if not ids_match or not types_match:
            exceptions.append(ChartQueryContextDatasourceMismatchValidationError())

    def validate(self) -> None:  # noqa: C901
        exceptions: list[ValidationError] = []
        dashboard_ids = self._properties.get("dashboards")
        tag_ids: Optional[list[int]] = self._properties.get("tags")

        # Validate if datasource_id is provided datasource_type is required
        datasource_id = self._properties.get("datasource_id")
        datasource_type = ""
        if datasource_id is not None:
            datasource_type = self._properties.get("datasource_type", "")
            if not datasource_type:
                exceptions.append(DatasourceTypeUpdateRequiredValidationError())

        # Validate/populate model exists
        self._model = ChartDAO.find_by_id(self._model_id)
        if not self._model:
            raise ChartNotFoundError()

        # Check and update editorship; when only updating query context we relax
        # editorship so report workers can save context. We still require chart
        # access so users cannot rewrite query context for charts they cannot access.
        if not is_query_context_update(self._properties):
            try:
                security_manager.raise_for_editorship(self._model)
                compute_subjects(self._model, self._properties, exceptions)
            except SupersetSecurityException as ex:
                raise ChartForbiddenError() from ex
            except ValidationError as ex:
                exceptions.append(ex)
        else:
            try:
                security_manager.raise_for_access(chart=self._model)
            except SupersetSecurityException as ex:
                raise ChartForbiddenError() from ex
            # Keep the refreshed payload bound to the chart's own datasource so it
            # cannot be repointed at an unrelated one.
            self._validate_query_context_datasource(exceptions)

        # validate tags
        try:
            validate_tags(ObjectType.chart, self._model.tags, tag_ids)
        except ValidationError as ex:
            exceptions.append(ex)

        # Validate/Populate datasource
        if datasource_id is not None:
            try:
                datasource = get_datasource_by_id(datasource_id, datasource_type)
                self._properties["datasource_name"] = datasource.name
                security_manager.raise_for_access(datasource=datasource)
            except SupersetSecurityException as ex:
                raise ChartForbiddenError() from ex
            except ValidationError as ex:
                exceptions.append(ex)

        # Validate/Populate dashboards only if it's a list
        if dashboard_ids is not None:
            # First, verify all requested dashboards exist
            dashboards = DashboardDAO.find_by_ids(
                dashboard_ids,
                skip_base_filter=True,
            )
            if len(dashboards) != len(dashboard_ids):
                exceptions.append(DashboardsNotFoundValidationError())
            else:
                # Then, validate user has access to any NEW dashboard relationships
                self._validate_new_dashboard_access(dashboards, exceptions)
            self._properties["dashboards"] = dashboards

        if exceptions:
            raise ChartInvalidError(exceptions=exceptions)
