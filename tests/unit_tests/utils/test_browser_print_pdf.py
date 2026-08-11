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
"""Unit tests for the SIP-212 browser-print PDF path.

No real browser is required — all Playwright and Flask interactions are mocked.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# DashboardPrintScreenshot — URL construction
# ---------------------------------------------------------------------------


class TestDashboardPrintScreenshotUrl:
    """DashboardPrintScreenshot must append ?standalone=3&print=1 to the URL."""

    @patch("superset.utils.screenshots.app")
    def test_standalone_and_print_params_appended(self, mock_app: MagicMock) -> None:
        """Both standalone=3 and print=1 must be present in the final URL."""
        mock_app.config = {"WEBDRIVER_TYPE": "chrome"}

        from superset.utils.screenshots import DashboardPrintScreenshot

        obj = DashboardPrintScreenshot(
            url="http://superset:8088/superset/dashboard/1/",
            digest="abc123",
        )

        assert "standalone=3" in obj.url
        assert "print=1" in obj.url

    @patch("superset.utils.screenshots.app")
    def test_existing_query_params_preserved(self, mock_app: MagicMock) -> None:
        """Existing URL parameters must not be dropped."""
        mock_app.config = {"WEBDRIVER_TYPE": "chrome"}

        from superset.utils.screenshots import DashboardPrintScreenshot

        obj = DashboardPrintScreenshot(
            url="http://superset:8088/superset/dashboard/1/?foo=bar",
            digest=None,
        )

        assert "foo=bar" in obj.url
        assert "print=1" in obj.url


# ---------------------------------------------------------------------------
# DashboardPrintScreenshot.get_print_pdf — feature-flag routing
# ---------------------------------------------------------------------------


class TestGetPrintPdfFlagRouting:
    """get_print_pdf() must honour feature flags before attempting capture."""

    @patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.screenshots.feature_flag_manager")
    @patch("superset.utils.screenshots.app")
    def test_returns_none_when_playwright_flag_off(
        self, mock_app: MagicMock, mock_ffm: MagicMock
    ) -> None:
        """Return None immediately if PLAYWRIGHT_REPORTS_AND_THUMBNAILS is disabled."""
        mock_app.config = {"WEBDRIVER_TYPE": "chrome"}
        mock_ffm.is_feature_enabled.return_value = False

        from superset.utils.screenshots import DashboardPrintScreenshot

        obj = DashboardPrintScreenshot(
            url="http://superset:8088/superset/dashboard/1/",
            digest="abc",
        )
        result = obj.get_print_pdf(user=MagicMock())
        assert result is None

    @patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", False)
    @patch("superset.utils.screenshots.feature_flag_manager")
    @patch("superset.utils.screenshots.app")
    def test_returns_none_when_playwright_not_installed(
        self, mock_app: MagicMock, mock_ffm: MagicMock
    ) -> None:
        """Return None immediately if Playwright is not installed."""
        mock_app.config = {"WEBDRIVER_TYPE": "chrome"}
        mock_ffm.is_feature_enabled.return_value = True  # flag on, but no playwright

        from superset.utils.screenshots import DashboardPrintScreenshot

        obj = DashboardPrintScreenshot(
            url="http://superset:8088/superset/dashboard/1/",
            digest="abc",
        )
        result = obj.get_print_pdf(user=MagicMock())
        assert result is None

    @patch("superset.utils.screenshots.PLAYWRIGHT_AVAILABLE", True)
    @patch("superset.utils.screenshots.WebDriverPlaywright")
    @patch("superset.utils.screenshots.feature_flag_manager")
    @patch("superset.utils.screenshots.app")
    def test_delegates_to_webdriver_when_flags_ok(
        self,
        mock_app: MagicMock,
        mock_ffm: MagicMock,
        mock_driver_cls: MagicMock,
    ) -> None:
        """When flags are satisfied, get_print_pdf delegates to WebDriverPlaywright."""
        mock_app.config = {"WEBDRIVER_TYPE": "chrome"}
        mock_ffm.is_feature_enabled.return_value = True

        fake_pdf = b"%PDF-1.4 fake"
        mock_driver_instance = MagicMock()
        mock_driver_instance.get_print_pdf.return_value = fake_pdf
        mock_driver_cls.return_value = mock_driver_instance

        from superset.utils.screenshots import DashboardPrintScreenshot

        obj = DashboardPrintScreenshot(
            url="http://superset:8088/superset/dashboard/1/",
            digest="abc",
        )
        user = MagicMock()
        result = obj.get_print_pdf(user=user)

        assert result == fake_pdf
        mock_driver_instance.get_print_pdf.assert_called_once()
        call_kwargs = mock_driver_instance.get_print_pdf.call_args.kwargs
        assert call_kwargs["user"] is user


# ---------------------------------------------------------------------------
# ReportExecuteCommand._get_pdf / _get_browser_print_pdf — routing logic
# ---------------------------------------------------------------------------


class TestGetPdfRouting:
    """_get_pdf() uses browser-print path when flag enabled, falls back otherwise."""

    def _make_command(self) -> object:
        """Return a minimal _ReportExecuteCommand-like stub for routing tests."""
        from superset.commands.report.execute import BaseReportState

        cmd = object.__new__(BaseReportState)
        cmd._report_execution_context = None  # type: ignore[attr-defined]
        return cmd

    @patch("superset.commands.report.execute.feature_flag_manager")
    def test_skips_browser_print_when_flag_off(
        self, mock_ffm: MagicMock
    ) -> None:
        """When DASHBOARD_REPORTS_BROWSER_PRINT_PDF is False, skip the new path."""
        mock_ffm.is_feature_enabled.return_value = False

        cmd = self._make_command()

        schedule = MagicMock()
        schedule.dashboard = MagicMock()  # is a dashboard report
        cmd._report_schedule = schedule  # type: ignore[attr-defined]

        # Patch _get_screenshots + build_pdf_from_screenshots so the fallback succeeds
        with (
            patch.object(
                type(cmd), "_get_screenshots", return_value=[b"fake-png"]
            ),
            patch(
                "superset.commands.report.execute.build_pdf_from_screenshots",
                return_value=b"fallback-pdf",
            ),
            patch.object(type(cmd), "_phase_timeout", return_value=None),
        ):
            result = cmd._get_pdf()  # type: ignore[attr-defined]

        assert result == b"fallback-pdf"

    @patch("superset.commands.report.execute.feature_flag_manager")
    def test_skips_browser_print_for_chart_report(
        self, mock_ffm: MagicMock
    ) -> None:
        """Browser-print path must be skipped for chart reports (no dashboard)."""
        mock_ffm.is_feature_enabled.return_value = True

        cmd = self._make_command()
        schedule = MagicMock()
        schedule.dashboard = None  # chart report, not a dashboard
        cmd._report_schedule = schedule  # type: ignore[attr-defined]

        with (
            patch.object(
                type(cmd), "_get_screenshots", return_value=[b"fake-png"]
            ),
            patch(
                "superset.commands.report.execute.build_pdf_from_screenshots",
                return_value=b"chart-fallback-pdf",
            ),
            patch.object(type(cmd), "_phase_timeout", return_value=None),
        ):
            result = cmd._get_pdf()  # type: ignore[attr-defined]

        assert result == b"chart-fallback-pdf"


# ---------------------------------------------------------------------------
# _get_browser_print_pdf — multi-URL guard
# ---------------------------------------------------------------------------


class TestGetBrowserPrintPdfMultiUrl:
    """_get_browser_print_pdf must return None for multi-URL dashboards."""

    @patch("superset.commands.report.execute.DashboardPrintScreenshot")
    @patch("superset.commands.report.execute.resolve_executor_user")
    @patch("superset.commands.report.execute.app")
    def test_returns_none_for_multi_url_dashboard(
        self,
        mock_app: MagicMock,
        mock_resolver: MagicMock,
        mock_screenshot_cls: MagicMock,
    ) -> None:
        """Two or more URLs → return None (deferred to Phase 5 multi-page merge)."""
        mock_app.config = {
            "WEBDRIVER_WINDOW": {"dashboard": (1600, 1200)},
            "ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH": 3000,
        }

        from superset.commands.report.execute import BaseReportState

        cmd = object.__new__(BaseReportState)
        cmd._report_execution_context = None  # type: ignore[attr-defined]

        schedule = MagicMock()
        schedule.custom_width = None
        schedule.custom_height = None
        cmd._report_schedule = schedule  # type: ignore[attr-defined]

        mock_resolver.return_value = (MagicMock(), None)

        with patch.object(
            type(cmd),
            "get_dashboard_urls",
            return_value=["http://superset:8088/url1/", "http://superset:8088/url2/"],
        ):
            result = cmd._get_browser_print_pdf()  # type: ignore[attr-defined]

        assert result is None
        mock_screenshot_cls.assert_not_called()
