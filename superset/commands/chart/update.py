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
from typing import Any, Optional, TYPE_CHECKING

from flask import g
from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset import security_manager
from superset.commands.base import BaseCommand, UpdateMixin
from superset.commands.chart.exceptions import (
    ChartForbiddenError,
    ChartInvalidError,
    ChartNotFoundError,
    ChartUpdateFailedError,
    DashboardsForbiddenError,
    DashboardsNotFoundValidationError,
    DatasourceTypeUpdateRequiredValidationError,
)
from superset.commands.chart.utils import (
    touch_dashboards,
    validate_chart_datasource_type,
    validate_query_context_datasource,
)
from superset.commands.exceptions import DatasourceNotFoundValidationError
from superset.commands.utils import (
    compute_subjects,
    get_datasource_by_id,
    raise_if_managed_externally,
    update_tags,
    validate_tags,
)
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.exceptions import SupersetSecurityException
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.tags.models import ObjectType
from superset.utils.decorators import on_error, transaction
from superset.versioning.changes.normalization import (
    register_matching_normalization_context,
)

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from superset.connectors.sqla.models import BaseDatasource


def is_query_context_update(properties: dict[str, Any]) -> bool:
    return set(properties) == {"query_context", "query_context_generation"} and bool(
        properties.get("query_context_generation")
    )


class UpdateChartCommand(UpdateMixin, BaseCommand):
    def __init__(
        self,
        model_id: int,
        data: dict[str, Any],
        normalization_changes: object = None,
    ) -> None:
        self._model_id: int = model_id
        self._properties: dict[str, Any] = data.copy()
        self._model: Optional[Slice] = None
        self._normalization_changes: object = normalization_changes

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

        if self._normalization_changes is not None and "params" in self._properties:
            register_matching_normalization_context(
                db.session,
                self._model.id,
                self._normalization_changes,
                self._model.params,
                self._properties["params"],
            )

        # Touch newly linked dashboards to bump changed_on/changed_by (resolves #44305).
        # Ensures adding a chart to an existing dashboard updates the dashboard's
        # last modified state.
        if "dashboards" in self._properties:
            existing_dashboard_ids = {d.id for d in self._model.dashboards}
            newly_added_dashboards = [
                d
                for d in self._properties["dashboards"]
                if d.id not in existing_dashboard_ids
            ]
            touch_dashboards(newly_added_dashboards)

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
            # For NEW dashboard relationships, verify user has access first
            # to avoid leaking information about inaccessible dashboards
            accessible_dashboards = DashboardDAO.find_by_ids(list(new_dashboard_ids))
            unauthorized_dashboard_ids = new_dashboard_ids - {
                d.id for d in accessible_dashboards
            }

            if unauthorized_dashboard_ids:
                exceptions.append(DashboardsNotFoundValidationError())
                return

            for dash in accessible_dashboards:
                if dash.is_managed_externally or not security_manager.is_editor(dash):
                    raise DashboardsForbiddenError()

    def _validate_query_context_datasource(
        self, exceptions: list[ValidationError]
    ) -> None:
        """
        Ensure a query-context-only update keeps the chart's own datasource.
        """
        if not self._model:
            return
        validate_query_context_datasource(
            self._properties.get("query_context"),
            self._model.datasource_id,
            self._model.datasource_type,
            exceptions,
        )

    def validate(self) -> None:  # noqa: C901
        exceptions: list[ValidationError] = []
        dashboard_ids = self._properties.get("dashboards")
        tag_ids: Optional[list[int]] = self._properties.get("tags")

        # A supplied type cannot clear the chart's datasource namespace.
        datasource_id = self._properties.get("datasource_id")
        datasource_type = self._properties.get("datasource_type", "")
        if (
            datasource_id is not None or "datasource_type" in self._properties
        ) and not datasource_type:
            exceptions.append(DatasourceTypeUpdateRequiredValidationError())

        # Validate/populate model exists
        self._model = ChartDAO.find_by_id(self._model_id)
        if not self._model:
            raise ChartNotFoundError()

        # Check and update editorship; when only updating query context we relax
        # editorship so background workers can save context. Report and thumbnail
        # executors resolve against the schedule or the requesting user, not the
        # chart, so they are frequently not chart editors. Access is still required.
        if not is_query_context_update(self._properties):
            try:
                security_manager.raise_for_editorship(self._model)
                compute_subjects(self._model, self._properties, exceptions)
            except SupersetSecurityException as ex:
                raise ChartForbiddenError() from ex
            except ValidationError as ex:
                exceptions.append(ex)
            raise_if_managed_externally(self._model, ChartForbiddenError)
        else:
            # ``raise_for_access`` admits a guest for every chart on the dashboard
            # its token embeds, but a guest holds no write capability (see the
            # capability matrix in ``SECURITY.md``). The strict path inherits this
            # deny from ``is_editor``; this branch has to state it.
            if security_manager.is_guest_user():
                raise ChartForbiddenError()
            try:
                security_manager.raise_for_access(chart=self._model)
            except SupersetSecurityException as ex:
                raise ChartForbiddenError() from ex
            # The relaxed-editorship branch refuses externally managed
            # charts too: the stored query context is executable state
            # (report execution loads and runs it), so accepting a
            # client-supplied context here would let an editor change a
            # managed chart's behavior -- the bypass this gate closes.
            # Explore fires this save in the background when the chart is
            # opened; for a managed chart that background call gets a 403
            # it ignores.
            raise_if_managed_externally(self._model, ChartForbiddenError)
            # Keep the refreshed payload bound to the chart's own datasource so it
            # cannot be repointed at an unrelated one.
            self._validate_query_context_datasource(exceptions)

        # validate tags
        try:
            validate_tags(ObjectType.chart, self._model.tags, tag_ids)
        except ValidationError as ex:
            exceptions.append(ex)

        # Validate/Populate datasource
        # An empty datasource_type was already flagged above via
        # DatasourceTypeUpdateRequiredValidationError; skip this block so
        # we don't clobber that message with DatasourceTypeInvalidError.
        if datasource_type:
            try:
                validate_chart_datasource_type(datasource_type)
                # A type-only change still selects a different datasource namespace.
                effective_id: int | None = (
                    datasource_id
                    if "datasource_id" in self._properties
                    else self._model.datasource_id
                )
                if effective_id is None:
                    raise DatasourceNotFoundValidationError()
                datasource: BaseDatasource = get_datasource_by_id(
                    effective_id, datasource_type
                )
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
