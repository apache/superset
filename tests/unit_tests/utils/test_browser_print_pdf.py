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
    def test_skips_browser_print_when_flag_off(self, mock_ffm: MagicMock) -> None:
        """When DASHBOARD_REPORTS_BROWSER_PRINT_PDF is False, skip the new path."""
        mock_ffm.is_feature_enabled.return_value = False

        cmd = self._make_command()

        schedule = MagicMock()
        schedule.dashboard = MagicMock()  # is a dashboard report
        cmd._report_schedule = schedule  # type: ignore[attr-defined]

        # Patch _get_screenshots + build_pdf_from_screenshots so the fallback succeeds
        with (
            patch.object(type(cmd), "_get_screenshots", return_value=[b"fake-png"]),
            patch(
                "superset.commands.report.execute.build_pdf_from_screenshots",
                return_value=b"fallback-pdf",
            ),
            patch.object(type(cmd), "_phase_timeout", return_value=None),
        ):
            result = cmd._get_pdf()  # type: ignore[attr-defined]

        assert result == b"fallback-pdf"

    @patch("superset.commands.report.execute.feature_flag_manager")
    def test_skips_browser_print_for_chart_report(self, mock_ffm: MagicMock) -> None:
        """Browser-print path must be skipped for chart reports (no dashboard)."""
        mock_ffm.is_feature_enabled.return_value = True

        cmd = self._make_command()
        schedule = MagicMock()
        schedule.dashboard = None  # chart report, not a dashboard
        cmd._report_schedule = schedule  # type: ignore[attr-defined]

        with (
            patch.object(type(cmd), "_get_screenshots", return_value=[b"fake-png"]),
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
        cmd._execution_id = "test-exec-id"  # type: ignore[attr-defined]

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


# ---------------------------------------------------------------------------
# WebDriverPlaywright — header/footer template builders
# ---------------------------------------------------------------------------


class TestBuildPdfHeaderTemplate:
    """_build_pdf_header_template renders all three slots with token expansion."""

    def test_default_content_uses_title_and_date(self) -> None:
        """No content dict → left=title, right contains date span."""
        from superset.utils.webdriver import WebDriverPlaywright

        html = WebDriverPlaywright._build_pdf_header_template("My Dashboard")

        assert "My Dashboard" in html
        assert '<span class="date"></span>' in html

    def test_custom_left_slot(self) -> None:
        """Operator-supplied left string replaces the default title."""
        from superset.utils.webdriver import WebDriverPlaywright

        html = WebDriverPlaywright._build_pdf_header_template(
            "Ignored Title",
            content={"left": "ACME Corp"},
        )

        assert "ACME Corp" in html

    def test_title_token_expanded(self) -> None:
        """{title} in a custom slot is replaced with the dashboard title."""
        from superset.utils.webdriver import WebDriverPlaywright

        html = WebDriverPlaywright._build_pdf_header_template(
            "Sales Q4",
            content={"center": "Report: {title}"},
        )

        assert "Report: Sales Q4" in html

    def test_html_special_chars_escaped(self) -> None:
        """A title with HTML special characters is escaped, not injected."""
        from superset.utils.webdriver import WebDriverPlaywright

        html = WebDriverPlaywright._build_pdf_header_template(
            "<script>alert(1)</script>",
        )

        assert "<script>" not in html
        assert "&lt;script&gt;" in html

    def test_date_token_becomes_chromium_span(self) -> None:
        """{date} in a custom slot is converted to the Chromium date span."""
        from superset.utils.webdriver import WebDriverPlaywright

        html = WebDriverPlaywright._build_pdf_header_template(
            "T",
            content={"right": "Printed: {date}"},
        )

        assert "Printed: " in html
        assert '<span class="date"></span>' in html

    def test_overflow_protection_present(self) -> None:
        """Every slot span must include overflow:hidden and text-overflow:ellipsis."""
        from superset.utils.webdriver import WebDriverPlaywright

        html = WebDriverPlaywright._build_pdf_header_template("Title")

        assert html.count("overflow:hidden") >= 3
        assert html.count("text-overflow:ellipsis") >= 3
        assert html.count("max-width:200px") >= 3


class TestBuildPdfFooterTemplate:
    """_build_pdf_footer_template renders left/center slots and fixed page numbers."""

    def test_default_content_present(self) -> None:
        """Default footer has 'Confidential' and 'Generated by Apache Superset'."""
        from superset.utils.webdriver import WebDriverPlaywright

        html = WebDriverPlaywright._build_pdf_footer_template()

        assert "Confidential" in html
        assert "Generated by Apache Superset" in html

    def test_page_number_classes_always_present(self) -> None:
        """pageNumber and totalPages Chromium classes must always appear."""
        from superset.utils.webdriver import WebDriverPlaywright

        html = WebDriverPlaywright._build_pdf_footer_template(
            content={"left": "Custom", "center": "Also custom"}
        )

        assert 'class="pageNumber"' in html
        assert 'class="totalPages"' in html

    def test_custom_left_and_center(self) -> None:
        """Operator-supplied left/center replace the defaults."""
        from superset.utils.webdriver import WebDriverPlaywright

        html = WebDriverPlaywright._build_pdf_footer_template(
            content={"left": "DO NOT COPY", "center": "INTERNAL NOTICE"}
        )

        assert "DO NOT COPY" in html
        assert "INTERNAL NOTICE" in html
        assert "Confidential" not in html
        assert "Generated by Apache Superset" not in html

    def test_overflow_protection_on_left_and_center(self) -> None:
        """Left and center slots must have overflow:hidden + ellipsis."""
        from superset.utils.webdriver import WebDriverPlaywright

        html = WebDriverPlaywright._build_pdf_footer_template()

        assert html.count("overflow:hidden") >= 2
        assert html.count("text-overflow:ellipsis") >= 2


class TestResolveSlot:
    """_resolve_slot handles token expansion and HTML-escaping correctly."""

    def test_no_tokens_plain_text(self) -> None:
        """Plain text with no tokens is HTML-escaped and returned as-is."""
        from superset.utils.webdriver import WebDriverPlaywright

        result = WebDriverPlaywright._resolve_slot("Hello World", "ignored")

        assert result == "Hello World"

    def test_title_token_replaced(self) -> None:
        """{title} is replaced with the provided title string."""
        from superset.utils.webdriver import WebDriverPlaywright

        result = WebDriverPlaywright._resolve_slot("Report: {title}", "Q3 Sales")

        assert result == "Report: Q3 Sales"

    def test_date_token_becomes_span(self) -> None:
        """{date} is replaced with the Chromium date span."""
        from superset.utils.webdriver import WebDriverPlaywright

        result = WebDriverPlaywright._resolve_slot("As of {date}", "")

        assert "As of " in result
        assert '<span class="date"></span>' in result

    def test_html_special_chars_in_title_escaped(self) -> None:
        """Title characters that are HTML-special are escaped in output."""
        from superset.utils.webdriver import WebDriverPlaywright

        result = WebDriverPlaywright._resolve_slot("{title}", "A & B <> C")

        assert "&amp;" in result
        assert "&lt;" in result
        assert "&gt;" in result
        assert "<" not in result.replace('<span class="date"></span>', "")

    def test_ampersand_in_literal_text_escaped(self) -> None:
        """Literal '&' in the slot string itself is HTML-escaped."""
        from superset.utils.webdriver import WebDriverPlaywright

        result = WebDriverPlaywright._resolve_slot("Q&A", "")

        assert "&amp;" in result
        assert "Q&A" not in result


# ---------------------------------------------------------------------------
# _get_browser_print_pdf — per-report orientation override
# ---------------------------------------------------------------------------


class TestPerReportOrientation:
    """extra.dashboard.pdf_orientation overrides the global config value."""

    def _make_command(self) -> object:
        from superset.commands.report.execute import BaseReportState

        cmd = object.__new__(BaseReportState)
        cmd._report_execution_context = None  # type: ignore[attr-defined]
        cmd._execution_id = "test-exec-id"  # type: ignore[attr-defined]
        return cmd

    @patch("superset.commands.report.execute.DashboardPrintScreenshot")
    @patch("superset.commands.report.execute.resolve_executor_user")
    @patch("superset.commands.report.execute.app")
    def test_landscape_extra_overrides_config(
        self,
        mock_app: MagicMock,
        mock_resolver: MagicMock,
        mock_screenshot_cls: MagicMock,
    ) -> None:
        """extra.dashboard.pdf_orientation='landscape' overrides global config."""
        mock_app.config = {
            "WEBDRIVER_WINDOW": {"dashboard": (1600, 1200)},
            "ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH": 3000,
            "BROWSER_PRINT_PDF_FONT_SIZE": None,
            "BROWSER_PRINT_PDF_LAYOUT": None,
            "BROWSER_PRINT_PDF_ORIENTATION": "portrait",  # global default
        }
        cmd = self._make_command()
        schedule = MagicMock()
        schedule.custom_width = None
        schedule.custom_height = None
        schedule.extra = {"dashboard": {"pdf_orientation": "landscape"}}
        schedule.dashboard.dashboard_title = "My Dashboard"
        schedule.dashboard.digest = "abc"
        cmd._report_schedule = schedule  # type: ignore[attr-defined]

        mock_resolver.return_value = (MagicMock(), None)
        mock_screenshot_instance = MagicMock()
        mock_screenshot_instance.get_print_pdf.return_value = b"%PDF-landscape"
        mock_screenshot_cls.return_value = mock_screenshot_instance

        from unittest.mock import PropertyMock

        with (
            patch.object(
                type(cmd),
                "_log_context",
                new_callable=PropertyMock,
                return_value="test",
            ),
            patch.object(
                type(cmd),
                "get_dashboard_urls",
                return_value=["http://superset:8088/dash/1/"],
            ),
        ):
            result = cmd._get_browser_print_pdf()  # type: ignore[attr-defined]

        assert result == b"%PDF-landscape"
        # The per-report 'landscape' must be passed to get_print_pdf
        call_kwargs = mock_screenshot_instance.get_print_pdf.call_args.kwargs
        assert call_kwargs.get("print_orientation") == "landscape"

    @patch("superset.commands.report.execute.DashboardPrintScreenshot")
    @patch("superset.commands.report.execute.resolve_executor_user")
    @patch("superset.commands.report.execute.app")
    def test_invalid_extra_orientation_falls_back_to_config(
        self,
        mock_app: MagicMock,
        mock_resolver: MagicMock,
        mock_screenshot_cls: MagicMock,
    ) -> None:
        """An invalid pdf_orientation value in extra is ignored; config is used."""
        mock_app.config = {
            "WEBDRIVER_WINDOW": {"dashboard": (1600, 1200)},
            "ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH": 3000,
            "BROWSER_PRINT_PDF_FONT_SIZE": None,
            "BROWSER_PRINT_PDF_LAYOUT": None,
            "BROWSER_PRINT_PDF_ORIENTATION": "portrait",
        }

        cmd = self._make_command()
        schedule = MagicMock()
        schedule.custom_width = None
        schedule.custom_height = None
        schedule.extra = {"dashboard": {"pdf_orientation": "INVALID"}}
        schedule.dashboard.dashboard_title = "My Dashboard"
        schedule.dashboard.digest = "abc"
        cmd._report_schedule = schedule  # type: ignore[attr-defined]

        mock_resolver.return_value = (MagicMock(), None)
        mock_screenshot_instance = MagicMock()
        mock_screenshot_instance.get_print_pdf.return_value = b"%PDF-portrait"
        mock_screenshot_cls.return_value = mock_screenshot_instance

        from unittest.mock import PropertyMock

        with (
            patch.object(
                type(cmd),
                "_log_context",
                new_callable=PropertyMock,
                return_value="test",
            ),
            patch.object(
                type(cmd),
                "get_dashboard_urls",
                return_value=["http://superset:8088/dash/1/"],
            ),
        ):
            cmd._get_browser_print_pdf()  # type: ignore[attr-defined]

        call_kwargs = mock_screenshot_instance.get_print_pdf.call_args.kwargs
        # Should use the config value since extra value is invalid
        assert call_kwargs.get("print_orientation") == "portrait"

    @patch("superset.commands.report.execute.DashboardPrintScreenshot")
    @patch("superset.commands.report.execute.resolve_executor_user")
    @patch("superset.commands.report.execute.app")
    def test_no_extra_uses_config(
        self,
        mock_app: MagicMock,
        mock_resolver: MagicMock,
        mock_screenshot_cls: MagicMock,
    ) -> None:
        """When extra is empty, the global config orientation is used."""
        mock_app.config = {
            "WEBDRIVER_WINDOW": {"dashboard": (1600, 1200)},
            "ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH": 3000,
            "BROWSER_PRINT_PDF_FONT_SIZE": None,
            "BROWSER_PRINT_PDF_LAYOUT": None,
            "BROWSER_PRINT_PDF_ORIENTATION": "landscape",
        }

        cmd = self._make_command()
        schedule = MagicMock()
        schedule.custom_width = None
        schedule.custom_height = None
        schedule.extra = {}  # no pdf_orientation in extra
        schedule.dashboard.dashboard_title = "My Dashboard"
        schedule.dashboard.digest = "abc"
        cmd._report_schedule = schedule  # type: ignore[attr-defined]

        mock_resolver.return_value = (MagicMock(), None)
        mock_screenshot_instance = MagicMock()
        mock_screenshot_instance.get_print_pdf.return_value = b"%PDF"
        mock_screenshot_cls.return_value = mock_screenshot_instance

        from unittest.mock import PropertyMock

        with (
            patch.object(
                type(cmd),
                "_log_context",
                new_callable=PropertyMock,
                return_value="test",
            ),
            patch.object(
                type(cmd),
                "get_dashboard_urls",
                return_value=["http://superset:8088/dash/1/"],
            ),
        ):
            cmd._get_browser_print_pdf()  # type: ignore[attr-defined]

        call_kwargs = mock_screenshot_instance.get_print_pdf.call_args.kwargs
        assert call_kwargs.get("print_orientation") == "landscape"


# ---------------------------------------------------------------------------
# _get_browser_print_pdf — per-report header/footer content override
# ---------------------------------------------------------------------------


class TestPerReportHeaderFooter:
    """extra.dashboard.pdf_header/pdf_footer override the global config values."""

    def _make_command(self) -> object:
        from superset.commands.report.execute import BaseReportState

        cmd = object.__new__(BaseReportState)
        cmd._report_execution_context = None  # type: ignore[attr-defined]
        cmd._execution_id = "test-exec-id"  # type: ignore[attr-defined]
        return cmd

    def _base_config(self) -> dict:
        return {
            "WEBDRIVER_WINDOW": {"dashboard": (1600, 1200)},
            "ALERT_REPORTS_MAX_CUSTOM_SCREENSHOT_WIDTH": 3000,
            "BROWSER_PRINT_PDF_FONT_SIZE": None,
            "BROWSER_PRINT_PDF_LAYOUT": None,
            "BROWSER_PRINT_PDF_ORIENTATION": None,
        }

    @patch("superset.commands.report.execute.DashboardPrintScreenshot")
    @patch("superset.commands.report.execute.resolve_executor_user")
    @patch("superset.commands.report.execute.app")
    def test_per_report_header_passed_to_get_print_pdf(
        self,
        mock_app: MagicMock,
        mock_resolver: MagicMock,
        mock_screenshot_cls: MagicMock,
    ) -> None:
        """extra.dashboard.pdf_header is forwarded as header_content."""
        mock_app.config = self._base_config()
        cmd = self._make_command()
        schedule = MagicMock()
        schedule.custom_width = None
        schedule.custom_height = None
        custom_header = {"left": "ACME Corp", "right": "Q4 Report"}
        schedule.extra = {"dashboard": {"pdf_header": custom_header}}
        schedule.dashboard.dashboard_title = "Sales"
        schedule.dashboard.digest = "abc"
        cmd._report_schedule = schedule  # type: ignore[attr-defined]

        mock_resolver.return_value = (MagicMock(), None)
        mock_instance = MagicMock()
        mock_instance.get_print_pdf.return_value = b"%PDF"
        mock_screenshot_cls.return_value = mock_instance

        from unittest.mock import PropertyMock

        with (
            patch.object(
                type(cmd),
                "_log_context",
                new_callable=PropertyMock,
                return_value="test",
            ),
            patch.object(
                type(cmd),
                "get_dashboard_urls",
                return_value=["http://superset:8088/dash/1/"],
            ),
        ):
            cmd._get_browser_print_pdf()  # type: ignore[attr-defined]

        kwargs = mock_instance.get_print_pdf.call_args.kwargs
        assert kwargs.get("header_content") == custom_header

    @patch("superset.commands.report.execute.DashboardPrintScreenshot")
    @patch("superset.commands.report.execute.resolve_executor_user")
    @patch("superset.commands.report.execute.app")
    def test_per_report_footer_passed_to_get_print_pdf(
        self,
        mock_app: MagicMock,
        mock_resolver: MagicMock,
        mock_screenshot_cls: MagicMock,
    ) -> None:
        """extra.dashboard.pdf_footer is forwarded as footer_content."""
        mock_app.config = self._base_config()
        cmd = self._make_command()
        schedule = MagicMock()
        schedule.custom_width = None
        schedule.custom_height = None
        custom_footer = {"left": "Internal Only", "center": "ACME Internal"}
        schedule.extra = {"dashboard": {"pdf_footer": custom_footer}}
        schedule.dashboard.dashboard_title = "Sales"
        schedule.dashboard.digest = "abc"
        cmd._report_schedule = schedule  # type: ignore[attr-defined]

        mock_resolver.return_value = (MagicMock(), None)
        mock_instance = MagicMock()
        mock_instance.get_print_pdf.return_value = b"%PDF"
        mock_screenshot_cls.return_value = mock_instance

        from unittest.mock import PropertyMock

        with (
            patch.object(
                type(cmd),
                "_log_context",
                new_callable=PropertyMock,
                return_value="test",
            ),
            patch.object(
                type(cmd),
                "get_dashboard_urls",
                return_value=["http://superset:8088/dash/1/"],
            ),
        ):
            cmd._get_browser_print_pdf()  # type: ignore[attr-defined]

        kwargs = mock_instance.get_print_pdf.call_args.kwargs
        assert kwargs.get("footer_content") == custom_footer

    @patch("superset.commands.report.execute.DashboardPrintScreenshot")
    @patch("superset.commands.report.execute.resolve_executor_user")
    @patch("superset.commands.report.execute.app")
    def test_no_header_footer_extra_passes_none(
        self,
        mock_app: MagicMock,
        mock_resolver: MagicMock,
        mock_screenshot_cls: MagicMock,
    ) -> None:
        """When pdf_header/pdf_footer absent from extra, None is forwarded.

        None tells the webdriver to use the global operator config value.
        """
        mock_app.config = self._base_config()
        cmd = self._make_command()
        schedule = MagicMock()
        schedule.custom_width = None
        schedule.custom_height = None
        schedule.extra = {"dashboard": {}}  # no header/footer keys
        schedule.dashboard.dashboard_title = "Sales"
        schedule.dashboard.digest = "abc"
        cmd._report_schedule = schedule  # type: ignore[attr-defined]

        mock_resolver.return_value = (MagicMock(), None)
        mock_instance = MagicMock()
        mock_instance.get_print_pdf.return_value = b"%PDF"
        mock_screenshot_cls.return_value = mock_instance

        from unittest.mock import PropertyMock

        with (
            patch.object(
                type(cmd),
                "_log_context",
                new_callable=PropertyMock,
                return_value="test",
            ),
            patch.object(
                type(cmd),
                "get_dashboard_urls",
                return_value=["http://superset:8088/dash/1/"],
            ),
        ):
            cmd._get_browser_print_pdf()  # type: ignore[attr-defined]

        kwargs = mock_instance.get_print_pdf.call_args.kwargs
        assert kwargs.get("header_content") is None
        assert kwargs.get("footer_content") is None

    def test_webdriver_per_report_header_overrides_config(self) -> None:
        """get_print_pdf uses per-report header_content over the config dict."""
        from superset.utils.webdriver import WebDriverPlaywright

        # Verify the resolver logic directly via the builder: when per-report
        # content is supplied, it takes precedence over the global config value.
        # We test _build_pdf_header_template with per-report content directly.
        per_report = {"left": "ACME Corp", "center": "", "right": "Q4 {date}"}
        html = WebDriverPlaywright._build_pdf_header_template(
            "Dashboard Title", content=per_report
        )

        assert "ACME Corp" in html
        assert "Apache Superset" not in html  # default right slot not present
        assert '<span class="date"></span>' in html  # {date} expanded

    def test_webdriver_per_report_footer_overrides_config(self) -> None:
        """get_print_pdf uses per-report footer_content over the config dict."""
        from superset.utils.webdriver import WebDriverPlaywright

        per_report = {"left": "Internal Only", "center": "ACME Reports"}
        html = WebDriverPlaywright._build_pdf_footer_template(content=per_report)

        assert "Internal Only" in html
        assert "ACME Reports" in html
        assert "Confidential" not in html
        assert "Generated by Apache Superset" not in html
        # Page N of M must still be present
        assert 'class="pageNumber"' in html
        assert 'class="totalPages"' in html
