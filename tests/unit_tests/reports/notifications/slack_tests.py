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
from unittest.mock import MagicMock, patch

import pandas as pd
from flask import g


@patch("superset.reports.notifications.slack.logger")
def test_get_channel_with_multi_recipients(
    logger_mock: MagicMock,
) -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.slack import SlackNotification, WebClient

    execution_id = uuid.uuid4()
    g.context = {"execution_id": execution_id}
    content = NotificationContent(
        name="test alert",
        header_data={
            "notification_format": "PNG",
            "notification_type": "Alert",
            "owners": [1],
            "notification_source": None,
            "chart_id": None,
            "dashboard_id": None,
        },
        embedded_data=pd.DataFrame(
            {
                "A": [1, 2, 3],
                "B": [4, 5, 6],
                "C": ["111", "222", '<a href="http://www.example.com">333</a>'],
            }
        ),
        description='<p>This is <a href="#">a test</a> alert</p><br />',
    )
    # Set a return value for _get_channel
    with patch.object(
        SlackNotification,
        "_get_channel",
        return_value="some_channel,second_channel,third_channel",
    ) as get_channel_mock:
        slack_notification = SlackNotification(
            recipient=ReportRecipients(
                type=ReportRecipientType.SLACK,
                recipient_config_json='{"target": "some_channel; second_channel, third_channel"}',
            ),
            content=content,
        )

        result = slack_notification._get_channel()

        assert result == "some_channel,second_channel,third_channel"

        # Ensure _get_channel was called
        get_channel_mock.assert_called_once()

        # Ensure other methods were not called
        logger_mock.info.assert_not_called()

    # reset g.context
    g.context = None
