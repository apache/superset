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
import textwrap
from functools import partial
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset import app, security_manager
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
from superset.daos.report import ReportScheduleDAO
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.reports.models import ReportSchedule
from superset.tags.models import ObjectType
from superset.utils import json
from superset.utils.core import send_email_smtp
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
        assert self._model is not None
        self.process_tab_diff()

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

    def process_tab_diff(self) -> None:
        def find_deleted_tabs() -> list[str]:
            position_json = self._properties.get("position_json", "")
            current_tabs = self._model.tabs  # type: ignore
            if position_json and current_tabs:
                position = json.loads(position_json)
                deleted_tabs = [
                    tab for tab in current_tabs["all_tabs"] if tab not in position
                ]
                return deleted_tabs
            return []

        def find_reports_containing_tabs(tabs: list[str]) -> list[ReportSchedule]:
            alert_reports_list = []
            for tab in tabs:
                for report in ReportScheduleDAO.find_by_extra_metadata(tab):
                    alert_reports_list.append(report)
            return alert_reports_list

        def send_deactivated_email_warning(report: ReportSchedule) -> None:
            description = textwrap.dedent(
                """
                The dashboard tab used in this report has been deleted and your report has been deactivated.
                Please update your report settings to remove or change the tab used.
                """
            )

            html_content = textwrap.dedent(
                f"""
                    <html>
                    <head>
                        <style type="text/css">
                        table, th, td {{
                            border-collapse: collapse;
                            border-color: rgb(200, 212, 227);
                            color: rgb(42, 63, 95);
                            padding: 4px 8px;
                        }}
                        .image{{
                            margin-bottom: 18px;
                        }}
                        </style>
                    </head>
                    <body>
                        <div>{description}</div>
                        <br>
                    </body>
                    </html>
                    """
            )
            for report_owner in report.owners:
                if email := report_owner.email:
                    send_email_smtp(
                        to=email,
                        subject=f"[Report: {report.name}] Deactivated",
                        html_content=html_content,
                        config=app.config,
                    )

        def deactivate_reports(reports_list: list[ReportSchedule]) -> None:
            for report in reports_list:
                # deactivate
                ReportScheduleDAO.update(report, {"active": False})
                # send email to report owner
                send_deactivated_email_warning(report)

        deleted_tabs = find_deleted_tabs()
        reports = find_reports_containing_tabs(deleted_tabs)
        deactivate_reports(reports)
