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

from superset.reports.schemas import ReportSchedulePostSchema, ReportSchedulePutSchema


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


MINIMAL_POST_PAYLOAD = {
    "type": "Report",
    "name": "A report",
    "crontab": "* * * * *",
    "timezone": "America/Los_Angeles",
}

CUSTOM_WIDTH_CONFIG = {
    "ALERT_REPORTS_MIN_CUSTOM_SCREENSHOT_WIDTH": 600,
    "ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH": 2400,
}


@pytest.mark.parametrize(
    "schema_class,payload_base",
    [
        (ReportSchedulePostSchema, MINIMAL_POST_PAYLOAD),
        (ReportSchedulePutSchema, {}),
    ],
    ids=["post", "put"],
)
@pytest.mark.parametrize(
    "width,should_pass",
    [
        (599, False),
        (600, True),
        (2400, True),
        (2401, False),
        (None, True),
    ],
)
def test_custom_width_boundary_values(
    mocker: MockerFixture,
    schema_class: type,
    payload_base: dict[str, object],
    width: int | None,
    should_pass: bool,
) -> None:
    mocker.patch("flask.current_app.config", CUSTOM_WIDTH_CONFIG)
    schema = schema_class()
    payload = {**payload_base, "custom_width": width}

    if should_pass:
        schema.load(payload)
    else:
        with pytest.raises(ValidationError) as exc:
            schema.load(payload)
        assert "custom_width" in exc.value.messages


def test_working_timeout_validation(mocker: MockerFixture) -> None:
    mocker.patch("flask.current_app.config", CUSTOM_WIDTH_CONFIG)
    post_schema = ReportSchedulePostSchema()
    put_schema = ReportSchedulePutSchema()

    # POST: working_timeout=0 and -1 are invalid (min=1)
    with pytest.raises(ValidationError) as exc:
        post_schema.load({**MINIMAL_POST_PAYLOAD, "working_timeout": 0})
    assert "working_timeout" in exc.value.messages

    with pytest.raises(ValidationError) as exc:
        post_schema.load({**MINIMAL_POST_PAYLOAD, "working_timeout": -1})
    assert "working_timeout" in exc.value.messages

    # POST: working_timeout=1 is valid
    post_schema.load({**MINIMAL_POST_PAYLOAD, "working_timeout": 1})

    # PUT: working_timeout=None is valid (allow_none=True)
    put_schema.load({"working_timeout": None})


def test_log_retention_post_vs_put_parity(mocker: MockerFixture) -> None:
    mocker.patch("flask.current_app.config", CUSTOM_WIDTH_CONFIG)
    post_schema = ReportSchedulePostSchema()
    put_schema = ReportSchedulePutSchema()

    # POST: log_retention=0 is invalid (min=1)
    with pytest.raises(ValidationError) as exc:
        post_schema.load({**MINIMAL_POST_PAYLOAD, "log_retention": 0})
    assert "log_retention" in exc.value.messages

    # POST: log_retention=1 is valid
    post_schema.load({**MINIMAL_POST_PAYLOAD, "log_retention": 1})

    # PUT: log_retention=0 is valid (min=0)
    put_schema.load({"log_retention": 0})


def test_report_type_disallows_database(mocker: MockerFixture) -> None:
    mocker.patch("flask.current_app.config", CUSTOM_WIDTH_CONFIG)
    schema = ReportSchedulePostSchema()

    with pytest.raises(ValidationError) as exc:
        schema.load({**MINIMAL_POST_PAYLOAD, "database": 1})
    assert "database" in exc.value.messages


def test_alert_type_allows_database(mocker: MockerFixture) -> None:
    """Alert type should accept database; only Report type blocks it."""
    mocker.patch("flask.current_app.config", CUSTOM_WIDTH_CONFIG)
    schema = ReportSchedulePostSchema()
    result = schema.load({**MINIMAL_POST_PAYLOAD, "type": "Alert", "database": 1})
    assert result["database"] == 1
