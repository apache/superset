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

"""Utility functions used across Superset"""

from collections import namedtuple
from datetime import datetime, timedelta
from email.utils import make_msgid, parseaddr
import logging

import croniter
from dateutil.tz import tzlocal
from flask import render_template, url_for
from flask_babel import gettext as __
import requests
import simplejson as json
from six.moves import urllib

from superset import app, db, security_manager
from superset.models.schedules import (
    EmailDeliveryType,
    get_scheduler_model,
    ScheduleType,
    SliceEmailReportFormat,
)
from superset.tasks.celery_app import app as celery_app
from superset.utils import core as utils
from superset.utils.selenium import (
    DashboardScreenshot,
    get_auth_cookies,
    SliceScreenshot,
)

# Globals
logging.getLogger('tasks.email_reports').setLevel(logging.INFO)

EmailContent = namedtuple('EmailContent', ['body', 'data', 'images'])


def _get_recipients(schedule):
    bcc = app.config.get('EMAIL_REPORT_BCC_ADDRESS', None)

    if schedule.deliver_as_group:
        to = schedule.recipients
        yield (to, bcc)
    else:
        for to in utils.get_email_address_list(schedule.recipients):
            yield (to, bcc)


def _deliver_email(recipients, subject, email):
    config = app.config
    dryrun = config.get('SCHEDULED_EMAIL_DEBUG_MODE')
    for (to, bcc) in recipients:
        utils.send_email_smtp(
            to, subject, email.body,
            config,
            data=email.data,
            images=email.images,
            bcc=bcc,
            mime_subtype='related',
            dryrun=dryrun,
        )


def _generate_mail_content(delivery_type, screenshot, name, url):
    config = app.config
    if delivery_type == EmailDeliveryType.attachment:
        images = None
        data = {
            'screenshot.png': screenshot,
        }
        body = __(
            '<b><a href="%(url)s">Explore in Superset</a></b><p></p>',
            name=name,
            url=url,
        )
    else:
        # Implicit: delivery_type == EmailDeliveryType.inline:

        # Get the domain from the 'From' address ..
        # and make a message id without the < > in the ends
        domain = parseaddr(config.get('SMTP_MAIL_FROM'))[1].split('@')[1]
        msgid = make_msgid(domain)[1:-1]

        images = {
            msgid: screenshot,
        }
        data = None
        body = __(
            """
            <b><a href="%(url)s">Explore in Superset</a></b><p></p>
            <img src="cid:%(msgid)s">
            """,
            name=name, url=url, msgid=msgid,
        )

    return EmailContent(body, data, images)


def _get_url_path(view, **kwargs):
    with app.test_request_context():
        return urllib.parse.urljoin(
            str(app.config.get('WEBDRIVER_BASEURL')),
            url_for(view, **kwargs),
        )


def deliver_dashboard(dashboard, recipients, delivery_type):
    """
    Given a schedule, delivery the dashboard as an email report
    """
    config = app.config

    window = config.get('WEBDRIVER_WINDOW')['dashboard']
    user = security_manager.find_user(config.get('EMAIL_REPORTS_USER'))
    with app.app_context():
        screenshot = DashboardScreenshot(id=dashboard.id)
        img = screenshot.get_thumb(
            user=user, window_size=window, thumb_size=window)

    # Generate the email body and attachments
    email = _generate_mail_content(
        delivery_type,
        img,
        dashboard.dashboard_title,
        screenshot.url,
    )

    subject = __(
        '%(prefix)s %(title)s',
        prefix=config.get('EMAIL_REPORTS_SUBJECT_PREFIX'),
        title=dashboard.dashboard_title,
    )

    _deliver_email(recipients, subject, email)


def _get_slice_data(slc, delivery_type):
    config = app.config

    slice_url = _get_url_path(
        'Superset.explore_json',
        csv='true',
        form_data=json.dumps({'slice_id': slc.id}),
    )

    # URL to include in the email
    url = _get_url_path(
        'Superset.slice',
        slice_id=slc.id,
    )

    cookies = {}
    user = security_manager.find_user(config.get('EMAIL_REPORTS_USER'))
    with app.app_context():
        for cookie in get_auth_cookies(user):
            cookies['session'] = cookie

    response = requests.get(slice_url, cookies=cookies)
    response.raise_for_status()

    # TODO: Move to the csv module
    rows = [r.split(b',') for r in response.content.splitlines()]

    if delivery_type == EmailDeliveryType.inline:
        data = None

        # Parse the csv file and generate HTML
        columns = rows.pop(0)
        with app.app_context():
            body = render_template(
                'superset/reports/slice_data.html',
                columns=columns,
                rows=rows,
                name=slc.slice_name,
                link=url,
            )

    elif delivery_type == EmailDeliveryType.attachment:
        data = {
            __('%(name)s.csv', name=slc.slice_name): response.content,
        }
        body = __(
            '<b><a href="%(url)s">Explore in Superset</a></b><p></p>',
            name=slc.slice_name,
            url=url,
        )

    return EmailContent(body, data, None)


def _get_slice_visualization(slc, delivery_type):
    config = app.config
    url = _get_url_path(
        'Superset.slice',
        slice_id=slc.id,
    )
    window = config.get('WEBDRIVER_WINDOW')['slice']
    user = security_manager.find_user(config.get('EMAIL_REPORTS_USER'))

    with app.app_context():
        screenshot = SliceScreenshot(id=slc.id)
        img = screenshot.get_thumb(
            user=user, window_size=window, thumb_size=window)

    # Generate the email body and attachments
    return _generate_mail_content(
        delivery_type,
        img,
        slc.slice_name,
        url,
    )


def deliver_slice(slc, recipients, email_format, delivery_type):
    """
    Given a schedule, delivery the slice as an email report
    """
    config = app.config
    if email_format == SliceEmailReportFormat.data:
        email = _get_slice_data(slc, delivery_type)
    elif email_format == SliceEmailReportFormat.visualization:
        email = _get_slice_visualization(slc, delivery_type)
    else:
        raise RuntimeError('Unknown email report format')

    subject = __(
        '%(prefix)s %(title)s',
        prefix=config.get('EMAIL_REPORTS_SUBJECT_PREFIX'),
        title=slc.slice_name,
    )

    _deliver_email(recipients, subject, email)


@celery_app.task(name='email_reports.send', bind=True, soft_time_limit=300)
def schedule_email_report(task, report_type, schedule_id, recipients=None):
    model_cls = get_scheduler_model(report_type)
    schedule = db.create_scoped_session().query(model_cls).get(schedule_id)

    # The user may have disabled the schedule. If so, ignore this
    if not schedule or not schedule.active:
        logging.info('Ignoring deactivated schedule')
        return

    # TODO: Detach the schedule object from the db session
    if recipients is not None:
        schedule.id = schedule_id
        schedule.recipients = recipients

    if report_type == ScheduleType.dashboard.value:
        deliver_dashboard(
            schedule.dashboard, _get_recipients(schedule), schedule.delivery_type)
    elif report_type == ScheduleType.slice.value:
        deliver_slice(
            schedule.slice,
            _get_recipients(schedule),
            schedule.email_format,
            schedule.delivery_type,
        )
    else:
        raise RuntimeError('Unknown report type')


def next_schedules(crontab, start_at, stop_at, resolution=0):
    crons = croniter.croniter(crontab, start_at - timedelta(seconds=1))
    previous = start_at - timedelta(days=1)

    for eta in crons.all_next(datetime):
        # Do not cross the time boundary
        if eta >= stop_at:
            break

        if eta < start_at:
            continue

        # Do not allow very frequent tasks
        if eta - previous < timedelta(seconds=resolution):
            continue

        yield eta
        previous = eta


def schedule_window(report_type, start_at, stop_at, resolution):
    """
    Find all active schedules and schedule celery tasks for
    each of them with a specific ETA (determined by parsing
    the cron schedule for the schedule)
    """
    model_cls = get_scheduler_model(report_type)
    dbsession = db.create_scoped_session()
    schedules = dbsession.query(model_cls).filter(model_cls.active.is_(True))

    for schedule in schedules:
        args = (
            report_type,
            schedule.id,
        )

        # Schedule the job for the specified time window
        for eta in next_schedules(schedule.crontab,
                                  start_at,
                                  stop_at,
                                  resolution=resolution):
            schedule_email_report.apply_async(args, eta=eta)


@celery_app.task(name='email_reports.schedule_hourly')
def schedule_hourly():
    """ Celery beat job meant to be invoked hourly """
    config = app.config

    if not config.get('ENABLE_SCHEDULED_EMAIL_REPORTS'):
        logging.info('Scheduled email reports not enabled in config')
        return

    resolution = config.get('EMAIL_REPORTS_CRON_RESOLUTION', 0) * 60

    # Get the top of the hour
    start_at = datetime.now(tzlocal()).replace(microsecond=0, second=0, minute=0)
    stop_at = start_at + timedelta(seconds=3600)
    schedule_window(ScheduleType.dashboard.value, start_at, stop_at, resolution)
    schedule_window(ScheduleType.slice.value, start_at, stop_at, resolution)
