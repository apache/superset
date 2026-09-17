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

from superset.reports.schemas import ReportSchedulePostSchema


def test_report_post_schema_custom_width_validation(mocker: MockerFixture) -> None:
    """
    Test the custom width validation.
    """
    current_app = mocker.patch("superset.reports.schemas.current_app")
    current_app.config = {
        "ALERT_REPORTS_MIN_CUSTOM_SCREENSHOT_WIDTH": 100,
        "ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH": 200,
    }

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
