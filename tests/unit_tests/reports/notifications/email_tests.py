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
from datetime import datetime

import pandas as pd
from pytz import timezone

from tests.unit_tests.conftest import with_feature_flags


def test_render_description_with_html() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    content = NotificationContent(
        name="test alert",
        embedded_data=pd.DataFrame(
            {
                "A": [1, 2, 3],
                "B": [4, 5, 6],
                "C": ["111", "222", '<a href="http://www.example.com">333</a>'],
            }
        ),
        description='<p>This is <a href="#">a test</a> alert</p><br />',
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "owners": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
        },
    )
    email_body = (
        EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
        )
        ._get_content()
        .body
    )
    assert (
        '<p>This is <a href="#" rel="noopener noreferrer">a test</a> alert</p><br>'
        in email_body
    )
    assert '<td>&lt;a href="http://www.example.com"&gt;333&lt;/a&gt;</td>' in email_body


@with_feature_flags(DATE_FORMAT_IN_EMAIL_SUBJECT=True)
def test_email_subject_with_datetime() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    now = datetime.now(timezone("UTC"))

    datetime_pattern = "%Y-%m-%d"

    content = NotificationContent(
        name=f"test alert {datetime_pattern}",
        embedded_data=pd.DataFrame(
            {
                "A": [1, 2, 3],
            }
        ),
        description='<p>This is <a href="#">a test</a> alert</p><br />',
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "owners": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
        },
    )
    subject = EmailNotification(
        recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
    )._get_subject()
    assert datetime_pattern not in subject
    assert now.strftime(datetime_pattern) in subject


def test_error_email_with_screenshot() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    # Create mock screenshot data
    screenshot_data = [b"fake_screenshot_data_1", b"fake_screenshot_data_2"]

    content = NotificationContent(
        name="test alert",
        text="Error occurred while generating report",
        url="http://localhost:8088/superset/dashboard/1",
        screenshots=screenshot_data,
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "owners": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
        },
    )
    email_content = EmailNotification(
        recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
    )._get_content()

    # Check that error message is in the body
    assert "Error occurred while generating report" in email_content.body
    assert "unable to be generated" in email_content.body

    # Check that images are included
    assert email_content.images is not None
    assert len(email_content.images) == 2

    # Check that image tags are in the body
    assert '<img width="1000" src="cid:' in email_content.body
    assert 'class="image"' in email_content.body


def test_error_email_without_screenshot() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    content = NotificationContent(
        name="test alert",
        text="Error occurred while generating report",
        url="http://localhost:8088/superset/dashboard/1",
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "owners": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
        },
    )
    email_content = EmailNotification(
        recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
    )._get_content()

    # Check that error message is in the body
    assert "Error occurred while generating report" in email_content.body
    assert "unable to be generated" in email_content.body

    # Check that no images are included
    assert email_content.images == {}

    # Check that no image tags are in the body
    assert "<img" not in email_content.body
