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

import io
import shutil
import struct
import subprocess
import zlib
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from PIL import Image, ImageDraw, ImageFont, UnidentifiedImageError

from superset.utils import json
from superset.utils.report_execution import (
    ReportArtifactKind,
    ReportExecutionContext,
    ReportExecutionDeadline,
)
from superset.utils.screenshot_utils import (
    _stable_readiness_js,
    CHART_HOLDERS_MOUNTED_JS,
    combine_screenshot_tiles,
    CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS,
    FIND_ALL_CHART_HOLDER_STATES_JS,
    FIND_CHART_HOLDER_STATES_JS,
    get_screenshot_blankness_metrics,
    is_screenshot_nearly_uniform,
    REPORT_ALL_CHART_HOLDERS_READY_JS,
    REPORT_CAPTURE_READINESS_STABILITY_MS,
    REPORT_CHART_HOLDERS_READY_JS,
    REPORT_LAYOUT_READY_JS,
    report_mounted_js,
    report_ready_js,
    resolve_screenshot_task_budget_seconds,
    SCREENSHOT_TASK_BUDGET_MAX_MARGIN_SECONDS,
    ScreenshotBlankCaptureError,
    ScreenshotCaptureTimeoutError,
    ScreenshotTaskBudgetExceededError,
    SCROLL_SETTLE_TIMEOUT_MS,
    take_tiled_screenshot,
    TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS,
    TiledScreenshotBudgetExceededError,
    validate_report_screenshot,
    wait_for_stable_readiness,
)

if TYPE_CHECKING:
    from playwright.sync_api import Page


def _png(width: int, height: int, color: str) -> bytes:
    image = Image.new("RGB", (width, height), color)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def _two_tone_blank(width: int = 100, height: int = 100) -> bytes:
    image = Image.new("RGB", (width, height), "white")
    for y in range(int(height * 0.85), height):
        for x in range(width):
            image.putpixel((x, y), (245, 245, 245))
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_stable_readiness_skips_impossible_dwell() -> None:
    page = MagicMock()

    waited = wait_for_stable_readiness(
        page,
        "() => true",
        REPORT_CAPTURE_READINESS_STABILITY_MS / 1000,
    )

    assert waited is False
    page.wait_for_function.assert_not_called()


def test_stable_readiness_skips_when_budget_below_polling_margin() -> None:
    page = MagicMock()

    # Above the raw 500 ms window but below window + polling margin: the dwell
    # cannot complete before the timeout, so it must skip rather than abort.
    waited = wait_for_stable_readiness(page, "() => true", 0.6)

    assert waited is False
    page.wait_for_function.assert_not_called()


def test_holder_diagnostics_include_offscreen_errors_for_full_capture() -> None:
    """Full scans expose off-screen errors that viewport scans mark virtualized."""
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node.js is required to execute holder diagnostics")
    assert node is not None
    script = r"""
const input = JSON.parse(require("fs").readFileSync(0, "utf8"));
global.window = {innerHeight: 800};
const holder = (id, top, error) => ({
  className: `dashboard-chart-id-${id}`,
  getBoundingClientRect: () => ({top, bottom: top + 100}),
  querySelectorAll: () => [],
  querySelector: selector => {
    if (selector.includes('slice_container')) return {};
    if (error && selector.includes('alert')) return {};
    return null;
  },
});
global.document = {
  querySelectorAll: () => [holder(1, 0, false), holder(2, 1000, true)],
};
process.stdout.write(JSON.stringify(input.map(expression =>
  eval('(' + expression + ')')().map(item => item.state))));
"""
    completed = subprocess.run(  # noqa: S603
        [node, "-e", script],
        input=json.dumps(
            [FIND_CHART_HOLDER_STATES_JS, FIND_ALL_CHART_HOLDER_STATES_JS]
        ),
        capture_output=True,
        check=True,
        text=True,
    )
    assert json.loads(completed.stdout) == [
        ["rendered", "virtualized"],
        ["rendered", "error"],
    ]


def test_stable_readiness_javascript_resets_dwell_state() -> None:
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node.js is required to execute the readiness predicate")
    assert node is not None

    expression = _stable_readiness_js("() => globalThis.ready")
    script = r"""
const input = JSON.parse(require("fs").readFileSync(0, "utf8"));
global.window = global;
let now = 0;
global.performance = {now: () => now};
global.ready = false;
const predicate = eval("(" + input.expression + ")");
const results = [];
const poll = (token, time, ready) => {
  now = time;
  global.ready = ready;
  results.push(predicate({token, stabilityMs: 500}));
};
poll("first", 0, false);
poll("first", 100, true);
poll("first", 599, true);
poll("first", 600, true);
poll("first", 700, false);
poll("first", 800, true);
poll("first", 1300, true);
poll("second", 1400, true);
poll("second", 1900, true);
process.stdout.write(JSON.stringify(results));
"""

    completed = subprocess.run(  # noqa: S603
        [node, "-e", script],
        input=json.dumps({"expression": expression}),
        capture_output=True,
        check=True,
        text=True,
    )

    assert json.loads(completed.stdout) == [
        False,
        False,
        False,
        True,
        False,
        False,
        True,
        False,
        True,
    ]


class TestScreenshotBlankDetection:
    @pytest.mark.parametrize("shade", [230, 239, 245, 250, 255])
    def test_uniform_light_gray_is_blank(self, shade):
        assert is_screenshot_nearly_uniform(
            _png(800, 1000, f"rgb({shade},{shade},{shade})")
        )[0]

    def test_final_validation_rejects_undecodable_bytes(self):
        context = _report_context()
        with pytest.raises(ScreenshotBlankCaptureError):
            validate_report_screenshot(b"broken png", context)
        assert context.capture_rejection_reasons == ("invalid_image",)

    @pytest.mark.parametrize("content_validated", [False, True])
    def test_final_validation_rejects_png_with_corrupt_pixel_stream(
        self, content_validated
    ):
        screenshot = bytearray(_png(100, 100, "red"))
        chunk_offset = 8
        while chunk_offset < len(screenshot):
            chunk_size = struct.unpack(
                ">I",
                screenshot[chunk_offset : chunk_offset + 4],
            )[0]
            chunk_type = bytes(screenshot[chunk_offset + 4 : chunk_offset + 8])
            data_start = chunk_offset + 8
            data_end = data_start + chunk_size
            if chunk_type == b"IDAT":
                corrupt_data = b"\x78\x9c" + b"\x00" * (chunk_size - 2)
                screenshot[data_start:data_end] = corrupt_data
                screenshot[data_end : data_end + 4] = struct.pack(
                    ">I",
                    zlib.crc32(chunk_type + corrupt_data) & 0xFFFFFFFF,
                )
                break
            chunk_offset = data_end + 4
        else:
            pytest.fail("PNG did not contain an IDAT chunk")

        with Image.open(io.BytesIO(screenshot)) as image:
            image.verify()

        context = _report_context()
        with pytest.raises(ScreenshotBlankCaptureError):
            validate_report_screenshot(
                bytes(screenshot), context, content_validated=content_validated
            )
        assert context.capture_rejection_reasons == ("invalid_image",)

    @pytest.mark.parametrize("shade", [239, 245, 250])
    def test_white_page_with_gray_placeholder_is_blank(self, shade):
        image = Image.new("RGB", (800, 1000), "white")
        ImageDraw.Draw(image).rectangle((0, 0, 799, 149), fill=(shade, shade, shade))
        output = io.BytesIO()
        image.save(output, format="PNG")
        context = _report_context()
        with pytest.raises(ScreenshotBlankCaptureError):
            validate_report_screenshot(output.getvalue(), context)
        assert context.capture_was_rejected

    @pytest.mark.parametrize("height", [1000, 10000])
    @pytest.mark.parametrize("label", ["No data", "42", "Dashboard", "Error"])
    def test_small_label_does_not_exempt_blank_page(self, height, label):
        image = Image.new("RGB", (800, height), "white")
        ImageDraw.Draw(image).text(
            (100, 100), label, fill="black", font=ImageFont.load_default(size=24)
        )
        output = io.BytesIO()
        image.save(output, format="PNG")
        with pytest.raises(ScreenshotBlankCaptureError):
            validate_report_screenshot(output.getvalue(), _report_context())

    @pytest.mark.parametrize(
        "color", ["navy", "#1b1b2e", "gray", "red", "#30aa55", "lightblue"]
    )
    def test_uniform_fill_is_rejected_regardless_of_theme(self, color):
        context = _report_context()
        screenshot = _png(800, 1000, color)
        with pytest.raises(ScreenshotBlankCaptureError):
            validate_report_screenshot(screenshot, context)
        assert context.capture_was_rejected
        assert not context.artifact_was_validated(
            screenshot,
            ReportArtifactKind.SCREENSHOT,
        )

    @pytest.mark.parametrize(
        "background,foreground", [("white", "black"), ("navy", "white")]
    )
    def test_large_readable_kpi_is_not_blank(self, background, foreground):
        image = Image.new("RGB", (800, 1000), background)
        ImageDraw.Draw(image).text(
            (200, 400), "42", fill=foreground, font=ImageFont.load_default(size=180)
        )
        output = io.BytesIO()
        image.save(output, format="PNG")
        validate_report_screenshot(output.getvalue(), _report_context())

    def test_small_logo_does_not_exempt_blank_page(self):
        image = Image.new("RGB", (800, 1000), "white")
        ImageDraw.Draw(image).ellipse((10, 10, 24, 24), fill="navy")
        output = io.BytesIO()
        image.save(output, format="PNG")
        with pytest.raises(ScreenshotBlankCaptureError):
            validate_report_screenshot(output.getvalue(), _report_context())

    def test_uniform_png_is_blank(self):
        is_blank, dominant_ratio = is_screenshot_nearly_uniform(_png(100, 100, "white"))

        assert is_blank is True
        assert dominant_ratio == 1.0

    def test_chart_like_png_is_not_blank(self):
        image = Image.new("RGB", (100, 100), "white")
        for x in range(10, 90):
            for y in range(10, 90):
                image.putpixel((x, y), (x, y, 100))
        output = io.BytesIO()
        image.save(output, format="PNG")

        is_blank, dominant_ratio = is_screenshot_nearly_uniform(output.getvalue())

        assert is_blank is False
        assert dominant_ratio < 0.995

    def test_two_tone_near_white_png_is_blank(self):
        is_blank, dominant_ratio = is_screenshot_nearly_uniform(_two_tone_blank())

        assert is_blank is True
        assert dominant_ratio == 0.85

    def test_two_tone_gray_below_near_white_cutoff_is_blank(self):
        image = Image.new("RGB", (100, 100), "white")
        for y in range(85, 100):
            for x in range(100):
                image.putpixel((x, y), (239, 239, 239))
        output = io.BytesIO()
        image.save(output, format="PNG")

        is_blank, dominant_ratio = is_screenshot_nearly_uniform(output.getvalue())

        assert is_blank is True
        assert dominant_ratio == 0.85

    def test_sparse_readable_text_is_not_blank(self):
        image = Image.new("RGB", (800, 1000), "white")
        label = Image.new("RGB", (60, 14), "white")
        ImageDraw.Draw(label).text(
            (0, 0), "No data", fill="black", font=ImageFont.load_default()
        )
        label = label.resize((240, 56), Image.Resampling.NEAREST)
        image.paste(label, (20, 20))
        output = io.BytesIO()
        image.save(output, format="PNG")

        is_blank, _dominant_ratio = is_screenshot_nearly_uniform(output.getvalue())

        assert is_blank is False

    def test_tall_sparse_report_with_content_is_not_blank(self):
        image = Image.new("RGB", (800, 4000), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((20, 20, 780, 220), outline="black", width=3)
        for y in range(60, 220, 40):
            draw.line((20, y, 780, y), fill="black", width=2)
        output = io.BytesIO()
        image.save(output, format="PNG")

        is_blank, _dominant_ratio = is_screenshot_nearly_uniform(output.getvalue())

        assert is_blank is False

    def test_high_density_light_thin_line_chart_is_not_blank(self):
        image = Image.new("RGB", (3000, 1200), "white")
        draw = ImageDraw.Draw(image)
        for y in (200, 500, 800, 1050):
            draw.line((180, y, 2850, y), fill=(225, 225, 225), width=2)
        draw.line((180, 100, 180, 1050), fill=(170, 170, 170), width=3)
        draw.line((180, 1050, 2850, 1050), fill=(170, 170, 170), width=3)
        points = [
            (250, 900),
            (700, 720),
            (1200, 790),
            (1750, 480),
            (2250, 560),
            (2800, 250),
        ]
        draw.line(points, fill=(145, 180, 210), width=3)
        for x, y in points:
            draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(145, 180, 210))
        output = io.BytesIO()
        image.save(output, format="PNG")

        metrics = get_screenshot_blankness_metrics(output.getvalue())

        assert metrics.is_blank is False
        assert metrics.structural_edge_ratio >= 0.02

    def test_high_density_sparse_light_table_is_not_blank(self):
        image = Image.new("RGB", (3000, 1200), "white")
        draw = ImageDraw.Draw(image)
        columns = (150, 900, 1700, 2850)
        rows = (150, 350, 550, 750)
        for y in rows:
            draw.line((columns[0], y, columns[-1], y), fill=(210, 210, 210), width=2)
        for x in columns:
            draw.line((x, rows[0], x, rows[-1]), fill=(210, 210, 210), width=2)
        for row in range(3):
            for column in range(3):
                x = columns[column] + 35
                y = rows[row] + 55
                draw.rectangle(
                    (x, y, x + 180 + column * 80, y + 9), fill=(155, 155, 155)
                )
        output = io.BytesIO()
        image.save(output, format="PNG")

        metrics = get_screenshot_blankness_metrics(output.getvalue())

        assert metrics.is_blank is False
        assert metrics.structural_edge_ratio >= 0.02

    def test_sparse_png_with_dark_content_is_not_blank(self):
        image = Image.new("RGB", (100, 100), "white")
        for x in range(20, 80):
            for y in range(20, 24):
                image.putpixel((x, y), (50, 50, 50))
        output = io.BytesIO()
        image.save(output, format="PNG")

        is_blank, dominant_ratio = is_screenshot_nearly_uniform(output.getvalue())

        assert is_blank is False
        assert dominant_ratio == 0.976

    def test_non_image_bytes_are_left_for_combination_validation(self):
        assert is_screenshot_nearly_uniform(b"not an image") == (False, 0.0)


def _report_context() -> ReportExecutionContext:
    """Return a deterministic context with 30 seconds available for readiness."""

    return ReportExecutionContext(
        execution_id=UUID("084e7ee6-5557-4ecd-9632-b7f39c9ec524"),
        report_schedule_id=11,
        dashboard_id=805,
        expected_chart_count=52,
        deadline=ReportExecutionDeadline(
            total_seconds=240,
            started_at=0,
            _clock=lambda: 0,
        ),
        capture_reserve_seconds=60,
        delivery_reserve_seconds=120,
        cleanup_reserve_seconds=30,
    )


class TestResolveScreenshotTaskBudget:
    def _task(self, timelimit):
        task = MagicMock()
        task.request.timelimit = timelimit
        return task

    def test_prefers_soft_limit_and_reserves_scaled_margin(self):
        task = self._task((400, 300))
        with patch("superset.utils.screenshot_utils.current_task", task):
            budget = resolve_screenshot_task_budget_seconds()

        assert budget == 240

    def test_uses_hard_limit_and_caps_cleanup_margin(self):
        task = self._task((2000, None))
        with patch("superset.utils.screenshot_utils.current_task", task):
            budget = resolve_screenshot_task_budget_seconds()

        assert budget == 2000 - SCREENSHOT_TASK_BUDGET_MAX_MARGIN_SECONDS

    @pytest.mark.parametrize("timelimit", [None, (), (None, None), "300", (0, 0)])
    def test_absent_or_malformed_timelimit_preserves_standalone_timeout(
        self, timelimit
    ):
        task = self._task(timelimit)
        with patch("superset.utils.screenshot_utils.current_task", task):
            assert resolve_screenshot_task_budget_seconds() is None

    def test_outside_celery_preserves_standalone_timeout(self):
        with patch("superset.utils.screenshot_utils.current_task", None):
            assert resolve_screenshot_task_budget_seconds() is None

    def test_broken_task_metadata_preserves_standalone_timeout(self):
        task = MagicMock()
        type(task).request = property(
            lambda self: (_ for _ in ()).throw(RuntimeError("boom"))
        )
        with (
            patch("superset.utils.screenshot_utils.current_task", task),
            patch("superset.utils.screenshot_utils.logger") as mock_logger,
        ):
            assert resolve_screenshot_task_budget_seconds("execution_id=abc") is None

        assert mock_logger.debug.call_args.kwargs["exc_info"] is True


class TestCombineScreenshotTiles:
    def _create_test_image(self, width: int, height: int, color: str = "red") -> bytes:
        """Helper to create test PNG image bytes."""
        img = Image.new("RGB", (width, height), color)
        output = io.BytesIO()
        img.save(output, format="PNG")
        return output.getvalue()

    def test_empty_tiles_returns_empty_bytes(self):
        """Test that empty tiles list returns empty bytes."""
        result = combine_screenshot_tiles([])
        assert result == b""

    def test_single_tile_returns_original(self):
        """Test that single tile returns the original image."""
        test_image = self._create_test_image(100, 100)
        result = combine_screenshot_tiles([test_image])
        assert result == test_image

    def test_combine_multiple_tiles_vertically(self):
        """Test combining multiple tiles into a single vertical image."""
        # Create test images with different colors
        tile1 = self._create_test_image(100, 50, "red")
        tile2 = self._create_test_image(100, 75, "green")
        tile3 = self._create_test_image(100, 25, "blue")

        result = combine_screenshot_tiles([tile1, tile2, tile3])

        # Verify result is not empty
        assert result != b""

        # Verify the combined image has correct dimensions
        combined_img = Image.open(io.BytesIO(result))
        assert combined_img.width == 100  # Max width of all tiles
        assert combined_img.height == 150  # Sum of all heights (50 + 75 + 25)

        # Verify the image format is PNG
        assert combined_img.format == "PNG"

    def test_combine_tiles_different_widths(self):
        """Test combining tiles with different widths uses max width."""
        tile1 = self._create_test_image(50, 100, "red")
        tile2 = self._create_test_image(150, 100, "green")
        tile3 = self._create_test_image(100, 100, "blue")

        result = combine_screenshot_tiles([tile1, tile2, tile3])

        combined_img = Image.open(io.BytesIO(result))
        assert combined_img.width == 150  # Max width
        assert combined_img.height == 300  # Sum of heights

    def test_combine_tiles_handles_pil_error(self):
        """Test that PIL errors are handled gracefully."""
        # Create one valid image and one invalid
        valid_tile = self._create_test_image(100, 100)
        invalid_tile = b"invalid_image_data"

        result = combine_screenshot_tiles([valid_tile, invalid_tile])

        # Should return the first (valid) tile as fallback
        assert result == valid_tile

    def test_combine_tiles_logs_exception(self):
        """Test that exceptions are logged properly."""
        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            # Create invalid image data that will cause PIL to raise an exception
            invalid_tile = b"definitely_not_an_image"
            valid_tile = self._create_test_image(100, 100)

            result = combine_screenshot_tiles([valid_tile, invalid_tile])

            # Should have logged the exception
            mock_logger.exception.assert_called_once()
            # Should return first tile as fallback
            assert result == valid_tile

    def test_report_mode_rejects_partial_first_tile_fallback(self):
        """A report must not turn a tile-combine failure into a partial image."""

        valid_tile = self._create_test_image(100, 100)
        with pytest.raises(UnidentifiedImageError):
            combine_screenshot_tiles(
                [valid_tile, b"invalid_image_data"],
                allow_partial_fallback=False,
            )


class TestTakeTiledScreenshot:
    def test_per_tile_diagnostics_failure_does_not_discard_capture(self, mock_page):
        """Diagnostics must not discard valid tiles: a non-timeout evaluate
        failure on the per-tile diagnostics path logs a warning and the
        capture still succeeds."""
        final_states = [{"chartId": "1", "state": "rendered"}]
        diagnostics_calls = 0

        def evaluate(script, _arg=None):
            nonlocal diagnostics_calls
            if "scrollWidth" in script:
                return {"height": 1000, "top": 100, "left": 50, "width": 800}
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 1}
            if script == FIND_CHART_HOLDER_STATES_JS:
                diagnostics_calls += 1
                if diagnostics_calls == 1:
                    raise RuntimeError("Execution context was destroyed")
                return final_states
            return None

        mock_page.wait_for_function.side_effect = None
        mock_page.wait_for_function.return_value = None
        mock_page.evaluate.side_effect = evaluate
        combined = self._create_chart_like_tile()
        mock_page.screenshot.return_value = combined

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch(
                "superset.utils.screenshot_utils.combine_screenshot_tiles",
                return_value=combined,
            ):
                result = take_tiled_screenshot(
                    mock_page,
                    "dashboard",
                    tile_height=2000,
                    load_wait=30,
                    report_execution_context=_report_context(),
                )

        assert result == combined
        assert mock_page.screenshot.call_count == 1
        assert any(
            call.args
            and call.args[0].startswith(
                "Unable to collect per-tile chart-holder diagnostics"
            )
            for call in mock_logger.warning.call_args_list
        )

    def test_final_semantic_status_fires_exactly_once_for_error_holders(
        self, mock_page
    ):
        """One error chart spanning every tile emits ONE report_semantic_status
        WARNING for the capture (final block), not one per tile — the per-tile
        INFO lines already carry error_holders."""
        with_error = [
            {"chartId": "1", "state": "rendered"},
            {"chartId": "2", "state": "error"},
        ]
        mock_page.wait_for_function.side_effect = None
        mock_page.wait_for_function.return_value = None
        mock_page.evaluate.side_effect = [
            {"height": 5000, "top": 100, "left": 50, "width": 800},
            None,
            with_error,
            None,
            with_error,
            None,
            with_error,
            with_error,
        ]

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                take_tiled_screenshot(
                    mock_page,
                    "dashboard",
                    tile_height=2000,
                    load_wait=30,
                    report_execution_context=_report_context(),
                )

        semantic_calls = [
            call
            for call in mock_logger.warning.call_args_list
            if call.args and call.args[0].startswith("report_semantic_status")
        ]
        assert len(semantic_calls) == 1
        message = semantic_calls[0].args[0] % semantic_calls[0].args[1:]
        assert "error_holders=1" in message
        assert "semantic_success=false" in message

    def test_tile_line_reports_mixed_holder_states(self, mock_page):
        """The per-tile enriched line must map each state to its own field —
        a swap between (say) rendered and error counts must fail this test."""
        mixed = [
            {"chartId": "1", "state": "rendered"},
            {"chartId": "2", "state": "rendered"},
            {"chartId": "3", "state": "empty"},
            {"chartId": "4", "state": "error"},
            {"chartId": "5", "state": "waiting_on_database"},
        ]
        mock_page.wait_for_function.side_effect = None
        mock_page.wait_for_function.return_value = None
        mock_page.evaluate.side_effect = [
            {"height": 5000, "top": 100, "left": 50, "width": 800},  # dimensions
            None,
            mixed,  # tile 1: scroll, per-tile diagnostics
            None,
            mixed,  # tile 2
            None,
            mixed,  # tile 3
            mixed,  # final diagnostics
        ]

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                take_tiled_screenshot(
                    mock_page,
                    "dashboard",
                    tile_height=2000,
                    load_wait=30,
                    report_execution_context=_report_context(),
                )

        tile_calls = [
            call
            for call in mock_logger.info.call_args_list
            if call.args and call.args[0].startswith("report_readiness_tile")
        ]
        assert len(tile_calls) == 3
        message = tile_calls[0].args[0] % tile_calls[0].args[1:]
        assert "mounted_holders=5" in message
        assert "ready_holders=4" in message
        assert "rendered_holders=2" in message
        assert "empty_holders=1" in message
        assert "error_holders=1" in message
        assert "virtualized_holders=0" in message
        assert "unready_holders=1" in message
        assert "semantic_success=False" in message

    @pytest.fixture
    def mock_page(self):
        """Create a mock Playwright page object."""
        page = MagicMock()

        # Mock element locator
        element = MagicMock()
        page.locator.return_value = element

        # Mock element info - simulating a 5000px tall dashboard at position 100
        element_info = {"height": 5000, "top": 100, "left": 50, "width": 800}

        # Only one evaluate call needed for dashboard dimensions
        page.evaluate.return_value = element_info

        # Mock screenshot method
        fake_screenshot = b"fake_screenshot_data"
        page.screenshot.return_value = fake_screenshot

        return page

    def test_successful_tiled_screenshot(self, mock_page):
        """Test successful tiled screenshot generation."""
        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles"
        ) as mock_combine:
            mock_combine.return_value = b"combined_screenshot"

            result = take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            # Should return combined screenshot
            assert result == b"combined_screenshot"

            # Should have called screenshot method multiple times
            # (3 tiles for 5000px height)
            assert mock_page.screenshot.call_count == 3

            # Should have called combine function
            mock_combine.assert_called_once()

    def test_blank_tile_forces_repaint_and_retries(self, mock_page):
        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}

        def evaluate(script, arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                assert arg == {"top": 1000, "bottom": 2000}
                return {"total": 1, "contentful": 1}
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        mock_page.evaluate.side_effect = evaluate
        chart_tile = self._create_chart_like_tile()
        mock_page.screenshot.side_effect = [_png(800, 1000, "white"), chart_tile]

        with (
            patch(
                "superset.utils.screenshot_utils.combine_screenshot_tiles",
                return_value=chart_tile,
            ) as mock_combine,
            patch("superset.utils.screenshot_utils.logger") as mock_logger,
        ):
            result = take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                report_execution_context=_report_context(),
            )

        assert result == chart_tile
        mock_combine.assert_called_once()
        combined_tiles = mock_combine.call_args.args[0]
        assert len(combined_tiles) == 1
        assert is_screenshot_nearly_uniform(combined_tiles[0])[0] is False
        assert mock_page.screenshot.call_count == 2
        mock_page.bring_to_front.assert_called_once_with()
        assert any(
            "requestAnimationFrame" in call.args[0]
            for call in mock_page.evaluate.call_args_list
        )
        readiness_log = next(
            call
            for call in mock_logger.info.call_args_list
            if call.args[0].startswith("report_readiness_ready")
        )
        assert readiness_log.args[13] == 1
        retry_log = next(
            call
            for call in mock_logger.info.call_args_list
            if call.args[0].startswith("report_capture_blank_tile_retries")
        )
        assert retry_log.args[1] == 1

    def test_repeated_blank_tiles_fail_closed_for_reports(self, mock_page):
        element_info = {"height": 2000, "top": 0, "left": 0, "width": 800}

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 1}
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.return_value = _png(800, 1000, "white")
        report_context = _report_context()

        with (
            patch("superset.utils.screenshot_utils.logger"),
            patch(
                "superset.utils.screenshot_utils.combine_screenshot_tiles"
            ) as mock_combine,
            pytest.raises(
                ScreenshotBlankCaptureError,
                match="blank tile 1/2 after 3 attempts",
            ),
        ):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=1000,
                report_execution_context=report_context,
            )

        assert mock_page.screenshot.call_count == 3
        assert report_context.capture_rejection_reasons == ("blank_tile:1/2",)
        mock_combine.assert_not_called()

    def test_repeated_blank_tiles_fail_closed_for_api_exports(self, mock_page):
        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 1}
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.return_value = _png(800, 1000, "white")

        with (
            patch("superset.utils.screenshot_utils.logger"),
            patch(
                "superset.utils.screenshot_utils.combine_screenshot_tiles"
            ) as mock_combine,
            pytest.raises(
                ScreenshotBlankCaptureError,
                match="blank tile 1/1 after 3 attempts",
            ),
        ):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=1000,
                require_complete_capture=True,
            )

        assert mock_page.screenshot.call_count == 3
        mock_combine.assert_not_called()

    def test_blank_combined_image_fails_closed_after_contentful_tiles_pass(
        self, mock_page
    ):
        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 1}
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.return_value = self._create_chart_like_tile()

        report_context = _report_context()
        with (
            patch(
                "superset.utils.screenshot_utils.combine_screenshot_tiles",
                return_value=_two_tone_blank(800, 1000),
            ),
            patch("superset.utils.screenshot_utils.logger") as mock_logger,
            pytest.raises(
                ScreenshotBlankCaptureError,
                match="Combined report screenshot lost content",
            ),
        ):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=1000,
                report_execution_context=report_context,
            )

        assert report_context.capture_rejection_reasons == ("blank_combined",)
        assert any(
            call.args[0].startswith("report_capture_blank_combined_rejected")
            and call.args[1] == 1
            and call.args[2] == [1]
            for call in mock_logger.warning.call_args_list
        )

    def test_blank_combined_image_fails_closed_for_api_exports(self, mock_page):
        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 1}
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.return_value = self._create_chart_like_tile()

        with (
            patch(
                "superset.utils.screenshot_utils.combine_screenshot_tiles",
                return_value=_two_tone_blank(800, 1000),
            ),
            pytest.raises(
                ScreenshotBlankCaptureError,
                match="Combined report screenshot lost content",
            ),
        ):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=1000,
                require_complete_capture=True,
            )

    def test_sparse_contentful_tile_is_not_diluted_by_empty_tiles(self, mock_page):
        element_info = {"height": 8000, "top": 0, "left": 0, "width": 800}
        holder_count_calls = 0

        def evaluate(script, _arg=None):
            nonlocal holder_count_calls
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                holder_count_calls += 1
                return {
                    "total": 1,
                    "contentful": 1 if holder_count_calls == 1 else 0,
                }
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        sparse_content = Image.new("RGB", (800, 1000), "white")
        ImageDraw.Draw(sparse_content).rectangle((50, 50, 149, 149), fill=(64, 64, 64))
        sparse_output = io.BytesIO()
        sparse_content.save(sparse_output, format="PNG")
        empty_tile = _png(800, 1000, "white")
        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.side_effect = [sparse_output.getvalue()] + [empty_tile] * 7
        report_context = _report_context()

        result = take_tiled_screenshot(
            mock_page,
            "dashboard",
            tile_height=1000,
            report_execution_context=report_context,
        )

        # The whole image is statistically blank because valid empty-state tiles
        # dominate it, but its content-bearing region remains valid.
        assert get_screenshot_blankness_metrics(result).is_blank is True
        validate_report_screenshot(result, report_context)
        assert report_context.artifact_was_validated(
            result, ReportArtifactKind.SCREENSHOT
        )
        assert report_context.capture_was_rejected is False
        assert mock_page.screenshot.call_count == 8

    @pytest.mark.parametrize("terminal_state", ["empty", "error"])
    def test_blank_combined_image_is_allowed_for_terminal_empty_states(
        self, mock_page, terminal_state
    ):
        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}
        blank = _two_tone_blank(800, 1000)

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 0}
            if "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": terminal_state}]

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.return_value = blank

        report_context = _report_context()
        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles",
            return_value=blank,
        ):
            result = take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=1000,
                report_execution_context=report_context,
            )

        assert result == blank
        validate_report_screenshot(result, report_context)
        assert report_context.artifact_was_validated(
            result, ReportArtifactKind.SCREENSHOT
        )
        assert mock_page.screenshot.call_count == 1

    def test_terminal_empty_tiles_do_not_approve_corrupt_combined_bytes(
        self, mock_page
    ):
        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return {"height": 1000, "top": 0, "left": 0, "width": 800}
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 0}
            return [{"chartId": "7", "state": "empty"}]

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.return_value = _png(800, 1000, "white")
        context = _report_context()
        with (
            patch(
                "superset.utils.screenshot_utils.combine_screenshot_tiles",
                return_value=b"corrupt combined image",
            ),
            pytest.raises(ScreenshotBlankCaptureError),
        ):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=1000,
                report_execution_context=context,
            )
        assert context.capture_rejection_reasons == ("invalid_image",)
        assert not context.artifact_was_validated(
            b"corrupt combined image",
            ReportArtifactKind.SCREENSHOT,
        )

    @pytest.mark.parametrize("color", ["white", "navy", "#1b1b2e", "gray", "lightblue"])
    def test_single_uniform_content_tile_fails_closed_for_reports(
        self, mock_page, color
    ):
        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}
        uniform_tile = _png(800, 1000, color)

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 1}
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.return_value = uniform_tile

        with (
            patch(
                "superset.utils.screenshot_utils.combine_screenshot_tiles"
            ) as mock_combine,
            pytest.raises(ScreenshotBlankCaptureError),
        ):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                report_execution_context=_report_context(),
            )

        assert mock_page.screenshot.call_count == 3
        mock_combine.assert_not_called()

    def test_uniform_tile_without_visible_charts_is_allowed(self, mock_page):
        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 0}
            if "window.scrollTo" in script:
                return None
            return []

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.return_value = _png(800, 1000, "white")

        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles",
            return_value=b"combined",
        ):
            result = take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

        assert result == b"combined"
        assert mock_page.screenshot.call_count == 1
        mock_page.bring_to_front.assert_not_called()

    def test_capture_timeout_retries_with_remaining_budget(self, mock_page):
        from superset.utils.screenshot_utils import PlaywrightTimeout

        elapsed = 0.0
        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}
        context = ReportExecutionContext(
            execution_id=UUID("084e7ee6-5557-4ecd-9632-b7f39c9ec524"),
            report_schedule_id=11,
            dashboard_id=805,
            expected_chart_count=52,
            deadline=ReportExecutionDeadline(
                total_seconds=400,
                started_at=0,
                _clock=lambda: elapsed,
            ),
            capture_reserve_seconds=60,
            delivery_reserve_seconds=120,
            cleanup_reserve_seconds=30,
        )

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 1}
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        def screenshot(**_kwargs):
            nonlocal elapsed
            if mock_page.screenshot.call_count == 1:
                elapsed = 180.0
                raise PlaywrightTimeout("wedged compositor")
            return self._create_chart_like_tile()

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.side_effect = screenshot
        combined = self._create_chart_like_tile()

        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles",
            return_value=combined,
        ):
            result = take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                report_execution_context=context,
            )

        assert result == combined
        first_call, second_call = mock_page.screenshot.call_args_list
        assert first_call.kwargs["timeout"] == 120_000
        assert second_call.kwargs["timeout"] == 70_000

    def test_repeated_capture_timeout_propagates_specific_error(self, mock_page):
        from superset.utils.screenshot_utils import PlaywrightTimeout

        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 1}
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.side_effect = PlaywrightTimeout("wedged compositor")

        with pytest.raises(
            ScreenshotCaptureTimeoutError,
            match="timed out capturing tile 1/1 after 3 attempts",
        ):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                report_execution_context=_report_context(),
            )

        assert mock_page.screenshot.call_count == 3

    def test_holder_count_failure_does_not_abort_capture(self, mock_page):
        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                raise RuntimeError("execution context destroyed")
            if "window.scrollTo" in script:
                return None
            return []

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.return_value = _png(800, 1000, "white")

        with (
            patch(
                "superset.utils.screenshot_utils.combine_screenshot_tiles",
                return_value=b"combined",
            ) as mock_combine,
            patch("superset.utils.screenshot_utils.logger") as mock_logger,
        ):
            result = take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

        assert result == b"combined"
        assert mock_page.screenshot.call_count == 3
        assert len(mock_combine.call_args.args[0]) == 1
        assert any(
            call.args[0].startswith("Unable to count chart holders")
            for call in mock_logger.warning.call_args_list
        )
        assert any(
            call.args[0].startswith("thumbnail_capture_blank_tile_retained")
            for call in mock_logger.warning.call_args_list
        )

    def test_repaint_wait_timeout_is_bounded_and_retried(self, mock_page):
        from superset.utils.screenshot_utils import PlaywrightTimeout

        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 1}
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.side_effect = [
            _png(800, 1000, "white"),
            self._create_chart_like_tile(),
        ]

        def wait_for_function(script, *_args, **_kwargs):
            if "__supersetRepaintComplete" in script:
                raise PlaywrightTimeout("no repaint")
            return None

        mock_page.wait_for_function.side_effect = wait_for_function
        combined = self._create_chart_like_tile()

        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles",
            return_value=combined,
        ):
            result = take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                report_execution_context=_report_context(),
            )

        assert result == combined
        assert any(
            call.args == ("() => window.__supersetRepaintComplete === true",)
            and call.kwargs == {"timeout": 5000.0}
            for call in mock_page.wait_for_function.call_args_list
        )
        assert mock_page.screenshot.call_count == 2

    def test_repaint_preserves_celery_soft_timeout(self, mock_page):
        from celery.exceptions import SoftTimeLimitExceeded

        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 1}
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.return_value = _png(800, 1000, "white")
        mock_page.wait_for_function.side_effect = [None, None, SoftTimeLimitExceeded()]

        with pytest.raises(SoftTimeLimitExceeded):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                report_execution_context=_report_context(),
            )

    def test_repeated_capture_timeout_preserves_thumbnail_contract(self, mock_page):
        from superset.utils.screenshot_utils import PlaywrightTimeout

        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if script == CONTENTFUL_CHART_HOLDERS_IN_CLIP_JS:
                return {"total": 1, "contentful": 1}
            if "requestAnimationFrame" in script or "window.scrollTo" in script:
                return None
            return []

        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.side_effect = PlaywrightTimeout("wedged compositor")

        result = take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

        assert result is None
        assert mock_page.screenshot.call_count == 3

    @staticmethod
    def _create_chart_like_tile() -> bytes:
        image = Image.new("RGB", (800, 1000), "white")
        for x in range(100, 700):
            for y in range(100, 900):
                image.putpixel((x, y), (x % 255, y % 255, 100))
        output = io.BytesIO()
        image.save(output, format="PNG")
        return output.getvalue()

    def test_slow_holder_mount_is_polled_before_dimensions_and_capture(
        self,
        mock_page,
    ):
        """Tiling waits for React to mount a holder before measuring the dashboard."""
        events: list[str] = []
        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}
        wait_calls = 0

        def wait_for_function(
            expression,
            *,
            arg=None,
            timeout=None,
            polling=None,
        ):
            nonlocal wait_calls
            if expression == REPORT_LAYOUT_READY_JS:
                events.append("layout")
                return
            if wait_calls == 0:
                events.append("mount")
            elif "__supersetCaptureReadiness" in expression:
                assert arg["stabilityMs"] == REPORT_CAPTURE_READINESS_STABILITY_MS
                events.append("stable_ready")
            else:
                events.append("ready")
            wait_calls += 1

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                events.append("dimensions")
                return element_info
            if "window.scrollTo" in script:
                return None
            return [{"chartId": "7", "state": "rendered"}]

        def screenshot(**kwargs):
            events.append("capture")
            return content_png

        content = Image.new("RGB", (800, 1000), "white")
        ImageDraw.Draw(content).rectangle((0, 0, 399, 999), fill="black")
        output = io.BytesIO()
        content.save(output, format="PNG")
        content_png = output.getvalue()

        mock_page.wait_for_function.side_effect = wait_for_function
        mock_page.evaluate.side_effect = evaluate
        mock_page.screenshot.side_effect = screenshot

        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles",
            return_value=content_png,
        ):
            result = take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                load_wait=30,
                report_execution_context=_report_context(),
            )

        assert result == content_png
        assert events == [
            "layout",
            "mount",
            "dimensions",
            "ready",
            "stable_ready",
            "capture",
        ]

    def test_zero_holders_timeout_before_dimensions_or_capture(self, mock_page):
        """An empty DOM cannot vacuously pass the tiled readiness gate."""
        from superset.utils.screenshot_utils import PlaywrightTimeout

        mock_page.wait_for_function.side_effect = _layout_ready_then(
            PlaywrightTimeout("zero holders")
        )
        mock_page.evaluate.return_value = []

        with pytest.raises(PlaywrightTimeout):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                load_wait=30,
                report_execution_context=_report_context(),
            )

        assert mock_page.evaluate.call_count == 1
        assert "state: 'rendered'" in mock_page.evaluate.call_args.args[0]
        mock_page.screenshot.assert_not_called()

    def test_element_not_found_returns_none(self):
        """Test that missing element returns None."""
        mock_page = MagicMock()
        element = MagicMock()
        element.wait_for.side_effect = Exception("Element not found")
        mock_page.locator.return_value = element

        result = take_tiled_screenshot(mock_page, "nonexistent", tile_height=2000)

        assert result is None

    def test_tile_calculation_logic(self, mock_page):
        """Test that tiles are calculated correctly."""
        # Mock dashboard height of 3500px with viewport of 2000px
        element_info = {"height": 3500, "top": 100, "left": 50, "width": 800}

        # Override the fixture's evaluate return for this test
        mock_page.evaluate.return_value = element_info

        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles"
        ) as mock_combine:
            mock_combine.return_value = b"combined"

            take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            # Should take 2 screenshots (3500px / 2000px = 1.75, rounded up to 2)
            assert mock_page.screenshot.call_count == 2

    def test_logs_dashboard_info(self, mock_page):
        """Test that dashboard info is logged."""
        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

                # Should log dashboard dimensions with lazy logging format
                mock_logger.info.assert_any_call(
                    "Dashboard: %sx%spx at (%s, %s)%s", 800, 5000, 50, 100, ""
                )
                # Should log number of tiles with lazy logging format
                mock_logger.info.assert_any_call("Taking %s screenshot tiles%s", 3, "")

    def test_exception_handling_returns_none(self):
        """Test that exceptions are handled and None is returned."""
        mock_page = MagicMock()
        mock_page.locator.side_effect = Exception("Unexpected error")

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            result = take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            assert result is None
            # The exception object is passed, not the string
            call_args = mock_logger.exception.call_args
            assert call_args[0][0] == "Tiled screenshot failed: %s%s"
            assert str(call_args[0][1]) == "Unexpected error"
            assert call_args[0][2] == ""  # no log_context passed

    def test_exception_handling_logs_context(self):
        """Genuine system faults (not a customer chart-loading issue) stay at
        ERROR/exception level, and still carry the log context (e.g. report
        execution id) for correlation with the run that triggered this
        screenshot."""
        mock_page = MagicMock()
        mock_page.locator.side_effect = Exception("Unexpected error")

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            result = take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                log_context="execution_id=abc-123",
            )

            assert result is None
            call_args = mock_logger.exception.call_args
            assert call_args[0][2] == " [execution_id=abc-123]"

    def test_screenshot_clip_parameters(self, mock_page):
        """Test that screenshot clipping parameters are correct."""
        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            # Check screenshot calls have correct clip parameters
            screenshot_calls = mock_page.screenshot.call_args_list

            # Should have 3 tiles (5000px / 2000px = 2.5, rounded up to 3)
            assert len(screenshot_calls) == 3

            # All tiles use the same x and width
            for _, call in enumerate(screenshot_calls):
                kwargs = call[1]
                assert kwargs["type"] == "png"
                assert kwargs["clip"]["x"] == 50
                assert kwargs["clip"]["width"] == 800

            # Check y positions and heights for each tile
            # Tile 1: clip_y=0, height=2000 (tile_height < remaining: 5000)
            assert screenshot_calls[0][1]["clip"]["y"] == 0
            assert screenshot_calls[0][1]["clip"]["height"] == 2000

            # Tile 2: clip_y=0, height=2000 (tile_height < remaining: 3000)
            assert screenshot_calls[1][1]["clip"]["y"] == 0
            assert screenshot_calls[1][1]["clip"]["height"] == 2000

            # Tile 3: clip_y=1000 (tile_height - remaining: 2000 - 1000)
            # height=1000 (remaining content)
            assert screenshot_calls[2][1]["clip"]["y"] == 1000
            assert screenshot_calls[2][1]["clip"]["height"] == 1000

    def test_handles_invalid_tile_dimensions(self, mock_page):
        """Test that tiles with invalid dimensions are skipped."""
        # Mock a dashboard where the last tile would have 0 or negative height
        # This simulates edge cases in height calculations
        element_info = {"height": 4000, "top": 100, "left": 50, "width": 800}
        mock_page.evaluate.return_value = element_info

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch(
                "superset.utils.screenshot_utils.combine_screenshot_tiles"
            ) as mock_combine:
                mock_combine.return_value = b"combined"

                # Use exact viewport height that divides evenly
                result = take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

                # Should succeed
                assert result == b"combined"

                # Should take 2 screenshots (4000px / 2000px = 2)
                assert mock_page.screenshot.call_count == 2

                # Should not log any warnings about invalid dimensions
                warning_calls = [
                    call
                    for call in mock_logger.warning.call_args_list
                    if "invalid clip dimensions" in str(call)
                ]
                assert len(warning_calls) == 0

    def test_skips_tile_with_zero_height(self, mock_page):
        """Test that a tile with zero or negative height is skipped."""
        # This test verifies the clip_height <= 0 check
        # We'll manually test the logic by creating a scenario where
        # remaining_content becomes <= 0
        element_info = {"height": 2000, "top": 100, "left": 50, "width": 800}
        mock_page.evaluate.return_value = element_info

        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles"
        ) as mock_combine:
            mock_combine.return_value = b"combined"

            # Use viewport height equal to element height
            result = take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            # Should succeed with 1 tile
            assert result == b"combined"
            assert mock_page.screenshot.call_count == 1

    def test_scroll_positions_calculated_correctly(self, mock_page):
        """Test that window scroll positions are calculated correctly."""
        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            evaluate_calls = mock_page.evaluate.call_args_list
            scroll_calls = [
                call
                for call in evaluate_calls
                if call.args[0].startswith("window.scrollTo")
            ]

            # First call is for dimensions (contains querySelector)
            assert "querySelector" in str(evaluate_calls[0])

            # Tile 1: scroll to y=100 (dashboard_top + 0 * tile_height)
            assert scroll_calls[0].args[0] == "window.scrollTo(0, 100)"

            # Tile 2: scroll to y=2100 (dashboard_top + 1 * tile_height)
            assert scroll_calls[1].args[0] == "window.scrollTo(0, 2100)"

            # Tile 3: scroll to y=4100 (dashboard_top + 2 * tile_height)
            assert scroll_calls[2].args[0] == "window.scrollTo(0, 4100)"

    def test_reset_scroll_position(self, mock_page):
        """Test that scroll position waits are called after each scroll."""
        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(mock_page, "dashboard", tile_height=2000)

            # Should call wait_for_timeout 3 times (once per tile)
            assert mock_page.wait_for_timeout.call_count == 3

            # Each wait should use the scroll settle timeout constant
            for call in mock_page.wait_for_timeout.call_args_list:
                assert call[0][0] == SCROLL_SETTLE_TIMEOUT_MS

    def test_per_tile_readiness_wait_uses_viewport_check(self, mock_page):
        """wait_for_function polls viewport-visible chart holders after each scroll."""
        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                load_wait=30,
                report_execution_context=_report_context(),
            )

        # One initial holder-mount gate, then readiness and stable-readiness
        # polls per tile.
        stable_calls = [
            call
            for call in mock_page.wait_for_function.call_args_list
            if call.args and "__supersetCaptureReadiness" in call.args[0]
        ]
        assert len(stable_calls) == 3
        for stable_call in stable_calls:
            assert (
                stable_call.kwargs["arg"]["stabilityMs"]
                == REPORT_CAPTURE_READINESS_STABILITY_MS
            )

        # Each call uses viewport-scoped JS and the load_wait timeout
        layout_call, mount_call, *tile_calls = (
            mock_page.wait_for_function.call_args_list
        )
        assert layout_call.args[0] == REPORT_LAYOUT_READY_JS
        assert "length > 0" in mount_call.args[0]
        assert mount_call.kwargs["timeout"] == 30 * 1000
        for call in tile_calls:
            js = call[0][0]
            assert "getBoundingClientRect" in js
            assert "window.innerHeight" in js
            assert "dashboard-component-chart-holder" in js
            assert call.kwargs["timeout"] == 30 * 1000

    def test_per_tile_readiness_timeout_raises_and_skips_capture(self, mock_page):
        """A per-tile readiness timeout raises and does not capture that tile.

        This is a product decision (fail loudly, never snapshot spinners or
        blank charts): a per-tile timeout must abort the tiled screenshot
        instead of warning and continuing.
        """
        from superset.utils.screenshot_utils import PlaywrightTimeout

        timeout = PlaywrightTimeout("Timeout waiting for chart holders")
        mock_page.wait_for_function.side_effect = [None, None, timeout]
        mock_page.evaluate.side_effect = [
            {"height": 5000, "top": 100, "left": 50, "width": 800},  # dimensions
            None,  # window.scrollTo(...) for tile 1
            [{"chartId": "42", "state": "waiting_on_database"}],  # unready
            [{"chartId": "42", "state": "waiting_on_database"}],  # all states
        ]

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                with pytest.raises(PlaywrightTimeout):
                    take_tiled_screenshot(
                        mock_page,
                        "dashboard",
                        tile_height=2000,
                        load_wait=30,
                        report_execution_context=_report_context(),
                    )

        # No tile should have been captured -- fail loudly, don't snapshot
        # a blank or partially-loaded tile.
        mock_page.screenshot.assert_not_called()

        # The layout and mount gates pass and only the first tile readiness
        # poll runs.
        assert mock_page.wait_for_function.call_count == 3

        # A chart failing to load in time is a customer chart-loading issue,
        # not a Superset system fault -- WARNING, not ERROR (#38130, #38441).
        # The report still fails loudly via the raise, asserted above.
        mock_logger.error.assert_not_called()
        mock_logger.warning.assert_called_once()
        warning_args = mock_logger.warning.call_args[0]
        assert "unready" in warning_args[0].lower()
        assert warning_args[3] == 1  # mounted holders
        assert warning_args[4] == 0  # ready holders
        message = warning_args[0] % warning_args[1:]
        assert "tile=1/3" in message
        assert "tiles_captured=0/3" in message
        assert "effective_wait_seconds=30.00" in message
        assert "capture_kind=report" in message
        # Diagnostic payload identifies chart id AND the state it's stuck in
        # (spinner mounted vs nothing mounted vs waiting-on-database) so a
        # slow query can be told apart from the virtualization race.
        assert (
            "unready_holder_states=[{'chartId': '42', 'state': 'waiting_on_database'}]"
            in message
        )

    def test_readiness_change_aborts_before_tile_capture(self, mock_page):
        from superset.utils.screenshot_utils import PlaywrightTimeout

        mock_page.wait_for_function.side_effect = [
            None,
            None,
            PlaywrightTimeout("spinner returned"),
        ]

        with pytest.raises(PlaywrightTimeout, match="spinner returned"):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                report_execution_context=_report_context(),
            )

        mock_page.screenshot.assert_not_called()

    def test_timeout_warning_includes_log_context(self, mock_page):
        """The log context (e.g. report execution id) is threaded through for
        correlation with the run that triggered this screenshot."""
        from superset.utils.screenshot_utils import PlaywrightTimeout

        mock_page.wait_for_function.side_effect = PlaywrightTimeout("timed out")
        mock_page.evaluate.side_effect = [
            {"height": 2000, "top": 0, "left": 0, "width": 800},
            None,
            [{"chartId": "7", "state": "nothing_mounted"}],
            [{"chartId": "7", "state": "nothing_mounted"}],
        ]

        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                with pytest.raises(PlaywrightTimeout):
                    take_tiled_screenshot(
                        mock_page,
                        "dashboard",
                        tile_height=2000,
                        load_wait=5,
                        log_context="execution_id=abc-123",
                    )

        warning_args = mock_logger.warning.call_args[0]
        assert " [execution_id=abc-123]" in warning_args[0] % warning_args[1:]

    def test_chart_holder_with_nothing_mounted_blocks_wait(self, mock_page):
        """Regression test for the vacuous-pass race (PR #39895).

        A chart holder that intersects the viewport but has not yet mounted
        a spinner or a chart (e.g. its IntersectionObserver callback hasn't
        fired) must not satisfy the readiness predicate.
        """
        from superset.utils.screenshot_utils import PlaywrightTimeout

        js_call_count = {"n": 0}

        def fake_wait_for_function(js, timeout=None):
            js_call_count["n"] += 1
            # Simulate evaluating the predicate against a DOM with a chart
            # holder in viewport that has mounted nothing at all.
            assert "dashboard-component-chart-holder" in js
            if "getBoundingClientRect" not in js:
                return None
            raise PlaywrightTimeout("Timeout waiting for chart holders")

        mock_page.wait_for_function.side_effect = fake_wait_for_function
        mock_page.evaluate.side_effect = [
            {"height": 2000, "top": 0, "left": 0, "width": 800},  # dimensions
            None,  # window.scrollTo(...) for tile 1
            [{"chartId": "7", "state": "nothing_mounted"}],  # diagnostics
            [{"chartId": "7", "state": "nothing_mounted"}],  # all states
        ]

        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            with pytest.raises(PlaywrightTimeout):
                take_tiled_screenshot(
                    mock_page, "dashboard", tile_height=2000, load_wait=5
                )

        assert js_call_count["n"] == 1
        mock_page.screenshot.assert_not_called()

    def test_unready_holder_state_classification_embedded_in_js(self, mock_page):
        """The readiness JS classifies *why* a holder isn't ready.

        Distinguishing "spinner_mounted" (query done, not yet in the
        virtualization viewport), "waiting_on_database" (initial query still
        in flight), and "nothing_mounted" (the vacuous-pass race) is what
        lets a slow query be told apart from the race during an incident.
        """
        from superset.utils.screenshot_utils import (
            CHART_HOLDERS_READY_JS,
            DASHBOARD_ALL_CHART_HOLDERS_READY_JS,
            FIND_CHART_HOLDER_STATES_JS,
            FIND_UNREADY_CHART_HOLDERS_JS,
            REPORT_CHART_HOLDERS_READY_JS,
        )

        for js in (CHART_HOLDERS_READY_JS, FIND_UNREADY_CHART_HOLDERS_JS):
            assert "spinner_mounted" in js
            assert "waiting_on_database" in js
            assert "nothing_mounted" in js
            assert ".slice_container" in js
            assert (
                '.dashboard-component-chart-holder[class*="dashboard-chart-id-"]'
            ) in js
            assert "holder.className.match(/\\bdashboard-chart-id-(\\d+)\\b/)" in js
        assert "holders.length > 0" not in CHART_HOLDERS_READY_JS
        assert "holders.length > 0" in REPORT_CHART_HOLDERS_READY_JS
        assert ".dashboard-grid" in DASHBOARD_ALL_CHART_HOLDERS_READY_JS
        assert "holders.length > 0" not in DASHBOARD_ALL_CHART_HOLDERS_READY_JS

        assert "rendered" in FIND_CHART_HOLDER_STATES_JS
        assert "empty" in FIND_CHART_HOLDER_STATES_JS
        assert "error" in FIND_CHART_HOLDER_STATES_JS
        assert "virtualized" in FIND_CHART_HOLDER_STATES_JS
        assert "waiting_on_database" in FIND_CHART_HOLDER_STATES_JS
        assert (
            '.dashboard-component-chart-holder[class*="dashboard-chart-id-"]'
        ) in FIND_CHART_HOLDER_STATES_JS

    def test_readiness_constants_are_production_safe(self):
        from superset.utils.screenshot_utils import (
            CHART_CONTAINER_READY_JS,
            CHART_HOLDERS_READY_JS,
            DASHBOARD_ALL_CHART_HOLDERS_READY_JS,
            FIND_CHART_HOLDER_STATES_JS,
            FIND_UNREADY_CHART_HOLDERS_JS,
            REPORT_CHART_HOLDERS_READY_JS,
        )

        for js in (
            CHART_CONTAINER_READY_JS,
            CHART_HOLDERS_READY_JS,
            DASHBOARD_ALL_CHART_HOLDERS_READY_JS,
            FIND_CHART_HOLDER_STATES_JS,
            FIND_UNREADY_CHART_HOLDERS_JS,
            REPORT_CHART_HOLDERS_READY_JS,
        ):
            assert "data-test" not in js

    def test_per_tile_timing_logged_at_debug(self, mock_page):
        """Each tile logs how long it waited for readiness, for profiling."""
        with patch("superset.utils.screenshot_utils.logger") as mock_logger:
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                take_tiled_screenshot(
                    mock_page,
                    "dashboard",
                    tile_height=2000,
                    load_wait=30,
                    log_context="execution_id=abc-123",
                )

        # 3 tiles, all ready immediately (mock_page.wait_for_function is a
        # no-op MagicMock by default) -> one timing line per tile.
        timing_calls = [
            call
            for call in mock_logger.debug.call_args_list
            if "ready after" in call[0][0]
        ]
        assert len(timing_calls) == 3

        first_call_args = timing_calls[0][0]
        assert first_call_args[1] == 1  # tile index
        assert first_call_args[2] == 3  # total tiles
        elapsed = first_call_args[3]
        assert isinstance(elapsed, float)
        assert elapsed >= 0
        assert first_call_args[4] == 30  # load_wait
        assert first_call_args[5] == " [execution_id=abc-123]"

    def test_all_chart_holders_ready_passes(self, mock_page):
        """All chart holders rendered or errored -> wait passes, tile captured."""
        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            result = take_tiled_screenshot(
                mock_page, "dashboard", tile_height=2000, load_wait=5
            )

        # mock_page.wait_for_function is a MagicMock by default and does not
        # raise, i.e. the readiness check passes immediately for every tile.
        assert mock_page.wait_for_function.call_count == 3
        assert mock_page.screenshot.call_count == 3
        assert result is not None

    def test_thumbnail_zero_holders_preserves_existing_capture_behavior(
        self,
        mock_page,
    ):
        """The report-only mount gate must not make empty thumbnails time out."""

        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles",
            return_value=b"thumbnail",
        ):
            result = take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                load_wait=30,
            )

        assert result == b"thumbnail"
        assert mock_page.wait_for_function.call_count == 3
        predicate = mock_page.wait_for_function.call_args_list[0].args[0]
        assert "holders.length > 0" not in predicate
        assert mock_page.screenshot.call_count == 3

    def test_load_wait_default_is_sixty_seconds(self):
        """load_wait defaults to 60 to match SCREENSHOT_LOAD_WAIT config default."""
        import inspect

        from superset.utils.screenshot_utils import take_tiled_screenshot

        sig = inspect.signature(take_tiled_screenshot)
        assert sig.parameters["load_wait"].default == 60

    def test_per_tile_animation_wait_called_per_tile(self, mock_page):
        """animation_wait adds an extra wait per tile after the spinner check."""
        with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
            take_tiled_screenshot(
                mock_page, "dashboard", tile_height=2000, animation_wait=5
            )

        # 3 tiles × (1 scroll settle + 1 animation wait) = 6 total calls
        assert mock_page.wait_for_timeout.call_count == 6

        animation_calls = [
            call
            for call in mock_page.wait_for_timeout.call_args_list
            if call[0][0] == 5 * 1000
        ]
        assert len(animation_calls) == 3

    def test_animation_wait_default_is_zero(self):
        """animation_wait defaults to 0 so no extra per-tile wait by default."""
        import inspect

        from superset.utils.screenshot_utils import take_tiled_screenshot

        sig = inspect.signature(take_tiled_screenshot)
        assert sig.parameters["animation_wait"].default == 0


class TestTileWaitBudget:
    """The tiled operation's cumulative per-tile waits are capped by one
    wall-clock budget derived from the running Celery task's own time limit
    (resolve_screenshot_task_budget_seconds), falling back to a fixed total
    ceiling outside Celery because per-tile waits accumulate."""

    @pytest.fixture
    def mock_page(self):
        """Create a mock Playwright page object for a 3-tile (5000px) dashboard."""
        page = MagicMock()
        element = MagicMock()
        page.locator.return_value = element
        page.evaluate.return_value = {
            "height": 5000,
            "top": 100,
            "left": 50,
            "width": 800,
        }
        page.screenshot.return_value = b"fake_screenshot_data"
        return page

    class _FakeClock:
        """Stateful monotonic() stand-in the test advances explicitly.

        Robust to how many times the code under test samples the clock per
        tile (budget check, per-tile wait timing, animation budget) -- only
        explicit advances move time forward.
        """

        def __init__(self) -> None:
            self.now = 0.0

        def __call__(self) -> float:
            return self.now

    def test_budget_error_is_task_budget_error_subclass(self):
        """Callers can catch the whole budget-error family with the base
        ScreenshotTaskBudgetExceededError type."""
        assert issubclass(
            TiledScreenshotBudgetExceededError, ScreenshotTaskBudgetExceededError
        )

    def test_per_tile_wait_shrinks_as_budget_depletes(self, mock_page, monkeypatch):
        """Each tile's readiness-wait timeout is capped at the remaining budget."""
        monkeypatch.setattr(
            "superset.utils.screenshot_utils.TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS",  # noqa: E501
            1000,
        )
        clock = self._FakeClock()
        # Simulate slow tiles: the readiness wait itself consumes wall time,
        # so each subsequent tile sees less remaining budget.
        wait_durations = iter([950, 40, 5])

        def slow_wait(*args, **kwargs):
            clock.now += next(wait_durations)

        mock_page.wait_for_function.side_effect = slow_wait

        with patch("superset.utils.screenshot_utils.current_task", None):
            with patch("superset.utils.screenshot_utils.time.monotonic", new=clock):
                with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                    result = take_tiled_screenshot(
                        mock_page, "dashboard", tile_height=2000, load_wait=100
                    )

        assert result is not None
        timeouts = [
            call[1]["timeout"] for call in mock_page.wait_for_function.call_args_list
        ]
        # remaining budget at each tile's wait: 1000, 50, 10 seconds
        # -> capped timeouts shrink
        assert timeouts == [100 * 1000, 50 * 1000, 10 * 1000]
        assert timeouts == sorted(timeouts, reverse=True)

    def test_readiness_wait_uses_budget_recomputed_after_scroll_settle(
        self, mock_page, monkeypatch
    ):
        """The readiness-wait timeout must be capped using the budget
        recomputed *after* the scroll-settle sleep, not the stale value from
        before it -- otherwise each tile could overrun the total budget by up
        to one settle interval."""
        monkeypatch.setattr(
            "superset.utils.screenshot_utils.TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS",  # noqa: E501
            1000,
        )
        # A single-tile dashboard to keep the scenario simple.
        mock_page.evaluate.return_value = {
            "height": 1000,
            "top": 100,
            "left": 50,
            "width": 800,
        }
        clock = self._FakeClock()
        # The scroll-settle sleep itself consumes 950s of wall-clock time,
        # leaving only 50s of the 1000s budget by the time the readiness
        # wait is capped.
        mock_page.wait_for_timeout.side_effect = lambda *args, **kwargs: setattr(
            clock, "now", clock.now + 950
        )

        with patch("superset.utils.screenshot_utils.current_task", None):
            with patch("superset.utils.screenshot_utils.time.monotonic", new=clock):
                with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                    take_tiled_screenshot(
                        mock_page, "dashboard", tile_height=2000, load_wait=999
                    )

        timeout = mock_page.wait_for_function.call_args_list[0][1]["timeout"]
        # Must reflect the post-settle remaining budget (50s), not the
        # stale pre-settle value (1000s, which would have let load_wait's
        # full 999s through uncapped).
        assert timeout == 50 * 1000

    def test_budget_exhausted_raises_and_stops_capturing(self, mock_page, monkeypatch):
        """Exhausting the budget aborts cleanly instead of capturing unchecked."""
        monkeypatch.setattr(
            "superset.utils.screenshot_utils.TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS",  # noqa: E501
            1000,
        )
        clock = self._FakeClock()
        # Tile 0's readiness wait consumes the whole budget; tile 1's budget
        # check then sees remaining <= 0 and raises before capturing.
        mock_page.wait_for_function.side_effect = lambda *args, **kwargs: setattr(
            clock, "now", 1000.0
        )

        with patch("superset.utils.screenshot_utils.current_task", None):
            with patch("superset.utils.screenshot_utils.time.monotonic", new=clock):
                with patch(
                    "superset.utils.screenshot_utils.combine_screenshot_tiles"
                ) as mock_combine:
                    with patch("superset.utils.screenshot_utils.logger") as mock_logger:
                        with pytest.raises(TiledScreenshotBudgetExceededError):
                            take_tiled_screenshot(
                                mock_page, "dashboard", tile_height=2000, load_wait=100
                            )

        # Nothing is captured: the pre-capture bounded check raises before
        # snapshotting the tile whose readiness wait consumed the budget
        # (the capture call itself is deadline-bounded in this design).
        assert mock_page.screenshot.call_count == 0
        # Tiles were never combined -- the function raised before that point.
        mock_combine.assert_not_called()

        # Budget exhaustion is a customer chart-loading issue, not a Superset
        # system fault, so it must log at WARNING (not ERROR) -- consistent
        # with the #38130/#38441 precedent for screenshot timeout logging.
        assert mock_logger.error.call_count == 0
        terminal_warning = next(
            call
            for call in mock_logger.warning.call_args_list
            if call.args[0].startswith("report_capture_terminal")
        )
        warning_args = terminal_warning.args
        assert "terminal_reason=budget_exhausted" in warning_args[0]

    def test_budget_exhausted_warning_includes_log_context(
        self, mock_page, monkeypatch
    ):
        """log_context (e.g. report execution id) is appended to the warning."""
        monkeypatch.setattr(
            "superset.utils.screenshot_utils.TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS",  # noqa: E501
            1000,
        )
        clock = self._FakeClock()
        # Tile 0's readiness wait consumes the whole budget; tile 1's budget
        # check then sees remaining <= 0 and raises.
        mock_page.wait_for_function.side_effect = lambda *args, **kwargs: setattr(
            clock, "now", 1000.0
        )
        with patch("superset.utils.screenshot_utils.current_task", None):
            with patch("superset.utils.screenshot_utils.time.monotonic", new=clock):
                with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                    with patch("superset.utils.screenshot_utils.logger") as mock_logger:
                        with pytest.raises(TiledScreenshotBudgetExceededError):
                            take_tiled_screenshot(
                                mock_page,
                                "dashboard",
                                tile_height=2000,
                                load_wait=100,
                                log_context="execution_id=abc-123",
                            )

        warning_args = mock_logger.warning.call_args[0]
        assert warning_args[-1] == " [execution_id=abc-123]"

    def test_budget_exhausted_before_first_tile_raises_without_capture(
        self, mock_page, monkeypatch
    ):
        """No budget floor: a budget already exhausted by setup (element
        lookup/dimension probing) raises before the first tile is captured,
        matching the non-tiled path's raise-before-capture semantics."""
        monkeypatch.setattr(
            "superset.utils.screenshot_utils.TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS",  # noqa: E501
            1000,
        )
        clock = self._FakeClock()
        # The dashboard-dimension evaluate() itself consumes the whole budget.
        original_return = {"height": 5000, "top": 100, "left": 50, "width": 800}

        def slow_evaluate(*args, **kwargs):
            clock.now = 1000.0
            return original_return

        mock_page.evaluate.side_effect = slow_evaluate

        with patch("superset.utils.screenshot_utils.current_task", None):
            with patch("superset.utils.screenshot_utils.time.monotonic", new=clock):
                with patch(
                    "superset.utils.screenshot_utils.combine_screenshot_tiles"
                ) as mock_combine:
                    with pytest.raises(TiledScreenshotBudgetExceededError):
                        take_tiled_screenshot(
                            mock_page, "dashboard", tile_height=2000, load_wait=100
                        )

        mock_page.screenshot.assert_not_called()
        mock_combine.assert_not_called()

    def test_no_celery_context_uses_fixed_total_fallback(self, mock_page):
        """Outside Celery the helper returns None; the tiled path must fall
        back to the fixed total ceiling rather than running uncapped, because
        per-tile waits accumulate across tiles."""
        clock = self._FakeClock()
        with patch("superset.utils.screenshot_utils.current_task", None):
            with patch("superset.utils.screenshot_utils.time.monotonic", new=clock):
                with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                    take_tiled_screenshot(
                        mock_page,
                        "dashboard",
                        tile_height=2000,
                        load_wait=10_000,  # deliberately above the fallback
                    )

        first_timeout = mock_page.wait_for_function.call_args_list[0][1]["timeout"]
        assert first_timeout == TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS * 1000

    def test_screenshot_started_at_counts_pre_capture_time_against_budget(
        self, mock_page, monkeypatch
    ):
        """Time spent before tiling (navigation, headstart, element waits)
        counts against the non-report budget when the caller provides the
        overall screenshot start time -- the same clock the non-tiled
        readiness wait uses. Report captures use their deadline instead."""
        monkeypatch.setattr(
            "superset.utils.screenshot_utils.TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS",  # noqa: E501
            1000,
        )
        clock = self._FakeClock()
        # The overall screenshot started 900s ago; only 100s of budget remains.
        clock.now = 900.0

        with patch("superset.utils.screenshot_utils.current_task", None):
            with patch("superset.utils.screenshot_utils.time.monotonic", new=clock):
                with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                    take_tiled_screenshot(
                        mock_page,
                        "dashboard",
                        tile_height=2000,
                        load_wait=500,
                        screenshot_started_at=0.0,
                    )

        first_timeout = mock_page.wait_for_function.call_args_list[0][1]["timeout"]
        assert first_timeout == 100 * 1000

    def test_omitted_screenshot_started_at_anchors_clock_locally(
        self, mock_page, monkeypatch
    ):
        """Without the caller-provided anchor the clock starts at entry
        (backward-compatible default)."""
        monkeypatch.setattr(
            "superset.utils.screenshot_utils.TILED_SCREENSHOT_TOTAL_WAIT_BUDGET_SECONDS",  # noqa: E501
            1000,
        )
        clock = self._FakeClock()
        clock.now = 900.0

        with patch("superset.utils.screenshot_utils.current_task", None):
            with patch("superset.utils.screenshot_utils.time.monotonic", new=clock):
                with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                    take_tiled_screenshot(
                        mock_page,
                        "dashboard",
                        tile_height=2000,
                        load_wait=500,
                    )

        first_timeout = mock_page.wait_for_function.call_args_list[0][1]["timeout"]
        assert first_timeout == 500 * 1000

    def test_derived_task_budget_caps_tile_wait(self, mock_page):
        """Inside Celery, the tiled path caps waits using the same
        task-derived budget as the non-tiled path (helper reuse, #42427)."""
        task = MagicMock()
        task.request.timelimit = (120, None)  # (hard, soft): 120s hard limit

        clock = self._FakeClock()
        with patch("superset.utils.screenshot_utils.current_task", task):
            with patch("superset.utils.screenshot_utils.time.monotonic", new=clock):
                with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                    take_tiled_screenshot(
                        mock_page, "dashboard", tile_height=2000, load_wait=200
                    )

        # margin = min(300, 120 * 0.2) = 24; budget = 120 - 24 = 96
        first_timeout = mock_page.wait_for_function.call_args_list[0][1]["timeout"]
        assert first_timeout == 96 * 1000
        assert first_timeout < 200 * 1000

    def test_fast_dashboard_matches_default_behavior(self, mock_page):
        """Well under budget, waits are not capped and behavior is unchanged."""
        with patch("superset.utils.screenshot_utils.current_task", None):
            with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                result = take_tiled_screenshot(
                    mock_page,
                    "dashboard",
                    tile_height=2000,
                    load_wait=30,
                    animation_wait=5,
                )

        assert result is not None
        assert mock_page.screenshot.call_count == 3

        for call in mock_page.wait_for_function.call_args_list:
            assert call[1]["timeout"] == 30 * 1000

        animation_calls = [
            call
            for call in mock_page.wait_for_timeout.call_args_list
            if call[0][0] == 5 * 1000
        ]
        assert len(animation_calls) == 3

    def test_per_tile_timing_debug_line_logged(self, mock_page):
        """Each tile logs a DEBUG timing breakdown (readiness wait, animation
        wait) so slow dashboards can be profiled from logs alone."""
        with patch("superset.utils.screenshot_utils.current_task", None):
            with patch("superset.utils.screenshot_utils.logger") as mock_logger:
                with patch("superset.utils.screenshot_utils.combine_screenshot_tiles"):
                    take_tiled_screenshot(
                        mock_page,
                        "dashboard",
                        tile_height=2000,
                        log_context="cache_key=xyz",
                    )

        timing_calls = [
            call for call in mock_logger.debug.call_args_list if "timing" in call[0][0]
        ]
        assert len(timing_calls) == 3
        for i, call in enumerate(timing_calls):
            args = call[0]
            assert args[1] == i + 1  # tile index
            assert args[2] == 3  # total tiles
            assert args[-1] == " [cache_key=xyz]"


def test_readiness_predicates_gate_on_unpainted_echarts_hosts() -> None:
    """The report gate, the single-chart gate, and the diagnostics query all
    key on the ECharts paint marker so a pre-paint canvas is never captured."""
    from superset.utils.screenshot_utils import (
        CHART_CONTAINER_READY_JS,
        ECHARTS_UNPAINTED_HOST_SELECTOR,
        FIND_CHART_HOLDER_STATES_JS,
        REPORT_CHART_HOLDERS_READY_JS,
    )

    assert (
        ECHARTS_UNPAINTED_HOST_SELECTOR == ".echarts-host:not(.echarts-render-finished)"
    )
    assert ECHARTS_UNPAINTED_HOST_SELECTOR in REPORT_CHART_HOLDERS_READY_JS
    assert ECHARTS_UNPAINTED_HOST_SELECTOR in CHART_CONTAINER_READY_JS
    assert "mounted_unpainted" in FIND_CHART_HOLDER_STATES_JS


def test_readiness_predicates_gate_on_unpainted_ag_grid_hosts() -> None:
    """Report readiness follows the AG Grid first-data-rendered contract used
    by the frontend image export path, rather than accepting its mounted shell."""
    from superset.utils.screenshot_utils import (
        AG_GRID_HOST_SELECTOR,
        CHART_CONTAINER_READY_JS,
        CHART_CONTAINER_STATE_JS,
        CHART_HOLDERS_READY_JS,
        FIND_CHART_HOLDER_STATES_JS,
        REPORT_ALL_CHART_HOLDERS_READY_JS,
        REPORT_CHART_HOLDERS_READY_JS,
    )

    assert AG_GRID_HOST_SELECTOR == '[data-themed-ag-grid="true"]'
    for predicate in (
        CHART_HOLDERS_READY_JS,
        REPORT_CHART_HOLDERS_READY_JS,
        REPORT_ALL_CHART_HOLDERS_READY_JS,
        CHART_CONTAINER_READY_JS,
    ):
        assert AG_GRID_HOST_SELECTOR in predicate
        assert "_agGridFirstDataRendered !== true" in predicate
    for predicate in (
        CHART_HOLDERS_READY_JS,
        REPORT_CHART_HOLDERS_READY_JS,
        REPORT_ALL_CHART_HOLDERS_READY_JS,
    ):
        assert "grid._supersetAgGridWaitObserved = true" in predicate
    assert "ag_grid_unpainted" in FIND_CHART_HOLDER_STATES_JS
    assert "grid._supersetAgGridWaitObserved === true" in (FIND_CHART_HOLDER_STATES_JS)
    assert "agGridWaitObserved" in FIND_CHART_HOLDER_STATES_JS
    assert "ag_grid_unpainted" in CHART_CONTAINER_STATE_JS


def test_ag_grid_no_rows_overlay_is_a_terminal_empty_state() -> None:
    """A mounted zero-row grid must not wait for firstDataRendered forever."""
    from superset.utils.screenshot_utils import (
        CHART_CONTAINER_READY_JS,
        CHART_HOLDERS_READY_JS,
        EMPTY_SELECTOR,
        REPORT_ALL_CHART_HOLDERS_READY_JS,
        REPORT_CHART_HOLDERS_READY_JS,
    )

    assert ".ag-overlay-no-rows-wrapper:not(.ag-hidden)" in EMPTY_SELECTOR
    for predicate in (
        CHART_HOLDERS_READY_JS,
        REPORT_CHART_HOLDERS_READY_JS,
        REPORT_ALL_CHART_HOLDERS_READY_JS,
        CHART_CONTAINER_READY_JS,
    ):
        assert ".ag-overlay-no-rows-wrapper:not(.ag-hidden)" in predicate


def test_expand_scrollable_content_js_unrolls_ag_grid_and_css_scroll() -> None:
    """The pre-capture DOM-expansion script must reach both flavors of
    clipped table content: ag-Grid's row virtualization (needs its own API
    to force a full render) and plain CSS overflow/height clipping (the
    content already exists in the DOM and just needs the constraint lifted).
    It must also lift the fixed heights on the shared `.chart-container` /
    `.slice_container` / ag-Grid-wrapper ancestor chain, not just the
    scrollable descendant itself -- a bounding-box capture
    (`element.screenshot()`, used for single-chart exports) clips to the
    ancestor's own box, which does not grow just because a descendant's
    content does (#38090, reviewed by @aminghadersohi on #43979)."""
    from superset.utils.screenshot_utils import (
        AG_GRID_HOST_SELECTOR,
        CHART_CONTAINER_SELECTOR,
        EXPAND_SCROLLABLE_CONTENT_JS,
        GENERIC_SCROLLABLE_DESCENDANT_SELECTOR,
        SLICE_CONTAINER_SELECTOR_FOR_EXPANSION,
    )

    assert AG_GRID_HOST_SELECTOR in EXPAND_SCROLLABLE_CONTENT_JS
    assert "setGridOption('domLayout', 'print')" in EXPAND_SCROLLABLE_CONTENT_JS
    assert "grid._agGridApi" in EXPAND_SCROLLABLE_CONTENT_JS
    # The grid's own host and its immediate parent (the ag-Grid table
    # plugin's fixed-pixel-height wrapper) both get their height lifted --
    # not just the descendant content inside the grid.
    assert "grid.style.height = 'auto'" in EXPAND_SCROLLABLE_CONTENT_JS
    assert "grid.parentElement.style.height = 'auto'" in EXPAND_SCROLLABLE_CONTENT_JS

    assert SLICE_CONTAINER_SELECTOR_FOR_EXPANSION == ".slice_container"
    assert SLICE_CONTAINER_SELECTOR_FOR_EXPANSION in EXPAND_SCROLLABLE_CONTENT_JS

    assert CHART_CONTAINER_SELECTOR == ".chart-container"
    assert GENERIC_SCROLLABLE_DESCENDANT_SELECTOR == (
        '.chart-container [style*="overflow"], .chart-container .ant-table-body'
    )
    assert GENERIC_SCROLLABLE_DESCENDANT_SELECTOR in EXPAND_SCROLLABLE_CONTENT_JS
    # Gated on actually clipping, so a non-scrollable match (e.g. a sticky
    # table header with no overflow of its own) is left untouched.
    assert "el.scrollHeight > el.clientHeight" in EXPAND_SCROLLABLE_CONTENT_JS
    assert "overflow = 'visible'" in EXPAND_SCROLLABLE_CONTENT_JS
    assert "maxHeight = 'none'" in EXPAND_SCROLLABLE_CONTENT_JS

    # Takes an explicit wait budget rather than hardcoding one, so it can be
    # bounded by a report's remaining deadline (see webdriver_test.py).
    assert "async (maxWaitMs) =>" in EXPAND_SCROLLABLE_CONTENT_JS
    assert "Date.now() + maxWaitMs" in EXPAND_SCROLLABLE_CONTENT_JS

    # The generic-descendant reset repeats to a fixed point (bounded), not a
    # single pass: an ancestor whose own height was computed as the sum of
    # its still-clipped children (e.g. plugin-chart-table's `role="table"`
    # sticky wrapper in useSticky.tsx) has scrollHeight == clientHeight
    # *before* its child is expanded, so a single querySelectorAll pass
    # skips it -- see test_expand_scrollable_content_resolves_nested_ancestor_clip
    # below for the real-browser reproduction.
    #
    # Pinned as one exact block rather than independent substring checks: as
    # @aminghadersohi found by mutation-testing the original two asserts
    # (`"changedInPass" in ...` / `"passes < 5" in ...`), both tokens can
    # survive edits that still break convergence -- e.g. seeding
    # `changedInPass = false` (the loop body never runs) or adding a second,
    # tighter cap alongside the existing one (back to a single effective
    # pass) -- because neither mutation removes either literal token from
    # the string. An exact match of the whole control-flow block catches
    # any single-character change to it, including both of those.
    expected_fixed_point_loop = (
        "    let changedInPass = true;\n"
        "    let passes = 0;\n"
        "    while (changedInPass && passes < 5) {\n"
        "        changedInPass = false;\n"
        "        passes += 1;\n"
        f"        document.querySelectorAll('{GENERIC_SCROLLABLE_DESCENDANT_SELECTOR}')"
        ".forEach(\n"
        "            (el) => {\n"
        "                if (el.scrollHeight > el.clientHeight) {\n"
        "                    el.style.overflow = 'visible';\n"
        "                    el.style.height = 'auto';\n"
        "                    el.style.maxHeight = 'none';\n"
        "                    changedInPass = true;\n"
        "                }\n"
        "            }\n"
        "        );\n"
        "    }\n"
    )
    assert expected_fixed_point_loop in EXPAND_SCROLLABLE_CONTENT_JS


def test_expand_scrollable_content_resolves_nested_ancestor_clip() -> None:
    """Real-browser regression test (Playwright/Chromium) for the fixed-point
    loop above: reproduces the exact nested clip that a single-pass reset
    missed for `plugin-chart-table`.

    `useSticky.tsx` renders a `role="table"` wrapper with a fixed pixel
    height and `overflow: hidden`, around a `scrollBodyRef` div that has its
    *own* fixed height + `overflow: auto`. Before any DOM mutation, the
    wrapper's `scrollHeight` already equals its `clientHeight` (its height
    was computed as the sum of its still-clipped children), so a single
    querySelectorAll pass expands the inner scroll body but has already
    evaluated -- and skipped -- the outer wrapper by the time the inner one
    grows. This fixture reproduces that exact two-level shape and asserts
    every row ends up inside the bounding box a locator-scoped
    `element.screenshot()` would capture (the same clip Thread B of
    @aminghadersohi's #43979 review flagged for the ag-Grid ancestor case).

    Skips (does not fail) when Playwright's Python package or a Chromium
    binary is unavailable -- this environment's own CI unit-test job does
    not install either today, so this is currently a local/dev verification
    aid rather than an enforced CI gate.
    """
    pytest.importorskip("playwright.sync_api")
    from playwright.sync_api import Error as PlaywrightError, sync_playwright

    from superset.utils.screenshot_utils import EXPAND_SCROLLABLE_CONTENT_JS

    n_rows = 50
    row_height_px = 30
    body_height_px = 250  # only ~8 rows fit before the fix
    outer_height_px = 300  # header + visible body rows, per useSticky's realHeight

    rows_html = "".join(
        f'<tr id="row-{i}" style="height:{row_height_px}px;"><td>row {i}</td></tr>'
        for i in range(n_rows)
    )
    html = f"""
    <!doctype html><html><body style="margin:0">
    <div class="chart-container" style="min-height: {outer_height_px}px; position: relative;">
      <div class="slice_container" style="height: {outer_height_px}px; display:flex; flex-direction:column; justify-content:center;">
        <div role="table" style="width: 800px; height: {outer_height_px}px; overflow: hidden;">
          <div style="overflow: hidden; width: 780px; height: 36px;">HEADER ROW</div>
          <div style="height: {body_height_px}px; overflow: auto; width: 780px; box-sizing: border-box;">
            <table style="table-layout: fixed; width: 100%;">
              <tbody>{rows_html}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </body></html>
    """  # noqa: E501

    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch()
        except PlaywrightError as ex:
            pytest.skip(f"Chromium is not installed for Playwright: {ex}")
            return

        try:
            page = browser.new_page(viewport={"width": 900, "height": 900})
            page.set_content(html)

            chart_container = page.locator(".chart-container")
            last_row = page.locator(f"#row-{n_rows - 1}")

            before_box = chart_container.bounding_box()
            before_last_row_box = last_row.bounding_box()
            assert before_box is not None
            assert before_last_row_box is not None
            # Confirm the fixture actually reproduces clipping before
            # asserting the fix resolves it, so a broken fixture fails
            # loudly instead of vacuously passing.
            assert (
                before_last_row_box["y"] + before_last_row_box["height"]
                > before_box["y"] + before_box["height"]
            )

            page.evaluate(EXPAND_SCROLLABLE_CONTENT_JS, 500)

            after_box = chart_container.bounding_box()
            after_last_row_box = last_row.bounding_box()
            assert after_box is not None
            assert after_last_row_box is not None
            assert (
                after_last_row_box["y"] + after_last_row_box["height"]
                <= after_box["y"] + after_box["height"]
            )
            # Every row's height, plus the header -- not just the last
            # row's position -- actually fits inside the grown container.
            assert after_box["height"] >= n_rows * row_height_px
        finally:
            browser.close()


# DOM/CSS of the chart-only page that `ChartScreenshot` captures
# (`standalone=REPORT`), measured on a master build and reduced to the rules that
# decide layout. Every class is a plain stylesheet rule, never an inline `style`
# attribute, because that is how the real plugins (emotion) style them and what
# the inline-`style` selector in EXPAND_SCROLLABLE_CONTENT_JS cannot see.
#
# `.shell-*` is the app shell above `.chart-container`: a growable flex `body`
# (`min-height: 100vh`, GlobalStyles) over flex-column wrappers that fill it, down
# to the ExploreChartPanel wrapper (`flex: 1; min-height: 0; overflow: hidden`).
# There is no fixed viewport-height ancestor clamp (percentage heights remain, but
# they resolve against content-driven parents), so the wrapper grows with its
# content. The 6.1.0 shell pinned `html, body, #app` to `height: 100%`, which did
# clamp it; that layout is out of scope here.
_CHART_CAPTURE_FIXTURE_CSS = """
html { height: 100%; }
body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; }
.shell-app { flex: 1 1 auto; position: relative; display: flex;
  flex-direction: column; }
.shell-flex, .shell-layout, .shell-content, .shell-portal { display: flex;
  flex-direction: column; flex: 1 1 auto; min-height: 0; }
.shell-portal { height: 100%; }
.shell-standalone { position: relative; height: 100%; flex: 1 1 auto;
  display: flex; flex-direction: column; }
.shell-chart-panel { min-height: 0; flex: 1; overflow: hidden; }
.dashboard-chart { overflow: hidden; position: relative; height: 400px; }
.chart-container { min-height: 600px; position: relative; }
.dashboard-chart .chart-container { min-height: 400px; }
.slice_container { display: flex; flex-direction: column;
  justify-content: center; height: 600px; }
.dashboard-chart .slice_container { height: 400px; }
.pivot-styles { margin: 16px; height: 568px; width: 760px; }
.pivot-wrapper { height: 100%; max-width: inherit; overflow: auto; }
.handlebars-styles { height: 568px; width: 760px; padding: 16px;
  overflow: auto; }
.ag-parent { height: 568px; }
.ag-host { height: 100%; overflow: auto; }
.legend-viewport { max-height: 100px; overflow-x: hidden; overflow-y: auto;
  width: 100%; }
.nest-root { height: 568px; width: 760px; overflow: hidden; }
.nest-fill { height: 100%; overflow: hidden; }
.cards { height: 568px; overflow: auto; }
.card { height: 40px; overflow: hidden; position: relative; }
.badge { position: absolute; bottom: -20px; }
td { height: 24px; padding: 0 4px; border: 1px solid #888; font: 12px sans-serif; }
td.marker { background: #222; color: #fff; }
"""

_CHART_CAPTURE_ROWS = 300

# More nesting levels than the fixed-point loop used to allow passes for.
_NESTED_CLIP_DEPTH = 8
# `.nest-root`'s height, which the whole chain resolves against.
_NESTED_CLIP_WRAPPER_HEIGHT_PX = 568
# A height cap small enough that a 300-row fixture clearly overshoots it, so a
# capped capture is distinguishable from an uncapped one.
_CHART_CAPTURE_SMALL_CAP_PX = 2000
# `.chart-container`'s width at the default chart window, which turns a
# device-pixel budget into the height it allows.
_CHART_CAPTURE_WIDTH_PX = 800
# Rows enough to make an inline-overflow table taller than the fixed 16384px
# cap the device-pixel budget replaced, while staying far inside that budget.
_INLINE_OVERFLOW_PARITY_ROWS = 1000
_REPLACED_FIXED_CAP_PX = 16384
# Enough clipped boxes that re-reading all of them on every pass of the
# fixed-point loop is measurably quadratic.
_OVERFLOWING_CARD_COUNT = 200
# A budget that divides exactly at the default width and a scale factor of 2:
# 6,400,000 / (800 * 2 * 2) = 2000 CSS px, i.e. a 1600x4000 image.
_HIGH_DPI_BUDGET_PX = 6_400_000
_HIGH_DPI_SCALE_FACTOR = 2
_HIGH_DPI_ALLOWED_CSS_PX = 2000


def _chart_capture_rows(n_rows: int) -> str:
    marked = {0: "first", n_rows // 2: "middle", n_rows - 1: "last"}
    rows = []
    for i in range(n_rows):
        cell = '<td class="marker">' if i in marked else "<td>"
        row_id = f' id="row-{marked[i]}"' if i in marked else ""
        rows.append(
            f"<tr{row_id}>{cell}PRODUCT_{i // 5:03d}</td>"
            f"{cell}Customer {i:04d}</td><td>{i}</td></tr>"
        )
    return "".join(rows)


def _pivot_chart_body(n_rows: int) -> str:
    """Pivot-table DOM shape: a fixed-pixel-height div (no overflow) around a
    `height: 100%; overflow: auto` div that scrolls the table."""
    return (
        '<div class="pivot-styles"><div class="pivot-wrapper">'
        f'<table id="content"><tbody>{_chart_capture_rows(n_rows)}</tbody></table>'
        "</div></div>"
    )


def _inline_overflow_chart_body(n_rows: int) -> str:
    """The shape EXPAND_SCROLLABLE_CONTENT_JS already handles: the scroller
    carries its fixed height and overflow inline."""
    return (
        '<div style="height: 568px; overflow: auto; width: 760px;">'
        f'<table id="content"><tbody>{_chart_capture_rows(n_rows)}</tbody></table>'
        "</div>"
    )


def _handlebars_style_chart_body(n_rows: int) -> str:
    """A class-styled fixed-height scroller around a user-templated table, the
    shape of the Handlebars chart. Covered only incidentally: the table chain
    policy does not know which chart type it is looking at."""
    return (
        '<div class="handlebars-styles">'
        f'<table id="content"><tbody>{_chart_capture_rows(n_rows)}</tbody></table>'
        "</div>"
    )


def _ag_grid_chart_body(n_rows: int) -> str:
    """A table inside an ag-Grid host whose box is class-styled. No grid API is
    attached, so the print-layout mechanism has nothing to act on and any change
    to the box would have to come from the table-chain pass."""
    return (
        '<div class="ag-parent"><div class="ag-host" data-themed-ag-grid="true">'
        f'<table id="content"><tbody>{_chart_capture_rows(n_rows)}</tbody></table>'
        "</div></div>"
    )


def _deeply_nested_chart_body(n_rows: int) -> str:
    """`_NESTED_CLIP_DEPTH` class-styled fixed-height wrappers around a long
    table. Every level's height is exactly its (still-clipped) child's, so a
    level reports no overflow of its own until the level inside it has been
    lifted -- the shape that costs the fixed-point loop one pass per level."""
    html = f'<table id="content"><tbody>{_chart_capture_rows(n_rows)}</tbody></table>'
    for _ in range(_NESTED_CLIP_DEPTH - 1):
        html = f'<div class="nest-fill">{html}</div>'
    return f'<div class="nest-root">{html}</div>'


def _overflowing_cards_chart_body(n_cards: int) -> str:
    """A chart made of `n_cards` fixed-height clipped boxes, each holding its
    own small table and a badge hanging below its bottom edge.

    A card still reports overflow after it has been lifted, because the badge
    is positioned past the bottom of its box -- the shape that makes
    re-checking already-lifted nodes on every pass expensive."""
    cards = "".join(
        '<div class="card"><table><tbody>'
        f"<tr><td>row {i} a</td></tr><tr><td>row {i} b</td></tr>"
        '</tbody></table><span class="badge">b</span></div>'
        for i in range(n_cards)
    )
    return f'<div class="cards">{cards}</div>'


def _legend_and_canvas_chart_body(_n_rows: int) -> str:
    """Intentionally bounded, non-table content: a legend that scrolls inside a
    `max-height` box (class-styled, like the ECharts legend viewport) and a
    canvas host that clips to its own box (the canvas is absolutely positioned,
    as in the ECharts root, so it leaves no baseline gap that would overflow)."""
    items = "".join(f"<div>series {i}</div>" for i in range(40))
    return (
        f'<div id="legend" class="legend-viewport">{items}</div>'
        '<div id="canvas-host" style="position: relative; height: 400px; '
        'width: 760px; overflow: hidden;"><canvas width="760" height="400" '
        'style="position: absolute; left: 0; top: 0;"></canvas></div>'
    )


def _wrap_chart_capture(body: str, layout: str) -> str:
    chart = (
        f'<div class="chart-container"><div class="slice_container">{body}</div></div>'
    )
    if layout == "shell":
        chart = (
            '<div class="shell-app"><div class="shell-flex"><div class="shell-layout">'
            '<div class="shell-content"><div class="shell-portal">'
            '<div class="shell-standalone"><div class="shell-chart-panel">'
            f"{chart}</div></div></div></div></div></div></div>"
        )
    elif layout == "dashboard":
        chart = f'<div class="dashboard-chart">{chart}</div>'
    return (
        f"<!doctype html><html><head><style>{_CHART_CAPTURE_FIXTURE_CSS}</style>"
        f"</head><body>{chart}</body></html>"
    )


@contextmanager
def _chart_capture_page(html: str, device_scale_factor: int = 1) -> Iterator["Page"]:
    """A page at the default chart window size holding `html`.

    `device_scale_factor` is what `get_screenshot` passes as the browser
    context's scale factor (the `pixel_density` config), so it decides how many
    image pixels each CSS pixel of the capture costs.

    Skips (does not fail) when Playwright's Python package or its Chromium
    binary is unavailable, like the other real-browser test in this module;
    any other launch failure is a real error.
    """
    pytest.importorskip("playwright.sync_api")
    from playwright.sync_api import Error as PlaywrightError, sync_playwright

    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch()
        except PlaywrightError as ex:
            if "Executable doesn't exist" in str(ex):
                pytest.skip(f"Chromium is not installed for Playwright: {ex}")
            raise
        try:
            # DEFAULT_CHART_WINDOW_SIZE
            page = browser.new_page(
                viewport={"width": _CHART_CAPTURE_WIDTH_PX, "height": 600},
                device_scale_factor=device_scale_factor,
            )
            page.set_content(html)
            yield page
        finally:
            browser.close()


def _measure_markers(page: "Page") -> dict[str, tuple[int, int]]:
    """Top and bottom of the first, middle and last row, relative to the top of
    `.chart-container`."""
    top = page.locator(".chart-container").bounding_box()
    assert top is not None
    markers = {}
    for name in ("first", "middle", "last"):
        box = page.locator(f"#row-{name}").bounding_box()
        assert box is not None
        markers[name] = (
            round(box["y"] - top["y"]),
            round(box["y"] + box["height"] - top["y"]),
        )
    return markers


def _assert_markers_painted(png: bytes, markers: dict[str, tuple[int, int]]) -> None:
    image = Image.open(io.BytesIO(png)).convert("L")
    for name, (y0, y1) in markers.items():
        assert image.height >= y1, (
            f"screenshot is {image.height}px tall but the {name} row ends {y1}px "
            "below the top of the chart: rows are cut off"
        )
        # Pillow pads a crop that falls outside the image with black, which
        # would satisfy the dark-pixel check below, so a row cropped away
        # (e.g. above the top of the capture) has to be rejected here.
        assert 0 <= y0 < y1 <= image.height, (
            f"the {name} row (y={y0}..{y1}) lies outside the {image.height}px capture"
        )
        dark = image.crop((0, y0, 200, y1)).point(lambda v: 255 if v < 80 else 0)
        painted = sum(1 for v in dark.getdata() if v) / (200 * (y1 - y0))
        assert painted > 0.5, (
            f"the {name} row (y={y0}..{y1}) is not painted in the capture "
            f"({painted:.0%} of its marker cell)"
        )


@pytest.mark.parametrize(
    ("body", "n_rows", "layout"),
    [
        # Controls: content the pre-capture expansion is known to cope with.
        pytest.param(_pivot_chart_body, 10, "shell", id="control-short-pivot"),
        pytest.param(
            _inline_overflow_chart_body,
            _CHART_CAPTURE_ROWS,
            "bare",
            id="control-long-inline-overflow-scroller",
        ),
        pytest.param(
            _inline_overflow_chart_body,
            _CHART_CAPTURE_ROWS,
            "shell",
            id="control-long-inline-overflow-scroller-in-shell",
        ),
        # Incidental coverage: the same policy also un-clips this table shape.
        pytest.param(
            _handlebars_style_chart_body,
            _CHART_CAPTURE_ROWS,
            "shell",
            id="incidental-handlebars-style-table",
        ),
        # The reported bug: a long pivot table.
        pytest.param(
            _pivot_chart_body,
            _CHART_CAPTURE_ROWS,
            "bare",
            id="long-pivot-scroller-clips-chart-container",
        ),
        pytest.param(
            _pivot_chart_body,
            _CHART_CAPTURE_ROWS,
            "shell",
            id="long-pivot-in-app-shell",
        ),
    ],
)
def test_chart_container_screenshot_captures_whole_content(
    body: Callable[[int], str], n_rows: int, layout: str
) -> None:
    """Real-browser guard (Playwright/Chromium) for the chart screenshot API:
    after the production pre-capture step, the PNG that
    `WebDriverPlaywright._get_screenshot` takes of `.chart-container` must reach
    down to, and actually paint, the first, middle and last row of the table.

    A pivot table scrolls inside an emotion-styled `overflow: auto` div under a
    fixed-height parent. Neither carries an inline `style`, so the selector of
    the expansion script never matches them and `.chart-container` stays at the
    window height.
    """
    from superset.utils.webdriver import WebDriverPlaywright

    with _chart_capture_page(_wrap_chart_capture(body(n_rows), layout)) as page:
        chart_container = page.locator(".chart-container")
        WebDriverPlaywright._expand_scrollable_content(
            page, element_name="chart-container"
        )
        markers = _measure_markers(page)
        png = WebDriverPlaywright._get_screenshot(
            page, chart_container, "chart-container"
        )

    _assert_markers_painted(png, markers)


@pytest.mark.parametrize("element_name", ["standalone", "chart-container"])
def test_expansion_leaves_dashboard_chart_clip_alone(element_name: str) -> None:
    """A dashboard tile clips its chart on purpose (`.dashboard-chart` is
    `overflow: hidden` at a fixed height). The expansion script also runs for
    dashboard captures, so it must not un-clip the tile or resize it: the
    table pass is not run for a dashboard target, and refuses on its own when
    pointed at a chart inside a tile."""
    from superset.utils.webdriver import WebDriverPlaywright

    html = _wrap_chart_capture(_pivot_chart_body(_CHART_CAPTURE_ROWS), "dashboard")
    with _chart_capture_page(html) as page:
        measure = """() => {
            const tile = document.querySelector('.dashboard-chart');
            const scroller = document.querySelector('.pivot-wrapper');
            return {
                tileOverflow: getComputedStyle(tile).overflowY,
                tileHeight: tile.getBoundingClientRect().height,
                scrollerOverflow: getComputedStyle(scroller).overflowY,
                scrollerHeight: scroller.getBoundingClientRect().height,
            };
        }"""
        before = page.evaluate(measure)
        WebDriverPlaywright._expand_scrollable_content(page, element_name=element_name)
        after = page.evaluate(measure)

    assert before["tileOverflow"] == "hidden"
    assert after == before


def test_expansion_keeps_ag_grid_print_layout_mechanism() -> None:
    """ag-Grid is un-clipped through its own API (`domLayout: print`), plus a
    height reset on its host and the host's parent; that mechanism is separate
    from the CSS overflow handling and must keep working as is."""
    from superset.utils.webdriver import WebDriverPlaywright

    html = """<!doctype html><html><body>
      <div id="parent" style="height: 300px;">
        <div id="grid" data-themed-ag-grid="true" style="height: 300px;"></div>
      </div></body></html>"""
    with _chart_capture_page(html) as page:
        page.evaluate(
            """() => {
                const calls = (window.__gridOptions = []);
                document.getElementById('grid')._agGridApi = {
                    setGridOption: (key, value) => calls.push([key, value]),
                    resetRowHeights: () => calls.push(['reset', true]),
                };
            }"""
        )
        WebDriverPlaywright._expand_scrollable_content(page)
        recorded = page.evaluate("window.__gridOptions")
        grid_height = page.evaluate("document.getElementById('grid').style.height")
        parent_height = page.evaluate("document.getElementById('parent').style.height")

    assert ["domLayout", "print"] in recorded
    assert grid_height == "auto"
    assert parent_height == "auto"


def test_expansion_leaves_bounded_non_table_widgets_alone() -> None:
    """Content that scrolls or clips by design and holds no table (a legend in
    a `max-height` box, a canvas host) must keep its box and its scrolling."""
    from superset.utils.webdriver import WebDriverPlaywright

    html = _wrap_chart_capture(_legend_and_canvas_chart_body(0), "shell")
    with _chart_capture_page(html) as page:
        measure = """() => {
            const legend = document.getElementById('legend');
            const host = document.getElementById('canvas-host');
            return {
                legendOverflow: getComputedStyle(legend).overflowY,
                legendClient: legend.clientHeight,
                legendScroll: legend.scrollHeight,
                hostOverflow: getComputedStyle(host).overflowY,
                hostHeight: host.getBoundingClientRect().height,
                chartHeight: document.querySelector('.chart-container')
                    .getBoundingClientRect().height,
            };
        }"""
        before = page.evaluate(measure)
        WebDriverPlaywright._expand_scrollable_content(
            page, element_name="chart-container"
        )
        after = page.evaluate(measure)

    # The legend really does scroll before, so "unchanged" is meaningful.
    assert before["legendScroll"] > before["legendClient"]
    assert after == before


def test_table_pass_excludes_ag_grid_hosts() -> None:
    """A table inside an ag-Grid host is not the table pass's business: ag-Grid
    is un-clipped through its own print layout, so the host's box and its
    parent's must stay as they are."""
    from superset.utils.webdriver import WebDriverPlaywright

    html = _wrap_chart_capture(_ag_grid_chart_body(_CHART_CAPTURE_ROWS), "shell")
    with _chart_capture_page(html) as page:
        measure = """() => {
            const host = document.querySelector('.ag-host');
            return {
                hostOverflow: getComputedStyle(host).overflowY,
                hostHeight: host.getBoundingClientRect().height,
                parentHeight: host.parentElement.getBoundingClientRect().height,
                chartHeight: document.querySelector('.chart-container')
                    .getBoundingClientRect().height,
            };
        }"""
        before = page.evaluate(measure)
        WebDriverPlaywright._expand_scrollable_content(
            page, element_name="chart-container"
        )
        after = page.evaluate(measure)

    # The host really does clip before, so "unchanged" is meaningful.
    assert before["hostOverflow"] == "auto"
    assert after == before


@pytest.mark.parametrize("layout", ["bare", "shell"])
@pytest.mark.parametrize(
    ("n_rows", "cap_px", "truncates"),
    [
        pytest.param(
            _CHART_CAPTURE_ROWS,
            _CHART_CAPTURE_SMALL_CAP_PX,
            True,
            id="past-a-patched-budget-is-truncated",
        ),
        pytest.param(
            _CHART_CAPTURE_ROWS,
            None,
            False,
            id="within-the-production-budget-is-whole",
        ),
    ],
)
def test_lifted_chart_height_is_bounded_by_the_cap(
    n_rows: int, cap_px: int | None, truncates: bool, layout: str
) -> None:
    """The lift must stop at `expand_chart_table_max_pixels()`.

    A pivot near its default cell limit would otherwise grow without bound and
    become a PNG past Pillow's decompression-bomb limit, which
    `validate_report_screenshot` rejects -- so a huge report would be dropped
    entirely rather than delivered with its tail truncated. `cap_px` is the
    height the budget has to allow at this capture's width; `None` means the
    real budget, which a 300-row fixture is nowhere near.

    What is truncated matters as much as the bound: `.slice_container` centers
    its content (`superset-frontend/src/components/Chart/Chart.tsx`), so a
    capped window would show the middle of the table and crop the headings and
    first rows away along with the tail.
    """
    from superset.utils import webdriver
    from superset.utils.webdriver import WebDriverPlaywright

    budget = (
        cap_px * _CHART_CAPTURE_WIDTH_PX
        if cap_px is not None
        else webdriver.expand_chart_table_max_pixels()
    )
    html = _wrap_chart_capture(_pivot_chart_body(n_rows), layout)
    with _chart_capture_page(html) as page:
        with patch.object(
            webdriver, "expand_chart_table_max_pixels", return_value=budget
        ):
            WebDriverPlaywright._expand_scrollable_content(
                page, element_name="chart-container"
            )
        table_height = page.evaluate("document.getElementById('content').scrollHeight")
        markers = _measure_markers(page)
        png = WebDriverPlaywright._get_screenshot(
            page, page.locator(".chart-container"), "chart-container"
        )

    captured_height = Image.open(io.BytesIO(png)).height
    allowed_height = budget // _CHART_CAPTURE_WIDTH_PX
    if truncates:
        assert table_height > allowed_height, (
            "the fixture is not taller than the budget allows, so it cannot "
            "show what the budget does"
        )
        assert captured_height == allowed_height
        # The tail is truncated by design, but the head of the table has to
        # stay inside the capture rather than being centered out of it.
        assert markers["first"][0] >= 0, (
            f"the first row starts {markers['first'][0]}px above the top of "
            "the capture: the capped window is not aligned to the top of the "
            "content"
        )
        _assert_markers_painted(png, {"first": markers["first"]})
    else:
        assert table_height <= allowed_height
        assert captured_height >= table_height
        _assert_markers_painted(png, markers)


def test_pixel_budget_is_counted_in_device_pixels() -> None:
    """The budget bounds the image, and an image is measured in device pixels.

    A capture at `pixel_density` 2 costs four device pixels per CSS pixel, so
    the budget has to be divided by the width *and* the scale factor twice.
    Dropping one factor of the ratio would allow twice the pixel area the
    limit permits at density 2, and dropping both -- dividing by the CSS width
    alone -- four times. Either mistake is indistinguishable from the correct
    arithmetic at density 1, which every other test here runs at.
    """
    from superset.utils import webdriver
    from superset.utils.webdriver import WebDriverPlaywright

    html = _wrap_chart_capture(_pivot_chart_body(_CHART_CAPTURE_ROWS), "shell")
    with _chart_capture_page(html, _HIGH_DPI_SCALE_FACTOR) as page:
        assert page.evaluate("window.devicePixelRatio") == _HIGH_DPI_SCALE_FACTOR
        with patch.object(
            webdriver,
            "expand_chart_table_max_pixels",
            return_value=_HIGH_DPI_BUDGET_PX,
        ):
            WebDriverPlaywright._expand_scrollable_content(
                page, element_name="chart-container"
            )
        container_height = page.evaluate(
            "document.querySelector('.chart-container').getBoundingClientRect().height"
        )
        markers = _measure_markers(page)
        png = WebDriverPlaywright._get_screenshot(
            page, page.locator(".chart-container"), "chart-container"
        )

    # 6,400,000 device px / (800 CSS px wide * 2 * 2) = 2000 CSS px tall, which
    # the capture renders at the scale factor in both dimensions: 1600x4000,
    # exactly the budget. Dividing by `width * dpr` -- one factor of the ratio
    # -- would allow 4000 CSS px here and a 1600x8000 image, twice the pixels
    # the budget permits; dividing by the CSS width alone would allow 8000 CSS
    # px and a 1600x16000 image, four times. The container height catches
    # either.
    assert container_height == _HIGH_DPI_ALLOWED_CSS_PX
    image = Image.open(io.BytesIO(png))
    assert (image.width, image.height) == (
        _CHART_CAPTURE_WIDTH_PX * _HIGH_DPI_SCALE_FACTOR,
        _HIGH_DPI_ALLOWED_CSS_PX * _HIGH_DPI_SCALE_FACTOR,
    )
    assert image.width * image.height == _HIGH_DPI_BUDGET_PX
    # `_measure_markers` reports CSS pixels relative to the container, while
    # the capture is cropped in image pixels.
    first_y0, first_y1 = markers["first"]
    _assert_markers_painted(
        png,
        {
            "first": (
                first_y0 * _HIGH_DPI_SCALE_FACTOR,
                first_y1 * _HIGH_DPI_SCALE_FACTOR,
            )
        },
    )


def test_tall_inline_overflow_table_is_captured_whole() -> None:
    """A fixed height cap is a regression for a shape that was already captured
    whole: the generic expansion pass un-clips an inline-`style` scroller (the
    classic Table chart) on its own, and a 1,000-row table of that shape is
    taller than 16384px while nowhere near the decompression-bomb limit. The
    budget has to be counted in device pixels against the capture's width, so
    this capture stays whole."""
    from superset.utils.webdriver import WebDriverPlaywright

    html = _wrap_chart_capture(
        _inline_overflow_chart_body(_INLINE_OVERFLOW_PARITY_ROWS), "shell"
    )
    with _chart_capture_page(html) as page:
        WebDriverPlaywright._expand_scrollable_content(
            page, element_name="chart-container"
        )
        table_height = page.evaluate("document.getElementById('content').scrollHeight")
        markers = _measure_markers(page)
        png = WebDriverPlaywright._get_screenshot(
            page, page.locator(".chart-container"), "chart-container"
        )

    assert table_height > _REPLACED_FIXED_CAP_PX, (
        "the fixture no longer exceeds the height a fixed cap would impose, so "
        "it cannot show that the capture is left whole"
    )
    assert Image.open(io.BytesIO(png)).height >= table_height
    _assert_markers_painted(png, markers)


def test_expansion_lifts_more_wrappers_than_a_fixed_pass_count() -> None:
    """Each pass of the fixed-point loop can only lift one nesting level: an
    outer fixed-height wrapper reports no overflow of its own until the level
    inside it has grown. A chart nested more deeply than a fixed pass count
    would therefore keep an outer wrapper clipped and cut rows, so the loop is
    bounded by the size of the parent chain it is working on instead."""
    from superset.utils.webdriver import WebDriverPlaywright

    html = _wrap_chart_capture(_deeply_nested_chart_body(_CHART_CAPTURE_ROWS), "shell")
    with _chart_capture_page(html) as page:
        WebDriverPlaywright._expand_scrollable_content(
            page, element_name="chart-container"
        )
        table_height = page.evaluate("document.getElementById('content').scrollHeight")
        markers = _measure_markers(page)
        png = WebDriverPlaywright._get_screenshot(
            page, page.locator(".chart-container"), "chart-container"
        )

    assert table_height > _NESTED_CLIP_WRAPPER_HEIGHT_PX
    _assert_markers_painted(png, markers)


def test_expansion_does_not_revisit_a_node_that_stays_overflowing() -> None:
    """A node that still reports overflow after being lifted has nothing more
    to give, and re-checking it keeps every pass of the fixed-point loop alive
    until the bound -- one `scrollHeight` read per chain node per pass, which
    is quadratic in the size of the chain. Each node is lifted at most once, so
    the work stays proportional to the chain."""
    from superset.utils.webdriver import WebDriverPlaywright

    html = _wrap_chart_capture(
        _overflowing_cards_chart_body(_OVERFLOWING_CARD_COUNT), "bare"
    )
    with _chart_capture_page(html) as page:
        page.evaluate(
            """() => {
                window.__scrollHeightReads = 0;
                const inherited = Object.getOwnPropertyDescriptor(
                    Element.prototype, 'scrollHeight'
                );
                Object.defineProperty(Element.prototype, 'scrollHeight', {
                    configurable: true,
                    get() {
                        window.__scrollHeightReads += 1;
                        return inherited.get.call(this);
                    },
                });
            }"""
        )
        # The cards really do clip before the expansion runs, so a cheap pass
        # would not be cheap merely because it had nothing to do.
        assert page.evaluate(
            "document.querySelector('.card').scrollHeight > "
            "document.querySelector('.card').clientHeight + 1"
        )
        WebDriverPlaywright._expand_scrollable_content(
            page, element_name="chart-container"
        )
        reads = page.evaluate("window.__scrollHeightReads")

    assert reads < 10 * _OVERFLOWING_CARD_COUNT, (
        f"{reads} scrollHeight reads for {_OVERFLOWING_CARD_COUNT} clipped "
        "boxes: the loop is re-checking nodes it has already lifted"
    )


# App config for the production `get_screenshot` path, with the tiling
# thresholds lowered so a modest fixture is measured as a tall page.
_PRODUCTION_CAPTURE_CONFIG = {
    "WEBDRIVER_OPTION_ARGS": [],
    "WEBDRIVER_WINDOW": {"pixel_density": 1},
    "SCREENSHOT_PLAYWRIGHT_DEFAULT_TIMEOUT": 30000,
    "SCREENSHOT_PLAYWRIGHT_WAIT_EVENT": "load",
    "SCREENSHOT_SELENIUM_HEADSTART": 0,
    "SCREENSHOT_SELENIUM_ANIMATION_WAIT": 0,
    "SCREENSHOT_REPLACE_UNEXPECTED_ERRORS": False,
    "SCREENSHOT_LOCATE_WAIT": 10,
    "SCREENSHOT_LOAD_WAIT": 10,
    "SCREENSHOT_TILED_ENABLED": True,
    "SCREENSHOT_TILED_CHART_THRESHOLD": 20,
    "SCREENSHOT_TILED_HEIGHT_THRESHOLD": 1000,
    "SCREENSHOT_TILED_VIEWPORT_HEIGHT": 1500,
}


def _chart_report_context() -> ReportExecutionContext:
    """A deterministic scheduled-report context for a single-chart report, with
    30 seconds available for readiness like `_report_context`."""

    return ReportExecutionContext(
        execution_id=UUID("084e7ee6-5557-4ecd-9632-b7f39c9ec524"),
        report_schedule_id=11,
        chart_id=42,
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


def _capture_through_get_screenshot(
    html: str,
    page_file: Path,
    *,
    require_complete_capture: bool = False,
    report_execution_context: ReportExecutionContext | None = None,
) -> tuple[bytes | None, dict[str, tuple[int, int]], MagicMock]:
    """Drive the production `get_screenshot` decision against a local HTML file
    in real Chromium, with the app config and the browser manager standing in
    for the Flask app and the worker's long-lived browser.

    Returns the capture, the marker rows measured on a separately expanded copy
    of the same page, and the patched `take_tiled_screenshot` so a test can
    assert which capture path ran.
    """
    pytest.importorskip("playwright.sync_api")
    from playwright.sync_api import Error as PlaywrightError, sync_playwright

    from superset.utils import webdriver
    from superset.utils.webdriver import WebDriverPlaywright

    page_file.write_text(html)
    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch()
        except PlaywrightError as ex:
            if "Executable doesn't exist" in str(ex):
                pytest.skip(f"Chromium is not installed for Playwright: {ex}")
            raise
        try:
            measuring_page = browser.new_page(viewport={"width": 800, "height": 600})
            measuring_page.set_content(html)
            WebDriverPlaywright._expand_scrollable_content(
                measuring_page, element_name="chart-container"
            )
            markers = _measure_markers(measuring_page)

            browser_manager = MagicMock()
            browser_manager.get_browser.return_value = browser
            with (
                patch.object(
                    webdriver, "app", MagicMock(config=_PRODUCTION_CAPTURE_CONFIG)
                ),
                patch.object(
                    webdriver,
                    "take_tiled_screenshot",
                    wraps=webdriver.take_tiled_screenshot,
                ) as tiled,
            ):
                png = WebDriverPlaywright(
                    "chrome",
                    (800, 600),
                    browser_manager=browser_manager,
                    require_complete_capture=require_complete_capture,
                ).get_screenshot(
                    page_file.as_uri(),
                    "chart-container",
                    report_execution_context=report_execution_context,
                )
        finally:
            browser.close()
    return png, markers, tiled


def test_tiled_capture_of_tall_chart_paints_whole_content(tmp_path: Path) -> None:
    """The production `get_screenshot` decision, with the tiling thresholds
    lowered so a modest fixture takes the tiled branch: once the pivot is
    un-clipped the chart is tall enough for `take_tiled_screenshot`, and the
    combined image must still reach and paint the first, middle and last row.

    This is the thumbnail regime -- no report context, no complete-capture
    requirement -- whose tiling decision must stay as it is."""
    png, markers, tiled = _capture_through_get_screenshot(
        _wrap_chart_capture(_pivot_chart_body(120), "bare"),
        tmp_path / "chart.html",
    )

    tiled.assert_called_once()
    assert png is not None
    _assert_markers_painted(png, markers)


@pytest.mark.parametrize(
    ("require_complete_capture", "report_execution_context"),
    [
        pytest.param(True, None, id="api-or-ui-export"),
        pytest.param(False, _chart_report_context(), id="scheduled-report"),
    ],
)
def test_strict_tall_chart_capture_does_not_take_the_tiled_path(
    tmp_path: Path,
    require_complete_capture: bool,
    report_execution_context: ReportExecutionContext | None,
) -> None:
    """A strict single-chart capture must stay on the standard path.

    Un-clipping a long pivot makes the chart taller than the tiling threshold,
    and a report context or a complete-capture requirement would then route it
    to `take_tiled_screenshot`. That path's strict mode waits for dashboard
    chart holders and the dashboard grid, neither of which a chart-only page
    ever renders, so the capture times out and the report is never delivered.
    The standard path has its own `.chart-container` readiness wait, and
    re-expands the content once readiness confirms the chart rendered."""
    png, markers, tiled = _capture_through_get_screenshot(
        _wrap_chart_capture(_pivot_chart_body(120), "bare"),
        tmp_path / "chart.html",
        require_complete_capture=require_complete_capture,
        report_execution_context=report_execution_context,
    )

    tiled.assert_not_called()
    assert png is not None
    _assert_markers_painted(png, markers)


_FAKE_DOM_SCRIPT = r"""
const input = JSON.parse(require("fs").readFileSync(0, "utf8"));
global.window = {innerHeight: 800};
const elements = input.elements.map(spec => ({
  id: spec.id,
  classList: {contains: name => spec.classes.includes(name)},
  getAttribute: name => (name === 'role' && spec.role ? spec.role : null),
  querySelector: () => (spec.content ? {} : null),
  querySelectorAll: () => [],
  parentElement: null,
}));
input.elements.forEach((spec, index) => {
  if (spec.parent !== null) elements[index].parentElement = elements[spec.parent];
});
const holder = ready => ({
  className: 'dashboard-component-chart-holder dashboard-chart-id-7',
  getBoundingClientRect: () => ({top: 0, bottom: 100}),
  querySelectorAll: () => [],
  querySelector: selector =>
    (ready && selector.includes('slice_container') ? {} : null),
});
const holders = input.holders.map(holder);
global.document = {
  querySelectorAll: selector =>
    selector.includes('tabpanel')
      ? elements.filter(el => el.getAttribute('role') === 'tabpanel')
      : holders,
};
process.stdout.write(JSON.stringify(eval('(' + input.expression + ')')()));
"""


def _eval_in_fake_dom(
    expression: str,
    elements: list[dict[str, object]],
    holders: list[bool] | None = None,
) -> bool:
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node.js is required to execute readiness predicates")
    assert node is not None
    completed = subprocess.run(  # noqa: S603
        [node, "-e", _FAKE_DOM_SCRIPT],
        input=json.dumps(
            {"expression": expression, "elements": elements, "holders": holders or []}
        ),
        capture_output=True,
        check=True,
        text=True,
    )
    return bool(json.loads(completed.stdout))


def _pane(
    pane_id: str,
    *,
    active: bool = True,
    content: bool = True,
    parent: int | None = None,
    legacy: bool = False,
) -> dict[str, object]:
    # The pinned antd (@rc-component/tabs) marks panes ``ant-tabs-content`` /
    # ``ant-tabs-content-active``; older rc-tabs used ``ant-tabs-tabpane``.
    base = "ant-tabs-tabpane" if legacy else "ant-tabs-content"
    classes = [base] + ([f"{base}-active"] if active else [])
    return {
        "id": pane_id,
        "classes": classes,
        "content": content,
        "parent": parent,
        "role": "tabpanel",
    }


@pytest.mark.parametrize("all_holders", [True, False])
def test_empty_tab_pane_with_no_holders_is_ready(all_holders: bool) -> None:
    expression = report_ready_js(all_holders, "GRID_ID")
    assert _eval_in_fake_dom(expression, [_pane("GRID_ID-panel-GRID_ID")])


@pytest.mark.parametrize("all_holders", [True, False])
def test_inactive_empty_tab_pane_is_not_ready(all_holders: bool) -> None:
    expression = report_ready_js(all_holders, "GRID_ID")
    panes = [_pane("GRID_ID-panel-GRID_ID", active=False)]
    assert not _eval_in_fake_dom(expression, panes)


def test_empty_tab_pane_with_legacy_markup_is_ready() -> None:
    expression = report_ready_js(True, "GRID_ID")
    assert _eval_in_fake_dom(expression, [_pane("GRID_ID-panel-GRID_ID", legacy=True)])
    assert not _eval_in_fake_dom(
        expression, [_pane("GRID_ID-panel-GRID_ID", active=False, legacy=True)]
    )


def test_empty_tab_pane_ignores_non_pane_content_wrapper_ancestor() -> None:
    # Legacy rc-tabs wraps panes in a plain ``ant-tabs-content`` div that never
    # carries an active class; it must not be treated as an inactive pane.
    expression = report_ready_js(True, "GRID_ID")
    wrapper = {
        "id": "",
        "classes": ["ant-tabs-content"],
        "content": False,
        "parent": None,
        "role": None,
    }
    pane = _pane("GRID_ID-panel-GRID_ID", parent=0, legacy=True)
    assert _eval_in_fake_dom(expression, [wrapper, pane])


def test_empty_tab_pane_without_rendered_content_is_not_ready() -> None:
    expression = report_ready_js(True, "1")
    assert not _eval_in_fake_dom(expression, [_pane("GRID_ID-panel-1", content=False)])


def test_missing_empty_tab_pane_is_not_ready() -> None:
    expression = report_ready_js(True, "1")
    assert not _eval_in_fake_dom(expression, [_pane("GRID_ID-panel-GRID_ID")])


def test_empty_tab_pane_with_unready_holder_is_not_ready() -> None:
    expression = report_ready_js(True, "GRID_ID")
    panes = [_pane("GRID_ID-panel-GRID_ID")]
    assert not _eval_in_fake_dom(expression, panes, holders=[False])
    assert _eval_in_fake_dom(expression, panes, holders=[True])


def test_root_tab_suffix_requires_exact_root_pane_id() -> None:
    expression = report_ready_js(True, "1")
    assert not _eval_in_fake_dom(expression, [_pane("TABS-n-panel-1")])
    assert _eval_in_fake_dom(expression, [_pane("GRID_ID-panel-1")])


def test_nested_empty_tab_requires_every_ancestor_pane_active() -> None:
    expression = report_ready_js(True, "TAB-N2")
    active_chain = [
        _pane("GRID_ID-panel-1"),
        _pane("TABS-n-panel-TAB-N2", parent=0),
    ]
    assert _eval_in_fake_dom(expression, active_chain)
    inactive_ancestor = [
        _pane("GRID_ID-panel-1", active=False),
        _pane("TABS-n-panel-TAB-N2", parent=0),
    ]
    assert not _eval_in_fake_dom(expression, inactive_ancestor)
    lookalike = [_pane("TABS-n-panel-XTAB-N2")]
    assert not _eval_in_fake_dom(expression, lookalike)


def test_mounted_predicate_accepts_empty_active_pane() -> None:
    panes = [_pane("GRID_ID-panel-GRID_ID")]
    assert _eval_in_fake_dom(report_mounted_js("GRID_ID"), panes)
    assert not _eval_in_fake_dom(report_mounted_js("GRID_ID"), [])
    assert _eval_in_fake_dom(report_mounted_js("GRID_ID"), [], holders=[False])


def test_default_report_predicates_are_unchanged_without_suffix() -> None:
    assert report_ready_js(False) == REPORT_CHART_HOLDERS_READY_JS
    assert report_ready_js(True) == REPORT_ALL_CHART_HOLDERS_READY_JS
    assert report_mounted_js() == CHART_HOLDERS_MOUNTED_JS
    assert "holders.length > 0" in REPORT_CHART_HOLDERS_READY_JS
    assert not _eval_in_fake_dom(REPORT_ALL_CHART_HOLDERS_READY_JS, [])


def _layout_ready_then(error: Exception):
    """Let the dashboard layout wait pass, then raise ``error`` on any other wait."""

    def wait_for_function(expression, *args, **kwargs):
        if expression == REPORT_LAYOUT_READY_JS:
            return None
        raise error

    return wait_for_function


def _roomy_report_context() -> ReportExecutionContext:
    """A context whose remaining budget far exceeds the 30s load wait."""
    return ReportExecutionContext(
        execution_id=UUID("084e7ee6-5557-4ecd-9632-b7f39c9ec524"),
        report_schedule_id=11,
        dashboard_id=805,
        expected_chart_count=52,
        deadline=ReportExecutionDeadline(
            total_seconds=3600,
            started_at=0,
            _clock=lambda: 0,
        ),
        capture_reserve_seconds=60,
        delivery_reserve_seconds=120,
        cleanup_reserve_seconds=30,
    )


class TestTiledEmptyTab:
    @pytest.fixture
    def mock_page(self):
        page = MagicMock()
        page.locator.return_value = MagicMock()
        return page

    def _run(self, mock_page, context):
        element_info = {"height": 1000, "top": 0, "left": 0, "width": 800}
        waits: list[tuple[str, float]] = []

        def wait_for_function(expression, *, arg=None, timeout=None, polling=None):
            waits.append((expression, timeout))

        def evaluate(script, _arg=None):
            if "scrollWidth" in script:
                return element_info
            if "window.scrollTo" in script:
                return None
            return {"total": 0, "contentful": 0}

        mock_page.wait_for_function.side_effect = wait_for_function
        mock_page.evaluate.side_effect = evaluate
        # A text-only tab renders as a mostly white page with a few lines of
        # text; zero chart holders means blank-image validation is skipped.
        sparse = Image.new("RGB", (800, 1000), "white")
        ImageDraw.Draw(sparse).rectangle((20, 20, 300, 40), fill="black")
        output = io.BytesIO()
        sparse.save(output, format="PNG")
        sparse_png = output.getvalue()
        mock_page.screenshot.return_value = sparse_png
        self.sparse_png = sparse_png
        with patch(
            "superset.utils.screenshot_utils.combine_screenshot_tiles",
            return_value=sparse_png,
        ):
            result = take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                load_wait=30,
                report_execution_context=context,
            )
        return result, waits

    def test_empty_tab_proceeds_and_caps_waits_at_load_wait(self, mock_page):
        context = _roomy_report_context().with_empty_tab_pane("GRID_ID")

        result, waits = self._run(mock_page, context)

        assert result == self.sparse_png
        (layout_js, layout_timeout), *waits = waits
        assert layout_js == REPORT_LAYOUT_READY_JS
        assert layout_timeout > 30_000
        assert all("emptyPaneReady" in expression for expression, _ in waits[:2])
        assert all(timeout <= 30_000 for _, timeout in waits)

    def test_without_suffix_readiness_waits_use_remaining_budget(self, mock_page):
        result, waits = self._run(mock_page, _roomy_report_context())

        assert result == self.sparse_png
        assert not any("emptyPaneReady" in expression for expression, _ in waits)
        # Layout bootstrap keeps the whole budget, the zero-holder mount wait is
        # capped, and per-tile readiness keeps the whole budget.
        assert waits[0] == (REPORT_LAYOUT_READY_JS, 3_390_000)
        assert waits[1][1] <= 30_000
        assert waits[2][1] > 30_000

    def test_mount_timeout_raises_never_mounted_for_reports(self, mock_page):
        from superset.utils.screenshot_utils import (
            ChartHoldersNeverMountedError,
            PlaywrightTimeout,
        )

        mock_page.wait_for_function.side_effect = _layout_ready_then(
            PlaywrightTimeout("zero")
        )
        mock_page.evaluate.return_value = []

        with pytest.raises(ChartHoldersNeverMountedError):
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                load_wait=30,
                report_execution_context=_roomy_report_context(),
            )

        layout_call, mount_call = mock_page.wait_for_function.call_args_list
        assert layout_call.args[0] == REPORT_LAYOUT_READY_JS
        assert mount_call.kwargs["timeout"] == 30_000

    def test_slow_layout_keeps_budget_then_holders_mount(self, mock_page):
        """Bootstrap slower than load_wait is not cut short by the mount cap."""
        result, waits = self._run(mock_page, _roomy_report_context())

        assert result == self.sparse_png
        layout_js, layout_timeout = waits[0]
        assert layout_js == REPORT_LAYOUT_READY_JS
        assert layout_timeout == 3_390_000
        assert "length > 0" in waits[1][0]

    def test_layout_never_rendering_keeps_base_timeout(self, mock_page):
        """No layout within the budget raises the plain timeout, as before."""
        from superset.utils.screenshot_utils import (
            ChartHoldersNeverMountedError,
            PlaywrightTimeout,
        )

        mock_page.wait_for_function.side_effect = PlaywrightTimeout("no layout")
        mock_page.evaluate.return_value = []

        with pytest.raises(PlaywrightTimeout) as exc_info:
            take_tiled_screenshot(
                mock_page,
                "dashboard",
                tile_height=2000,
                load_wait=30,
                report_execution_context=_roomy_report_context(),
            )

        assert not isinstance(exc_info.value, ChartHoldersNeverMountedError)
        (layout_call,) = mock_page.wait_for_function.call_args_list
        assert layout_call.args[0] == REPORT_LAYOUT_READY_JS
        assert layout_call.kwargs["timeout"] == 3_390_000
        mock_page.screenshot.assert_not_called()


_LAYOUT_FAKE_DOM_SCRIPT = r"""
const input = JSON.parse(require("fs").readFileSync(0, "utf8"));
const present = new Set(input.present);
global.document = {
  querySelector: selector => (present.has(selector) ? {} : null),
};
process.stdout.write(JSON.stringify(eval('(' + input.expression + ')')()));
"""


def _eval_layout_dom(expression: str, present: list[str]) -> object:
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node.js is required to execute readiness predicates")
    assert node is not None
    completed = subprocess.run(  # noqa: S603
        [node, "-e", _LAYOUT_FAKE_DOM_SCRIPT],
        input=json.dumps({"expression": expression, "present": present}),
        capture_output=True,
        check=True,
        text=True,
    )
    return json.loads(completed.stdout)


def test_report_layout_wait_ends_on_a_crashed_page() -> None:
    from superset.utils.screenshot_utils import (
        DASHBOARD_CRASH_ALERT_SELECTOR,
        REPORT_LAYOUT_READY_JS,
    )

    grid = ".dashboard-grid"
    crash = DASHBOARD_CRASH_ALERT_SELECTOR
    # Still bootstrapping: keep waiting (a falsy result keeps the poll going).
    assert _eval_layout_dom(REPORT_LAYOUT_READY_JS, []) is False
    # Hydrated layout.
    assert _eval_layout_dom(REPORT_LAYOUT_READY_JS, [grid]) == "ready"
    # An error boundary replaced the dashboard: the wait ends and is flagged.
    assert _eval_layout_dom(REPORT_LAYOUT_READY_JS, [crash]) == "crashed"
    # An error alert next to a rendered grid is not a crash.
    assert _eval_layout_dom(REPORT_LAYOUT_READY_JS, [grid, crash]) == "ready"


class TestTiledCrashedPage:
    def test_crashed_page_ends_layout_wait_with_friendly_error(self):
        from superset.utils.screenshot_utils import (
            ChartHoldersNeverMountedError,
            DashboardRenderCrashedError,
            REPORT_LAYOUT_READY_JS,
        )

        page = MagicMock()
        page.wait_for_function.return_value.json_value.return_value = "crashed"

        with pytest.raises(DashboardRenderCrashedError) as exc_info:
            take_tiled_screenshot(
                page,
                "dashboard",
                tile_height=2000,
                load_wait=30,
                report_execution_context=_roomy_report_context(),
            )

        assert isinstance(exc_info.value, ChartHoldersNeverMountedError)
        (layout_call,) = page.wait_for_function.call_args_list
        assert layout_call.args[0] == REPORT_LAYOUT_READY_JS
        page.screenshot.assert_not_called()
