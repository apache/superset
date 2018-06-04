# -*- coding: utf-8 -*-
# pylint: disable=C,R,W
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import enum

from croniter import croniter
from flask import g
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
import simplejson as json

from superset import app, appbuilder, db, security_manager
from superset.exceptions import SupersetException
from superset.models.core import Dashboard, Slice
from superset.models.schedules import (
    DashboardEmailSchedule,
    ScheduleType,
    SliceEmailSchedule,
)
from superset.utils import get_email_address_list, json_iso_dttm_ser
from superset.views.core import json_success
from .base import DeleteMixin, SupersetModelView


class EmailScheduleView(SupersetModelView, DeleteMixin):
    schedule_type = None
    schedule_type_model = None

    page_size = 20
    add_exclude_columns = [
        'user',
        'created_on',
        'changed_on',
        'created_by',
        'changed_by',
    ]

    edit_exclude_columns = add_exclude_columns

    description_columns = {
        'deliver_as_group': 'If enabled, send a single email to all '
        'recipients (in email/To: field)',
        'crontab': 'Unix style crontab schedule to deliver emails',
        'delivery_type': 'Indicates how the rendered content is delivered',
    }

    def pre_add(self, obj):
        try:
            recipients = get_email_address_list(obj.recipients)
            obj.recipients = ', '.join(recipients)
        except Exception:
            raise SupersetException('Invalid email list')

        obj.user = obj.user or g.user
        if not croniter.is_valid(obj.crontab):
            raise SupersetException('Invalid crontab format')

    def pre_update(self, obj):
        self.pre_add(obj)

    @has_access
    @expose('/fetch/<int:item_id>/', methods=['GET'])
    def fetch_schedules(self, item_id):

        query = db.session.query(self.datamodel.obj)
        query = query.join(self.schedule_type_model).filter(
            self.schedule_type_model.id == item_id)

        schedules = []
        for schedule in query.all():
            info = {'schedule': schedule.id}

            for col in self.list_columns + self.add_exclude_columns:
                info[col] = getattr(schedule, col)

                if isinstance(info[col], enum.Enum):
                    info[col] = info[col].name
                elif isinstance(info[col], security_manager.user_model):
                    info[col] = info[col].username

            info['user'] = schedule.user.username
            info[self.schedule_type] = getattr(schedule, self.schedule_type).id
            schedules.append(info)

        return json_success(json.dumps(schedules, default=json_iso_dttm_ser))


class DashboardEmailScheduleView(EmailScheduleView):
    schedule_type = ScheduleType.dashboard.name
    schedule_type_model = Dashboard

    add_title = 'Schedule Email Reports for Dashboards'
    edit_title = add_title
    list_title = 'Manage Email Reports for Dashboards'

    datamodel = SQLAInterface(DashboardEmailSchedule)
    order_columns = ['user', 'dashboard', 'created_on']

    list_columns = [
        'dashboard',
        'active',
        'crontab',
        'user',
        'deliver_as_group',
        'delivery_type',
    ]

    search_columns = [
        'dashboard',
        'active',
        'user',
        'deliver_as_group',
        'delivery_type',
    ]

    label_columns = {
        'dashboard': _('Dashboard'),
        'created_on': _('Created On'),
        'changed_on': _('Changed On'),
        'user': _('User'),
        'active': _('Active'),
        'crontab': _('Crontab'),
        'recipients': _('Recipients'),
        'deliver_as_group': _('Deliver As Group'),
        'delivery_type': _('Delivery Type'),
    }

    def pre_add(self, obj):
        if obj.dashboard is None:
            raise SupersetException('Dashboard is mandatory')
        super(DashboardEmailScheduleView, self).pre_add(obj)


class SliceEmailScheduleView(EmailScheduleView):
    schedule_type = ScheduleType.slice.name
    schedule_type_model = Slice
    add_title = 'Schedule Email Reports for Charts'
    edit_title = add_title
    list_title = 'Manage Email Reports for Charts'

    datamodel = SQLAInterface(SliceEmailSchedule)
    order_columns = ['user', 'slice', 'created_on']
    list_columns = [
        'slice',
        'active',
        'crontab',
        'user',
        'deliver_as_group',
        'delivery_type',
        'email_format',
    ]

    search_columns = [
        'slice',
        'active',
        'user',
        'deliver_as_group',
        'delivery_type',
        'email_format',
    ]

    label_columns = {
        'slice': _('Chart'),
        'created_on': _('Created On'),
        'changed_on': _('Changed On'),
        'user': _('User'),
        'active': _('Active'),
        'crontab': _('Crontab'),
        'recipients': _('Recipients'),
        'deliver_as_group': _('Deliver As Group'),
        'delivery_type': _('Delivery Type'),
        'email_format': _('Email Format'),
    }

    def pre_add(self, obj):
        if obj.slice is None:
            raise SupersetException('Slice is mandatory')
        super(SliceEmailScheduleView, self).pre_add(obj)


def _register_schedule_menus():
    appbuilder.add_separator('Manage')

    appbuilder.add_view(
        DashboardEmailScheduleView,
        'Dashboard Email Schedules',
        label=__('Dashboard Emails'),
        category='Manage',
        category_label=__('Manage'),
        icon='fa-search')

    appbuilder.add_view(
        SliceEmailScheduleView,
        'Chart Emails',
        label=__('Chart Email Schedules'),
        category='Manage',
        category_label=__('Manage'),
        icon='fa-search')


if app.config.get('ENABLE_SCHEDULED_EMAIL_REPORTS'):
    _register_schedule_menus()
