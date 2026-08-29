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
from collections.abc import Callable
from functools import partial
from typing import Any, Optional

from flask import current_app
from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError
from sqlalchemy.exc import IntegrityError

from superset import db, security_manager
from superset.commands.base import BaseCommand, UpdateMixin
from superset.commands.dashboard.exceptions import (
    DashboardChartCustomizationsUpdateFailedError,
    DashboardColorsConfigUpdateFailedError,
    DashboardForbiddenError,
    DashboardInvalidError,
    DashboardNativeFiltersUpdateFailedError,
    DashboardNotFoundError,
    DashboardSlugExistsValidationError,
    DashboardUpdateFailedError,
)
from superset.commands.soft_delete_collisions import (
    raise_for_soft_deleted_slug_collision,
)
from superset.commands.utils import (
    compute_subjects,
    raise_if_managed_externally,
    update_tags,
    validate_tags,
)
from superset.daos.dashboard import DashboardDAO
from superset.daos.report import ReportScheduleDAO
from superset.dashboards.layout import repair_position
from superset.dashboards.schemas import validate_css
from superset.exceptions import SupersetSecurityException
from superset.models.dashboard import Dashboard
from superset.reports.models import ReportSchedule
from superset.subjects.types import SubjectType
from superset.tags.models import ObjectType
from superset.utils import json
from superset.utils.core import remove_duplicates, send_email_smtp
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateDashboardCommand(UpdateMixin, BaseCommand):
    #: Ordinary edits of an externally managed dashboard are refused
    #: server-side (see ``raise_if_managed_externally``).
    #: ``UpdateDashboardColorsConfigCommand`` flips this off so background
    #: colors sync keeps working while a dashboard is merely viewed -- but
    #: only for derived color values; its validate() override refuses
    #: changes to the authoritative inputs.
    _refuses_externally_managed: bool = True

    #: Superset-local fields not owned by the external source of truth: the
    #: publish toggle is local visibility state (which authorized viewers
    #: see the dashboard), not dashboard content, so an update touching
    #: ONLY these fields passes the managed-externally gate.
    _MANAGED_LOCAL_ONLY_FIELDS: frozenset[str] = frozenset({"published"})

    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[Dashboard] = None

    @transaction(on_error=partial(on_error, reraise=DashboardUpdateFailedError))
    def run(self) -> Model:
        self.validate()
        assert self._model is not None
        # Suppress autoflush during the update body so that Continuum's
        # before_flush baseline listener does not fire mid-operation while
        # the session is only partially populated.
        with db.session.no_autoflush:
            self.process_tab_diff()
            self.process_native_filter_diff()

            # Update tags
            if (tags := self._properties.pop("tags", None)) is not None:
                update_tags(
                    ObjectType.dashboard, self._model.id, self._model.tags, tags
                )

            # Re-serialize position_json to escape 4-byte Unicode characters,
            # repairing a layout that carries detached components on the way
            # through.
            if position_json := self._properties.get("position_json"):
                self._properties["position_json"] = json.dumps(
                    repair_position(json.loads(position_json), self._model_id)
                )

            # ``set_dash_metadata`` merges the incoming metadata against
            # ``dashboard.params_dict`` (the *stored* ``json_metadata``) to
            # preserve fields the caller omitted. Routing ``json_metadata``
            # through the generic attribute update below would overwrite
            # that stored value before the merge ever sees it, silently
            # collapsing the merge into a no-op and resetting any omitted
            # field to its default -- so it is excluded here and applied
            # exclusively via ``set_dash_metadata``.
            json_metadata = self._properties.get("json_metadata")
            dashboard = DashboardDAO.update(
                self._model,
                {k: v for k, v in self._properties.items() if k != "json_metadata"},
            )
            # See CreateDashboardCommand.run: translate a slug collision
            # with a soft-deleted dashboard (full-constraint dialects) into
            # restore guidance; anything else re-raises unchanged.
            try:
                db.session.flush()
            except IntegrityError as ex:
                db.session.rollback()  # pylint: disable=consider-using-transaction
                raise_for_soft_deleted_slug_collision(self._properties.get("slug"), ex)
                raise
            if json_metadata:
                DashboardDAO.set_dash_metadata(
                    dashboard,
                    data=json.loads(json_metadata),
                )
        return dashboard

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        slug: Optional[str] = self._properties.get("slug")
        tag_ids: Optional[list[int]] = self._properties.get("tags")

        # Validate/populate model exists
        self._model = DashboardDAO.find_by_id(self._model_id)
        if not self._model:
            raise DashboardNotFoundError()
        # Check editorship
        try:
            security_manager.raise_for_editorship(self._model)
        except SupersetSecurityException as ex:
            raise DashboardForbiddenError() from ex

        if self._refuses_externally_managed and not (
            self._properties
            and set(self._properties) <= self._MANAGED_LOCAL_ONLY_FIELDS
        ):
            raise_if_managed_externally(self._model, DashboardForbiddenError)

        # Validate slug uniqueness
        if not DashboardDAO.validate_update_slug_uniqueness(self._model_id, slug):
            exceptions.append(DashboardSlugExistsValidationError())

        compute_subjects(self._model, self._properties, exceptions)

        # validate tags
        try:
            validate_tags(ObjectType.dashboard, self._model.tags, tag_ids)
        except ValidationError as ex:
            exceptions.append(ex)

        # A dashboard PUT resends the full object on every save, so only
        # validate css when it's actually changing -- otherwise a dashboard
        # whose existing css predates this check (or was imported without
        # going through it) becomes uneditable for unrelated changes like a
        # rename or a chart move.
        if "css" in self._properties:
            new_css = self._properties["css"]
            if new_css != self._model.css:
                try:
                    validate_css(new_css)
                except ValidationError as ex:
                    exceptions.append(ex)

        if exceptions:
            raise DashboardInvalidError(exceptions=exceptions)

    @staticmethod
    def _send_deactivated_report_email(
        report: ReportSchedule, description: str
    ) -> None:
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
        for editor in report.editors:
            if editor.type == SubjectType.USER and editor.user:
                if email := editor.user.email:
                    send_email_smtp(
                        to=email,
                        subject=f"[Report: {report.name}] Deactivated",
                        html_content=html_content,
                        config=current_app.config,
                    )

    def _reports_on_this_dashboard(
        self,
        finder: Callable[[str], list[ReportSchedule]],
        keys: list[str],
    ) -> list[ReportSchedule]:
        """Reports referencing any of ``keys`` that belong to this dashboard.

        A single report can reference several ``keys``, hence the
        de-duplication by id.
        """
        dashboard_id = self._model.id  # type: ignore
        return remove_duplicates(
            (
                report
                for key in keys
                for report in finder(key)
                if report.dashboard_id == dashboard_id
            ),
            key=lambda report: report.id,
        )

    def process_tab_diff(self) -> None:
        def find_deleted_tabs() -> list[str]:
            position_json = self._properties.get("position_json", "")
            if not position_json:
                return []
            # ``tabs`` always answers with both keys, even for a layout it
            # could not walk, so an empty ``all_tabs`` needs no guard of its
            # own: nothing is diffed against the new layout.
            current_tabs = self._model.tabs  # type: ignore
            position = json.loads(position_json)
            return [tab for tab in current_tabs["all_tabs"] if tab not in position]

        description = textwrap.dedent(
            """
            The dashboard tab used in this report has been deleted and your report has been deactivated.
            Please update your report settings to remove or change the tab used.
            """  # noqa: E501
        )
        deleted_tabs = find_deleted_tabs()
        for report in self._reports_on_this_dashboard(
            ReportScheduleDAO.find_by_extra_metadata, deleted_tabs
        ):
            ReportScheduleDAO.update(report, {"active": False})
            self._send_deactivated_report_email(report, description)

    def process_native_filter_diff(self) -> None:
        def find_deleted_native_filter_ids() -> list[str]:
            new_json_metadata = self._properties.get("json_metadata", "")
            if not new_json_metadata:
                return []
            current_metadata = json.loads(self._model.json_metadata or "{}")  # type: ignore
            new_metadata = json.loads(new_json_metadata)
            current_filter_ids = {
                f["id"]
                for f in (current_metadata.get("native_filter_configuration") or [])
                if "id" in f
            }
            new_filter_ids = {
                f["id"]
                for f in (new_metadata.get("native_filter_configuration") or [])
                if "id" in f
            }
            return list(current_filter_ids - new_filter_ids)

        description = textwrap.dedent(
            """
            The dashboard filter used in this report has been deleted and your report has not been sent.
            Please update your report settings to remove or change the filter used.
            """  # noqa: E501
        )
        deleted_filter_ids = find_deleted_native_filter_ids()
        for report in self._reports_on_this_dashboard(
            ReportScheduleDAO.find_by_native_filter_id, deleted_filter_ids
        ):
            ReportScheduleDAO.update(report, {"active": False})
            self._send_deactivated_report_email(report, description)


class UpdateDashboardNativeFiltersCommand(UpdateDashboardCommand):
    @transaction(
        on_error=partial(on_error, reraise=DashboardNativeFiltersUpdateFailedError)
    )
    def run(self) -> Model:
        super().validate()
        assert self._model

        configuration = DashboardDAO.update_native_filters_config(
            self._model, self._properties
        )

        return configuration


class UpdateDashboardChartCustomizationsCommand(UpdateDashboardCommand):
    @transaction(
        on_error=partial(
            on_error, reraise=DashboardChartCustomizationsUpdateFailedError
        )
    )
    def run(self) -> Model:
        super().validate()
        assert self._model

        configuration = DashboardDAO.update_chart_customizations_config(
            self._model, self._properties
        )

        return configuration


class UpdateDashboardColorsConfigCommand(UpdateDashboardCommand):
    # The blanket gate is skipped so background colors sync (fired while a
    # dashboard is merely viewed) keeps working for externally managed
    # dashboards -- but only for the DERIVED color values. The authoritative
    # inputs are the dashboard's real content, owned by the external source
    # of truth; validate() refuses a payload that would change them.
    _refuses_externally_managed = False

    #: json_metadata keys a colors-config save may NOT change on an
    #: externally managed dashboard. The other accepted keys
    #: (color_scheme_domain, shared_label_colors, map_label_colors) are
    #: derived from these plus chart state (see
    #: DashboardDAO.update_colors_config).
    _AUTHORITATIVE_COLOR_KEYS: tuple[str, ...] = ("color_scheme", "label_colors")

    def __init__(
        self, model_id: int, data: dict[str, Any], mark_updated: bool = True
    ) -> None:
        super().__init__(model_id, data)
        self._mark_updated = mark_updated

    def validate(self) -> None:
        super().validate()
        assert self._model
        if self._model.is_managed_externally and self._changes_authoritative_colors():
            raise DashboardForbiddenError()

    def _changes_authoritative_colors(self) -> bool:
        """Whether the payload changes the EFFECTIVE authoritative colors.

        Compared by effective state, not raw metadata bytes: an absent
        key, an explicit null, and an empty value ("" / {}) all encode
        the same authoritative color state — none. The background colors
        sync always sends ``label_colors`` (as ``{}`` when nothing is
        set) while a dashboard is merely VIEWED, so refusing
        empty-vs-absent would 403 every view of a managed dashboard
        whose metadata lacks the key. The DAO may still write the empty
        key into stored metadata — that changes export bytes, not color
        state, and the next external sync owns the bytes anyway.
        """
        assert self._model
        metadata = json.loads(self._model.json_metadata or "{}")

        def effective(value: Any) -> Any:
            return None if value in (None, "", {}) else value

        return any(
            key in self._properties
            and effective(self._properties[key]) != effective(metadata.get(key))
            for key in self._AUTHORITATIVE_COLOR_KEYS
        )

    @transaction(
        on_error=partial(on_error, reraise=DashboardColorsConfigUpdateFailedError)
    )
    def run(self) -> Model:
        self.validate()
        assert self._model

        original_changed_on = self._model.changed_on

        DashboardDAO.update_colors_config(self._model, self._properties)

        if not self._mark_updated:
            db.session.commit()  # pylint: disable=consider-using-transaction
            # restore the original changed_on value
            self._model.changed_on = original_changed_on

        return self._model
