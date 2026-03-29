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

import pytest
from marshmallow import ValidationError
from pytest_mock import MockerFixture

from superset.reports.schemas import (
    ReportRecipientSchema,
    ReportSchedulePostSchema,
    ReportScheduleSubscribeSchema,
)


def test_report_post_schema_custom_width_validation(mocker: MockerFixture) -> None:
    """
    Test the custom width validation.
    """
    mocker.patch(
        "flask.current_app.config",
        {
            "ALERT_REPORTS_MIN_CUSTOM_SCREENSHOT_WIDTH": 100,
            "ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH": 200,
        },
    )

    schema = ReportSchedulePostSchema()

    schema.load(
        {
            "type": "Report",
            "name": "A report",
            "description": "My report",
            "active": True,
            "crontab": "* * * * *",
            "timezone": "America/Los_Angeles",
            "custom_width": 100,
        }
    )

    # not required
    schema.load(
        {
            "type": "Report",
            "name": "A report",
            "description": "My report",
            "active": True,
            "crontab": "* * * * *",
            "timezone": "America/Los_Angeles",
        }
    )

    with pytest.raises(ValidationError) as excinfo:
        schema.load(
            {
                "type": "Report",
                "name": "A report",
                "description": "My report",
                "active": True,
                "crontab": "* * * * *",
                "timezone": "America/Los_Angeles",
                "custom_width": 1000,
            }
        )
    assert excinfo.value.messages == {
        "custom_width": ["Screenshot width must be between 100px and 200px"]
    }


def test_report_recipient_schema_email_valid() -> None:
    schema = ReportRecipientSchema()
    result = schema.load(
        {
            "type": "Email",
            "recipient_config_json": {"target": "user@example.com"},
        }
    )
    assert result["recipient_config_json"]["target"] == "user@example.com"


def test_report_recipient_schema_email_invalid_target() -> None:
    schema = ReportRecipientSchema()
    with pytest.raises(ValidationError) as excinfo:
        schema.load(
            {
                "type": "Email",
                "recipient_config_json": {"target": "not-an-email"},
            }
        )
    assert "target" in excinfo.value.messages


def test_report_recipient_schema_email_invalid_cc() -> None:
    schema = ReportRecipientSchema()
    with pytest.raises(ValidationError) as excinfo:
        schema.load(
            {
                "type": "Email",
                "recipient_config_json": {
                    "target": "user@example.com",
                    "ccTarget": "bad-email",
                },
            }
        )
    assert "ccTarget" in excinfo.value.messages


def test_report_recipient_schema_email_invalid_bcc() -> None:
    schema = ReportRecipientSchema()
    with pytest.raises(ValidationError) as excinfo:
        schema.load(
            {
                "type": "Email",
                "recipient_config_json": {
                    "target": "user@example.com",
                    "bccTarget": "not-valid",
                },
            }
        )
    assert "bccTarget" in excinfo.value.messages


def test_report_recipient_schema_email_empty_bcc_allowed() -> None:
    schema = ReportRecipientSchema()
    result = schema.load(
        {
            "type": "Email",
            "recipient_config_json": {
                "target": "user@example.com",
                "bccTarget": "",
            },
        }
    )
    assert result["recipient_config_json"]["target"] == "user@example.com"


def test_report_recipient_schema_email_empty_cc_allowed() -> None:
    schema = ReportRecipientSchema()
    result = schema.load(
        {
            "type": "Email",
            "recipient_config_json": {
                "target": "user@example.com",
                "ccTarget": "",
            },
        }
    )
    assert result["recipient_config_json"]["target"] == "user@example.com"


def test_report_recipient_schema_slack_skips_email_validation() -> None:
    schema = ReportRecipientSchema()
    result = schema.load(
        {
            "type": "Slack",
            "recipient_config_json": {"target": "#general"},
        }
    )
    assert result["recipient_config_json"]["target"] == "#general"


def test_subscribe_schema_ignores_excluded_fields(mocker: MockerFixture) -> None:
    """Excluded fields sent by the client are silently dropped, not rejected."""
    mocker.patch(
        "flask.current_app.config",
        {
            "ALERT_REPORTS_MIN_CUSTOM_SCREENSHOT_WIDTH": 100,
            "ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH": 2000,
        },
    )
    schema = ReportScheduleSubscribeSchema()
    result = schema.load(
        {
            "type": "Report",
            "name": "My subscription",
            "crontab": "0 9 * * *",
            "timezone": "UTC",
            "chart": 1,
            # These are excluded server-side — should be silently dropped
            "recipients": [
                {"type": "Email", "recipient_config_json": {"target": "x@y.com"}}
            ],
            "creation_method": "alerts_reports",
        }
    )
    assert "recipients" not in result
    assert "creation_method" not in result
