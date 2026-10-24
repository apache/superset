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
"""Attachment-free alert delivery to configured Teams standard channels."""

from typing import Any
from urllib.parse import urlsplit

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from superset.extensions import db
from superset.integrations.teams.config import (
    TeamsConfig,
    TeamsDestination,
)
from superset.integrations.teams.store import TeamsInstallationStore
from superset.integrations.teams.validation import (
    TeamsRecipientValidationError,
    validate_teams_recipient,
)
from superset.reports.models import ReportRecipientType
from superset.reports.notifications.base import BaseNotification, NotificationContent
from superset.reports.notifications.exceptions import (
    NotificationAuthorizationException,
    NotificationError,
    NotificationParamException,
    NotificationTransientError,
)


def build_teams_card(content: NotificationContent) -> dict[str, Any]:
    """Build a card using structured data, omitting raw execution diagnostics."""
    body: list[dict[str, Any]] = [
        {
            "type": "TextBlock",
            "text": content.name,
            "weight": "Bolder",
            "size": "Medium",
            "wrap": True,
        },
    ]
    if content.description:
        body.append({"type": "TextBlock", "text": content.description, "wrap": True})
    if content.text:
        body.append(
            {
                "type": "TextBlock",
                "text": "Alert execution failed. Contact the alert owner for details.",
                "wrap": True,
            }
        )
    card: dict[str, Any] = {
        "$schema": "https://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.2",
        "body": body,
    }
    if content.include_cta and content.url:
        try:
            url = urlsplit(content.url)
            safe_link = url.scheme in {"http", "https"} and bool(url.hostname)
        except ValueError:
            safe_link = False
        if safe_link:
            card["actions"] = [
                {
                    "type": "Action.OpenUrl",
                    "title": "Open in Superset",
                    "url": content.url,
                }
            ]
    return card


def _send_to_teams(
    config: TeamsConfig,
    destination: TeamsDestination,
    service_url: str,
    card: dict[str, Any],
    *,
    retry_deadline: float | None = None,
) -> None:
    """Load the optional SDK only for delivery and map sanitized transport errors."""
    try:
        from superset.integrations.teams.adapter import (
            deliver_teams_alert,
            TeamsDeliveryError,
        )
    except ImportError:
        raise NotificationParamException("Teams SDK is not installed") from None
    try:
        deliver_teams_alert(
            config, destination, service_url, card, retry_deadline=retry_deadline
        )
    except TeamsDeliveryError as ex:
        exception = {
            "authorization": NotificationAuthorizationException,
            "transient": NotificationTransientError,
            "parameter": NotificationParamException,
        }[ex.category]
        raise exception(str(ex)) from None


class TeamsNotification(BaseNotification):
    """Resolve the configured destination and its active installation before send."""

    type = ReportRecipientType.TEAMS

    def send(self) -> None:
        """Send an alert as a new root post, without attachments or SQL diagnostics."""
        try:
            config, destination = validate_teams_recipient(
                self._recipient.recipient_config_json,
                self._content.header_data.get("notification_type"),
                self._content.header_data.get("notification_format"),
            )
        except TeamsRecipientValidationError as ex:
            raise NotificationParamException(str(ex)) from None
        if self._content.is_editor_error:
            raise NotificationParamException("Teams supports alert notifications only")
        if self._content.has_attachments or self._content.embedded_data is not None:
            raise NotificationParamException("Teams alerts do not support attachments")
        try:
            with Session(db.engine) as session:
                installation = TeamsInstallationStore(session).get_active(
                    config.tenant_id,
                    config.application_id,
                    destination.team_id,
                )
                if installation is None:
                    raise NotificationAuthorizationException(
                        "No active Teams bot installation for this destination"
                    )
                service_url = installation.service_url
        except SQLAlchemyError:
            raise NotificationError(
                "Unable to resolve Teams bot installation"
            ) from None
        _send_to_teams(
            config,
            destination,
            service_url,
            build_teams_card(self._content),
            retry_deadline=self._content.delivery_deadline,
        )
