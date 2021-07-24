# -*- coding: utf-8 -*-
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
from superset.models.reports import ReportRecipients
from superset.reports.notifications.base import BaseNotification, NotificationContent
from superset.reports.notifications.email import EmailNotification
from superset.reports.notifications.slack import SlackNotification


def create_notification(
    recipient: ReportRecipients, notification_content: NotificationContent
) -> BaseNotification:
    """
    Notification polymorphic factory
    Returns the Notification class for the recipient type
    """
    for plugin in BaseNotification.plugins:
        if plugin.type == recipient.type:
            return plugin(recipient, notification_content)
    raise Exception("Recipient type not supported")
