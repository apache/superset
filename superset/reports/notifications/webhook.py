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

import requests
import logging
import json
import hmac
from typing import Dict, Optional

from superset.reports.models import ReportRecipientType
from superset.reports.notifications.base import BaseNotification
from superset.reports.notifications.exceptions import NotificationError
from superset.utils.decorators import statsd_gauge

from superset import app

logger = logging.getLogger(__name__)


class WebhookNotification(BaseNotification):
    """
    Sends webhook notification to client host.
    """

    type = ReportRecipientType.WEBHOOK

    @staticmethod
    def _get_secret_token() -> str:
        """
        Retrieves the secret token for HMAC signature from the application configuration.
        """
        with app.app_context():
            return app.config.get("WEBHOOK_SECRET")

    def _get_host(self) -> str:
        """
        Retrieves the target host from the recipient configuration.
        """
        return json.loads(self._recipient.recipient_config_json)["target"]

    def _generate_signature(self, data: dict) -> str:
        """
        Generates an HMAC SHA256 signature for the given data.
        """
        secret = self._get_secret_token()
        if secret:
            return hmac.new(
                secret.encode("utf-8"),
                json.dumps(data).encode("utf-8"),
                digestmod="sha256",
            ).hexdigest()

    def _get_header(self, data: dict) -> Dict[str, str]:
        """
        Constructs the header with the generated HMAC signature.
        """
        signature = self._generate_signature(data)
        return {
            "X-Webhook-Signature": signature,
        }

    def _get_files(self) -> Optional[Dict[str, bytes]]:
        """
        Retrieves the files to be sent with the notification.
        """
        if self._content.csv:
            return {"csv": self._content.csv}
        elif self._content.pdf:
            return {"pdf": self._content.pdf}
        elif self._content.screenshots:
            return {
                "png_%s" % index: file
                for index, file in enumerate(self._content.screenshots)
            }
        return None

    def _construct_payload(self) -> Dict[str, str]:
        """
        Constructs the payload for the webhook notification.
        """
        content_name, content_id = self._content.name.split(":")
        return {
            "name": content_name,
            "id": content_id.strip(),
            "content_type": self._content.header_data.get("notification_source"),
            "content_id": (
                self._content.header_data.get("chart_id")
                if self._content.header_data.get("chart_id")
                else self._content.header_data.get("dashboard_id")
            ),
            "content_format": self._content.header_data.get("notification_format"),
        }

    @statsd_gauge("reports.webhook.send")
    def send(self) -> None:
        """
        Sends the webhook notification to the configured host.
        """
        host = self._get_host()
        payload = self._construct_payload()
        headers = self._get_header(payload)
        files = self._get_files()

        try:
            response = requests.post(
                url=host,
                data={"json": json.dumps(payload)},
                files=files,
                headers=headers,
                timeout=10,
            )
            response.raise_for_status()
            logger.info(f"Report webhook has been successfully sent to {host}")

        except requests.RequestException as e:
            raise NotificationError(str(e)) from e
