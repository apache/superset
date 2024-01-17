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


@patch("superset.reports.notifications.slack.g")
@patch("superset.reports.notifications.slack.logger")
def test_send_slack(
    logger_mock: MagicMock,
    flask_global_mock: MagicMock,
) -> None:
    # `superset.models.helpers`, a dependency of following imports,
    # requires app context
    from superset.reports.models import ReportRecipients, ReportRecipientType
    from superset.reports.notifications.base import NotificationContent
    from superset.reports.notifications.slack import SlackNotification, WebClient

    execution_id = uuid.uuid4()
    flask_global_mock.logs_context = {"execution_id": execution_id}
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
    with patch.object(
        WebClient, "chat_postMessage", return_value=True
    ) as chat_post_message_mock:
        SlackNotification(
            recipient=ReportRecipients(
                type=ReportRecipientType.SLACK,
                recipient_config_json='{"target": "some_channel"}',
            ),
            content=content,
        ).send()
        logger_mock.info.assert_called_with(
            "Report sent to slack", extra={"execution_id": execution_id}
        )
        chat_post_message_mock.assert_called_with(
            channel="some_channel",
            text="""*test alert*

<p>This is <a href="#">a test</a> alert</p><br />

<None|Explore in Superset>

```
|    |   A |   B | C                                        |
|---:|----:|----:|:-----------------------------------------|
|  0 |   1 |   4 | 111                                      |
|  1 |   2 |   5 | 222                                      |
|  2 |   3 |   6 | <a href="http://www.example.com">333</a> |
```
""",
        )
