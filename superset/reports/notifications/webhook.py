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

import logging
import textwrap
from dataclasses import dataclass
from datetime import datetime
from email.utils import make_msgid, parseaddr
from typing import Any, Optional

import nh3
from flask import current_app
from flask_babel import gettext as __
from pytz import timezone
import requests

from superset import is_feature_enabled
from superset.exceptions import SupersetErrorsException
from superset.reports.models import ReportRecipientType
from superset.reports.notifications.base import BaseNotification
from superset.reports.notifications.exceptions import NotificationError
from superset.utils import json
from superset.utils.core import HeaderDataType, send_email_smtp
from superset.utils.decorators import statsd_gauge

class WebhookNotification(BaseNotification):
    """
    Sends a post request to a webhook url
    """

    type = ReportRecipientType.WEBHOOK

    def _get_webhook_url(self):
        return json.loads(self._recipient.recipient_config_json)["target"]

    def _get_req_payload(self):
        print("Header data: ", self._content.header_data)
        header_content = {
            "notification_format": self._content.header_data.get("nofitication_format"),
            "notification_type": self._content.header_data.get("notification_type"),
            "notification_source": self._content.header_data.get("notification_source"),
            "chart_id": self._content.header_data.get("chart_id"),
            "dashboard_id": self._content.header_data.get("dashboard_id"),
        }
        content = {
            "name": self._content.name,
            "header": header_content,
            "text": self._content.text,
            "description:": self._content.description,
            "url": self._content.url,
        }
        return content

    @statsd_gauge("reports.webhook.send")
    def send(self) -> None:
        wh_url = self._get_webhook_url()
        payload = self._get_req_payload()
    
        requests.post(
            url=wh_url,
            json=payload
        )
        pass