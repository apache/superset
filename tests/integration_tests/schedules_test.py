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
# isort:skip_file
from datetime import datetime, timedelta
from superset.views.schedules import DashboardEmailScheduleView, SliceEmailScheduleView
from unittest.mock import Mock, patch, PropertyMock

from flask_babel import gettext as __
import pytest
from selenium.common.exceptions import WebDriverException
from slack import errors, WebClient

from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,
    load_world_bank_data,
)
from tests.integration_tests.test_app import app
from superset import db
from superset.models.dashboard import Dashboard
from superset.models.schedules import (
    DashboardEmailSchedule,
    EmailDeliveryType,
    SliceEmailReportFormat,
    SliceEmailSchedule,
)
from superset.tasks.schedules import (
    create_webdriver,
    deliver_dashboard,
    deliver_slice,
    next_schedules,
)
from superset.models.slice import Slice
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.utils import read_fixture


class TestSchedules(SupersetTestCase):

    RECIPIENTS = "recipient1@superset.com, recipient2@superset.com"
    BCC = "bcc@superset.com"
    CSV = read_fixture("trends.csv")

    @pytest.fixture()
    def add_schedule_slice_and_dashboard(self):
        with app.app_context():
            self.common_data = dict(
                active=True,
                crontab="* * * * *",
                recipients=self.RECIPIENTS,
                deliver_as_group=True,
                delivery_type=EmailDeliveryType.inline,
            )
            # Pick up a sample slice and dashboard
            slice = db.session.query(Slice).filter_by(slice_name="Region Filter").one()
            dashboard = (
                db.session.query(Dashboard)
                .filter_by(dashboard_title="World Bank's Data")
                .one()
            )

            dashboard_schedule = DashboardEmailSchedule(**self.common_data)
            dashboard_schedule.dashboard_id = dashboard.id
            dashboard_schedule.user_id = 1
            db.session.add(dashboard_schedule)

            slice_schedule = SliceEmailSchedule(**self.common_data)
            slice_schedule.slice_id = slice.id
            slice_schedule.user_id = 1
            slice_schedule.email_format = SliceEmailReportFormat.data
            slice_schedule.slack_channel = "#test_channel"

            db.session.add(slice_schedule)
            db.session.commit()

            self.slice_schedule = slice_schedule.id
            self.dashboard_schedule = dashboard_schedule.id

        yield

        with app.app_context():
            db.session.query(SliceEmailSchedule).filter_by(
                id=self.slice_schedule
            ).delete()
            db.session.query(DashboardEmailSchedule).filter_by(
                id=self.dashboard_schedule
            ).delete()
            db.session.commit()

    def test_crontab_scheduler(self):
        crontab = "* * * * *"

        start_at = datetime.now().replace(microsecond=0, second=0, minute=0)
        stop_at = start_at + timedelta(seconds=3600)

        # Fire off the task every minute
        schedules = list(next_schedules(crontab, start_at, stop_at, resolution=0))

        self.assertEqual(schedules[0], start_at)
        self.assertEqual(schedules[-1], stop_at - timedelta(seconds=60))
        self.assertEqual(len(schedules), 60)

        # Fire off the task every 10 minutes, controlled via resolution
        schedules = list(next_schedules(crontab, start_at, stop_at, resolution=10 * 60))

        self.assertEqual(schedules[0], start_at)
        self.assertEqual(schedules[-1], stop_at - timedelta(seconds=10 * 60))
        self.assertEqual(len(schedules), 6)

        # Fire off the task every 12 minutes, controlled via resolution
        schedules = list(next_schedules(crontab, start_at, stop_at, resolution=12 * 60))

        self.assertEqual(schedules[0], start_at)
        self.assertEqual(schedules[-1], stop_at - timedelta(seconds=12 * 60))
        self.assertEqual(len(schedules), 5)

    def test_wider_schedules(self):
        crontab = "*/15 2,10 * * *"

        for hour in range(0, 24):
            start_at = datetime.now().replace(
                microsecond=0, second=0, minute=0, hour=hour
            )
            stop_at = start_at + timedelta(seconds=3600)
            schedules = list(next_schedules(crontab, start_at, stop_at, resolution=0))

            if hour in (2, 10):
                self.assertEqual(len(schedules), 4)
            else:
                self.assertEqual(len(schedules), 0)

    def test_complex_schedule(self):
        # Run the job on every Friday of March and May
        # On these days, run the job at
        # 5:10 pm
        # 5:11 pm
        # 5:12 pm
        # 5:13 pm
        # 5:14 pm
        # 5:15 pm
        # 5:25 pm
        # 5:28 pm
        # 5:31 pm
        # 5:34 pm
        # 5:37 pm
        # 5:40 pm
        crontab = "10-15,25-40/3 17 * 3,5 5"
        start_at = datetime.strptime("2018/01/01", "%Y/%m/%d")
        stop_at = datetime.strptime("2018/12/31", "%Y/%m/%d")

        schedules = list(next_schedules(crontab, start_at, stop_at, resolution=60))
        self.assertEqual(len(schedules), 108)
        fmt = "%Y-%m-%d %H:%M:%S"
        self.assertEqual(schedules[0], datetime.strptime("2018-03-02 17:10:00", fmt))
        self.assertEqual(schedules[-1], datetime.strptime("2018-05-25 17:40:00", fmt))
        self.assertEqual(schedules[59], datetime.strptime("2018-03-30 17:40:00", fmt))
        self.assertEqual(schedules[60], datetime.strptime("2018-05-04 17:10:00", fmt))

    @patch("superset.tasks.schedules.firefox.webdriver.WebDriver")
    def test_create_driver(self, mock_driver_class):
        mock_driver = Mock()
        mock_driver_class.return_value = mock_driver
        mock_driver.find_elements_by_id.side_effect = [True, False]

        create_webdriver(db.session)
        mock_driver.add_cookie.assert_called_once()

    @pytest.mark.usefixtures(
        "load_world_bank_dashboard_with_slices", "add_schedule_slice_and_dashboard"
    )
    @patch("superset.tasks.schedules.firefox.webdriver.WebDriver")
    @patch("superset.tasks.schedules.send_email_smtp")
    @patch("superset.tasks.schedules.time")
    def test_deliver_dashboard_inline(self, mtime, send_email_smtp, driver_class):
        element = Mock()
        driver = Mock()
        mtime.sleep.return_value = None

        driver_class.return_value = driver

        # Ensure that we are able to login with the driver
        driver.find_elements_by_id.side_effect = [True, False]
        driver.find_element_by_class_name.return_value = element
        element.screenshot_as_png = read_fixture("sample.png")

        schedule = (
            db.session.query(DashboardEmailSchedule)
            .filter_by(id=self.dashboard_schedule)
            .one()
        )

        deliver_dashboard(
            schedule.dashboard_id,
            schedule.recipients,
            schedule.slack_channel,
            schedule.delivery_type,
            schedule.deliver_as_group,
        )

        mtime.sleep.assert_called_once()
        driver.screenshot.assert_not_called()
        send_email_smtp.assert_called_once()

    @pytest.mark.usefixtures(
        "load_world_bank_dashboard_with_slices", "add_schedule_slice_and_dashboard"
    )
    @patch("superset.tasks.schedules.firefox.webdriver.WebDriver")
    @patch("superset.tasks.schedules.send_email_smtp")
    @patch("superset.tasks.schedules.time")
    def test_deliver_dashboard_as_attachment(
        self, mtime, send_email_smtp, driver_class
    ):
        element = Mock()
        driver = Mock()
        mtime.sleep.return_value = None

        driver_class.return_value = driver

        # Ensure that we are able to login with the driver
        driver.find_elements_by_id.side_effect = [True, False]
        driver.find_element_by_id.return_value = element
        driver.find_element_by_class_name.return_value = element
        element.screenshot_as_png = read_fixture("sample.png")

        schedule = (
            db.session.query(DashboardEmailSchedule)
            .filter_by(id=self.dashboard_schedule)
            .one()
        )

        schedule.delivery_type = EmailDeliveryType.attachment

        deliver_dashboard(
            schedule.dashboard_id,
            schedule.recipients,
            schedule.slack_channel,
            schedule.delivery_type,
            schedule.deliver_as_group,
        )

        mtime.sleep.assert_called_once()
        driver.screenshot.assert_not_called()
        send_email_smtp.assert_called_once()
        self.assertIsNone(send_email_smtp.call_args[1]["images"])
        self.assertEqual(
            send_email_smtp.call_args[1]["data"]["screenshot"],
            element.screenshot_as_png,
        )

    @pytest.mark.usefixtures(
        "load_world_bank_dashboard_with_slices", "add_schedule_slice_and_dashboard"
    )
    @patch("superset.tasks.schedules.firefox.webdriver.WebDriver")
    @patch("superset.tasks.schedules.send_email_smtp")
    @patch("superset.tasks.schedules.time")
    def test_dashboard_chrome_like(self, mtime, send_email_smtp, driver_class):
        # Test functionality for chrome driver which does not support
        # element snapshots
        element = Mock()
        driver = Mock()
        mtime.sleep.return_value = None
        type(element).screenshot_as_png = PropertyMock(side_effect=WebDriverException)

        driver_class.return_value = driver

        # Ensure that we are able to login with the driver
        driver.find_elements_by_id.side_effect = [True, False]
        driver.find_element_by_id.return_value = element
        driver.find_element_by_class_name.return_value = element
        driver.screenshot.return_value = read_fixture("sample.png")

        schedule = (
            db.session.query(DashboardEmailSchedule)
            .filter_by(id=self.dashboard_schedule)
            .one()
        )

        deliver_dashboard(
            schedule.dashboard_id,
            schedule.recipients,
            schedule.slack_channel,
            schedule.delivery_type,
            schedule.deliver_as_group,
        )

        mtime.sleep.assert_called_once()
        driver.screenshot.assert_called_once()
        send_email_smtp.assert_called_once()

        self.assertEqual(send_email_smtp.call_args[0][0], self.RECIPIENTS)
        self.assertEqual(
            list(send_email_smtp.call_args[1]["images"].values())[0],
            driver.screenshot.return_value,
        )

    @pytest.mark.usefixtures(
        "load_world_bank_dashboard_with_slices", "add_schedule_slice_and_dashboard"
    )
    @patch("superset.tasks.schedules.firefox.webdriver.WebDriver")
    @patch("superset.tasks.schedules.send_email_smtp")
    @patch("superset.tasks.schedules.time")
    def test_deliver_email_options(self, mtime, send_email_smtp, driver_class):
        element = Mock()
        driver = Mock()
        mtime.sleep.return_value = None

        driver_class.return_value = driver

        # Ensure that we are able to login with the driver
        driver.find_elements_by_id.side_effect = [True, False]
        driver.find_element_by_class_name.return_value = element
        element.screenshot_as_png = read_fixture("sample.png")

        schedule = (
            db.session.query(DashboardEmailSchedule)
            .filter_by(id=self.dashboard_schedule)
            .one()
        )

        # Send individual mails to the group
        schedule.deliver_as_group = False

        # Set a bcc email address
        app.config["EMAIL_REPORT_BCC_ADDRESS"] = self.BCC

        deliver_dashboard(
            schedule.dashboard_id,
            schedule.recipients,
            schedule.slack_channel,
            schedule.delivery_type,
            schedule.deliver_as_group,
        )

        mtime.sleep.assert_called_once()
        driver.screenshot.assert_not_called()

        self.assertEqual(send_email_smtp.call_count, 2)
        self.assertEqual(send_email_smtp.call_args[1]["bcc"], self.BCC)

    @pytest.mark.usefixtures(
        "load_world_bank_dashboard_with_slices", "add_schedule_slice_and_dashboard"
    )
    @patch("superset.tasks.slack_util.WebClient.files_upload")
    @patch("superset.tasks.schedules.firefox.webdriver.WebDriver")
    @patch("superset.tasks.schedules.send_email_smtp")
    @patch("superset.tasks.schedules.time")
    def test_deliver_slice_inline_image(
        self, mtime, send_email_smtp, driver_class, files_upload
    ):
        element = Mock()
        driver = Mock()
        mtime.sleep.return_value = None

        driver_class.return_value = driver

        # Ensure that we are able to login with the driver
        driver.find_elements_by_id.side_effect = [True, False]
        driver.find_element_by_class_name.return_value = element
        element.screenshot_as_png = read_fixture("sample.png")

        schedule = (
            db.session.query(SliceEmailSchedule).filter_by(id=self.slice_schedule).one()
        )

        schedule.email_format = SliceEmailReportFormat.visualization
        schedule.delivery_format = EmailDeliveryType.inline

        deliver_slice(
            schedule.slice_id,
            schedule.recipients,
            schedule.slack_channel,
            schedule.delivery_type,
            schedule.email_format,
            schedule.deliver_as_group,
            db.session,
        )
        mtime.sleep.assert_called_once()
        driver.screenshot.assert_not_called()
        send_email_smtp.assert_called_once()

        self.assertEqual(
            list(send_email_smtp.call_args[1]["images"].values())[0],
            element.screenshot_as_png,
        )

        self.assertEqual(
            files_upload.call_args[1],
            {
                "channels": "#test_channel",
                "file": element.screenshot_as_png,
                "initial_comment": f"\n        *Region Filter*\n\n        <http://0.0.0.0:8080/superset/slice/{schedule.slice_id}/|Explore in Superset>\n        ",
                "title": "[Report]  Region Filter",
            },
        )

    @pytest.mark.usefixtures(
        "load_world_bank_dashboard_with_slices", "add_schedule_slice_and_dashboard"
    )
    @patch("superset.tasks.slack_util.WebClient.files_upload")
    @patch("superset.tasks.schedules.firefox.webdriver.WebDriver")
    @patch("superset.tasks.schedules.send_email_smtp")
    @patch("superset.tasks.schedules.time")
    def test_deliver_slice_attachment(
        self, mtime, send_email_smtp, driver_class, files_upload
    ):
        element = Mock()
        driver = Mock()
        mtime.sleep.return_value = None

        driver_class.return_value = driver

        # Ensure that we are able to login with the driver
        driver.find_elements_by_id.side_effect = [True, False]
        driver.find_element_by_class_name.return_value = element
        element.screenshot_as_png = read_fixture("sample.png")

        schedule = (
            db.session.query(SliceEmailSchedule).filter_by(id=self.slice_schedule).one()
        )

        schedule.email_format = SliceEmailReportFormat.visualization
        schedule.delivery_type = EmailDeliveryType.attachment

        deliver_slice(
            schedule.slice_id,
            schedule.recipients,
            schedule.slack_channel,
            schedule.delivery_type,
            schedule.email_format,
            schedule.deliver_as_group,
            db.session,
        )

        mtime.sleep.assert_called_once()
        driver.screenshot.assert_not_called()
        send_email_smtp.assert_called_once()

        self.assertEqual(
            send_email_smtp.call_args[1]["data"]["screenshot"],
            element.screenshot_as_png,
        )

        self.assertEqual(
            files_upload.call_args[1],
            {
                "channels": "#test_channel",
                "file": element.screenshot_as_png,
                "initial_comment": f"\n        *Region Filter*\n\n        <http://0.0.0.0:8080/superset/slice/{schedule.slice_id}/|Explore in Superset>\n        ",
                "title": "[Report]  Region Filter",
            },
        )

    @pytest.mark.usefixtures(
        "load_world_bank_dashboard_with_slices", "add_schedule_slice_and_dashboard"
    )
    @patch("superset.tasks.slack_util.WebClient.files_upload")
    @patch("superset.tasks.schedules.urllib.request.OpenerDirector.open")
    @patch("superset.tasks.schedules.urllib.request.urlopen")
    @patch("superset.tasks.schedules.send_email_smtp")
    def test_deliver_slice_csv_attachment(
        self, send_email_smtp, mock_open, mock_urlopen, files_upload
    ):
        response = Mock()
        mock_open.return_value = response
        mock_urlopen.return_value = response
        mock_urlopen.return_value.getcode.return_value = 200
        response.read.return_value = self.CSV

        schedule = (
            db.session.query(SliceEmailSchedule).filter_by(id=self.slice_schedule).one()
        )

        schedule.email_format = SliceEmailReportFormat.data
        schedule.delivery_type = EmailDeliveryType.attachment

        deliver_slice(
            schedule.slice_id,
            schedule.recipients,
            schedule.slack_channel,
            schedule.delivery_type,
            schedule.email_format,
            schedule.deliver_as_group,
            db.session,
        )

        send_email_smtp.assert_called_once()

        file_name = __("%(name)s.csv", name=schedule.slice.slice_name)

        self.assertEqual(send_email_smtp.call_args[1]["data"][file_name], self.CSV)

        self.assertEqual(
            files_upload.call_args[1],
            {
                "channels": "#test_channel",
                "file": self.CSV,
                "initial_comment": f"\n        *Region Filter*\n\n        <http://0.0.0.0:8080/superset/slice/{schedule.slice_id}/|Explore in Superset>\n        ",
                "title": "[Report]  Region Filter",
            },
        )

    @pytest.mark.usefixtures(
        "load_world_bank_dashboard_with_slices", "add_schedule_slice_and_dashboard"
    )
    @patch("superset.tasks.slack_util.WebClient.files_upload")
    @patch("superset.tasks.schedules.urllib.request.urlopen")
    @patch("superset.tasks.schedules.urllib.request.OpenerDirector.open")
    @patch("superset.tasks.schedules.send_email_smtp")
    def test_deliver_slice_csv_inline(
        self, send_email_smtp, mock_open, mock_urlopen, files_upload
    ):
        response = Mock()
        mock_open.return_value = response
        mock_urlopen.return_value = response
        mock_urlopen.return_value.getcode.return_value = 200
        response.read.return_value = self.CSV
        schedule = (
            db.session.query(SliceEmailSchedule).filter_by(id=self.slice_schedule).one()
        )

        schedule.email_format = SliceEmailReportFormat.data
        schedule.delivery_type = EmailDeliveryType.inline

        deliver_slice(
            schedule.slice_id,
            schedule.recipients,
            schedule.slack_channel,
            schedule.delivery_type,
            schedule.email_format,
            schedule.deliver_as_group,
            db.session,
        )

        send_email_smtp.assert_called_once()

        self.assertIsNone(send_email_smtp.call_args[1]["data"])
        self.assertTrue("<table " in send_email_smtp.call_args[0][2])

        self.assertEqual(
            files_upload.call_args[1],
            {
                "channels": "#test_channel",
                "file": self.CSV,
                "initial_comment": f"\n        *Region Filter*\n\n        <http://0.0.0.0:8080/superset/slice/{schedule.slice_id}/|Explore in Superset>\n        ",
                "title": "[Report]  Region Filter",
            },
        )

    def test_dashboard_disabled(self):
        with patch.object(DashboardEmailScheduleView, "is_enabled", return_value=False):
            self.login("admin")
            uri = "/dashboardemailscheduleview/list/"
            rv = self.client.get(uri)
            self.assertEqual(rv.status_code, 404)

    def test_dashboard_enabled(self):
        with patch.object(DashboardEmailScheduleView, "is_enabled", return_value=True):
            self.login("admin")
            uri = "/dashboardemailscheduleview/list/"
            rv = self.client.get(uri)
            self.assertLess(rv.status_code, 400)

    def test_slice_disabled(self):
        with patch.object(SliceEmailScheduleView, "is_enabled", return_value=False):
            self.login("admin")
            uri = "/sliceemailscheduleview/list/"
            rv = self.client.get(uri)
            self.assertEqual(rv.status_code, 404)

    def test_slice_enabled(self):
        with patch.object(SliceEmailScheduleView, "is_enabled", return_value=True):
            self.login("admin")
            uri = "/sliceemailscheduleview/list/"
            rv = self.client.get(uri)
            self.assertLess(rv.status_code, 400)


def test_slack_client_compatibility():
    c2 = WebClient()
    # slackclient >2.5.0 raises TypeError: a bytes-like object is required, not 'str
    # and requires to path a filepath instead of the bytes directly
    with pytest.raises(errors.SlackApiError):
        c2.files_upload(channels="#bogdan-test2", file=b"blabla", title="Test upload")
