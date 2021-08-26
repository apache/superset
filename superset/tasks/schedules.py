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
"""
DEPRECATION NOTICE: this module is deprecated as of v1.0.0.
It will be removed in future versions of Superset. Please
migrate to the new scheduler: `superset.tasks.scheduler`.
"""

import logging
import time
import urllib.request
from collections import namedtuple
from datetime import datetime, timedelta
from email.utils import make_msgid, parseaddr
from typing import (
    Any,
    Callable,
    Dict,
    Iterator,
    NamedTuple,
    Optional,
    Tuple,
    TYPE_CHECKING,
    Union,
)
from urllib.error import URLError

import croniter
import simplejson as json
from celery.app.task import Task
from dateutil.tz import tzlocal
from flask import current_app, render_template, url_for
from flask_babel import gettext as __
from selenium.common.exceptions import WebDriverException
from selenium.webdriver import chrome, firefox
from selenium.webdriver.remote.webdriver import WebDriver
from sqlalchemy import func
from sqlalchemy.exc import NoSuchColumnError, ResourceClosedError
from sqlalchemy.orm import Session

from superset import app, security_manager, thumbnail_cache
from superset.extensions import celery_app, machine_auth_provider_factory
from superset.models.alerts import Alert, AlertLog
from superset.models.dashboard import Dashboard
from superset.models.schedules import (
    EmailDeliveryType,
    get_scheduler_model,
    ScheduleType,
    SliceEmailReportFormat,
)
from superset.models.slice import Slice
from superset.tasks.alerts.observer import observe
from superset.tasks.alerts.validator import get_validator_function
from superset.tasks.slack_util import deliver_slack_msg
from superset.utils.celery import session_scope
from superset.utils.core import get_email_address_list, send_email_smtp
from superset.utils.retries import retry_call
from superset.utils.screenshots import ChartScreenshot, WebDriverProxy
from superset.utils.urls import get_url_path

# pylint: disable=too-few-public-methods

if TYPE_CHECKING:
    from flask_appbuilder.security.sqla.models import User
    from werkzeug.datastructures import TypeConversionDict

# Globals
config = app.config
logger = logging.getLogger("tasks.email_reports")
logger.setLevel(logging.INFO)

stats_logger = current_app.config["STATS_LOGGER"]
EMAIL_PAGE_RENDER_WAIT = config["EMAIL_PAGE_RENDER_WAIT"]
WEBDRIVER_BASEURL = config["WEBDRIVER_BASEURL"]
WEBDRIVER_BASEURL_USER_FRIENDLY = config["WEBDRIVER_BASEURL_USER_FRIENDLY"]

ReportContent = namedtuple(
    "ReportContent",
    [
        "body",  # email body
        "data",  # attachments
        "images",  # embedded images for the email
        "slack_message",  # html not supported, only markdown
        # attachments for the slack message, embedding not supported
        "slack_attachment",
    ],
)


class ScreenshotData(NamedTuple):
    url: str  # url to chat/dashboard for this screenshot
    image: Optional[bytes]  # bytes for the screenshot


class AlertContent(NamedTuple):
    label: str  # alert name
    sql: str  # sql statement for alert
    observation_value: str  # value from observation that triggered the alert
    validation_error_message: str  # a string of the comparison that triggered an alert
    alert_url: str  # url to alert details
    image_data: Optional[ScreenshotData]  # data for the alert screenshot


def _get_email_to_and_bcc(
    recipients: str, deliver_as_group: bool
) -> Iterator[Tuple[str, str]]:
    bcc = config["EMAIL_REPORT_BCC_ADDRESS"]

    if deliver_as_group:
        to = recipients
        yield (to, bcc)
    else:
        for to in get_email_address_list(recipients):
            yield (to, bcc)


# TODO(bkyryliuk): move email functionality into a separate module.
def _deliver_email(  # pylint: disable=too-many-arguments
    recipients: str,
    deliver_as_group: bool,
    subject: str,
    body: str,
    data: Optional[Dict[str, Any]],
    images: Optional[Dict[str, bytes]],
) -> None:
    for (to, bcc) in _get_email_to_and_bcc(recipients, deliver_as_group):
        send_email_smtp(
            to,
            subject,
            body,
            config,
            data=data,
            images=images,
            bcc=bcc,
            mime_subtype="related",
            dryrun=config["SCHEDULED_EMAIL_DEBUG_MODE"],
        )


def _generate_report_content(
    delivery_type: EmailDeliveryType, screenshot: bytes, name: str, url: str
) -> ReportContent:
    data: Optional[Dict[str, Any]]

    # how to: https://api.slack.com/reference/surfaces/formatting
    slack_message = __(
        """
        *%(name)s*\n
        <%(url)s|Explore in Superset>
        """,
        name=name,
        url=url,
    )

    if delivery_type == EmailDeliveryType.attachment:
        images = None
        data = {"screenshot": screenshot}
        body = __(
            '<b><a href="%(url)s">Explore in Superset</a></b><p></p>',
            name=name,
            url=url,
        )
    elif delivery_type == EmailDeliveryType.inline:
        # Get the domain from the 'From' address ..
        # and make a message id without the < > in the ends
        domain = parseaddr(config["SMTP_MAIL_FROM"])[1].split("@")[1]
        msgid = make_msgid(domain)[1:-1]

        images = {msgid: screenshot}
        data = None
        body = __(
            """
            <b><a href="%(url)s">Explore in Superset</a></b><p></p>
            <img src="cid:%(msgid)s">
            """,
            name=name,
            url=url,
            msgid=msgid,
        )

    return ReportContent(body, data, images, slack_message, screenshot)


def _get_url_path(view: str, user_friendly: bool = False, **kwargs: Any) -> str:
    with app.test_request_context():
        base_url = (
            WEBDRIVER_BASEURL_USER_FRIENDLY if user_friendly else WEBDRIVER_BASEURL
        )
        return urllib.parse.urljoin(str(base_url), url_for(view, **kwargs))


def create_webdriver(session: Session) -> WebDriver:
    return WebDriverProxy(driver_type=config["WEBDRIVER_TYPE"]).auth(
        get_reports_user(session)
    )


def get_reports_user(session: Session) -> "User":
    return (
        session.query(security_manager.user_model)
        .filter(
            func.lower(security_manager.user_model.username)
            == func.lower(config["EMAIL_REPORTS_USER"])
        )
        .one()
    )


def destroy_webdriver(
    driver: Union[chrome.webdriver.WebDriver, firefox.webdriver.WebDriver]
) -> None:
    """
    Destroy a driver
    """

    # This is some very flaky code in selenium. Hence the retries
    # and catch-all exceptions
    try:
        retry_call(driver.close, max_tries=2)
    except Exception:  # pylint: disable=broad-except
        pass
    try:
        driver.quit()
    except Exception:  # pylint: disable=broad-except
        pass


def deliver_dashboard(  # pylint: disable=too-many-locals
    dashboard_id: int,
    recipients: Optional[str],
    slack_channel: Optional[str],
    delivery_type: EmailDeliveryType,
    deliver_as_group: bool,
) -> None:

    """
    Given a schedule, delivery the dashboard as an email report
    """
    with session_scope(nullpool=True) as session:
        dashboard = session.query(Dashboard).filter_by(id=dashboard_id).one()

        dashboard_url = _get_url_path(
            "Superset.dashboard", dashboard_id_or_slug=dashboard.id
        )
        dashboard_url_user_friendly = _get_url_path(
            "Superset.dashboard", user_friendly=True, dashboard_id_or_slug=dashboard.id
        )

        # Create a driver, fetch the page, wait for the page to render
        driver = create_webdriver(session)
        window = config["WEBDRIVER_WINDOW"]["dashboard"]
        driver.set_window_size(*window)
        driver.get(dashboard_url)
        time.sleep(EMAIL_PAGE_RENDER_WAIT)

        # Set up a function to retry once for the element.
        # This is buggy in certain selenium versions with firefox driver
        get_element = getattr(driver, "find_element_by_class_name")
        element = retry_call(
            get_element,
            fargs=["grid-container"],
            max_tries=2,
            interval=EMAIL_PAGE_RENDER_WAIT,
        )

        try:
            screenshot = element.screenshot_as_png
        except WebDriverException:
            # Some webdrivers do not support screenshots for elements.
            # In such cases, take a screenshot of the entire page.
            screenshot = driver.screenshot()
        finally:
            destroy_webdriver(driver)

        # Generate the email body and attachments
        report_content = _generate_report_content(
            delivery_type,
            screenshot,
            dashboard.dashboard_title,
            dashboard_url_user_friendly,
        )

        subject = __(
            "%(prefix)s %(title)s",
            prefix=config["EMAIL_REPORTS_SUBJECT_PREFIX"],
            title=dashboard.dashboard_title,
        )

        if recipients:
            _deliver_email(
                recipients,
                deliver_as_group,
                subject,
                report_content.body,
                report_content.data,
                report_content.images,
            )
        if slack_channel:
            deliver_slack_msg(
                slack_channel,
                subject,
                report_content.slack_message,
                report_content.slack_attachment,
            )


def _get_slice_data(
    slc: Slice, delivery_type: EmailDeliveryType, session: Session
) -> ReportContent:
    slice_url = _get_url_path(
        "Superset.explore_json", csv="true", form_data=json.dumps({"slice_id": slc.id})
    )

    # URL to include in the email
    slice_url_user_friendly = _get_url_path(
        "Superset.slice", slice_id=slc.id, user_friendly=True
    )

    # Login on behalf of the "reports" user in order to get cookies to deal with auth
    auth_cookies = machine_auth_provider_factory.instance.get_auth_cookies(
        get_reports_user(session)
    )
    # Build something like "session=cool_sess.val;other-cookie=awesome_other_cookie"
    cookie_str = ";".join([f"{key}={val}" for key, val in auth_cookies.items()])

    opener = urllib.request.build_opener()
    opener.addheaders.append(("Cookie", cookie_str))
    response = opener.open(slice_url)
    if response.getcode() != 200:
        raise URLError(response.getcode())

    # TODO: Move to the csv module
    content = response.read()
    rows = [r.split(b",") for r in content.splitlines()]

    if delivery_type == EmailDeliveryType.inline:
        data = None

        # Parse the csv file and generate HTML
        columns = rows.pop(0)
        with app.app_context():
            body = render_template(
                "superset/reports/slice_data.html",
                columns=columns,
                rows=rows,
                name=slc.slice_name,
                link=slice_url_user_friendly,
            )

    elif delivery_type == EmailDeliveryType.attachment:
        data = {__("%(name)s.csv", name=slc.slice_name): content}
        body = __(
            '<b><a href="%(url)s">Explore in Superset</a></b><p></p>',
            name=slc.slice_name,
            url=slice_url_user_friendly,
        )

    # how to: https://api.slack.com/reference/surfaces/formatting
    slack_message = __(
        """
        *%(slice_name)s*\n
        <%(slice_url_user_friendly)s|Explore in Superset>
        """,
        slice_name=slc.slice_name,
        slice_url_user_friendly=slice_url_user_friendly,
    )

    return ReportContent(body, data, None, slack_message, content)


def _get_slice_screenshot(slice_id: int, session: Session) -> ScreenshotData:
    slice_obj = session.query(Slice).get(slice_id)

    chart_url = get_url_path("Superset.slice", slice_id=slice_obj.id, standalone="true")
    screenshot = ChartScreenshot(chart_url, slice_obj.digest)
    image_url = _get_url_path(
        "Superset.slice", user_friendly=True, slice_id=slice_obj.id,
    )

    user = security_manager.get_user_by_username(
        current_app.config["THUMBNAIL_SELENIUM_USER"], session=session
    )
    image_data = screenshot.compute_and_cache(
        user=user, cache=thumbnail_cache, force=True,
    )

    session.commit()
    return ScreenshotData(image_url, image_data)


def _get_slice_visualization(
    slc: Slice, delivery_type: EmailDeliveryType, session: Session
) -> ReportContent:
    # Create a driver, fetch the page, wait for the page to render
    driver = create_webdriver(session)
    window = config["WEBDRIVER_WINDOW"]["slice"]
    driver.set_window_size(*window)

    slice_url = _get_url_path("Superset.slice", slice_id=slc.id)
    slice_url_user_friendly = _get_url_path(
        "Superset.slice", slice_id=slc.id, user_friendly=True
    )

    driver.get(slice_url)
    time.sleep(EMAIL_PAGE_RENDER_WAIT)

    # Set up a function to retry once for the element.
    # This is buggy in certain selenium versions with firefox driver
    element = retry_call(
        driver.find_element_by_class_name,
        fargs=["chart-container"],
        max_tries=2,
        interval=EMAIL_PAGE_RENDER_WAIT,
    )

    try:
        screenshot = element.screenshot_as_png
    except WebDriverException:
        # Some webdrivers do not support screenshots for elements.
        # In such cases, take a screenshot of the entire page.
        screenshot = driver.screenshot()
    finally:
        destroy_webdriver(driver)

    # Generate the email body and attachments
    return _generate_report_content(
        delivery_type, screenshot, slc.slice_name, slice_url_user_friendly
    )


def deliver_slice(  # pylint: disable=too-many-arguments
    slice_id: int,
    recipients: Optional[str],
    slack_channel: Optional[str],
    delivery_type: EmailDeliveryType,
    email_format: SliceEmailReportFormat,
    deliver_as_group: bool,
    session: Session,
) -> None:
    """
    Given a schedule, delivery the slice as an email report
    """
    slc = session.query(Slice).filter_by(id=slice_id).one()

    if email_format == SliceEmailReportFormat.data:
        report_content = _get_slice_data(slc, delivery_type, session)
    elif email_format == SliceEmailReportFormat.visualization:
        report_content = _get_slice_visualization(slc, delivery_type, session)
    else:
        raise RuntimeError("Unknown email report format")

    subject = __(
        "%(prefix)s %(title)s",
        prefix=config["EMAIL_REPORTS_SUBJECT_PREFIX"],
        title=slc.slice_name,
    )

    if recipients:
        _deliver_email(
            recipients,
            deliver_as_group,
            subject,
            report_content.body,
            report_content.data,
            report_content.images,
        )
    if slack_channel:
        deliver_slack_msg(
            slack_channel,
            subject,
            report_content.slack_message,
            report_content.slack_attachment,
        )


@celery_app.task(
    name="email_reports.send",
    bind=True,
    soft_time_limit=config["EMAIL_ASYNC_TIME_LIMIT_SEC"],
)
def schedule_email_report(
    _task: Task,
    report_type: ScheduleType,
    schedule_id: int,
    recipients: Optional[str] = None,
    slack_channel: Optional[str] = None,
) -> None:
    model_cls = get_scheduler_model(report_type)
    with session_scope(nullpool=True) as session:
        schedule = session.query(model_cls).get(schedule_id)

        # The user may have disabled the schedule. If so, ignore this
        if not schedule or not schedule.active:
            logger.info("Ignoring deactivated schedule")
            return

        recipients = recipients or schedule.recipients
        slack_channel = slack_channel or schedule.slack_channel
        logger.info(
            "Starting report for slack: %s and recipients: %s.",
            slack_channel,
            recipients,
        )

        if report_type == ScheduleType.dashboard:
            deliver_dashboard(
                schedule.dashboard_id,
                recipients,
                slack_channel,
                schedule.delivery_type,
                schedule.deliver_as_group,
            )
        elif report_type == ScheduleType.slice:
            deliver_slice(
                schedule.slice_id,
                recipients,
                slack_channel,
                schedule.delivery_type,
                schedule.email_format,
                schedule.deliver_as_group,
                session,
            )
        else:
            raise RuntimeError("Unknown report type")


@celery_app.task(
    name="alerts.run_query",
    bind=True,
    # TODO: find cause of https://github.com/apache/superset/issues/10530
    # and remove retry
    autoretry_for=(NoSuchColumnError, ResourceClosedError,),
    retry_kwargs={"max_retries": 1},
    retry_backoff=True,
)
def schedule_alert_query(
    _task: Task,
    report_type: ScheduleType,
    schedule_id: int,
    recipients: Optional[str] = None,
    slack_channel: Optional[str] = None,
) -> None:
    model_cls = get_scheduler_model(report_type)
    with session_scope(nullpool=True) as session:
        schedule = session.query(model_cls).get(schedule_id)

        # The user may have disabled the schedule. If so, ignore this
        if not schedule or not schedule.active:
            logger.info("Ignoring deactivated alert")
            return

        if report_type == ScheduleType.alert:
            evaluate_alert(
                schedule.id, schedule.label, session, recipients, slack_channel
            )
        else:
            raise RuntimeError("Unknown report type")


class AlertState:
    ERROR = "error"
    TRIGGER = "trigger"
    PASS = "pass"


def deliver_alert(
    alert_id: int,
    session: Session,
    recipients: Optional[str] = None,
    slack_channel: Optional[str] = None,
) -> None:
    """
    Gathers alert information and sends out the alert
    to its respective email and slack recipients
    """

    alert = session.query(Alert).get(alert_id)

    logging.info("Triggering alert: %s", alert)

    # Set all the values for the alert report
    # Alternate values are used in the case of a test alert
    # where an alert might not have a validator
    recipients = recipients or alert.recipients
    slack_channel = slack_channel or alert.slack_channel
    validation_error_message = (
        str(alert.observations[-1].value) + " " + alert.pretty_config
    )

    if alert.slice:
        alert_content = AlertContent(
            alert.label,
            alert.sql,
            str(alert.observations[-1].value),
            validation_error_message,
            _get_url_path("AlertModelView.show", user_friendly=True, pk=alert_id),
            _get_slice_screenshot(alert.slice.id, session),
        )
    else:
        # TODO: dashboard delivery!
        alert_content = AlertContent(
            alert.label,
            alert.sql,
            str(alert.observations[-1].value),
            validation_error_message,
            _get_url_path("AlertModelView.show", user_friendly=True, pk=alert_id),
            None,
        )

    if recipients:
        deliver_email_alert(alert_content, recipients)
    if slack_channel:
        deliver_slack_alert(alert_content, slack_channel)


def deliver_email_alert(alert_content: AlertContent, recipients: str) -> None:
    """Delivers an email alert to the given email recipients"""
    subject = f"[Superset] Triggered alert: {alert_content.label}"
    deliver_as_group = False
    data = None
    images = {}
    # TODO(JasonD28): add support for emails with no screenshot
    image_url = None
    if alert_content.image_data:
        image_url = alert_content.image_data.url
        if alert_content.image_data.image:
            images = {"screenshot": alert_content.image_data.image}

    body = render_template(
        "email/alert.txt",
        alert_url=alert_content.alert_url,
        label=alert_content.label,
        sql=alert_content.sql,
        observation_value=alert_content.observation_value,
        validation_error_message=alert_content.validation_error_message,
        image_url=image_url,
    )

    _deliver_email(recipients, deliver_as_group, subject, body, data, images)


def deliver_slack_alert(alert_content: AlertContent, slack_channel: str) -> None:
    """Delivers a slack alert to the given slack channel"""

    subject = __("[Alert] %(label)s", label=alert_content.label)

    image = None
    if alert_content.image_data:
        slack_message = render_template(
            "slack/alert.txt",
            label=alert_content.label,
            sql=alert_content.sql,
            observation_value=alert_content.observation_value,
            validation_error_message=alert_content.validation_error_message,
            url=alert_content.image_data.url,
            alert_url=alert_content.alert_url,
        )
        image = alert_content.image_data.image
    else:
        slack_message = render_template(
            "slack/alert_no_screenshot.txt",
            label=alert_content.label,
            sql=alert_content.sql,
            observation_value=alert_content.observation_value,
            validation_error_message=alert_content.validation_error_message,
            alert_url=alert_content.alert_url,
        )

    deliver_slack_msg(
        slack_channel, subject, slack_message, image,
    )


def evaluate_alert(
    alert_id: int,
    label: str,
    session: Session,
    recipients: Optional[str] = None,
    slack_channel: Optional[str] = None,
) -> None:
    """Processes an alert to see if it should be triggered"""

    logger.info("Processing alert ID: %i", alert_id)

    state = None
    dttm_start = datetime.utcnow()

    try:
        logger.info("Querying observers for alert <%s:%s>", alert_id, label)
        error_msg = observe(alert_id, session)
        if error_msg:
            state = AlertState.ERROR
            logging.error(error_msg)
    except Exception as exc:  # pylint: disable=broad-except
        state = AlertState.ERROR
        logging.exception(exc)
        logging.error("Failed at query observers for alert: %s (%s)", label, alert_id)

    dttm_end = datetime.utcnow()

    if state != AlertState.ERROR:
        # Don't validate alert on test runs since it may not be triggered
        if recipients or slack_channel:
            deliver_alert(alert_id, session, recipients, slack_channel)
            state = AlertState.TRIGGER
        # Validate during regular workflow and deliver only if triggered
        elif validate_observations(alert_id, label, session):
            deliver_alert(alert_id, session, recipients, slack_channel)
            state = AlertState.TRIGGER
        else:
            state = AlertState.PASS

    session.commit()
    alert = session.query(Alert).get(alert_id)
    if state != AlertState.ERROR:
        alert.last_eval_dttm = dttm_end
    alert.last_state = state
    alert.logs.append(
        AlertLog(
            scheduled_dttm=dttm_start,
            dttm_start=dttm_start,
            dttm_end=dttm_end,
            state=state,
        )
    )
    session.commit()


def validate_observations(alert_id: int, label: str, session: Session) -> bool:
    """
    Runs an alert's validators to check if it should be triggered or not
    If so, return the name of the validator that returned true
    """

    logger.info("Validating observations for alert <%s:%s>", alert_id, label)
    alert = session.query(Alert).get(alert_id)
    validate = get_validator_function(alert.validator_type)
    return bool(validate and validate(alert, alert.validator_config))


def next_schedules(
    crontab: str, start_at: datetime, stop_at: datetime, resolution: int = 0
) -> Iterator[datetime]:
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


def schedule_window(
    report_type: str,
    start_at: datetime,
    stop_at: datetime,
    resolution: int,
    session: Session,
) -> None:
    """
    Find all active schedules and schedule celery tasks for
    each of them with a specific ETA (determined by parsing
    the cron schedule for the schedule)
    """
    model_cls = get_scheduler_model(report_type)

    if not model_cls:
        return None

    schedules = session.query(model_cls).filter(model_cls.active.is_(True))

    for schedule in schedules:
        logging.info("Processing schedule %s", schedule)
        args = (report_type, schedule.id)
        schedule_start_at = start_at

        if (
            hasattr(schedule, "last_eval_dttm")
            and schedule.last_eval_dttm
            and schedule.last_eval_dttm > start_at
        ):
            schedule_start_at = schedule.last_eval_dttm + timedelta(seconds=1)

        # Schedule the job for the specified time window
        for eta in next_schedules(
            schedule.crontab, schedule_start_at, stop_at, resolution=resolution
        ):
            logging.info("Scheduled eta %s", eta)
            get_scheduler_action(report_type).apply_async(args, eta=eta)  # type: ignore

    return None


def get_scheduler_action(report_type: str) -> Optional[Callable[..., Any]]:
    if report_type == ScheduleType.dashboard:
        return schedule_email_report
    if report_type == ScheduleType.slice:
        return schedule_email_report
    if report_type == ScheduleType.alert:
        return schedule_alert_query
    return None


@celery_app.task(name="email_reports.schedule_hourly")
def schedule_hourly() -> None:
    """Celery beat job meant to be invoked hourly"""
    if not config["ENABLE_SCHEDULED_EMAIL_REPORTS"]:
        logger.info("Scheduled email reports not enabled in config")
        return

    resolution = config["EMAIL_REPORTS_CRON_RESOLUTION"] * 60

    # Get the top of the hour
    start_at = datetime.now(tzlocal()).replace(microsecond=0, second=0, minute=0)
    stop_at = start_at + timedelta(seconds=3600)

    with session_scope(nullpool=True) as session:
        schedule_window(ScheduleType.dashboard, start_at, stop_at, resolution, session)
        schedule_window(ScheduleType.slice, start_at, stop_at, resolution, session)


@celery_app.task(name="alerts.schedule_check")
def schedule_alerts() -> None:
    """Celery beat job meant to be invoked every minute to check alerts"""
    resolution = 0
    now = datetime.utcnow()
    start_at = now - timedelta(
        seconds=300
    )  # process any missed tasks in the past few minutes
    stop_at = now + timedelta(seconds=1)
    with session_scope(nullpool=True) as session:
        schedule_window(ScheduleType.alert, start_at, stop_at, resolution, session)
