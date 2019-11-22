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
# pylint: disable=C,R,W
import enum
from typing import Optional, Type

import simplejson as json
from croniter import croniter
from flask import flash, g
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import gettext as __, lazy_gettext as _
from wtforms import BooleanField, StringField

from superset import app, appbuilder, db, security_manager
from superset.exceptions import SupersetException
from superset.models.core import Dashboard, Slice
from superset.models.schedules import (
    DashboardEmailSchedule,
    ScheduleType,
    SliceEmailSchedule,
)
from superset.tasks.schedules import schedule_email_report
from superset.utils.core import get_email_address_list, json_iso_dttm_ser
from superset.views.core import json_success

from .base import DeleteMixin, SupersetModelView


class EmailScheduleView(SupersetModelView, DeleteMixin):
    _extra_data = {"test_email": False, "test_email_recipients": None}
    schedule_type: Optional[Type] = None
    schedule_type_model: Optional[Type] = None

    page_size = 20

    add_exclude_columns = [
        "user",
        "created_on",
        "changed_on",
        "created_by",
        "changed_by",
    ]

    edit_exclude_columns = add_exclude_columns

    description_columns = {
        "deliver_as_group": "If enabled, send a single email to all "
        "recipients (in email/To: field)",
        "crontab": "Unix style crontab schedule to deliver emails. "
        "Changes to schedules reflect in one hour.",
        "delivery_type": "Indicates how the rendered content is delivered",
    }

    add_form_extra_fields = {
        "test_email": BooleanField(
            "Send Test Email",
            default=False,
            description="If enabled, we send a test mail on create / update",
        ),
        "test_email_recipients": StringField(
            "Test Email Recipients",
            default=None,
            description="List of recipients to send test email to. "
            "If empty, we send it to the original recipients",
        ),
    }

    edit_form_extra_fields = add_form_extra_fields

    def process_form(self, form, is_created):
        if form.test_email_recipients.data:
            test_email_recipients = form.test_email_recipients.data.strip()
        else:
            test_email_recipients = None
        self._extra_data["test_email"] = form.test_email.data
        self._extra_data["test_email_recipients"] = test_email_recipients

    def pre_add(self, obj):
        try:
            recipients = get_email_address_list(obj.recipients)
            obj.recipients = ", ".join(recipients)
        except Exception:
            raise SupersetException("Invalid email list")

        obj.user = obj.user or g.user
        if not croniter.is_valid(obj.crontab):
            raise SupersetException("Invalid crontab format")

    def pre_update(self, obj):
        self.pre_add(obj)

    def post_add(self, obj):
        # Schedule a test mail if the user requested for it.
        if self._extra_data["test_email"]:
            recipients = self._extra_data["test_email_recipients"] or obj.recipients
            args = (self.schedule_type, obj.id)
            kwargs = dict(recipients=recipients)
            schedule_email_report.apply_async(args=args, kwargs=kwargs)

        # Notify the user that schedule changes will be activate only in the
        # next hour
        if obj.active:
            flash("Schedule changes will get applied in one hour", "warning")

    def post_update(self, obj):
        self.post_add(obj)

    @has_access
    @expose("/fetch/<int:item_id>/", methods=["GET"])
    def fetch_schedules(self, item_id):

        query = db.session.query(self.datamodel.obj)
        query = query.join(self.schedule_type_model).filter(
            self.schedule_type_model.id == item_id
        )

        schedules = []
        for schedule in query.all():
            info = {"schedule": schedule.id}

            for col in self.list_columns + self.add_exclude_columns:
                info[col] = getattr(schedule, col)

                if isinstance(info[col], enum.Enum):
                    info[col] = info[col].name
                elif isinstance(info[col], security_manager.user_model):
                    info[col] = info[col].username

            info["user"] = schedule.user.username
            info[self.schedule_type] = getattr(schedule, self.schedule_type).id
            schedules.append(info)

        return json_success(json.dumps(schedules, default=json_iso_dttm_ser))


class DashboardEmailScheduleView(EmailScheduleView):
    schedule_type = ScheduleType.dashboard.value
    schedule_type_model = Dashboard

    add_title = _("Schedule Email Reports for Dashboards")
    edit_title = add_title
    list_title = _("Manage Email Reports for Dashboards")

    datamodel = SQLAInterface(DashboardEmailSchedule)
    order_columns = ["user", "dashboard", "created_on"]

    list_columns = [
        "dashboard",
        "active",
        "crontab",
        "user",
        "deliver_as_group",
        "delivery_type",
    ]

    add_columns = [
        "dashboard",
        "active",
        "crontab",
        "recipients",
        "deliver_as_group",
        "delivery_type",
        "test_email",
        "test_email_recipients",
    ]

    edit_columns = add_columns

    search_columns = [
        "dashboard",
        "active",
        "user",
        "deliver_as_group",
        "delivery_type",
    ]

    label_columns = {
        "dashboard": _("Dashboard"),
        "created_on": _("Created On"),
        "changed_on": _("Changed On"),
        "user": _("User"),
        "active": _("Active"),
        "crontab": _("Crontab"),
        "recipients": _("Recipients"),
        "deliver_as_group": _("Deliver As Group"),
        "delivery_type": _("Delivery Type"),
    }

    def pre_add(self, obj):
        if obj.dashboard is None:
            raise SupersetException("Dashboard is mandatory")
        super(DashboardEmailScheduleView, self).pre_add(obj)


class SliceEmailScheduleView(EmailScheduleView):
    schedule_type = ScheduleType.slice.value
    schedule_type_model = Slice
    add_title = _("Schedule Email Reports for Charts")
    edit_title = add_title
    list_title = _("Manage Email Reports for Charts")

    datamodel = SQLAInterface(SliceEmailSchedule)
    order_columns = ["user", "slice", "created_on"]
    list_columns = [
        "slice",
        "active",
        "crontab",
        "user",
        "deliver_as_group",
        "delivery_type",
        "email_format",
    ]

    add_columns = [
        "slice",
        "active",
        "crontab",
        "recipients",
        "deliver_as_group",
        "delivery_type",
        "email_format",
        "test_email",
        "test_email_recipients",
    ]

    edit_columns = add_columns

    search_columns = [
        "slice",
        "active",
        "user",
        "deliver_as_group",
        "delivery_type",
        "email_format",
    ]

    label_columns = {
        "slice": _("Chart"),
        "created_on": _("Created On"),
        "changed_on": _("Changed On"),
        "user": _("User"),
        "active": _("Active"),
        "crontab": _("Crontab"),
        "recipients": _("Recipients"),
        "deliver_as_group": _("Deliver As Group"),
        "delivery_type": _("Delivery Type"),
        "email_format": _("Email Format"),
    }

    def pre_add(self, obj):
        if obj.slice is None:
            raise SupersetException("Slice is mandatory")
        super(SliceEmailScheduleView, self).pre_add(obj)


def _register_schedule_menus():
    appbuilder.add_separator("Manage")

    appbuilder.add_view(
        DashboardEmailScheduleView,
        "Dashboard Email Schedules",
        label=__("Dashboard Emails"),
        category="Manage",
        category_label=__("Manage"),
        icon="fa-search",
    )

    appbuilder.add_view(
        SliceEmailScheduleView,
        "Chart Emails",
        label=__("Chart Email Schedules"),
        category="Manage",
        category_label=__("Manage"),
        icon="fa-search",
    )


if app.config["ENABLE_SCHEDULED_EMAIL_REPORTS"]:
    _register_schedule_menus()
