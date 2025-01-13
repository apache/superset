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
from typing import Any, Optional, Union

from croniter import croniter
from flask import current_app
from flask_babel import gettext as _
from marshmallow import fields, Schema, validate, validates, validates_schema
from marshmallow.validate import Length, Range, ValidationError
from pytz import all_timezones

from superset.reports.models import (
    ReportCreationMethod,
    ReportDataFormat,
    ReportRecipientType,
    ReportScheduleType,
    ReportScheduleValidatorType,
)

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

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}
get_slack_channels_schema = {
    "type": "object",
    "properties": {
        "search_string": {"type": "string"},
        "types": {
            "type": "array",
            "items": {"type": "string", "enum": ["public_channel", "private_channel"]},
        },
        "exact_match": {"type": "boolean"},
    },
}

type_description = "The report schedule type"
name_description = "The report schedule name."
# :)
description_description = "Use a nice description to give context to this Alert/Report"
email_subject_description = "The report schedule subject line"
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
owners_description = (
    "Owner are users ids allowed to delete or change this report. "
    "If left empty you will be one of the owners of the report."
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


def validate_crontab(value: Union[bytes, bytearray, str]) -> None:
    if not croniter.is_valid(str(value)):
        raise ValidationError("Cron expression is not valid")


class ValidatorConfigJSONSchema(Schema):
    op = fields.String(  # pylint: disable=invalid-name
        metadata={"description": validator_config_json_op_description},
        validate=validate.OneOf(choices=["<", "<=", ">", ">=", "==", "!="]),
    )
    threshold = fields.Float()


class ReportRecipientConfigJSONSchema(Schema):
    # TODO if email check validity
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


class ReportSchedulePostSchema(Schema):
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
    selected_tabs = fields.List(fields.Integer(), required=False, allow_none=True)
    database = fields.Integer(required=False)
    owners = fields.List(fields.Integer(metadata={"description": owners_description}))
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

    recipients = fields.List(fields.Nested(ReportRecipientSchema))
    report_format = fields.String(
        dump_default=ReportDataFormat.PNG,
        validate=validate.OneOf(choices=tuple(key.value for key in ReportDataFormat)),
    )
    extra = fields.Dict(
        dump_default=None,
    )
    force_screenshot = fields.Boolean(dump_default=False)
    custom_width = fields.Integer(
        metadata={
            "description": _("Custom width of the screenshot in pixels"),
            "example": 1000,
        },
        allow_none=True,
        required=False,
        default=None,
    )

    @validates("custom_width")
    def validate_custom_width(
        self,
        value: Optional[int],
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


class ReportSchedulePutSchema(Schema):
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
    database = fields.Integer(required=False)
    owners = fields.List(
        fields.Integer(metadata={"description": owners_description}), required=False
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
        dump_default=ReportDataFormat.PNG,
        validate=validate.OneOf(choices=tuple(key.value for key in ReportDataFormat)),
    )
    extra = fields.Dict(dump_default=None)
    force_screenshot = fields.Boolean(dump_default=False)

    custom_width = fields.Integer(
        metadata={
            "description": _("Custom width of the screenshot in pixels"),
            "example": 1000,
        },
        allow_none=True,
        required=False,
        default=None,
    )

    @validates("custom_width")
    def validate_custom_width(
        self,
        value: Optional[int],
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
