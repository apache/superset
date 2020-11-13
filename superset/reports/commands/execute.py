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
import urllib
from dataclasses import dataclass
from typing import Any, Iterator, Optional

from contextlib2 import contextmanager
from flask import url_for
from sqlalchemy.orm import Session

from superset import app, thumbnail_cache
from superset.commands.base import BaseCommand
from superset.extensions import db, security_manager
from superset.models.reports import ReportExecutionLog, ReportLogState, ReportSchedule
from superset.reports.dao import ReportScheduleDAO
from superset.reports.notifications import create_notification
from superset.reports.notifications.base import NotificationContent, ScreenshotData
from superset.utils.celery import session_scope
from superset.utils.screenshots import ChartScreenshot, DashboardScreenshot
from superset.utils.urls import get_url_path

logger = logging.getLogger(__name__)


@contextmanager
def normal_session_scope() -> Iterator[Session]:
    session = db.session
    try:
        yield session
        session.commit()
    except Exception as ex:
        session.rollback()
        logger.exception(ex)
        raise
    finally:
        session.close()


def _get_url_path(view: str, user_friendly: bool = False, **kwargs: Any) -> str:
    with app.test_request_context():
        base_url = (
            app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"]
            if user_friendly
            else app.config["WEBDRIVER_BASEURL"]
        )
        return urllib.parse.urljoin(str(base_url), url_for(view, **kwargs))


class ExecuteReportScheduleCommand(BaseCommand):
    def __init__(self, model_id: int, worker_context: bool = True):
        self._worker_context = worker_context
        self._model_id = model_id
        self._model: Optional[ReportSchedule] = None

    def set_state(self, session: Session, state: ReportLogState):
        if self._model:
            self._model.last_state = state
            session.commit()

    def get_url(self, user_friendly: bool = False) -> str:
        if self._model.chart:
            return get_url_path(
                "Superset.slice",
                user_friendly=user_friendly,
                slice_id=self._model.chart_id,
                standalone="true",
            )
        return get_url_path(
            "Superset.dashboard",
            user_friendly=user_friendly,
            dashboard_id_or_slug=self._model.dashboard_id,
        )

    def get_screenshot(self) -> ScreenshotData:
        url = self.get_url()
        if self._model.chart:
            screenshot = ChartScreenshot(url, self._model.chart.digest)
        else:
            screenshot = DashboardScreenshot(url, self._model.dashboard.digest)
        image_url = self.get_url(user_friendly=True)

        user = security_manager.find_user(app.config["THUMBNAIL_SELENIUM_USER"])
        image_data = screenshot.compute_and_cache(
            user=user, cache=thumbnail_cache, force=True,
        )
        return ScreenshotData(url=image_url, image=image_data)

    def get_notification_content(self) -> NotificationContent:
        screenshot_data = self.get_screenshot()
        if self._model.chart:
            name = self._model.chart.slice_name
        else:
            name = self._model.dashboard.dashboard_title
        return NotificationContent(name=name, screenshot=screenshot_data)

    def run(self) -> None:
        if self._worker_context:
            session_context = session_scope(nullpool=True)
        else:
            session_context = normal_session_scope
        with session_context as session:
            self.validate(session=session)
            self.set_state(session, ReportLogState.WORKING)
            notification_content = self.get_notification_content()
            for recipient in self._model.recipients:
                notification = create_notification(recipient, notification_content)
                notification.send()
            self.set_state(session, ReportLogState.SUCCESS)

    def validate(self, session: Session = None) -> None:
        # Validate/populate model exists
        self._model = ReportScheduleDAO.find_by_id(self._model_id, session=session)
        if not self._model:
            raise Exception("NOT FOUND")
