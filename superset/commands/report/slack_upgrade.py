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
from collections.abc import Callable
from uuid import UUID

from flask import current_app as app

from superset.commands.exceptions import UpdateFailedError
from superset.reports.models import (
    ReportRecipients,
    ReportRecipientType,
    ReportSchedule,
)
from superset.reports.notifications.base import BaseNotification, NotificationContent
from superset.reports.notifications.exceptions import (
    NotificationParamException,
    SlackV1NotificationError,
)
from superset.reports.notifications.slack import (
    SLACK_V1_FILE_UPLOAD_MESSAGE,
    SlackNotification,
)
from superset.reports.notifications.slack_channel_resolver import (
    resolve_slack_channel_ids,
)
from superset.utils import json
from superset.utils.decorators import record_statsd_gauge_failure
from superset.utils.slack import (
    NO_SLACK_RECIPIENTS_MESSAGE,
    parse_slack_recipient_targets,
    SlackChannelListingClientError,
)

logger = logging.getLogger(__name__)


class SlackV1UpgradeCoordinator:
    """Coordinate one atomic Slack v1 upgrade and its per-recipient fallbacks."""

    def __init__(
        self,
        report_schedule: ReportSchedule,
        execution_id: UUID,
        execution_warnings: list[str],
    ) -> None:
        self._report_schedule = report_schedule
        self._execution_id = execution_id
        self._execution_warnings = execution_warnings
        self.reset()

    def reset(self) -> None:
        """Reset execution-scoped upgrade and fallback state."""
        self._upgrade_error: NotificationParamException | UpdateFailedError | None = (
            None
        )
        self._fallback_recorded = False

    def update_recipients(self) -> None:
        """Resolve and atomically convert every Slack v1 recipient to Slack v2."""
        pending: list[tuple[ReportRecipients, list[str]]] = []
        try:
            for recipient in self._report_schedule.recipients:
                if recipient.type != ReportRecipientType.SLACK:
                    continue
                try:
                    slack_recipients = json.loads(recipient.recipient_config_json)
                except (TypeError, ValueError) as ex:
                    raise NotificationParamException(
                        "Invalid Slack recipient configuration"
                    ) from ex
                target = (
                    slack_recipients.get("target")
                    if isinstance(slack_recipients, dict)
                    else None
                )
                if not isinstance(target, str):
                    raise NotificationParamException(NO_SLACK_RECIPIENTS_MESSAGE)
                channels = parse_slack_recipient_targets(target.replace("#", ""))
                if not channels:
                    raise NotificationParamException(NO_SLACK_RECIPIENTS_MESSAGE)
                pending.append((recipient, channels))

            all_targets = list(
                dict.fromkeys(
                    channel for _, channels in pending for channel in channels
                )
            )
            channel_ids = resolve_slack_channel_ids(all_targets) if all_targets else {}
            resolved = [
                (
                    recipient,
                    json.dumps(
                        {
                            "target": ",".join(
                                channel_ids[channel] for channel in channels
                            )
                        }
                    ),
                )
                for recipient, channels in pending
            ]
        except (NotificationParamException, SlackChannelListingClientError) as ex:
            message = f"Failed to update slack recipients to v2: {ex}"
            logger.warning(message)
            raise NotificationParamException(message) from ex
        except Exception as ex:
            message = f"Failed to update slack recipients to v2: {ex}"
            logger.exception(message)
            raise UpdateFailedError(message) from ex

        for recipient, recipient_config_json in resolved:
            recipient.type = ReportRecipientType.SLACKV2
            recipient.recipient_config_json = recipient_config_json

    def send_fallback(
        self,
        notification: SlackNotification,
        content: NotificationContent,
        update_error: NotificationParamException | UpdateFailedError,
    ) -> None:
        """Deliver text through Slack v1 and record the first successful fallback."""
        if content.has_attachments:
            record_statsd_gauge_failure("reports.slack.send", update_error)
            message = (
                f"{SLACK_V1_FILE_UPLOAD_MESSAGE} "
                f"Slack v2 upgrade failed: {update_error}"
            )
            if isinstance(update_error, UpdateFailedError):
                raise UpdateFailedError(message) from update_error
            raise NotificationParamException(message) from update_error

        notification.send_legacy_text()
        if self._fallback_recorded:
            return

        self._execution_warnings.append(
            "Slack v2 upgrade unavailable; delivered the text-only report "
            f"through deprecated Slack v1: {update_error}"
        )
        app.config["STATS_LOGGER"].incr("reports.slack.v1_fallback")
        if isinstance(update_error, UpdateFailedError):
            app.config["STATS_LOGGER"].incr("reports.slack.v1_fallback.system_error")
            logger.error(
                "Slack v2 upgrade failed with a system error; delivered the "
                "text-only report through Slack v1 for this execution: %s",
                update_error,
                extra={
                    "execution_id": self._execution_id,
                    "report_schedule_id": self._report_schedule.id,
                },
            )
        else:
            logger.warning(
                "Slack v2 upgrade unavailable; delivered the text-only report "
                "through Slack v1 for this execution: %s",
                update_error,
            )
        self._fallback_recorded = True

    def send(
        self,
        notification: SlackNotification,
        content: NotificationContent,
        *,
        update_recipients: Callable[[], None],
        create_upgraded_notification: Callable[[], BaseNotification],
    ) -> None:
        """Send one Slack v1 recipient, upgrading or falling back when required."""
        if self._upgrade_error is not None:
            self.send_fallback(notification, content, self._upgrade_error)
            return

        try:
            notification.send()
        except SlackV1NotificationError as ex:
            logger.info("Attempting to upgrade the report to Slackv2: %s", ex)
            try:
                update_recipients()
            except (
                NotificationParamException,
                UpdateFailedError,
            ) as update_error:
                self._upgrade_error = update_error
                self.send_fallback(notification, content, update_error)
            else:
                create_upgraded_notification().send()
