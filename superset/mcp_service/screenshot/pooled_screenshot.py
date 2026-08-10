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
Pooled screenshot implementations for improved performance.

Screenshot generation delegates to the Playwright-based WebDriverPlaywright
via BaseScreenshot, which uses a process-scoped browser manager for efficient
context reuse without per-request browser startup/shutdown overhead.
"""

import logging

from flask_appbuilder.security.sqla.models import User

from superset.utils.report_execution import ReportExecutionContext
from superset.utils.screenshots import BaseScreenshot, WindowSize

logger = logging.getLogger(__name__)


class PooledBaseScreenshot(BaseScreenshot):
    """
    Screenshot class that delegates to the Playwright-based BaseScreenshot.

    The name is retained for import compatibility. Screenshot generation uses
    WebDriverPlaywright (via BaseScreenshot.get_screenshot), which manages a
    long-lived Chromium browser per worker process and creates isolated contexts
    per screenshot request.
    """

    def get_screenshot(
        self,
        user: User,
        window_size: WindowSize | None = None,
        log_context: str | None = None,
        report_execution_context: ReportExecutionContext | None = None,
    ) -> bytes | None:
        return super().get_screenshot(
            user=user,
            window_size=window_size,
            log_context=log_context,
            report_execution_context=report_execution_context,
        )


class PooledChartScreenshot(PooledBaseScreenshot):
    """Pooled version of chart screenshot generation."""

    thumbnail_type: str = "chart"
    element: str = "chart-container"

    def __init__(
        self,
        url: str,
        digest: str | None,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
    ):
        from superset.utils.urls import modify_url_query
        from superset.utils.webdriver import ChartStandaloneMode

        url = modify_url_query(
            url,
            standalone=ChartStandaloneMode.HIDE_NAV.value,
        )
        super().__init__(url, digest)
        self.window_size = window_size or (800, 600)
        self.thumb_size = thumb_size or (400, 300)


class PooledExploreScreenshot(PooledBaseScreenshot):
    """Pooled version of explore screenshot generation."""

    thumbnail_type: str = "explore"
    element: str = "chart-container"

    def __init__(
        self,
        url: str,
        digest: str | None,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
    ):
        super().__init__(url, digest)
        self.window_size = window_size or (1600, 1200)
        self.thumb_size = thumb_size or (800, 600)


class PooledDashboardScreenshot(PooledBaseScreenshot):
    """Pooled version of dashboard screenshot generation."""

    thumbnail_type: str = "dashboard"
    element: str = "standalone"

    def __init__(
        self,
        url: str,
        digest: str | None,
        window_size: WindowSize | None = None,
        thumb_size: WindowSize | None = None,
    ):
        from superset.utils.urls import modify_url_query
        from superset.utils.webdriver import DashboardStandaloneMode

        url = modify_url_query(
            url,
            standalone=DashboardStandaloneMode.REPORT.value,
        )
        super().__init__(url, digest)
        self.window_size = window_size or (1600, 1200)
        self.thumb_size = thumb_size or (800, 600)
