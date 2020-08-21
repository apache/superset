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
from typing import Dict, Optional, Union

from croniter import croniter
from flask_appbuilder import CompactCRUDMixin
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _
from wtforms import BooleanField, Form, StringField

from superset.constants import RouteMethod
from superset.models.alerts import Alert, AlertLog
from superset.models.schedules import ScheduleType
from superset.tasks.schedules import schedule_alert_query
from superset.utils.core import get_email_address_str, markdown

from ..exceptions import SupersetException
from .base import SupersetModelView

# TODO: access control rules for this module


class AlertLogModelView(
    CompactCRUDMixin, SupersetModelView
):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(AlertLog)
    include_route_methods = {RouteMethod.LIST} | {"show"}
    list_columns = (
        "scheduled_dttm",
        "dttm_start",
        "duration",
        "state",
    )


class AlertModelView(SupersetModelView):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(Alert)
    route_base = "/alert"
    include_route_methods = RouteMethod.CRUD_SET
    _extra_data: Dict[str, Union[bool, Optional[str]]] = {
        "test_alert": False,
        "test_email_recipients": None,
    }

    list_columns = (
        "label",
        "database",
        "crontab",
        "last_eval_dttm",
        "last_state",
        "active",
    )
    add_columns = (
        "label",
        "active",
        "crontab",
        "database",
        "sql",
        # TODO: implement different types of alerts
        # "alert_type",
        "owners",
        "recipients",
        "slack_channel",
        "slice",
        # TODO: implement dashboard screenshots with alerts
        # "dashboard",
        "log_retention",
        "grace_period",
        "test_alert",
        "test_email_recipients",
        "test_slack_channel",
    )
    label_columns = {
        "sql": "SQL",
        "log_retention": _("Log Retentions (days)"),
    }
    description_columns = {
        "sql": _(
            "A SQL statement that defines whether the alert should get "
            "triggered or not. If the statement return no row, the alert "
            "is not triggered. If the statement returns one or many rows, "
            "the cells will be evaluated to see if they are 'truthy' "
            "if any cell is truthy, the alert will fire. Truthy values "
            "are non zero, non null, non empty strings."
        ),
        "crontab": markdown(
            "A CRON-like expression. "
            "[Crontab Guru](https://crontab.guru/) is "
            "a helpful resource that can help you craft a CRON expression.",
            True,
        ),
        "recipients": _("A semicolon ';' delimited list of email addresses"),
        "log_retention": _("How long to keep the logs around for this alert"),
        "grace_period": _(
            "Once an alert is triggered, how long, in seconds, before "
            "Superset nags you again."
        ),
    }

    add_form_extra_fields = {
        "test_alert": BooleanField(
            "Send Test Alert",
            default=False,
            description="If enabled, a test alert will be sent on the creation / update"
            " of an active alert. All alerts after will be sent only if the SQL "
            "statement defined above returns True.",
        ),
        "test_email_recipients": StringField(
            "Test Email Recipients",
            default=None,
            description="List of recipients to send test email to. "
            "If empty, an email will be sent to the original recipients.",
        ),
        "test_slack_channel": StringField(
            "Test Slack Channel",
            default=None,
            description="A slack channel to send a test message to. "
            "If empty, an alert will be sent to the original channel.",
        ),
    }
    edit_form_extra_fields = add_form_extra_fields
    edit_columns = add_columns
    related_views = [AlertLogModelView]

    def process_form(self, form: Form, is_created: bool) -> None:
        email_recipients = None
        if form.test_email_recipients.data:
            email_recipients = get_email_address_str(form.test_email_recipients.data)

        test_slack_channel = (
            form.test_slack_channel.data.strip()
            if form.test_slack_channel.data
            else None
        )

        self._extra_data["test_alert"] = form.test_alert.data
        self._extra_data["test_email_recipients"] = email_recipients
        self._extra_data["test_slack_channel"] = test_slack_channel

    def pre_add(self, item: "AlertModelView") -> None:
        item.recipients = get_email_address_str(item.recipients)

        if not croniter.is_valid(item.crontab):
            raise SupersetException("Invalid crontab format")

    def post_add(self, item: "AlertModelView") -> None:
        if self._extra_data["test_alert"]:
            recipients = self._extra_data["test_email_recipients"] or item.recipients
            slack_channel = self._extra_data["test_slack_channel"] or item.slack_channel
            args = (ScheduleType.alert, item.id)
            kwargs = dict(recipients=recipients, slack_channel=slack_channel)
            schedule_alert_query.apply_async(args=args, kwargs=kwargs)

    def post_update(self, item: "AlertModelView") -> None:
        self.post_add(item)
