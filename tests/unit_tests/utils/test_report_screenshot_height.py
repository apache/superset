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

"""Report dashboard screenshots end at the rendered content.

A full-page capture is never shorter than the capture window, so a dashboard
that ends above the window bottom used to be delivered with a tall band of
empty page background. Report captures opt in to ending at the content; every
other capture keeps the window height.

The browser tests drive the production screenshot classes against local pages
that mirror the report-mode shell (a two-tone shell whose boxes are pinned to
the viewport) and skip when Chromium is not installed. The remaining tests need
no browser.
"""

import io
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from PIL import Image, ImageChops

from superset.utils.report_execution import (
    ReportArtifactKind,
    ReportExecutionContext,
    ReportExecutionDeadline,
)
from superset.utils.screenshot_utils import validate_report_screenshot
from superset.utils.screenshots import ChartScreenshot, DashboardScreenshot
from superset.utils.webdriver import WebDriverPlaywright

GREY = (245, 245, 245)
WHITE = (255, 255, 255)
BLUE = (0, 102, 204)
GREEN = (0, 153, 51)
RED = (255, 0, 0)
PURPLE = (148, 0, 211)

WINDOW = (1600, 2000)
URL = "http://example.com/superset/dashboard/1/"


def _rgb(color: tuple[int, int, int]) -> str:
    return f"rgb({color[0]},{color[1]},{color[2]})"


def _chart_row(chart_id: int, height: int, color: tuple[int, int, int]) -> str:
    """A chart tile with an explicit pixel height, as the dashboard grid renders.

    ``_expand_scrollable_content`` sets ``.slice_container`` to ``height: auto``,
    so the explicit height lives on the wrapper and on the painted block.
    """
    return (
        f'<div style="height:{height}px">'
        f'<div class="dashboard-component-chart-holder dashboard-chart-id-{chart_id}">'
        '<div class="chart-container"><div class="slice_container">'
        f'<div style="height:{height - 34}px;background:{_rgb(color)}"></div>'
        "</div></div></div></div>"
    )


def _dashboard_page(
    content: str,
    *,
    body_bg: tuple[int, int, int] = WHITE,
    shell_bg: tuple[int, int, int] = GREY,
    extra_css: str = "",
    before_app: str = "",
    after_app: str = "",
) -> str:
    """The report-mode shell: ``body`` paints one colour, the layout boxes another."""
    return (
        "<!doctype html><html><head><style>"
        "html{height:100%} "
        "body{min-height:100vh;display:flex;flex-direction:column;"
        f"background-color:{_rgb(body_bg)};margin:0}} "
        "#app{flex:1 1 auto;position:relative;display:flex;flex-direction:column} "
        ".ant-layout{display:flex;flex:auto;flex-direction:column;min-height:0;"
        f"background:{_rgb(shell_bg)}}} "
        f".dashboard-content{{background-color:{_rgb(shell_bg)};display:flex;"
        "flex-direction:row;flex:1} "
        ".grid-container{width:0;flex:1;position:relative;margin:16px} "
        ".dashboard-component-chart-holder{width:100%;height:100%;"
        "box-sizing:border-box;padding:16px;border:1px solid #ccc;"
        "background:rgb(250,250,250);overflow-y:visible} "
        ".chart-container,.slice_container{height:100%} "
        f"{extra_css}"
        '</style></head><body class="standalone">'
        f'{before_app}<div id="app"><div class="ant-layout">'
        '<div class="dashboard-content"><div class="grid-container">'
        f'<div class="dashboard-grid" style="position:relative">{content}</div>'
        f"</div></div></div></div>{after_app}</body></html>"
    )


def _is_missing_browser_executable(message: str) -> bool:
    return "executable doesn't exist" in message.lower()


@pytest.fixture(scope="module")
def chromium() -> Iterator[Any]:
    sync_api = pytest.importorskip("playwright.sync_api")
    playwright = sync_api.sync_playwright().start()
    try:
        try:
            browser = playwright.chromium.launch()
        except Exception as ex:  # noqa: BLE001
            if _is_missing_browser_executable(str(ex)):
                pytest.skip("Chromium is not installed")
            raise
        try:
            yield browser
        finally:
            browser.close()
    finally:
        playwright.stop()


class _BrowserManager:
    def __init__(self, browser: Any) -> None:
        self._browser = browser

    def get_browser(self, args: Any) -> Any:
        return self._browser


def _write_page(tmp_path: Path, html: str) -> str:
    page = tmp_path / "dashboard.html"
    page.write_text(html, encoding="utf-8")
    return page.as_uri()


def _report_context() -> ReportExecutionContext:
    return ReportExecutionContext(
        execution_id=UUID("084e7ee6-5557-4ecd-9632-b7f39c9ec524"),
        report_schedule_id=11,
        dashboard_id=805,
        expected_chart_count=1,
        deadline=ReportExecutionDeadline(
            total_seconds=240,
            started_at=0,
            _clock=lambda: 0,
        ),
        capture_reserve_seconds=60,
        delivery_reserve_seconds=120,
        cleanup_reserve_seconds=30,
    )


def _capture(
    app: Any,
    chromium: Any,
    url: str,
    *,
    trim: bool,
    tiled: bool = False,
    context: ReportExecutionContext | None = None,
    pixel_density: float = 1,
) -> bytes:
    """Capture through ``DashboardScreenshot`` exactly as a report does."""
    config: dict[str, Any] = {
        "SCREENSHOT_SELENIUM_HEADSTART": 0,
        "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 0,
        "SCREENSHOT_LOCATE_WAIT": 10,
        "SCREENSHOT_LOAD_WAIT": 10,
        "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "load",
        "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 20000,
        "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
        "SCREENSHOT_TILED_ENABLED": tiled,
        "WEBDRIVER_WINDOW": {
            "dashboard": WINDOW,
            "slice": WINDOW,
            "pixel_density": pixel_density,
        },
    }
    if tiled:
        config.update(
            SCREENSHOT_TILED_CHART_THRESHOLD=1,
            SCREENSHOT_TILED_HEIGHT_THRESHOLD=5000,
            SCREENSHOT_TILED_VIEWPORT_HEIGHT=2000,
        )
    options: dict[str, Any] = {}
    if trim:
        options["trim_to_content"] = True
    try:
        screenshot = DashboardScreenshot(
            url,
            "digest",
            window_size=WINDOW,
            require_complete_capture=tiled and context is None,
            **options,
        )
    except TypeError as ex:
        raise AssertionError(
            f"DashboardScreenshot has no trim_to_content opt-in ({ex})"
        ) from ex
    with (
        patch.dict(app.config, config),
        patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True),
        patch("superset.utils.webdriver._browser_manager", _BrowserManager(chromium)),
    ):
        png = screenshot.get_screenshot(user=None, report_execution_context=context)
    assert png
    return png


def _size(png: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(png)) as image:
        return image.size


def _band(png: bytes, color: tuple[int, int, int]) -> tuple[int, int] | None:
    """First row and one past the last row holding a pixel of exactly ``color``."""
    with Image.open(io.BytesIO(png)) as image:
        channels = image.convert("RGB").split()
    reference = [Image.new("L", channels[0].size, value) for value in color]
    differences = [
        ImageChops.difference(channel, expected)
        for channel, expected in zip(channels, reference, strict=True)
    ]
    mismatch = ImageChops.lighter(
        ImageChops.lighter(differences[0], differences[1]), differences[2]
    )
    box = mismatch.point(lambda value: 255 if value == 0 else 0).getbbox()
    return None if box is None else (box[1], box[3])


PATHS = pytest.mark.parametrize("tiled", [False, True], ids=["standard", "tiled"])


@PATHS
def test_short_dashboard_capture_ends_at_the_content(
    app: Any, chromium: Any, tmp_path: Path, tiled: bool
) -> None:
    url = _write_page(tmp_path, _dashboard_page(_chart_row(1, 400, BLUE)))
    base = _capture(app, chromium, url, trim=False, tiled=tiled)
    trimmed = _capture(app, chromium, url, trim=True, tiled=tiled)

    assert _size(base) == (1600, 2000)
    assert _size(trimmed) == (1600, 432)
    assert _band(base, BLUE) == (33, 399)
    assert _band(trimmed, BLUE) == (33, 399)


def test_themed_dashboard_capture_ends_at_the_content(
    app: Any, chromium: Any, tmp_path: Path
) -> None:
    url = _write_page(
        tmp_path,
        _dashboard_page(
            _chart_row(1, 400, BLUE), body_bg=(20, 20, 20), shell_bg=(33, 41, 54)
        ),
    )
    assert _size(_capture(app, chromium, url, trim=True)) == (1600, 432)


_FIXED = "position:fixed;left:0;width:100%"
EDGE_SHAPES = {
    "red_footer": (
        f'<div style="{_FIXED};top:1800px;height:200px;background:{_rgb(RED)}"></div>',
        RED,
        (1800, 2000),
    ),
    "footer_in_the_body_colour": (
        f'<div style="{_FIXED};bottom:0;height:200px;background:{_rgb(WHITE)}"></div>',
        WHITE,
        (1800, 2000),
    ),
    "hairline": (
        f'<div style="{_FIXED};bottom:0;height:1px;background:{_rgb(PURPLE)}"></div>',
        PURPLE,
        (1999, 2000),
    ),
    "shadow": (
        f'<div style="{_FIXED};bottom:30px;height:10px;background:{_rgb(PURPLE)};'
        f'box-shadow:0 30px 0 0 {_rgb(RED)}"></div>',
        RED,
        (1990, 2000),
    ),
}


@PATHS
@pytest.mark.parametrize("shape", list(EDGE_SHAPES))
def test_capture_keeps_content_painted_to_the_bottom_edge(
    app: Any, chromium: Any, tmp_path: Path, tiled: bool, shape: str
) -> None:
    after_app, color, band = EDGE_SHAPES[shape]
    url = _write_page(
        tmp_path, _dashboard_page(_chart_row(1, 400, BLUE), after_app=after_app)
    )
    base = _capture(app, chromium, url, trim=False, tiled=tiled)
    assert _band(base, color) == band

    trimmed = _capture(app, chromium, url, trim=True, tiled=tiled)
    assert _size(trimmed) == (1600, 2000)
    assert _band(trimmed, color) == band


_BELOW_THE_BOXES = {
    "pseudo_element": (
        '<div class="p"></div>',
        ".p{position:relative;height:0} .p::after{content:'';position:absolute;"
        f"top:600px;left:0;width:100%;height:80px;background:{_rgb(PURPLE)}}}",
    ),
    "overflowing_text": (
        '<div style="height:20px;line-height:40px;font-size:30px;'
        f'color:{_rgb(PURPLE)};overflow:visible">l1<br>l2<br>l3<br>l4</div>',
        "",
    ),
}


@PATHS
@pytest.mark.parametrize("shape", list(_BELOW_THE_BOXES))
def test_capture_keeps_content_painted_below_the_layout_boxes(
    app: Any, chromium: Any, tmp_path: Path, tiled: bool, shape: str
) -> None:
    extra, extra_css = _BELOW_THE_BOXES[shape]
    url = _write_page(
        tmp_path,
        _dashboard_page(_chart_row(1, 400, BLUE) + extra, extra_css=extra_css),
    )
    base = _capture(app, chromium, url, trim=False, tiled=tiled)
    base_band = _band(base, PURPLE)
    assert base_band is not None

    trimmed = _capture(app, chromium, url, trim=True, tiled=tiled)
    assert _band(trimmed, PURPLE) == base_band
    height = _size(trimmed)[1]
    if shape == "pseudo_element":
        assert base_band == (1016, 1096)
        assert height == 1112
    else:
        assert base_band[1] > 436
        assert base_band[1] + 16 <= height <= base_band[1] + 20


@PATHS
def test_tall_dashboard_capture_is_unchanged(
    app: Any, chromium: Any, tmp_path: Path, tiled: bool
) -> None:
    rows = "".join(
        _chart_row(index, 400, BLUE if index % 2 == 0 else GREEN) for index in range(8)
    )
    url = _write_page(tmp_path, _dashboard_page(rows))
    base = _capture(app, chromium, url, trim=False, tiled=tiled)
    trimmed = _capture(app, chromium, url, trim=True, tiled=tiled)

    assert _size(base) == (1600, 3232)
    assert _size(trimmed) == (1600, 3232)
    assert _band(base, GREEN) == _band(trimmed, GREEN)


def test_capture_wider_than_the_shell_is_left_alone(
    app: Any, chromium: Any, tmp_path: Path
) -> None:
    content = (
        _chart_row(1, 400, BLUE)
        + f'<div style="width:2000px;height:20px;background:{_rgb(GREEN)}"></div>'
    )
    url = _write_page(tmp_path, _dashboard_page(content))
    assert _size(_capture(app, chromium, url, trim=False)) == (2016, 2000)
    assert _size(_capture(app, chromium, url, trim=True)) == (2016, 2000)


def test_capture_keeps_a_footer_that_holds_a_dashboard_grid_node(
    app: Any, chromium: Any, tmp_path: Path
) -> None:
    footer = (
        f'<div style="{_FIXED};top:1800px;height:200px;z-index:1;'
        f'background:{_rgb(RED)}"><div class="dashboard-grid"></div></div>'
    )
    url = _write_page(
        tmp_path, _dashboard_page(_chart_row(1, 400, BLUE), before_app=footer)
    )
    base = _capture(app, chromium, url, trim=False)
    assert _band(base, RED) == (1800, 2000)

    trimmed = _capture(app, chromium, url, trim=True)
    assert _size(trimmed) == (1600, 2000)
    assert _band(trimmed, RED) == (1800, 2000)


_UNRENDERED_GRIDS = {
    "display_none": (
        '<div style="display:none"><div class="dashboard-grid"></div></div>'
    ),
    "visibility_hidden": (
        '<div style="visibility:hidden"><div class="dashboard-grid"></div></div>'
    ),
}


@PATHS
@pytest.mark.parametrize("hidden_grid", list(_UNRENDERED_GRIDS))
def test_capture_keeps_a_footer_when_the_first_grid_is_not_rendered(
    app: Any, chromium: Any, tmp_path: Path, tiled: bool, hidden_grid: str
) -> None:
    """A hidden pane (a tab that is not selected) can come first in the document.

    Nominating the page colour from it would walk up to ``body`` and pick the
    body colour instead of the colour of the dashboard shell, and the footer
    painted in the body colour would be trimmed away.
    """
    footer = (
        f'<div style="{_FIXED};bottom:0;height:200px;background:{_rgb(WHITE)}"></div>'
    )
    url = _write_page(
        tmp_path,
        _dashboard_page(
            _chart_row(1, 400, BLUE),
            before_app=_UNRENDERED_GRIDS[hidden_grid],
            after_app=footer,
        ),
    )
    base = _capture(app, chromium, url, trim=False, tiled=tiled)
    assert _band(base, WHITE) == (1800, 2000)

    trimmed = _capture(app, chromium, url, trim=True, tiled=tiled)
    assert _size(trimmed) == (1600, 2000)
    assert _band(trimmed, WHITE) == (1800, 2000)


def test_capture_without_the_opt_in_keeps_the_window(
    app: Any, chromium: Any, tmp_path: Path
) -> None:
    url = _write_page(tmp_path, _dashboard_page(_chart_row(1, 400, BLUE)))
    assert _size(_capture(app, chromium, url, trim=False)) == (1600, 2000)


@pytest.mark.parametrize(
    ("pixel_density", "expected"), [(2, (3200, 864)), (1.5, (2400, 648))]
)
def test_trim_keeps_the_pixel_density(
    app: Any,
    chromium: Any,
    tmp_path: Path,
    pixel_density: float,
    expected: tuple[int, int],
) -> None:
    url = _write_page(tmp_path, _dashboard_page(_chart_row(1, 400, BLUE)))
    trimmed = _capture(app, chromium, url, trim=True, pixel_density=pixel_density)
    assert _size(trimmed) == expected


@PATHS
def test_report_capture_is_trimmed_and_approved_for_delivery(
    app: Any, chromium: Any, tmp_path: Path, tiled: bool
) -> None:
    url = _write_page(tmp_path, _dashboard_page(_chart_row(1, 400, BLUE)))
    context = _report_context()
    png = _capture(app, chromium, url, trim=True, tiled=tiled, context=context)

    assert _size(png)[1] == 432
    assert context.artifact_was_validated(png, ReportArtifactKind.SCREENSHOT)
    validate_report_screenshot(png, context)
    assert context.capture_rejection_reasons == ()


def test_only_a_missing_executable_skips_the_browser_tests() -> None:
    missing = (
        "BrowserType.launch: Executable doesn't exist at /x/chrome-headless-shell\n"
        "... playwright install ..."
    )
    missing_libraries = (
        "BrowserType.launch: Host system is missing dependencies to run browsers.\n"
        "... sudo playwright install-deps ..."
    )
    assert _is_missing_browser_executable(missing) is True
    assert _is_missing_browser_executable(missing_libraries) is False
    assert (
        _is_missing_browser_executable(
            "Target page, context or browser has been closed"
        )
        is False
    )


def test_report_opt_in_reaches_the_driver() -> None:
    try:
        options: dict[str, Any] = {"trim_to_content": True}
        screenshot = DashboardScreenshot(URL, "digest", **options)
    except TypeError as ex:
        raise AssertionError(
            f"DashboardScreenshot has no trim_to_content opt-in ({ex})"
        ) from ex
    driver = screenshot.driver()
    assert isinstance(driver, WebDriverPlaywright)
    assert getattr(driver, "_trim_to_content", None) is True


def test_other_captures_never_opt_in() -> None:
    screenshots = [
        DashboardScreenshot(URL, "d"),
        DashboardScreenshot(URL, "d", require_complete_capture=True),
        ChartScreenshot(URL, "d"),
    ]
    for screenshot in screenshots:
        assert getattr(screenshot.driver(), "_trim_to_content", False) is False


_WIRING_CONFIG = {
    "WEBDRIVER_OPTION_ARGS": [],
    "WEBDRIVER_WINDOW": {"pixel_density": 1},
    "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
    "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "networkidle",
    "SCREENSHOT_SELENIUM_HEADSTART": 0,
    "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 2,
    "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
    "SCREENSHOT_LOCATE_WAIT": 10,
    "SCREENSHOT_LOAD_WAIT": 30,
}


@pytest.mark.parametrize(
    ("tiled", "opt_in"), [(False, True), (True, True), (False, False)]
)
@patch("superset.utils.webdriver.PLAYWRIGHT_AVAILABLE", True)
@patch("superset.utils.webdriver._browser_manager")
@patch("superset.utils.webdriver.app")
def test_driver_trims_the_finished_capture_only_when_asked(
    mock_app: MagicMock,
    mock_browser_manager: MagicMock,
    tiled: bool,
    opt_in: bool,
) -> None:
    mock_app.config = {
        **_WIRING_CONFIG,
        "SCREENSHOT_TILED_ENABLED": tiled,
        "SCREENSHOT_TILED_CHART_THRESHOLD": 20,
        "SCREENSHOT_TILED_HEIGHT_THRESHOLD": 5000,
        "SCREENSHOT_TILED_VIEWPORT_HEIGHT": 10,
    }
    mock_browser = MagicMock()
    mock_context = MagicMock()
    mock_page = MagicMock()
    mock_browser_manager.get_browser.return_value = mock_browser
    mock_browser.new_context.return_value = mock_context
    mock_context.new_page.return_value = mock_page
    mock_page.evaluate.return_value = 25 if tiled else []
    mock_page.screenshot.return_value = b"capture"
    mock_user = MagicMock()
    mock_user.username = "test_user"

    options: dict[str, Any] = {"trim_to_content": True} if opt_in else {}
    try:
        driver = WebDriverPlaywright("chrome", **options)
    except TypeError as ex:
        raise AssertionError(
            f"WebDriverPlaywright has no trim_to_content opt-in ({ex})"
        ) from ex

    with (
        patch.object(WebDriverPlaywright, "auth", return_value=mock_context),
        patch(
            "superset.utils.webdriver.take_tiled_screenshot", return_value=b"capture"
        ),
        patch(
            "superset.utils.webdriver.trim_report_screenshot_to_content",
            create=True,
            return_value=b"trimmed",
        ) as trim,
    ):
        result = driver.get_screenshot("http://example.com", "standalone", mock_user)

    if opt_in:
        trim.assert_called_once_with(
            mock_page, b"capture", report_execution_context=None, log_context=None
        )
        assert result == b"trimmed"
    else:
        trim.assert_not_called()
        assert result == b"capture"
