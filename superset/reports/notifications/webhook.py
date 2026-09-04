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
from typing import Any
from urllib.parse import urlparse

import backoff
import requests
from flask import current_app

from superset import feature_flag_manager
from superset.reports.models import ReportRecipientType
from superset.reports.notifications.base import BaseNotification
from superset.reports.notifications.exceptions import (
    NotificationParamException,
    NotificationUnprocessableException,
)
from superset.utils import json
from superset.utils.decorators import statsd_gauge

logger = logging.getLogger(__name__)


class WebhookNotification(BaseNotification):
    """
    Sends a post request to a webhook url
    """

    type = ReportRecipientType.WEBHOOK

    def _get_webhook_url(self) -> str:
        """
        Get the webhook URL from the recipient configuration
        :returns: The webhook URL
        :raises NotificationParamException: If the webhook URL is not provided in the recipient configuration
        """  # noqa: E501
        try:
            cfg = json.loads(self._recipient.recipient_config_json)
            target = cfg.get("target") if isinstance(cfg, dict) else None
            if not target:
                raise NotificationParamException("Webhook URL is required")
            return target
        except (json.JSONDecodeError, KeyError, TypeError) as ex:
            raise NotificationParamException("Webhook URL is required") from ex

    def _get_req_payload(self) -> dict[str, Any]:
        header_content = {
            "notification_format": self._content.header_data.get("notification_format"),
            "notification_type": self._content.header_data.get("notification_type"),
            "notification_source": self._content.header_data.get("notification_source"),
            "chart_id": self._content.header_data.get("chart_id"),
            "dashboard_id": self._content.header_data.get("dashboard_id"),
        }
        content = {
            "name": self._content.name,
            "header": header_content,
            "text": self._content.text,
            "description": self._content.description,
            "url": self._content.url,
        }
        return content

    def _get_files(self) -> list[tuple[str, tuple[str, bytes, str]]]:
        files = []
        if self._content.csv:
            files.append(("files", ("report.csv", self._content.csv, "text/csv")))
        if self._content.pdf:
            files.append(
                ("files", ("report.pdf", self._content.pdf, "application/pdf"))
            )
        if self._content.screenshots:
            for i, screenshot in enumerate(self._content.screenshots):
                files.append(
                    (
                        "files",
                        (f"screenshot_{i}.png", screenshot, "image/png"),
                    )
                )
        return files

    @backoff.on_exception(
        backoff.expo, NotificationUnprocessableException, factor=10, base=2, max_tries=5
    )
    @statsd_gauge("reports.webhook.send")
    def send(self) -> None:
        if not feature_flag_manager.is_feature_enabled("ALERT_REPORT_WEBHOOK"):
            raise NotificationUnprocessableException(
                "Attempted to send a Webhook notification but Webhook feature flag \
                is not enabled."
            )
        wh_url = self._get_webhook_url()
        if current_app.config["ALERT_REPORTS_WEBHOOK_HTTPS_ONLY"]:
            if urlparse(wh_url).scheme.lower() != "https":
                raise NotificationParamException(
                    "Webhook failed: HTTPS is required by config for webhook URLs."
                )
        payload = self._get_req_payload()
        files = self._get_files()

        try:
            if files:
                data = {}
                for key, value in payload.items():
                    if isinstance(value, (dict, list)):
                        data[key] = json.dumps(value)
                    else:
                        data[key] = value

                response = requests.post(wh_url, data=data, files=files, timeout=60)
            else:
                response = requests.post(wh_url, json=payload, timeout=60)

            logger.info(
                "Webhook sent to %s, status code: %s", wh_url, response.status_code
            )

            if response.status_code >= 500 or response.status_code == 429:
                raise NotificationUnprocessableException(
                    f"Webhook failed with status code {response.status_code}: \
                     {response.text}"
                )
            if response.status_code >= 400:
                raise NotificationParamException(
                    f"Webhook failed with status code {response.status_code}: \
                    {response.text}"
                )

        except requests.exceptions.RequestException as ex:
            raise NotificationUnprocessableException(str(ex)) from ex
