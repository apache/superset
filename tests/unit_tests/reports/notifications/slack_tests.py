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
from unittest.mock import Mock

import pandas as pd


def test_get_channel_with_multi_recipients() -> None:
    """
    Test the _get_channel function to ensure it will return a string
    with recipients separated by commas without interstitial spacing
    """
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.slack import SlackNotification

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
    slack_notification = SlackNotification(
        recipient=ReportRecipients(
            type=ReportRecipientType.SLACK,
            recipient_config_json='{"target": "some_channel; second_channel, third_channel"}',
        ),
        content=content,
    )

    client = Mock()
    client.conversations_list.return_value = {
        "channels": [
            {"name": "some_channel", "id": "23SDKE"},
            {"name": "second_channel", "id": "WD3D8KE"},
            {"name": "third_channel", "id": "223DFKE"},
        ]
    }

    result = slack_notification._get_channels(client)

    assert result == ["23SDKE", "WD3D8KE", "223DFKE"]
