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
import uuid
from unittest.mock import MagicMock, patch, PropertyMock

import pandas as pd
from flask import g


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


@patch("superset.reports.notifications.email.send_email_smtp")
@patch("superset.reports.notifications.email.logger")
def test_send_email(
    logger_mock: MagicMock,
    send_email_mock: MagicMock,
) -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.email import EmailNotification

    execution_id = uuid.uuid4()
    g.context = {"execution_id": execution_id}
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
    )
    EmailNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.EMAIL,
            recipient_config_json='{"target": "foo@bar.com"}',
        ),
        content=content,
    ).send()

    logger_mock.info.assert_called_with(
        "Report sent to email",
        extra={
            "execution_id": execution_id,
            "chart_id": None,
            "dashboard_id": None,
        },
    )
    # clear logger_mock and g.context
    logger_mock.reset_mock()
    g.context = None

    # test with no execution_id
    EmailNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.EMAIL,
            recipient_config_json='{"target": "foo@bar.com"}',
        ),
        content=content,
    ).send()
    logger_mock.info.assert_called_with(
        "Report sent to email",
        extra={
            "execution_id": None,
            "chart_id": None,
            "dashboard_id": None,
        },
    )
