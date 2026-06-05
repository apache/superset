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
from freezegun import freeze_time
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


def test_error_template_sanitizes_html() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    content = NotificationContent(
        name="test alert",
        text='DB error near "<img src=x onerror=alert(1)><script>alert(2)</script>"',
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

    # Injected markup in the error text must be stripped, not rendered.
    assert "<img" not in email_body
    assert "<script>" not in email_body
    assert "onerror=alert(1)" not in email_body


@with_feature_flags(DATE_FORMAT_IN_EMAIL_SUBJECT=True)
def test_email_subject_with_datetime() -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

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
    # Freeze the clock to a fixed, distinctive instant and construct the
    # notification *under* the freeze. The subject date must reflect this
    # frozen moment, which is only possible if the timestamp is stamped per
    # instance at construction/send time. If the timestamp were a class
    # attribute evaluated at import time (the regression this fixes), it would
    # carry the real import-time date instead and this assertion would fail.
    frozen_now = datetime(2021, 4, 22, 12, 0, 0, tzinfo=timezone("UTC"))
    with freeze_time(frozen_now):
        notification = EmailNotification(
            recipient=ReportRecipients(type=ReportRecipientType.EMAIL),
            content=content,
        )
        subject = notification._get_subject()
    assert datetime_pattern not in subject
    assert frozen_now.strftime(datetime_pattern) in subject
