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
from unittest.mock import patch

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
            "execution_id": "test-execution-id",
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
            "execution_id": "test-execution-id",
        },
    )
    subject = EmailNotification(
        recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
    )._get_subject()
    assert datetime_pattern not in subject
    assert now.strftime(datetime_pattern) in subject


@with_feature_flags(DATE_FORMAT_IN_EMAIL_SUBJECT=True)
def test_email_subject_datetime_evaluated_per_send() -> None:
    """
    Regression test for #35908: two notifications constructed at different
    times must carry their own send timestamp, not a value frozen to the
    time the notification class was first imported.
    """
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    def make_content() -> NotificationContent:
        return NotificationContent(
            name="report %Y-%m-%d %H:%M",
            embedded_data=pd.DataFrame({"A": [1]}),
            description="",
            header_data={
                "notification_format": "PNG",
                "notification_type": "Alert",
                "owners": [1],
                "notification_source": None,
                "chart_id": None,
                "dashboard_id": None,
                "slack_channels": None,
                "execution_id": "test-execution-id",
            },
        )

    first_send = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone("UTC"))
    second_send = datetime(2026, 1, 1, 11, 0, 0, tzinfo=timezone("UTC"))

    with patch("superset.reports.notifications.email.datetime") as mock_datetime:
        mock_datetime.now.return_value = first_send
        first_subject = EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL),
            content=make_content(),
        )._get_subject()

        mock_datetime.now.return_value = second_send
        second_subject = EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL),
            content=make_content(),
        )._get_subject()

    assert "2026-01-01 10:00" in first_subject
    assert "2026-01-01 11:00" in second_subject
    assert first_subject != second_subject


@with_feature_flags(DATE_FORMAT_IN_EMAIL_SUBJECT=True)
def test_email_subject_datetime_consistent_within_single_send() -> None:
    """
    Regression test for the codeant-ai review on #40285: within a single
    notification instance, `_name` is read multiple times (subject + CSV/PDF
    attachment filenames). All reads must return the same timestamp so the
    subject and attachment names don't disagree if execution crosses a
    second/minute boundary.
    """
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    content = NotificationContent(
        name="report %Y-%m-%d %H:%M:%S",
        embedded_data=pd.DataFrame({"A": [1]}),
        description="",
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "owners": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
            "slack_channels": None,
            "execution_id": "test-execution-id",
        },
    )

    notification = EmailNotification(
        recipient=ReportRecipients(type=ReportRecipientType.EMAIL), content=content
    )

    construct_time = datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone("UTC"))
    much_later = datetime(2026, 1, 1, 23, 59, 59, tzinfo=timezone("UTC"))

    with patch("superset.reports.notifications.email.datetime") as mock_datetime:
        mock_datetime.now.return_value = construct_time
        first_read = notification._name

        # Simulate execution crossing a boundary before the next _name read.
        mock_datetime.now.return_value = much_later
        second_read = notification._name

    # Both reads must return the construct-time value — _send_time is cached
    # on the instance so subject and attachment names stay aligned.
    assert first_read == second_read
    assert "2026-01-01 10:00:00" in first_read
