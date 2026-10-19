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
from __future__ import annotations

import logging
import re
from types import SimpleNamespace
from typing import Any, cast, TYPE_CHECKING

from croniter import CroniterBadDateError
from flask import current_app
from flask_babel import gettext as _
from marshmallow import ValidationError

from superset import is_feature_enabled, security_manager
from superset.commands.base import BaseCommand
from superset.commands.report.exceptions import (
    AlertQueryDataAccessValidationError,
    AlertQueryDMLNotAllowedValidationError,
    AlertQueryMultipleStatementsValidationError,
    ChartNotFoundValidationError,
    ChartNotSavedValidationError,
    DashboardNotFoundValidationError,
    DashboardNotSavedValidationError,
    ReportScheduleCrontabNotValidError,
    ReportScheduleEitherChartOrDashboardError,
    ReportScheduleExecutorTargetAccessError,
    ReportScheduleForbiddenError,
    ReportScheduleFormatRequiredError,
    ReportScheduleFrequencyNotAllowed,
    ReportScheduleOnlyChartOrDashboardError,
    ReportScheduleRecipientNotAllowedError,
    ReportScheduleRunAsForbiddenError,
    ReportScheduleRunAsNotFoundError,
)
from superset.daos.base import BaseDAO
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.daos.report import ReportConfigDAO
from superset.exceptions import SupersetParseError, SupersetSecurityException
from superset.integrations.teams.validation import (
    TeamsRecipientValidationError,
    validate_teams_recipient,
)
from superset.models.core import Database
from superset.reports.models import (
    ReportConfigKey,
    ReportCreationMethod,
    ReportDataFormat,
    ReportRecipientType,
    ReportSchedule,
    ReportScheduleType,
)
from superset.reports.types import ReportScheduleExtra
from superset.reports.utils import cron_meets_minimum_interval, get_email_addresses
from superset.sql.parse import SQLScript
from superset.tasks.exceptions import ExecutorNotFoundError, InvalidExecutorError
from superset.tasks.types import ExecutorType
from superset.tasks.utils import get_executor
from superset.utils import json
from superset.utils.core import get_user, override_user
from superset.utils.filters import is_excluded_by_extra_access

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User

logger = logging.getLogger(__name__)

# Matches balanced Jinja blocks so templated alert SQL can be recognized and
# its static validation deferred to execution time.
_JINJA_BLOCK_RE = re.compile(r"\{\{.*?\}\}|\{%.*?%\}|\{#.*?#\}", re.DOTALL)


def resolve_save_time_executor(
    *,
    run_as_type: str | None,
    run_as: User | None,
    created_by: User | None,
    changed_by: User | None,
    editors: Any,
) -> User | None:
    """Resolve the user a schedule in the given state will execute as.

    Mirrors the execution-time resolution: an explicit "Run As" user when the
    dynamic executor feature is enabled, otherwise ``ALERT_REPORTS_EXECUTORS``
    against the schedule's creator, modifier and editors. Returns ``None`` when
    the executor cannot be determined before execution (types resolved only at
    run time, or no matching user), leaving those cases to the existing
    validation and execution-time errors.
    """
    if is_feature_enabled("ALERT_REPORT_DYNAMIC_EXECUTOR") and run_as_type:
        user = run_as if run_as_type == ExecutorType.FIXED_USER else None
    else:
        # A plain namespace stands in for the schedule: ``get_executor`` only
        # reads these attributes, and a transient model would be cascaded into
        # the session through its editor relationships.
        schedule = SimpleNamespace(
            created_by=created_by, changed_by=changed_by, editors=editors or []
        )
        try:
            _, username = get_executor(
                current_app.config["ALERT_REPORTS_EXECUTORS"],
                cast(ReportSchedule, schedule),
            )
        except (ExecutorNotFoundError, InvalidExecutorError):
            return None
        user = security_manager.find_user(username)
    return user if user is not None and user.is_active else None


class BaseReportScheduleCommand(BaseCommand):
    _properties: dict[str, Any]
    # Set by the update/delete subclasses, absent on create -- read with
    # ``getattr(self, "_model", None)`` where both cases are possible.
    _model: Any

    def run(self) -> Any:
        pass

    def validate(self) -> None:
        pass

    def validate_alert_query(
        self,
        database: Database,
        sql: str,
        exceptions: list[ValidationError],
    ) -> None:
        """
        Validate alert SQL at save time: it must parse as a single statement,
        must not mutate state unless the database allows DML, and the saving
        user must be authorized for the tables it reads. Templated SQL that
        only parses after rendering is validated at execution time on the
        rendered query.
        """
        contains_jinja = bool(_JINJA_BLOCK_RE.search(sql))
        try:
            script = SQLScript(sql, engine=database.backend)
        except SupersetParseError as ex:
            if not contains_jinja:
                exceptions.append(
                    ValidationError(
                        _("Invalid SQL: %(error)s", error=ex.error.message),
                        field_name="sql",
                    )
                )
            return
        if len(script.statements) != 1:
            exceptions.append(AlertQueryMultipleStatementsValidationError())
            return
        if script.has_mutation() and not database.allow_dml:
            exceptions.append(AlertQueryDMLNotAllowedValidationError())
            return
        try:
            security_manager.raise_for_access(
                database=database, sql=sql, force_dataset_match=True
            )
        except SupersetSecurityException as ex:
            exceptions.append(AlertQueryDataAccessValidationError(ex.error.message))
        except SupersetParseError as ex:
            if not contains_jinja:
                exceptions.append(
                    ValidationError(
                        _("Invalid SQL: %(error)s", error=ex.error.message),
                        field_name="sql",
                    )
                )

    def _result_is_active(self) -> bool:
        """Whether this request leaves the schedule running.

        What the exclusion checks guard is delivery, not editing. Refusing a
        request that leaves the schedule paused would trap its owner: they could
        neither pause the report nor stop the scheduler selecting it, which is
        strictly worse than not checking at all.

        Both access paths consult this, because either can carry the pause. The
        list page's toggle sends ``{"active": false}`` on its own and reaches the
        stored-target path, while the edit modal always resends the stored
        chart/dashboard id alongside its own active switch and so reaches the
        submitted-target path. Answering it in one place and asking it from both
        is the point; an exemption that only one path could see is what made
        pausing from the modal a 403.
        """
        model = getattr(self, "_model", None)
        return bool(self._properties.get("active", getattr(model, "active", True)))

    def _check_object_access(
        self,
        object_id: int,
        *,
        kind: str,
        dao: type[BaseDAO[Any]],
        not_found_exc: type[ValidationError],
        exceptions: list[ValidationError],
    ) -> None:
        """Validate the object exists and the current user can access it."""
        obj = dao.find_by_id(object_id)
        if not obj:
            exceptions.append(not_found_exc())
        else:
            # The related-field filter narrows the picker, but a list filter is
            # not an authorisation boundary: ``find_by_id`` above applies the
            # ordinary access filter, so an excluded id posted directly would
            # otherwise be accepted. Ask the report-target question here, where
            # the id is actually resolved.
            if self._result_is_active() and is_excluded_by_extra_access(
                f"report_target_{kind}s", object_id
            ):
                raise ReportScheduleForbiddenError()
            try:
                security_manager.raise_for_access(**{kind: obj})
            except SupersetSecurityException as ex:
                raise ReportScheduleForbiddenError() from ex
        self._properties[kind] = obj

    def requires_asset(self) -> bool:
        """Whether the schedule's format requires an asset to be present."""
        # PUT may omit either field; fallback to the stored schedule values
        if model := getattr(self, "_model", None):
            report_type = self._properties.get("type", model.type)
            report_format = self._properties.get("report_format", model.report_format)
        # POST requires type. An omitted format uses the model's PNG default
        else:
            report_type = self._properties["type"]
            report_format = self._properties.get("report_format")
        return (
            report_type == ReportScheduleType.REPORT
            or report_format != ReportDataFormat.NONE
        )

    def validate_chart_dashboard(
        self, exceptions: list[ValidationError], update: bool = False
    ) -> None:
        """Validate supplied assets and require one for an attachment format."""
        requires_asset = self.requires_asset()
        chart_id = self._properties.get("chart")
        dashboard_id = self._properties.get("dashboard")
        creation_method = self._properties.get("creation_method")
        if not requires_asset and not (chart_id or dashboard_id):
            return

        if creation_method == ReportCreationMethod.CHARTS and not chart_id:
            # User has not saved chart yet in Explore view
            exceptions.append(ChartNotSavedValidationError())
            return

        if creation_method == ReportCreationMethod.DASHBOARDS and not dashboard_id:
            exceptions.append(DashboardNotSavedValidationError())
            return

        if chart_id and dashboard_id:
            exceptions.append(ReportScheduleOnlyChartOrDashboardError())

        if chart_id:
            self._check_object_access(
                chart_id,
                kind="chart",
                dao=ChartDAO,
                not_found_exc=ChartNotFoundValidationError,
                exceptions=exceptions,
            )
        elif dashboard_id:
            self._check_object_access(
                dashboard_id,
                kind="dashboard",
                dao=DashboardDAO,
                not_found_exc=DashboardNotFoundValidationError,
                exceptions=exceptions,
            )
        elif not update:
            exceptions.append(ReportScheduleEitherChartOrDashboardError())

        # Update schedule without chart_id / dashboard_id in properties
        else:
            # Allow an explicit null to clear the field
            model = getattr(self, "_model", None)
            effective_chart = self._properties.get(
                "chart", getattr(model, "chart_id", None)
            )
            effective_dashboard = self._properties.get(
                "dashboard", getattr(model, "dashboard_id", None)
            )
            if not effective_chart and not effective_dashboard:
                exceptions.append(ReportScheduleEitherChartOrDashboardError())
                return

            self._check_stored_target_access(
                model, effective_chart, effective_dashboard
            )

    def _check_stored_target_access(
        self,
        model: Any,
        effective_chart: Any,
        effective_dashboard: Any,
    ) -> None:
        """Ask of a stored target what is asked of a submitted one.

        Without this, activating a paused report resumes a schedule whose asset
        has since been withheld, while resubmitting that same asset is refused.

        Only when the result is a *scheduled* report; see
        :meth:`_result_is_active`.
        """
        if not self._result_is_active():
            return

        kind, target = (
            ("chart", effective_chart)
            if effective_chart
            else ("dashboard", effective_dashboard)
        )
        target_id = getattr(target, "id", target)
        if not isinstance(target_id, int):
            return

        # Both keys: a submitted target reaches the ordinary one through
        # ``find_by_id``'s base filter and the report-target one through
        # ``_check_object_access``, so a stored target asking only the latter
        # would accept what resubmitting it refuses.
        if any(
            is_excluded_by_extra_access(key, target_id)
            for key in (f"report_target_{kind}s", f"{kind}s")
        ):
            raise ReportScheduleForbiddenError()

    def _validate_report_extra(  # noqa: C901
        self, exceptions: list[ValidationError]
    ) -> None:
        extra: ReportScheduleExtra | None = self._properties.get("extra")
        dashboard = self._properties.get("dashboard")

        # On PUT requests, dashboard may not be in the payload — fall back to the model
        if dashboard is None:
            model = getattr(self, "_model", None)
            dashboard = getattr(model, "dashboard", None)

        if extra is None or dashboard is None:
            return

        dashboard_state = extra.get("dashboard")
        if not dashboard_state:
            return

        if not isinstance(dashboard_state, dict):
            exceptions.append(
                ValidationError(
                    _("extra.dashboard must be an object"),
                    "extra",
                )
            )
            return

        try:
            position_data = json.loads(dashboard.position_json or "{}")
        except json.JSONDecodeError:
            exceptions.append(
                ValidationError(
                    _("extra.dashboard.position_json is not valid JSON"),
                    "extra",
                )
            )
            return
        active_tabs = dashboard_state.get("activeTabs") or []
        invalid_tab_ids = set(active_tabs) - set(position_data.keys())

        if anchor := dashboard_state.get("anchor"):
            try:
                anchor_list: list[str] = json.loads(anchor)
                if _invalid_tab_ids := set(anchor_list) - set(position_data.keys()):
                    invalid_tab_ids.update(_invalid_tab_ids)
            except (json.JSONDecodeError, TypeError):
                # A non-string anchor (e.g. a list or dict) can never be a valid
                # tab-id key and is unhashable, so record its string form instead
                # of hashing the raw value in the membership test or set.add.
                anchor_id = anchor if isinstance(anchor, str) else str(anchor)
                if not isinstance(anchor, str) or anchor not in position_data:
                    invalid_tab_ids.add(anchor_id)

        if invalid_tab_ids:
            exceptions.append(
                ValidationError(
                    _("Invalid tab ids: %(tab_ids)s", tab_ids=str(invalid_tab_ids)),
                    "extra",
                )
            )

        self._validate_native_filters(dashboard, dashboard_state, exceptions)

    def _validate_native_filters(  # noqa: C901
        self,
        dashboard: Any,
        dashboard_state: Any,
        exceptions: list[ValidationError],
    ) -> None:
        native_filters = dashboard_state.get("nativeFilters")
        if not native_filters:
            return

        if not isinstance(native_filters, list):
            exceptions.append(
                ValidationError(
                    _("nativeFilters must be a list"),
                    "extra",
                )
            )
            return

        required_keys = {"nativeFilterId", "filterType", "columnName", "filterValues"}
        valid_filter_ids: set[str] | None = None

        for idx, native_filter in enumerate(native_filters):
            if not isinstance(native_filter, dict):
                exceptions.append(
                    ValidationError(
                        _("nativeFilters[%(idx)s] must be an object", idx=idx),
                        "extra",
                    )
                )
                continue

            missing_keys = required_keys - set(native_filter.keys())
            if missing_keys:
                exceptions.append(
                    ValidationError(
                        _(
                            "nativeFilters[%(idx)s] missing required keys: %(keys)s",
                            idx=idx,
                            keys=", ".join(sorted(missing_keys)),
                        ),
                        "extra",
                    )
                )
                continue

            if not isinstance(native_filter["filterValues"], list):
                exceptions.append(
                    ValidationError(
                        _(
                            "nativeFilters[%(idx)s].filterValues must be a list",
                            idx=idx,
                        ),
                        "extra",
                    )
                )
                continue

            filter_id = native_filter["nativeFilterId"]
            if not isinstance(filter_id, str) or not filter_id:
                exceptions.append(
                    ValidationError(
                        _(
                            "nativeFilters[%(idx)s].nativeFilterId"
                            " must be a non-empty string",
                            idx=idx,
                        ),
                        "extra",
                    )
                )
                continue
            if valid_filter_ids is None:
                try:
                    json_metadata = json.loads(dashboard.json_metadata or "{}")
                except json.JSONDecodeError:
                    exceptions.append(
                        ValidationError(
                            _(
                                "extra.nativeFilters could not be validated: "
                                "dashboard metadata is not valid JSON"
                            ),
                            "extra",
                        )
                    )
                    break
                valid_filter_ids = {
                    f["id"]
                    for f in json_metadata.get("native_filter_configuration", [])
                    if "id" in f
                }
            if filter_id not in valid_filter_ids:
                exceptions.append(
                    ValidationError(
                        _(
                            "nativeFilters[%(idx)s].nativeFilterId '%(filter_id)s' "
                            "does not exist on the dashboard",
                            idx=idx,
                            filter_id=filter_id,
                        ),
                        "extra",
                    )
                )

    def validate_report_frequency(
        self,
        cron_schedule: str,
        report_type: str,
    ) -> None:
        """
        Validates if the report scheduled frequency doesn't exceed the minimum
        interval in effect.

        :param cron_schedule: The cron schedule configured.
        :param report_type: The report type (Alert/Report).
        """
        config_key = (
            ReportConfigKey.ALERT_MINIMUM_INTERVAL
            if report_type == ReportScheduleType.ALERT
            else ReportConfigKey.REPORT_MINIMUM_INTERVAL
        )
        minimum_interval = ReportConfigDAO.get_effective_value(config_key)

        if minimum_interval is None:
            return
        if not isinstance(minimum_interval, int):
            logger.error(
                "Invalid value for %s: %s", config_key, minimum_interval, exc_info=True
            )
            return

        try:
            if not cron_meets_minimum_interval(cron_schedule, minimum_interval):
                raise ReportScheduleFrequencyNotAllowed(
                    report_type=report_type, minimum_interval=minimum_interval
                )
        except CroniterBadDateError as ex:
            raise ReportScheduleCrontabNotValidError(
                cron_schedule=cron_schedule
            ) from ex

    def validate_report_format(
        self,
        report_type: str,
        report_format: str | None,
        exceptions: list[ValidationError],
    ) -> None:
        """
        Reports always deliver content: the "no attachment" format is only
        allowed on alerts.
        """
        if (
            report_type == ReportScheduleType.REPORT
            and report_format == ReportDataFormat.NONE
        ):
            exceptions.append(ReportScheduleFormatRequiredError())

    def validate_teams_recipients(self, exceptions: list[ValidationError]) -> None:
        """Validate the merged saved schedule, including recipients omitted on PUT."""
        model = getattr(self, "_model", None)
        recipients = self._properties.get(
            "recipients", getattr(model, "recipients", [])
        )
        report_type = self._properties.get("type", getattr(model, "type", None))
        report_format = self._properties.get(
            "report_format", getattr(model, "report_format", ReportDataFormat.PNG)
        )
        for recipient in recipients or []:
            if isinstance(recipient, dict):
                recipient_type = recipient.get("type")
                recipient_config = recipient.get("recipient_config_json")
            else:
                recipient_type = recipient.type
                recipient_config = recipient.recipient_config_json
            if recipient_type != ReportRecipientType.TEAMS:
                continue
            try:
                validate_teams_recipient(recipient_config, report_type, report_format)
            except TeamsRecipientValidationError as ex:
                exceptions.append(ValidationError(str(ex), field_name=ex.field))

    def validate_recipients_policy(self, exceptions: list[ValidationError]) -> None:
        """
        Validate the e-mail recipients in the payload against the global
        recipient policy (allowed domains and/or existing users only).
        """
        recipients = self._properties.get("recipients")
        if not recipients:
            return
        disallowed = ReportConfigDAO.find_disallowed_addresses(
            get_email_addresses(recipients)
        )
        if disallowed:
            exceptions.append(ReportScheduleRecipientNotAllowedError(disallowed))

    def validate_run_as(
        self,
        field_name: str,
        user_id: int | None,
        exceptions: list[ValidationError],
        *,
        default_to_current_user: bool,
    ) -> User | None:
        """Validate a specific user or an admin-selected application default.

        A blank query executor inherits the content executor. A blank content
        executor selected by an admin uses the legacy application configuration.
        """
        is_admin = security_manager.is_admin()
        current_user = get_user()
        type_field = f"{field_name}_type"
        executor_type = self._properties.pop(type_field, None)
        if user_id is None and executor_type != ExecutorType.FIXED_USER:
            if field_name == "run_alert_query_as":
                self._properties[type_field] = None
                self._properties[field_name] = None
                return None
            if is_admin and not default_to_current_user:
                self._properties[type_field] = None
                self._properties[field_name] = None
                return None
            if not is_admin and not default_to_current_user:
                exceptions.append(ReportScheduleRunAsForbiddenError(field_name))
                return None
            user = current_user
        else:
            user = (
                security_manager.get_user_by_id(user_id)
                if user_id is not None
                else None
            )
        if not user or not user.is_active:
            exceptions.append(ReportScheduleRunAsNotFoundError(field_name))
            return None
        if not is_admin and (current_user is None or user.id != current_user.id):
            exceptions.append(ReportScheduleRunAsForbiddenError(field_name))
            return None
        self._properties[type_field] = ExecutorType.FIXED_USER
        self._properties[field_name] = user
        return user

    def _delivers_content(self, report_type: str, report_format: str | None) -> bool:
        """Whether the executor renders the target when the schedule runs."""
        return report_type == ReportScheduleType.REPORT or (
            report_format != ReportDataFormat.NONE
            and bool(
                ReportConfigDAO.get_effective_value(
                    ReportConfigKey.ALERTS_ATTACH_REPORTS
                )
            )
        )

    def _executor_target_state(self) -> tuple[str, Any, User | None, bool]:
        """Return the target kind, target, executor and delivery of the result."""
        model = getattr(self, "_model", None)
        chart = self._properties.get("chart", getattr(model, "chart", None))
        dashboard = self._properties.get("dashboard", getattr(model, "dashboard", None))
        kind, target = ("chart", chart) if chart else ("dashboard", dashboard)
        report_type = self._properties.get("type", getattr(model, "type", None))
        report_format = self._properties.get(
            "report_format",
            getattr(model, "report_format", ReportDataFormat.PNG),
        )
        current_user = get_user()
        executor = resolve_save_time_executor(
            run_as_type=self._properties.get(
                "run_as_type", getattr(model, "run_as_type", None)
            ),
            run_as=self._properties.get("run_as", getattr(model, "run_as", None)),
            created_by=getattr(model, "created_by", None) if model else current_user,
            changed_by=current_user,
            editors=self._properties.get("editors", getattr(model, "editors", [])),
        )
        return (
            kind,
            target,
            executor,
            self._delivers_content(str(report_type), report_format),
        )

    def _stored_executor_target_state(
        self,
    ) -> tuple[tuple[str, Any], User | None, bool, bool]:
        """Return the stored target, executor, delivery and active flag.

        The target is a ``(kind, id)`` pair so a chart and a dashboard that
        share a numeric id are never mistaken for one another.
        """
        model = getattr(self, "_model", None)
        assert model is not None
        executor = resolve_save_time_executor(
            run_as_type=model.run_as_type,
            run_as=model.run_as,
            created_by=model.created_by,
            changed_by=model.changed_by,
            editors=model.editors,
        )
        stored_target = (
            ("chart", model.chart_id)
            if model.chart_id
            else ("dashboard", model.dashboard_id)
        )
        return (
            stored_target,
            executor,
            self._delivers_content(model.type, model.report_format),
            bool(model.active),
        )

    def validate_executor_target_access(
        self, exceptions: list[ValidationError]
    ) -> None:
        """Check the chart or dashboard as the identity the schedule runs as.

        The target access check in :meth:`validate_chart_dashboard` asks only
        whether the *saving* user can read the target. A schedule executes as
        a different identity whenever ``ALERT_REPORTS_EXECUTORS`` or its "Run
        As" choice resolves to someone else; when that identity cannot read the
        target, the schedule saves but can never deliver. Asking the question
        here turns that into a validation error on the request that causes it.

        Runs only when the result is a scheduled schedule that renders its
        target (see :meth:`_result_is_active`), and on update only when the
        target, the executor, content delivery or the active flag changes, so
        that pausing or editing the metadata of an already-broken schedule is
        never refused. A saver who is not an admin and is not the executor is
        not told who the executor is.
        """
        if exceptions or not self._result_is_active():
            return
        kind, target, executor, delivers_content = self._executor_target_state()
        if target is None or isinstance(target, int) or executor is None:
            return
        if not delivers_content:
            return
        if getattr(self, "_model", None) is not None:
            stored_target, stored_executor, stored_delivery, stored_active = (
                self._stored_executor_target_state()
            )
            if (
                stored_target == (kind, target.id)
                and stored_executor is not None
                and stored_executor.id == executor.id
                and stored_delivery
                and stored_active
            ):
                return
        withheld = False
        try:
            with override_user(executor):
                security_manager.raise_for_access(**{kind: target})
                # ``raise_for_access`` does not consult the exclusion hook, yet
                # resolving the dashboard to build its permalink does, so a
                # dashboard withheld from the executor can never be rendered.
                withheld = kind == "dashboard" and is_excluded_by_extra_access(
                    "dashboards", target.id
                )
        except SupersetSecurityException:
            withheld = True
        if withheld:
            current_user = get_user()
            reveal_executor = security_manager.is_admin() or (
                current_user is not None and current_user.id == executor.id
            )
            exceptions.append(
                ReportScheduleExecutorTargetAccessError(
                    kind, executor.username if reveal_executor else None
                )
            )
