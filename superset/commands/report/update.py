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
from collections.abc import Callable
from functools import partial
from typing import Any, Optional

from flask import current_app
from flask_appbuilder.models.sqla import Model
from flask_babel import gettext as _
from marshmallow import ValidationError

from superset import is_feature_enabled, security_manager
from superset.commands.base import UpdateMixin
from superset.commands.report.base import BaseReportScheduleCommand
from superset.commands.report.exceptions import (
    DatabaseNotFoundValidationError,
    ReportScheduleAlertRequiredDatabaseValidationError,
    ReportScheduleDatabaseNotAllowedValidationError,
    ReportScheduleForbiddenError,
    ReportScheduleInvalidError,
    ReportScheduleNameUniquenessValidationError,
    ReportScheduleNotFoundError,
    ReportScheduleRunAlertQueryAsNotAllowedError,
    ReportScheduleRunAsConditionForbiddenError,
    ReportScheduleRunAsContentForbiddenError,
    ReportScheduleRunAsNotFoundError,
    ReportScheduleUpdateFailedError,
    ReportScheduleUserEmailNotFoundError,
)
from superset.commands.utils import compute_subjects
from superset.daos.database import DatabaseDAO
from superset.daos.report import ReportScheduleDAO
from superset.exceptions import SupersetSecurityException
from superset.reports.models import (
    ReportCreationMethod,
    ReportDataFormat,
    ReportRecipientType,
    ReportSchedule,
    ReportScheduleType,
    ReportState,
)
from superset.tasks.exceptions import ExecutorNotFoundError
from superset.tasks.types import ExecutorType
from superset.tasks.utils import get_executor
from superset.utils import json
from superset.utils.core import get_user, get_user_email, get_user_id
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)

# Payload fields that change the delivered asset, its rendering, or its recipients.
# When a schedule executes as another user, only admins may change these.
CONTENT_FIELDS: frozenset[str] = frozenset(
    {
        "type",
        "chart",
        "dashboard",
        "extra",
        "recipients",
        "report_format",
    }
)

ALERT_CONDITION_FIELDS: frozenset[str] = frozenset(
    {"database", "sql", "validator_type", "validator_config_json"}
)


def _normalize_json(value: Any) -> str:
    """Canonical JSON string for a dict/JSON-string value (for comparisons)."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return value
    if value is None:
        value = {}
    if not isinstance(value, (dict, list)):
        return str(value)
    return json.dumps(value, sort_keys=True)


def _normalize_extra(value: Any) -> str:
    """Ignore an empty native-filter list added by the report modal."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return value
    if isinstance(value, dict):
        dashboard = value.get("dashboard")
        if isinstance(dashboard, dict) and dashboard.get("nativeFilters") == []:
            value = {
                **value,
                "dashboard": {
                    key: item
                    for key, item in dashboard.items()
                    if key != "nativeFilters"
                },
            }
    return _normalize_json(value)


def _normalize_recipients(recipients: Any) -> list[tuple[str, str]]:
    """Canonical, order-independent representation of a recipients list."""
    normalized: list[tuple[str, str]] = []
    for recipient in recipients or []:
        if isinstance(recipient, dict):
            recipient_type = recipient.get("type")
            config = recipient.get("recipient_config_json")
        else:
            recipient_type = recipient.type
            config = recipient.recipient_config_json
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except json.JSONDecodeError:
                pass
        if isinstance(config, dict):
            config = {
                key: value
                for key, value in config.items()
                if key not in ("ccTarget", "bccTarget") or value != ""
            }
        normalized.append((str(recipient_type), _normalize_json(config)))
    return sorted(normalized)


class UpdateReportScheduleCommand(UpdateMixin, BaseReportScheduleCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[ReportSchedule] = None

    @transaction(on_error=partial(on_error, reraise=ReportScheduleUpdateFailedError))
    def run(self) -> Model:
        self.validate()
        return ReportScheduleDAO.update(self._model, self._properties)

    def _compare_fields(
        self,
        keys: frozenset[str],
        current: dict[str, Any],
        normalizers: dict[str, Callable[[Any], Any]],
    ) -> set[str]:
        """
        Return submitted fields whose normalized values differ from the stored values
        """
        changed: set[str] = set()
        for field in keys & set(self._properties):
            value = self._properties[field]
            normalizer = normalizers.get(field)
            if normalizer:
                value = normalizer(value)
            if value != current[field]:
                changed.add(field)
        return changed

    def _changed_content_fields(self) -> set[str]:
        """
        Return the content fields whose payload value differs from the stored
        one. Must run before other validators replace ids with model objects.
        """
        assert self._model is not None
        model = self._model
        current: dict[str, Any] = {
            "type": model.type,
            "chart": model.chart_id,
            "dashboard": model.dashboard_id,
            "extra": _normalize_extra(model.extra_json),
            "recipients": _normalize_recipients(model.recipients),
            "report_format": model.report_format,
        }
        normalizers: dict[str, Callable[[Any], Any]] = {
            "extra": _normalize_extra,
            "recipients": _normalize_recipients,
        }
        return self._compare_fields(CONTENT_FIELDS, current, normalizers)

    def _changed_condition_fields(self) -> set[str]:
        """Return alert-condition fields that differ from the stored values."""
        assert self._model is not None
        current = {
            "database": self._model.database_id,
            "sql": self._model.sql,
            "validator_type": self._model.validator_type,
            "validator_config_json": _normalize_json(self._model.validator_config_json),
        }
        normalizers: dict[str, Callable[[Any], Any]] = {
            "validator_config_json": _normalize_json,
        }
        return self._compare_fields(ALERT_CONDITION_FIELDS, current, normalizers)

    def _validate_executors(
        self,
        report_type: str,
        changed_content_fields: set[str],
        changed_condition_fields: set[str],
        exceptions: list[ValidationError],
    ) -> None:
        """
        Resolve the "Run As" fields (SIP-209) on update.

        Fields absent from the payload keep their stored value. Admins may set
        any active user or explicit executor type. Clearing content restores the
        legacy application-configured executor;
        clearing the query executor inherits the content identity.
        Non-admins may only point the fields at themselves and, when the schedule
        executes as another user,
        may not change its content or recipients: doing so would let an editor
        read data with someone else's credentials.
        """
        assert self._model is not None
        has_run_as = bool({"run_as", "run_as_type"} & self._properties.keys())
        has_query_as = bool(
            {"run_alert_query_as", "run_alert_query_as_type"} & self._properties.keys()
        )
        run_as_id = self._properties.pop("run_as", None)
        query_as_id = self._properties.pop("run_alert_query_as", None)
        if not is_feature_enabled("ALERT_REPORT_DYNAMIC_EXECUTOR"):
            self._properties.update(
                run_as=None,
                run_as_type=None,
                run_alert_query_as=None,
                run_alert_query_as_type=None,
            )
            return

        run_as = (
            self.validate_run_as(
                "run_as", run_as_id, exceptions, default_to_current_user=False
            )
            if has_run_as
            else self._model.run_as
        )

        query_as = None
        if report_type == ReportScheduleType.REPORT:
            if has_query_as and (
                query_as_id is not None
                or self._properties.get("run_alert_query_as_type") is not None
            ):
                exceptions.append(ReportScheduleRunAlertQueryAsNotAllowedError())
            else:
                self._properties["run_alert_query_as"] = None
                self._properties["run_alert_query_as_type"] = None
        elif has_query_as:
            query_as = self.validate_run_as(
                "run_alert_query_as",
                query_as_id,
                exceptions,
                default_to_current_user=False,
            )
        else:
            query_as = self._model.run_alert_query_as

        if security_manager.is_admin():
            return
        current_user_id = get_user_id()
        executes_as_other_user = any(
            user is not None and user.id != current_user_id
            for user in (run_as, query_as)
        )
        typed_executor = any(
            self._properties.get(field, getattr(self._model, field))
            not in (None, ExecutorType.FIXED_USER)
            for field in ("run_as_type", "run_alert_query_as_type")
        )
        content_type = self._properties.get("run_as_type", self._model.run_as_type)
        unresolved_executor = (
            content_type is None
            or (content_type == ExecutorType.FIXED_USER and run_as is None)
            or (
                report_type == ReportScheduleType.ALERT
                and query_as is None
                and self._properties.get(
                    "run_alert_query_as_type", self._model.run_alert_query_as_type
                )
                == ExecutorType.FIXED_USER
            )
        )
        if (
            executes_as_other_user or typed_executor or unresolved_executor
        ) and changed_content_fields:
            exceptions.append(ReportScheduleRunAsContentForbiddenError())

        query_executor_cleared = (
            report_type == ReportScheduleType.ALERT
            and has_query_as
            and self._model.run_alert_query_as_type is not None
            and self._properties.get("run_alert_query_as_type") is None
        )
        if report_type == ReportScheduleType.ALERT and (
            changed_condition_fields or query_executor_cleared
        ):
            query_type = self._properties.get(
                "run_alert_query_as_type", self._model.run_alert_query_as_type
            )
            effective_query_type = (
                query_type if query_type is not None else content_type
            )
            effective_query_user = query_as if query_type is not None else run_as
            if (
                effective_query_type != ExecutorType.FIXED_USER
                or effective_query_user is None
                or effective_query_user.id != current_user_id
            ):
                exceptions.append(ReportScheduleRunAsConditionForbiddenError())

    def _validate_attachment_executor(self, exceptions: list[ValidationError]) -> None:
        """Require a usable content identity when enabling content on an alert."""
        assert self._model is not None
        if not (
            self._model.report_format == ReportDataFormat.NONE
            and self._properties.get("report_format", ReportDataFormat.NONE)
            != ReportDataFormat.NONE
        ):
            return
        user = self._properties.get("run_as", self._model.run_as)
        executor_type = self._properties.get("run_as_type", self._model.run_as_type)
        if not is_feature_enabled("ALERT_REPORT_DYNAMIC_EXECUTOR"):
            user, executor_type = None, None
        if executor_type != ExecutorType.FIXED_USER:
            try:
                _, username = get_executor(
                    [ExecutorType(executor_type)]
                    if executor_type
                    else current_app.config["ALERT_REPORTS_EXECUTORS"],
                    ReportSchedule(
                        created_by=self._model.created_by,
                        changed_by=get_user(),
                        editors=self._properties.get("editors", self._model.editors),
                    ),
                )
                user = security_manager.find_user(username)
            except ExecutorNotFoundError:
                user = None
        if user is None or not user.is_active:
            exceptions.append(ReportScheduleRunAsNotFoundError("run_as"))

    def validate(self) -> None:  # noqa: C901
        """
        Validates the properties of a report schedule configuration, including uniqueness
        of name and type, relations based on the report type, frequency, etc. Populates
        a list of `ValidationErrors` to be returned in the API response if any.

        Fields were loaded according to the `ReportSchedulePutSchema` schema.
        """  # noqa: E501
        # Load existing report schedule config
        self._model = ReportScheduleDAO.find_by_id(self._model_id)
        if not self._model:
            raise ReportScheduleNotFoundError()

        # Required fields for validation
        cron_schedule = self._properties.get("crontab", self._model.crontab)
        name = self._properties.get("name", self._model.name)
        report_type = self._properties.get("type", self._model.type)

        # Optional fields
        database_id = self._properties.get("database")

        exceptions: list[ValidationError] = []

        # Change the state to not triggered when the user deactivates
        # A report that is currently in a working state. This prevents
        # an alert/report from being kept in a working state if activated back
        if (
            self._model.last_state == ReportState.WORKING
            and "active" in self._properties
            and not self._properties["active"]
        ):
            self._properties["last_state"] = ReportState.NOOP

        # For reports created from charts or dashboards the recipient must always
        # be the requesting user's own email address.
        if (
            self._model.creation_method
            in (
                ReportCreationMethod.CHARTS,
                ReportCreationMethod.DASHBOARDS,
            )
            and "recipients" in self._properties
        ):
            if user_email := get_user_email():
                self._properties["recipients"] = [
                    {
                        "type": ReportRecipientType.EMAIL,
                        "recipient_config_json": {"target": user_email},
                    }
                ]
            else:
                exceptions.append(ReportScheduleUserEmailNotFoundError())

        # Compare the recipients that will actually be saved. Other validators
        # below may replace asset IDs with model objects, so snapshot here.
        changed_content_fields = (
            self._changed_content_fields()
            if is_feature_enabled("ALERT_REPORT_DYNAMIC_EXECUTOR")
            else set()
        )
        changed_condition_fields = (
            self._changed_condition_fields()
            if report_type == ReportScheduleType.ALERT
            else set()
        )

        # Validate name/type uniqueness if either is changing
        if name != self._model.name or report_type != self._model.type:
            if not ReportScheduleDAO.validate_update_uniqueness(
                name, report_type, expect_id=self._model_id
            ):
                exceptions.append(
                    ReportScheduleNameUniquenessValidationError(
                        report_type=report_type, name=name
                    )
                )

        # Determine effective database state (payload overrides model)
        if "database" in self._properties:
            has_database = self._properties["database"] is not None
        else:
            has_database = self._model.database_id is not None

        # Validate database is not allowed on Report type
        if report_type == ReportScheduleType.REPORT and has_database:
            exceptions.append(ReportScheduleDatabaseNotAllowedValidationError())

        # Validate Alert has a database
        if report_type == ReportScheduleType.ALERT and not has_database:
            exceptions.append(ReportScheduleAlertRequiredDatabaseValidationError())

        # Validate if DB exists (for alerts)
        if report_type == ReportScheduleType.ALERT and database_id is not None:
            if not (database := DatabaseDAO.find_by_id(database_id)):
                exceptions.append(DatabaseNotFoundValidationError())
            self._properties["database"] = database

        # Re-validate only when the alert SQL or its database changes. The
        # modal resubmits unchanged values on metadata-only edits.
        if changed_condition_fields & {"sql", "database"}:
            effective_database = (
                self._properties.get("database") or self._model.database
            )
            effective_sql = self._properties.get("sql", self._model.sql)
            if effective_database and effective_sql:
                self.validate_alert_query(effective_database, effective_sql, exceptions)

        # validate report frequency
        try:
            self.validate_report_frequency(
                cron_schedule,
                report_type,
            )
        except ValidationError as exc:
            exceptions.append(exc)

        # Validate chart or dashboard relations
        self.validate_chart_dashboard(exceptions, update=True)
        self._validate_report_extra(exceptions)

        if "validator_config_json" in self._properties:
            self._properties["validator_config_json"] = json.dumps(
                self._properties["validator_config_json"]
            )

        # Check editorship
        try:
            security_manager.raise_for_editorship(self._model)
        except SupersetSecurityException as ex:
            raise ReportScheduleForbiddenError() from ex

        compute_subjects(
            self._model,
            self._properties,
            exceptions,
            include_viewers=False,
        )

        self.validate_report_format(
            report_type,
            self._properties.get("report_format", self._model.report_format),
            exceptions,
        )
        if "recipients" in self._properties:
            self.validate_recipients_policy(exceptions)
        self._validate_executors(
            report_type, changed_content_fields, changed_condition_fields, exceptions
        )
        self._validate_attachment_executor(exceptions)

        # Validate retry config when the feature is enabled.
        if is_feature_enabled("ALERT_REPORTS_RETRY"):
            # Fall back to the existing DB value for fields not in the payload.
            send_failed = self._properties.get(
                "send_failed_reports", self._model.send_failed_reports
            )
            retry_enabled = self._properties.get(
                "retry_on_failure", self._model.retry_on_failure
            )
            if send_failed and not retry_enabled:
                msg = _("send_failed_reports requires retry_on_failure to be enabled")
                exceptions.append(ValidationError({"send_failed_reports": [msg]}))

        if exceptions:
            raise ReportScheduleInvalidError(exceptions=exceptions)
