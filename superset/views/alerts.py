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
from croniter import croniter
from flask_appbuilder import CompactCRUDMixin
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_babel import lazy_gettext as _

from superset.constants import RouteMethod
from superset.models.alerts import Alert, AlertLog, SQLObservation
from superset.tasks.alerts.validator import check_validator
from superset.utils import core as utils
from superset.utils.core import get_email_address_str, markdown

from ..exceptions import SupersetException
from .base import SupersetModelView

# TODO: access control rules for this module


class AlertLogModelView(
    CompactCRUDMixin, SupersetModelView
):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(AlertLog)
    include_route_methods = {RouteMethod.LIST} | {"show"}
    base_order = ("dttm_start", "desc")
    list_columns = (
        "scheduled_dttm",
        "dttm_start",
        "duration",
        "state",
    )


class AlertObservationModelView(
    CompactCRUDMixin, SupersetModelView
):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(SQLObservation)
    include_route_methods = {RouteMethod.LIST} | {"show"}
    base_order = ("dttm", "desc")
    list_title = _("List Observations")
    show_title = _("Show Observation")
    list_columns = (
        "dttm",
        "value",
        "error_msg",
    )
    label_columns = {
        "error_msg": _("Error Message"),
    }


class AlertModelView(SupersetModelView):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(Alert)
    route_base = "/alert"
    include_route_methods = RouteMethod.CRUD_SET

    list_columns = (
        "label",
        "database",
        "sql",
        "pretty_config",
        "crontab",
        "last_eval_dttm",
        "last_state",
        "active",
        "owners",
    )
    show_columns = (
        "label",
        "database",
        "sql",
        "validator_type",
        "validator_config",
        "active",
        "crontab",
        "owners",
        "slice",
        "recipients",
        "slack_channel",
        "log_retention",
        "grace_period",
        "last_eval_dttm",
        "last_state",
    )
    order_columns = ["label", "last_eval_dttm", "last_state", "active"]
    add_columns = (
        "label",
        "database",
        "sql",
        "validator_type",
        "validator_config",
        "active",
        "crontab",
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
    )
    label_columns = {
        "log_retention": _("Log Retentions (days)"),
    }
    description_columns = {
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
        "sql": _(
            "A SQL statement that defines whether the alert should get triggered or "
            "not. The query is expected to return either NULL or a number value."
        ),
        "validator_type": utils.markdown(
            "Determines when to trigger alert based off value from alert query. "
            "Alerts will be triggered with these validator types:"
            "<ul><li>Not Null - When the return value is Not NULL, Empty, or 0</li>"
            "<li>Operator - When `sql_return_value comparison_operator threshold`"
            " is True e.g. `50 <= 75`<br>Supports the comparison operators <, <=, "
            ">, >=, ==, and !=</li></ul>",
            True,
        ),
        "validator_config": utils.markdown(
            "JSON string containing values the validator will compare against. "
            "Each validator needs the following values:"
            "<ul><li>Not Null - Nothing. You can leave the config as it is.</li>"
            '<li>Operator<ul><li>`"op": "operator"` with an operator from ["<", '
            '"<=", ">", ">=", "==", "!="] e.g. `"op": ">="`</li>'
            '<li>`"threshold": threshold_value` e.g. `"threshold": 50`'
            '</li></ul>Example config:<br>{<br> "op":">=",<br>"threshold": 60<br>}'
            "</li></ul>",
            True,
        ),
    }

    edit_columns = add_columns
    related_views = [
        AlertObservationModelView,
        AlertLogModelView,
    ]

    def pre_add(self, item: "AlertModelView") -> None:
        item.recipients = get_email_address_str(item.recipients)

        if not croniter.is_valid(item.crontab):
            raise SupersetException("Invalid crontab format")

        item.validator_type = item.validator_type.lower()
        check_validator(item.validator_type, item.validator_config)

    def pre_update(self, item: "AlertModelView") -> None:
        item.validator_type = item.validator_type.lower()
        check_validator(item.validator_type, item.validator_config)

    def post_update(self, item: "AlertModelView") -> None:
        self.post_add(item)
