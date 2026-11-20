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

"""Trimming a report capture to its content: pixel formats, corruption, approval."""

import dataclasses
import io
import logging
import struct
import zlib
from typing import Any
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from celery.exceptions import SoftTimeLimitExceeded
from PIL import Image

from superset.utils import screenshot_utils
from superset.utils.report_execution import (
    ReportArtifactKind,
    ReportExecutionContext,
    ReportExecutionDeadline,
)
from superset.utils.screenshot_utils import (
    get_screenshot_blankness_metrics,
    PlaywrightError,
    read_page_background_color,
    ScreenshotBlankCaptureError,
    trim_report_screenshot_to_content,
    trim_trailing_background_rows,
    validate_report_screenshot,
)

GREY = (245, 245, 245)
WHITE = (255, 255, 255)
BLUE = (0, 102, 204)
RED = (255, 0, 0)

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _scene(
    mode: str = "RGB",
    width: int = 40,
    height: int = 120,
    top: int = 4,
    content: int = 30,
) -> Image.Image:
    """A grey page with a blue block, ``top`` rows below the top edge."""
    alpha = (255,) if mode == "RGBA" else ()
    image = Image.new(mode, (width, height), GREY + alpha)
    image.paste(
        Image.new(mode, (width - 8, content), BLUE + alpha),
        (4, top),
    )
    return image


def _png(image: Image.Image) -> bytes:
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def _chunk(kind: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + kind
        + data
        + struct.pack(">I", zlib.crc32(kind + data))
    )


def _hand_built_png(
    width: int,
    height: int,
    rows: list[bytes],
    *,
    bit_depth: int = 8,
    color_type: int = 2,
    extra_chunk: tuple[bytes, bytes] | None = None,
) -> bytes:
    """A PNG of a kind Pillow cannot write, one filter-less row per entry."""
    header = struct.pack(">IIBBBBB", width, height, bit_depth, color_type, 0, 0, 0)
    pixels = b"".join(b"\x00" + row for row in rows)
    return (
        PNG_SIGNATURE
        + _chunk(b"IHDR", header)
        + (_chunk(*extra_chunk) if extra_chunk else b"")
        + _chunk(b"IDAT", zlib.compress(pixels))
        + _chunk(b"IEND", b"")
    )


def _sixteen_bit_rgb() -> bytes:
    """Every sample narrows to grey, but row 5 differs and row 30 differs only in
    the low byte of each sample."""
    rows = [b"\xf5\x00" * 3 * 20 for _ in range(40)]
    rows[5] = b"\x00\x66" * 3 * 20
    rows[30] = b"\xf5\x01" * 3 * 20
    return _hand_built_png(20, 40, rows, bit_depth=16)


def _eight_bit_rgb_with_transparency() -> bytes:
    rows = [bytes(GREY) * 20 for _ in range(40)]
    rows[5] = bytes(BLUE) * 20
    return _hand_built_png(
        20, 40, rows, extra_chunk=(b"tRNS", struct.pack(">HHH", 1, 2, 3))
    )


def _animated() -> bytes:
    output = io.BytesIO()
    _scene().save(output, "PNG", save_all=True, append_images=[_scene(top=8)])
    return output.getvalue()


def _flipped_idat_checksum(png: bytes) -> bytes:
    start = png.index(b"IDAT")
    length = struct.unpack(">I", png[start - 4 : start])[0]
    crc_at = start + 4 + length
    corrupted = bytearray(png)
    corrupted[crc_at] ^= 0xFF
    return bytes(corrupted)


def _without_iend(png: bytes) -> bytes:
    return png[: png.rindex(b"IEND") - 4]


def _context() -> ReportExecutionContext:
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


def _page(color: Any = (245, 245, 245)) -> MagicMock:
    page = MagicMock()
    page.evaluate.return_value = None if color is None else list(color)
    return page


def _sparse_capture() -> bytes:
    """Mostly empty and tall: approved by regions, blank by the whole-image metrics."""
    image = Image.new("RGB", (800, 8000), GREY)
    for row in range(0, 5001, 1000):
        for column in range(0, 800, 8):
            image.putpixel((column, row), BLUE)
    return _png(image)


@pytest.mark.parametrize("mode", ["RGB", "RGBA"])
def test_trim_removes_only_the_excess_background_rows(mode: str) -> None:
    scene = _scene(mode)
    result = trim_trailing_background_rows(_png(scene), GREY)

    with Image.open(io.BytesIO(result)) as trimmed:
        assert trimmed.size == (40, 38)
        assert trimmed.mode == mode
        assert trimmed.tobytes() == scene.crop((0, 0, 40, 38)).tobytes()


def _bottom_rows_red() -> Image.Image:
    image = _scene()
    image.paste(Image.new("RGB", (40, 20), RED), (0, 100))
    return image


def _rgba_with_translucent_corner() -> Image.Image:
    image = _scene("RGBA")
    image.putpixel((39, 119), GREY + (254,))
    return image


@pytest.mark.parametrize(
    ("image", "background"),
    [
        pytest.param(_scene(height=34), GREY, id="content_reaches_the_bottom"),
        pytest.param(_scene(height=38), GREY, id="margin_already_symmetric"),
        pytest.param(Image.new("RGB", (40, 120), GREY), GREY, id="all_background"),
        pytest.param(_bottom_rows_red(), GREY, id="uniform_but_not_the_background"),
        pytest.param(_scene(), WHITE, id="other_background_colour"),
        pytest.param(_rgba_with_translucent_corner(), GREY, id="alpha_254"),
    ],
)
def test_trim_returns_the_same_object_when_nothing_is_removed(
    caplog: pytest.LogCaptureFixture,
    image: Image.Image,
    background: tuple[int, int, int],
) -> None:
    source = _png(image)
    name = screenshot_utils.logger.name
    with caplog.at_level(logging.DEBUG, logger=name):
        result = trim_trailing_background_rows(source, background)

    assert result is source
    assert [record for record in caplog.records if record.name == name] == []


@pytest.mark.parametrize(
    "source",
    [
        pytest.param(_png(_scene().convert("P")), id="palette"),
        pytest.param(_png(Image.new("I;16", (40, 120))), id="sixteen_bit_grey"),
        pytest.param(_png(Image.new("1", (40, 120))), id="bilevel"),
        pytest.param(_sixteen_bit_rgb(), id="sixteen_bit_rgb"),
        pytest.param(_eight_bit_rgb_with_transparency(), id="transparency_chunk"),
        pytest.param(_animated(), id="animated"),
    ],
)
def test_trim_leaves_unsupported_pixel_formats_untouched(source: bytes) -> None:
    assert trim_trailing_background_rows(source, GREY) is source


@pytest.mark.parametrize(
    "source",
    [
        pytest.param(_flipped_idat_checksum(_png(_scene())), id="bad_checksum"),
        pytest.param(_without_iend(_png(_scene())), id="missing_iend"),
        pytest.param(b"not a png", id="not_an_image"),
    ],
)
def test_trim_leaves_corrupt_bytes_untouched(source: bytes) -> None:
    assert trim_trailing_background_rows(source, GREY) is source


def test_trim_survives_a_decompression_bomb(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = _png(_scene())
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 100)

    assert trim_trailing_background_rows(source, GREY) is source


@pytest.mark.parametrize("source_of_deadline", ["image_decode", "page_read"])
def test_report_deadlines_pass_through(source_of_deadline: str) -> None:
    source = _png(_scene())
    page = _page()
    if source_of_deadline == "page_read":
        page.evaluate.side_effect = SoftTimeLimitExceeded()
        with pytest.raises(SoftTimeLimitExceeded):
            trim_report_screenshot_to_content(page, source)
        return

    with patch.object(
        screenshot_utils.Image, "open", side_effect=SoftTimeLimitExceeded()
    ):
        with pytest.raises(SoftTimeLimitExceeded):
            trim_trailing_background_rows(source, GREY)


def test_page_background_read_returns_the_colour() -> None:
    assert read_page_background_color(_page([245, 245, 245])) == (245, 245, 245)


def test_page_background_read_rejects_anything_else() -> None:
    for unusable in (
        None,
        "rgb(1, 2, 3)",
        [1, 2],
        [1, 2, 3.0],
        [True, 0, 0],
        [1, 2, 256],
    ):
        assert read_page_background_color(_page(unusable)) is None

    for error in (RuntimeError("boom"), PlaywrightError("closed")):
        page = MagicMock()
        page.evaluate.side_effect = error
        assert read_page_background_color(page) is None


def test_trimmed_capture_stays_approved_for_delivery() -> None:
    source = _sparse_capture()
    context = _context()
    validate_report_screenshot(source, context, content_validated=True)

    result = trim_report_screenshot_to_content(
        _page(), source, report_execution_context=context
    )

    with Image.open(io.BytesIO(result)) as trimmed:
        assert trimmed.size == (800, 5001)
    assert context.artifact_was_validated(result, ReportArtifactKind.SCREENSHOT)
    validate_report_screenshot(result, context)
    assert context.capture_rejection_reasons == ()


def test_unapproved_capture_earns_no_exemption() -> None:
    context = _context()
    page = _page()

    with pytest.raises(ScreenshotBlankCaptureError):
        trim_report_screenshot_to_content(
            page, _sparse_capture(), report_execution_context=context
        )

    assert "blank_final_image" in context.capture_rejection_reasons
    page.evaluate.assert_not_called()


def test_capture_rejected_untrimmed_stays_rejected() -> None:
    image = Image.new("RGB", (1600, 2000), GREY)
    image.paste(Image.new("RGB", (1568, 400), (227, 227, 227)), (16, 16))
    source = _png(image)
    assert get_screenshot_blankness_metrics(source).is_blank
    assert not get_screenshot_blankness_metrics(
        trim_trailing_background_rows(source, GREY)
    ).is_blank

    with pytest.raises(ScreenshotBlankCaptureError):
        trim_report_screenshot_to_content(
            _page(), source, report_execution_context=_context()
        )


def test_blank_capture_is_not_rescued() -> None:
    source = _png(Image.new("RGB", (800, 2000), GREY))

    with pytest.raises(ScreenshotBlankCaptureError):
        trim_report_screenshot_to_content(
            _page(), source, report_execution_context=_context()
        )


def test_corrupt_capture_is_rejected_not_trimmed() -> None:
    source = _flipped_idat_checksum(_png(_scene()))
    context = _context()

    with pytest.raises(ScreenshotBlankCaptureError):
        trim_report_screenshot_to_content(
            _page(), source, report_execution_context=context
        )
    assert "invalid_image" in context.capture_rejection_reasons

    assert trim_report_screenshot_to_content(_page(), source) is source


def test_capture_without_a_delivery_context_is_trimmed_unvalidated() -> None:
    context = _context()
    for report_context in (
        None,
        dataclasses.replace(context, validate_for_delivery=False),
    ):
        result = trim_report_screenshot_to_content(
            _page(),
            _png(_scene()),
            report_execution_context=report_context,
        )

        with Image.open(io.BytesIO(result)) as trimmed:
            assert trimmed.size == (40, 38)
        if report_context is not None:
            assert not report_context.artifact_was_validated(
                result, ReportArtifactKind.SCREENSHOT
            )


def test_no_page_background_leaves_the_capture_alone() -> None:
    source = _png(_scene())

    assert trim_report_screenshot_to_content(_page(None), source) is source
