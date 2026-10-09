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
import re
from typing import Any, Optional, Union

from croniter import croniter
from flask import current_app
from flask_babel import gettext as _, lazy_gettext
from marshmallow import (
    EXCLUDE,
    fields,
    pre_load,
    Schema,
    validate,
    validates,
    validates_schema,
)
from marshmallow.validate import Length, Range, ValidationError
from pytz import all_timezones

from superset import is_feature_enabled
from superset.reports.models import (
    ReportCreationMethod,
    ReportDataFormat,
    ReportRecipientType,
    ReportScheduleType,
    ReportScheduleValidatorType,
)
from superset.reports.utils import EMAIL_DOMAIN_REGEX
from superset.tasks.types import ExecutorType

openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get a report schedule"}},
    "get_list": {
        "get": {
            "summary": "Get a list of report schedules",
            "description": "Gets a list of report schedules, use Rison or JSON "
            "query parameters for filtering, sorting,"
            " pagination and for selecting specific"
            " columns and metadata.",
        }
    },
    "post": {"post": {"summary": "Create a report schedule"}},
    "put": {"put": {"summary": "Update a report schedule"}},
    "delete": {"delete": {"summary": "Delete a report schedule"}},
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}

get_delete_ids_schema = {
    "type": "array",
    "items": {"type": "integer"},
    "example": [1, 2, 3],
}
get_slack_channels_schema = {
    "type": "object",
    "properties": {
        "search_string": {"type": "string"},
        "types": {
            "type": "array",
            "items": {"type": "string", "enum": ["public_channel", "private_channel"]},
        },
        "exact_match": {"type": "boolean"},
        "force": {"type": "boolean"},
        "page": {"type": "integer", "minimum": 0},
        "page_size": {"type": "integer", "minimum": 1},
    },
}

type_description = "The report schedule type"
name_description = "The report schedule name."
# :)
description_description = "Use a nice description to give context to this Alert/Report"
email_subject_description = "The report schedule subject line"
include_cta_description = (
    "Whether to include the call-to-action link back to Superset "
    "(e.g. 'Explore in Superset') in the delivered notifications"
)
context_markdown_description = "Markdown description"
crontab_description = (
    "A CRON expression."
    "[Crontab Guru](https://crontab.guru/) is "
    "a helpful resource that can help you craft a CRON expression."
)
timezone_description = "A timezone string that represents the location of the timezone."
sql_description = (
    "A SQL statement that defines whether the alert should get triggered or "
    "not. The query is expected to return either NULL or a number value."
)
editors_description = (
    "A list of subject IDs (users, roles, or groups) that can alter the report."
)
validator_type_description = (
    "Determines when to trigger alert based off value from alert query. "
    "Alerts will be triggered with these validator types:\n"
    "- Not Null - When the return value is Not NULL, Empty, or 0\n"
    "- Operator - When `sql_return_value comparison_operator threshold`"
    " is True e.g. `50 <= 75`<br>Supports the comparison operators <, <=, "
    ">, >=, ==, and !="
)
validator_config_json_op_description = (
    "The operation to compare with a threshold to apply to the SQL output\n"
)
log_retention_description = "How long to keep the logs around for this report (in days)"
grace_period_description = (
    "Once an alert is triggered, how long, in seconds, before "
    "Superset nags you again. (in seconds)"
)
working_timeout_description = (
    "If an alert is staled at a working state, how long until it's state is reset to"
    " error"
)
creation_method_description = (
    "Creation method is used to inform the frontend whether the report/alert was "
    "created in the dashboard, chart, or alerts and reports UI."
)
run_as_description = (
    "ID of the user whose credentials (RBAC permissions, database OAuth2 tokens) "
    "are used when rendering the content (screenshot, PDF, CSV, XLSX or text). "
    "Admins can set any active user; non-admins can only set themselves. Only"
    "honored when the ALERT_REPORT_DYNAMIC_EXECUTOR feature flag is enabled. "
    "Admins can set this and run_as_type to null to use ALERT_REPORTS_EXECUTORS."
)
run_alert_query_as_description = (
    "ID of the user whose credentials are used when running the alert condition "
    "SQL query, useful when the audience of the alert does not have access to the "
    "database. Null inherits the content executor at execution time."
)


_RUN_AS_FIELD_KEYS = (
    "run_as",
    "run_alert_query_as",
    "run_as_type",
    "run_alert_query_as_type",
)
_REPORT_EXECUTOR_TYPES = [
    ExecutorType.FIXED_USER,
]


class RunAsFieldStripMixin:
    """Drop the "Run As" fields from the raw payload when the dynamic executor
    feature (``ALERT_REPORT_DYNAMIC_EXECUTOR``) is disabled, so callers on the
    legacy path never store an executor by accident."""

    @pre_load
    def strip_run_as_fields_if_disabled(
        self,
        data: dict[str, Any],
        **kwargs: Any,
    ) -> dict[str, Any]:
        if not is_feature_enabled("ALERT_REPORT_DYNAMIC_EXECUTOR"):
            for key in _RUN_AS_FIELD_KEYS:
                data.pop(key, None)
        return data


def validate_crontab(value: Union[bytes, bytearray, str]) -> None:
    if not croniter.is_valid(str(value)):
        raise ValidationError("Cron expression is not valid")


class ValidatorConfigJSONSchema(Schema):
    op = fields.String(  # pylint: disable=invalid-name
        metadata={"description": validator_config_json_op_description},
        validate=validate.OneOf(choices=["<", "<=", ">", ">=", "==", "!="]),
    )
    threshold = fields.Float()


EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")
# A Slack channel id: C public, G private, D direct message.
SLACK_CHANNEL_ID_REGEX = re.compile(r"^[CGD][A-Z0-9]{6,}$")


class ReportRecipientConfigJSONSchema(Schema):
    target = fields.String()
    ccTarget = fields.String()  # noqa: N815
    bccTarget = fields.String()  # noqa: N815


class ReportRecipientSchema(Schema):
    type = fields.String(
        metadata={"description": "The recipient type, check spec for valid options"},
        allow_none=False,
        required=True,
        validate=validate.OneOf(
            choices=tuple(key.value for key in ReportRecipientType)
        ),
    )
    recipient_config_json = fields.Nested(ReportRecipientConfigJSONSchema)

    @validates_schema
    def validate_email_recipients(self, data: dict[str, Any], **kwargs: Any) -> None:
        if data.get("type") != ReportRecipientType.EMAIL.value:
            return

        config = data.get("recipient_config_json") or {}

        def validate_addresses(field: str, value: str | None, required: bool) -> None:
            if not value or not value.strip():
                if required:
                    raise ValidationError(
                        {field: ["Email target is required for Email recipients"]}
                    )
                return
            invalid = [
                addr.strip()
                for addr in re.split(r"[,;]", value)
                if addr.strip() and not EMAIL_REGEX.match(addr.strip())
            ]
            if invalid:
                raise ValidationError(
                    {field: [f"Invalid email address(es): {', '.join(invalid)}"]}
                )

        validate_addresses("target", config.get("target"), required=True)
        validate_addresses("ccTarget", config.get("ccTarget"), required=False)
        validate_addresses("bccTarget", config.get("bccTarget"), required=False)

    @validates_schema
    def validate_slack_recipients(self, data: dict[str, Any], **kwargs: Any) -> None:
        """SlackV2 recipients must be channel ids, because a name never delivers."""
        # SlackV2 only. The deprecated Slack v1 path still accepts channel names:
        # it sends with files_upload/chat_postMessage, which resolve a name, and
        # existing v1 recipients are auto-upgraded to SlackV2 on first send by
        # update_report_schedule_slack_v2. Rejecting names here would break that
        # upgrade path and the v1 contract.
        if data.get("type") != ReportRecipientType.SLACKV2.value:
            return

        target = ((data.get("recipient_config_json") or {}).get("target") or "").strip()
        # Superset splits a target on commas, semicolons and whitespace, so each
        # part has to be a channel id on its own.
        channels = [channel for channel in re.split(r"[,;\s]+", target) if channel]
        if not channels:
            raise ValidationError(
                {"target": [_("A Slack channel is required for Slack recipients")]}
            )

        invalid = [c for c in channels if not SLACK_CHANNEL_ID_REGEX.match(c)]
        if invalid:
            raise ValidationError(
                {
                    "target": [
                        _(
                            "Not a Slack channel id: %(invalid)s. Superset uploads "
                            "report attachments with files_upload_v2, which accepts "
                            "a channel id and rejects a channel name, so a name is "
                            "saved successfully and then never delivers. Choose the "
                            "channel from the dropdown, or copy its id from Slack "
                            "(channel name, View channel details, the id is at the "
                            "bottom).",
                            invalid=", ".join(invalid),
                        )
                    ]
                }
            )


_RETRY_FIELD_KEYS = (
    "retry_on_failure",
    "retry_max_attempts",
    "send_failed_reports",
    "retry_notify_owners",
    "retry_notify_recipients",
)


class RetryFieldStripMixin:
    """Strip retry fields from the raw payload before validation when the
    feature is off.  Using ``@pre_load`` ensures that field-level validators
    (e.g. ``Range`` on ``retry_max_attempts``) are never reached for values
    that will be discarded anyway."""

    @pre_load
    def strip_retry_fields_if_disabled(
        self,
        data: dict[str, Any],
        **kwargs: Any,
    ) -> dict[str, Any]:
        if not is_feature_enabled("ALERT_REPORTS_RETRY"):
            for key in _RETRY_FIELD_KEYS:
                data.pop(key, None)
        return data


class ReportSchedulePostSchema(RetryFieldStripMixin, RunAsFieldStripMixin, Schema):
    type = fields.String(
        metadata={"description": type_description},
        allow_none=False,
        required=True,
        validate=validate.OneOf(choices=tuple(key.value for key in ReportScheduleType)),
    )
    name = fields.String(
        metadata={"description": name_description, "example": "Daily dashboard email"},
        allow_none=False,
        required=True,
        validate=[Length(1, 150)],
    )
    description = fields.String(
        metadata={
            "description": description_description,
            "example": "Daily sales dashboard to marketing",
        },
        allow_none=True,
        required=False,
    )
    email_subject = fields.String(
        metadata={
            "description": email_subject_description,
            "example": "[Report]  Report name: Dashboard or chart name",
        },
        allow_none=True,
        required=False,
    )
    context_markdown = fields.String(
        metadata={"description": context_markdown_description},
        allow_none=True,
        required=False,
    )
    active = fields.Boolean()
    crontab = fields.String(
        metadata={"description": crontab_description, "example": "*/5 * * * *"},
        validate=[validate_crontab, Length(1, 1000)],
        allow_none=False,
        required=True,
    )
    timezone = fields.String(
        metadata={"description": timezone_description},
        dump_default="UTC",
        validate=validate.OneOf(choices=tuple(all_timezones)),
    )
    sql = fields.String(
        metadata={
            "description": sql_description,
            "example": "SELECT value FROM time_series_table",
        }
    )
    chart = fields.Integer(required=False, allow_none=True)
    creation_method = fields.Enum(
        ReportCreationMethod,
        by_value=True,
        required=False,
        metadata={"description": creation_method_description},
    )
    dashboard = fields.Integer(required=False, allow_none=True)
    database = fields.Integer(required=False)
    editors = fields.List(fields.Integer(metadata={"description": editors_description}))
    run_as_type = fields.String(
        required=False,
        allow_none=True,
        validate=validate.OneOf(_REPORT_EXECUTOR_TYPES),
        metadata={"description": "Explicit executor type; fixed_user requires run_as."},
    )
    run_alert_query_as_type = fields.String(
        required=False,
        allow_none=True,
        validate=validate.OneOf(_REPORT_EXECUTOR_TYPES),
        metadata={"description": "Alert query executor type; null inherits run_as."},
    )
    run_as = fields.Integer(
        metadata={"description": run_as_description},
        required=False,
        allow_none=True,
    )
    run_alert_query_as = fields.Integer(
        metadata={"description": run_alert_query_as_description},
        required=False,
        allow_none=True,
    )
    validator_type = fields.String(
        metadata={"description": validator_type_description},
        validate=validate.OneOf(
            choices=tuple(key.value for key in ReportScheduleValidatorType)
        ),
    )
    validator_config_json = fields.Nested(ValidatorConfigJSONSchema)
    log_retention = fields.Integer(
        metadata={"description": log_retention_description, "example": 90},
        validate=[Range(min=1, error=_("Value must be greater than 0"))],
    )
    grace_period = fields.Integer(
        metadata={"description": grace_period_description, "example": 60 * 60 * 4},
        dump_default=60 * 60 * 4,
        validate=[Range(min=1, error=_("Value must be greater than 0"))],
    )
    working_timeout = fields.Integer(
        metadata={"description": working_timeout_description, "example": 60 * 60 * 1},
        dump_default=60 * 60 * 1,
        validate=[Range(min=1, error=_("Value must be greater than 0"))],
    )

    recipients = fields.List(fields.Nested(ReportRecipientSchema), required=False)
    report_format = fields.String(
        metadata={
            "description": (
                "Attachment format. NONE disables attachments for alerts and makes "
                "chart/dashboard optional. Omitted attachment settings are "
                "preserved on update."
            )
        },
        dump_default=ReportDataFormat.PNG,
        validate=validate.OneOf(choices=tuple(key.value for key in ReportDataFormat)),
    )
    extra = fields.Dict(
        dump_default=None,
    )
    force_screenshot = fields.Boolean(dump_default=False)
    include_cta = fields.Boolean(
        dump_default=True,
        allow_none=True,
        metadata={"description": include_cta_description},
    )
    custom_width = fields.Integer(
        metadata={
            "description": _("Custom width of the screenshot in pixels"),
            "example": 1000,
        },
        allow_none=True,
        required=False,
        dump_default=None,
    )
    retry_on_failure = fields.Boolean(
        metadata={"description": _("Enable automatic retries on report failure")},
        load_default=False,
    )
    retry_max_attempts = fields.Integer(
        metadata={
            "description": _("Maximum number of retry attempts (1–10)"),
            "example": 3,
        },
        load_default=3,
        required=False,
        validate=[Range(min=1, max=10, error=_("Must be between 1 and 10"))],
    )
    send_failed_reports = fields.Boolean(
        metadata={
            "description": _(
                "Send the failed report to all recipients after retries are exhausted"
            )
        },
        load_default=False,
    )
    retry_notify_owners = fields.Boolean(
        metadata={"description": _("Notify report owners on each retry attempt")},
        load_default=True,
    )
    retry_notify_recipients = fields.Boolean(
        metadata={"description": _("Notify report recipients on each retry attempt")},
        load_default=False,
    )

    @validates("custom_width")
    def validate_custom_width(
        self,
        value: Optional[int],
        **kwargs: Any,
    ) -> None:
        if value is None:
            return

        min_width = current_app.config["ALERT_REPORTS_MIN_CUSTOM_SCREENSHOT_WIDTH"]
        max_width = current_app.config["ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH"]
        if not min_width <= value <= max_width:
            raise ValidationError(
                _(
                    "Screenshot width must be between %(min)spx and %(max)spx",
                    min=min_width,
                    max=max_width,
                )
            )

    @validates_schema
    def validate_report_references(  # pylint: disable=unused-argument
        self,
        data: dict[str, Any],
        **kwargs: Any,
    ) -> None:
        if data["type"] == ReportScheduleType.REPORT:
            if "database" in data:
                raise ValidationError(
                    {"database": ["Database reference is not allowed on a report"]}
                )
            if data.get("report_format") == ReportDataFormat.NONE:
                raise ValidationError(
                    {"report_format": [_("Reports require a content format")]}
                )

    @validates_schema
    def validate_retry_config(  # pylint: disable=unused-argument
        self,
        data: dict[str, Any],
        **kwargs: Any,
    ) -> None:
        if not is_feature_enabled("ALERT_REPORTS_RETRY"):
            return
        if data.get("send_failed_reports") and not data.get("retry_on_failure"):
            raise ValidationError(
                {
                    "send_failed_reports": [
                        _("send_failed_reports requires retry_on_failure to be enabled")
                    ]
                }
            )


class ReportScheduleSubscribeSchema(ReportSchedulePostSchema):
    """Schema for creating a chart/dashboard subscription.

    ``recipients`` and ``creation_method`` are excluded — both are set
    server-side: recipients are locked to the authenticated user's email,
    and creation_method is derived from the presence of ``chart`` or
    ``dashboard`` in the payload.

    ``type`` is restricted to ``Report`` — alert schedules cannot be
    created through the subscribe endpoint.

    The "Run As" fields are excluded as well: a subscription always executes
    as the subscribing user.
    """

    type = fields.String(
        metadata={"description": type_description},
        allow_none=False,
        required=True,
        validate=validate.OneOf(choices=[ReportScheduleType.REPORT.value]),
    )

    class Meta:
        exclude = (
            "recipients",
            "creation_method",
            "editors",
            "run_as",
            "run_alert_query_as",
            "run_as_type",
            "run_alert_query_as_type",
        )
        unknown = EXCLUDE


class ReportSchedulePutSchema(RetryFieldStripMixin, RunAsFieldStripMixin, Schema):
    type = fields.String(
        metadata={"description": type_description},
        required=False,
        validate=validate.OneOf(choices=tuple(key.value for key in ReportScheduleType)),
    )
    name = fields.String(
        metadata={"description": name_description},
        required=False,
        validate=[Length(1, 150)],
    )
    description = fields.String(
        metadata={
            "description": description_description,
            "example": "Daily sales dashboard to marketing",
        },
        allow_none=True,
        required=False,
    )
    email_subject = fields.String(
        metadata={
            "description": email_subject_description,
            "example": "[Report]  Report name: Dashboard or chart name",
        },
        allow_none=True,
        required=False,
    )
    context_markdown = fields.String(
        metadata={"description": context_markdown_description},
        allow_none=True,
        required=False,
    )
    active = fields.Boolean(required=False)
    crontab = fields.String(
        metadata={"description": crontab_description},
        validate=[validate_crontab, Length(1, 1000)],
        required=False,
    )
    timezone = fields.String(
        metadata={"description": timezone_description},
        dump_default="UTC",
        validate=validate.OneOf(choices=tuple(all_timezones)),
    )
    sql = fields.String(
        metadata={
            "description": sql_description,
            "example": "SELECT value FROM time_series_table",
        },
        required=False,
        allow_none=True,
    )
    chart = fields.Integer(required=False, allow_none=True)
    creation_method = fields.Enum(
        ReportCreationMethod,
        by_value=True,
        allow_none=True,
        metadata={"description": creation_method_description},
    )
    dashboard = fields.Integer(required=False, allow_none=True)
    database = fields.Integer(required=False, allow_none=True)
    editors = fields.List(
        fields.Integer(metadata={"description": editors_description}), required=False
    )
    run_as_type = fields.String(
        required=False,
        allow_none=True,
        validate=validate.OneOf(_REPORT_EXECUTOR_TYPES),
        metadata={"description": "Explicit executor type; fixed_user requires run_as."},
    )
    run_alert_query_as_type = fields.String(
        required=False,
        allow_none=True,
        validate=validate.OneOf(_REPORT_EXECUTOR_TYPES),
        metadata={"description": "Alert query executor type; null inherits run_as."},
    )
    run_as = fields.Integer(
        metadata={"description": run_as_description},
        required=False,
        allow_none=True,
    )
    run_alert_query_as = fields.Integer(
        metadata={"description": run_alert_query_as_description},
        required=False,
        allow_none=True,
    )
    validator_type = fields.String(
        metadata={"description": validator_type_description},
        validate=validate.OneOf(
            choices=tuple(key.value for key in ReportScheduleValidatorType)
        ),
        allow_none=True,
        required=False,
    )
    validator_config_json = fields.Nested(ValidatorConfigJSONSchema, required=False)
    log_retention = fields.Integer(
        metadata={"description": log_retention_description, "example": 90},
        required=False,
        validate=[Range(min=0, error=_("Value must be 0 or greater"))],
    )
    grace_period = fields.Integer(
        metadata={"description": grace_period_description, "example": 60 * 60 * 4},
        required=False,
        validate=[Range(min=1, error=_("Value must be greater than 0"))],
    )
    working_timeout = fields.Integer(
        metadata={"description": working_timeout_description, "example": 60 * 60 * 1},
        allow_none=True,
        required=False,
        validate=[Range(min=1, error=_("Value must be greater than 0"))],
    )
    recipients = fields.List(fields.Nested(ReportRecipientSchema), required=False)
    report_format = fields.String(
        metadata={
            "description": (
                "Attachment format. NONE disables attachments for alerts and makes "
                "chart/dashboard optional. Omitted attachment settings are "
                "preserved on update."
            )
        },
        dump_default=ReportDataFormat.PNG,
        validate=validate.OneOf(choices=tuple(key.value for key in ReportDataFormat)),
    )
    extra = fields.Dict(dump_default=None)
    force_screenshot = fields.Boolean(dump_default=False)
    include_cta = fields.Boolean(
        dump_default=True,
        allow_none=True,
        metadata={"description": include_cta_description},
    )

    custom_width = fields.Integer(
        metadata={
            "description": _("Custom width of the screenshot in pixels"),
            "example": 1000,
        },
        allow_none=True,
        required=False,
        dump_default=None,
    )
    retry_on_failure = fields.Boolean(
        metadata={"description": _("Enable automatic retries on report failure")},
        required=False,
    )
    retry_max_attempts = fields.Integer(
        metadata={
            "description": _("Maximum number of retry attempts (1–10)"),
            "example": 3,
        },
        required=False,
        validate=[Range(min=1, max=10, error=_("Must be between 1 and 10"))],
    )
    send_failed_reports = fields.Boolean(
        metadata={
            "description": _(
                "Send the failed report to all recipients after retries are exhausted"
            )
        },
        required=False,
    )
    retry_notify_owners = fields.Boolean(
        metadata={"description": _("Notify report owners on each retry attempt")},
        required=False,
    )
    retry_notify_recipients = fields.Boolean(
        metadata={"description": _("Notify report recipients on each retry attempt")},
        required=False,
    )

    @validates("custom_width")
    def validate_custom_width(
        self,
        value: Optional[int],
        **kwargs: Any,
    ) -> None:
        if value is None:
            return

        min_width = current_app.config["ALERT_REPORTS_MIN_CUSTOM_SCREENSHOT_WIDTH"]
        max_width = current_app.config["ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH"]
        if not min_width <= value <= max_width:
            raise ValidationError(
                _(
                    "Screenshot width must be between %(min)spx and %(max)spx",
                    min=min_width,
                    max=max_width,
                )
            )


def validate_email_domain(value: str) -> None:
    if not EMAIL_DOMAIN_REGEX.match(value.strip()):
        raise ValidationError(_("Invalid e-mail domain: %(domain)s", domain=value))


class ReportConfigurationSchema(Schema):
    """
    Global Alerts & Reports configuration (SIP-209).

    Every field is optional on update: absent fields keep their stored value and
    ``null`` clears a setting without restoring its legacy fallback.
    """

    alerts_attach_reports = fields.Boolean(
        metadata={
            "description": "Whether alerts deliver their attachment (screenshot, "
            "PDF, CSV or XLSX). When disabled, alerts only send the message and "
            "link. Falls back to the FF until a row has first been saved."
        },
        required=False,
        allow_none=True,
    )
    date_format_in_email_subject = fields.Boolean(
        metadata={
            "description": "Render strftime date placeholders in email subjects. "
            "Falls back to the DATE_FORMAT_IN_EMAIL_SUBJECT FF until first saved."
        },
        required=False,
        allow_none=True,
    )
    alert_minimum_interval = fields.Integer(
        metadata={
            "description": "Minimum interval between alert executions, in seconds. "
            "Values below 120 do not restrict schedules. Falls back to "
            "ALERT_MINIMUM_INTERVAL only before this setting has been saved.",
            "example": 3600,
        },
        required=False,
        allow_none=True,
        validate=[Range(min=0, error=lazy_gettext("Value must be 0 or greater"))],
    )
    report_minimum_interval = fields.Integer(
        metadata={
            "description": "Minimum interval between report executions, in seconds. "
            "Values below 120 do not restrict schedules. Falls back to "
            "REPORT_MINIMUM_INTERVAL only before this setting has been saved.",
            "example": 3600,
        },
        required=False,
        allow_none=True,
        validate=[Range(min=0, error=lazy_gettext("Value must be 0 or greater"))],
    )
    limit_recipients_to_users = fields.Boolean(
        metadata={
            "description": "When enabled, only e-mail addresses of existing active "
            "users are accepted as recipients."
        },
        required=False,
        allow_none=True,
    )
    allowed_email_domains = fields.List(
        fields.String(validate=validate_email_domain),
        metadata={
            "description": "E-mail domains accepted as recipients. An empty list "
            "allows any domain.",
            "example": ["example.com", "superset.com"],
        },
        required=False,
        allow_none=True,
    )

    @pre_load
    def normalize_domains(self, data: Any, **kwargs: Any) -> Any:
        if not isinstance(data, dict):
            return data
        domains = data.get("allowed_email_domains")
        if isinstance(domains, list):
            normalized: list[str] = []
            for domain in domains:
                if isinstance(domain, str):
                    domain = domain.strip().lower().lstrip("@")
                    if not domain or domain in normalized:
                        continue
                normalized.append(domain)
            data["allowed_email_domains"] = normalized
        return data


class ReportConfigImpactedSchema(Schema):
    """A schedule conflicting with a proposed Alerts & Reports configuration."""

    id = fields.Integer()
    name = fields.String()
    type = fields.String()
    reason = fields.String(
        metadata={"description": "Either 'recipient' or 'frequency'"},
    )
    detail = fields.String(
        metadata={"description": "The offending e-mail address or crontab"},
    )


class SlackChannelSchema(Schema):
    """
    Schema to load Slack channels, set to ignore any fields not used by Superset.
    """

    class Meta:
        unknown = EXCLUDE

    id = fields.String()
    name = fields.String()
    is_member = fields.Boolean()
    is_private = fields.Boolean()


class ReportScheduleExecuteResponseSchema(Schema):
    """Schema for the response when executing a report schedule immediately."""

    class Meta:
        unknown = EXCLUDE

    execution_id = fields.UUID(
        metadata={"description": _("UUID to track the execution status")}
    )
    message = fields.String(metadata={"description": _("Success message")})
