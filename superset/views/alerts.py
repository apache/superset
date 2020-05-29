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
import enum
from typing import Optional, Type

import simplejson as json
from croniter import croniter
from flask import flash, g
from flask_appbuilder import CompactCRUDMixin, expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import lazy_gettext as _
from wtforms import BooleanField, StringField

from superset import db, security_manager
from superset.constants import RouteMethod
from superset.exceptions import SupersetException
from superset.models.alerts import Alert, AlertLog
from superset.models.schedules import (
    DashboardEmailSchedule,
    ScheduleType,
    SliceEmailSchedule,
)
from superset.models.slice import Slice
from superset.tasks.schedules import schedule_email_report
from superset.utils.core import get_email_address_list, json_iso_dttm_ser, markdown
from superset.views.core import json_success

from .base import DeleteMixin, SupersetModelView


class AlertLogModelView(CompactCRUDMixin, SupersetModelView):
    datamodel = SQLAInterface(AlertLog)
    include_route_methods = {RouteMethod.LIST}
    list_columns = (
        "scheduled_dttm",
        "dttm_start",
        "state",
    )


class AlertModelView(SupersetModelView):  # pylint: disable=too-many-ancestors
    datamodel = SQLAInterface(Alert)
    route_base = "/alert"
    include_route_methods = RouteMethod.CRUD_SET

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
        "alert_type",
        "owners",
        "recipients",
        "slice",
        "dashboard",
        "log_retention",
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
    }
    edit_columns = add_columns
    related_views = [AlertLogModelView]
