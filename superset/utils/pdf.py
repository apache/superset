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
import re
import textwrap
from io import BytesIO
from typing import Any

from superset.commands.report.exceptions import ReportSchedulePdfFailedError

logger = logging.getLogger(__name__)
try:
    from PIL import Image, ImageDraw, ImageFont
except ModuleNotFoundError:
    logger.info("No PIL installation found")


NEWLINE_PATTERN = re.compile(r"\r\n|\r|\n")
DEFAULT_PAGE_HEIGHT = 1754
PAGE_MARGIN = 48
CELL_PADDING_X = 8
CELL_PADDING_Y = 6
MIN_COLUMN_CHARS = 10
MAX_COLUMN_CHARS = 120
MIN_PAGE_WIDTH = 360
MAX_PAGE_WIDTH = 4096
HEADER_BG_COLOR = (244, 244, 244)
GRID_COLOR = (210, 210, 210)
TEXT_COLOR = (0, 0, 0)


def build_pdf_from_screenshots(snapshots: list[bytes]) -> bytes:
    images = []

    for snap in snapshots:
        img = Image.open(BytesIO(snap))
        if img.mode == "RGBA":
            img = img.convert("RGB")
        images.append(img)
    logger.info("building pdf")
    try:
        new_pdf = BytesIO()
        images[0].save(new_pdf, "PDF", save_all=True, append_images=images[1:])
        new_pdf.seek(0)
    except Exception as ex:
        raise ReportSchedulePdfFailedError(
            f"Failed converting screenshots to pdf {str(ex)}"
        ) from ex

    return new_pdf.read()


def _normalize_chart_row_value(value: Any) -> str:
    """
    Convert chart row values into printable text for PDF export.
    """
    if value is None:
        return ""
    if isinstance(value, (list, tuple, dict, set)):
        value_str = str(value)
    else:
        value_str = str(value)
    value_str = NEWLINE_PATTERN.sub(" ", value_str).replace("\t", "    ")
    return value_str


def apply_column_labels_to_rows(
    query_data: Any,
    column_labels: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Apply human-friendly column labels to row keys while preserving row values.

    If multiple source columns resolve to the same label, unique suffixes are
    applied to prevent key collisions and data loss.
    """
    if not isinstance(query_data, list):
        return []

    normalized_labels = {
        str(column_name): str(label) if label else str(column_name)
        for column_name, label in (column_labels or {}).items()
    }

    header_map: dict[str, str] = {}
    used_headers: set[str] = set()
    for row in query_data:
        if not isinstance(row, dict):
            continue
        for key in row:
            source_key = str(key)
            if source_key in header_map:
                continue

            preferred = normalized_labels.get(source_key, source_key)
            candidate = preferred
            if candidate in used_headers:
                candidate = f"{preferred} ({source_key})"
            suffix = 2
            while candidate in used_headers:
                candidate = f"{preferred} ({suffix})"
                suffix += 1

            header_map[source_key] = candidate
            used_headers.add(candidate)

    rows: list[dict[str, Any]] = []
    for row in query_data:
        if isinstance(row, dict):
            rows.append(
                {
                    header_map.get(str(key), str(key)): value
                    for key, value in row.items()
                }
            )
        else:
            rows.append({"value": row})
    return rows


def _load_table_font() -> Any:
    """
    Load a monospaced font when available, with a safe fallback.
    """
    font_candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf",
        "/usr/share/fonts/dejavu/DejaVuSansMono.ttf",
    ]
    for font_path in font_candidates:
        try:
            return ImageFont.truetype(font_path, 15)
        except OSError:
            continue
    return ImageFont.load_default()


def _measure_text_metrics(font: Any) -> tuple[int, int]:
    """
    Return approximate single-character width and line height for the font.
    """
    probe = Image.new("RGB", (1, 1), "white")
    draw = ImageDraw.Draw(probe)
    char_bbox = draw.textbbox((0, 0), "0", font=font)
    line_bbox = draw.textbbox((0, 0), "Ag", font=font)
    char_width = max(char_bbox[2] - char_bbox[0], 1)
    line_height = max((line_bbox[3] - line_bbox[1]) + 2, 12)
    return char_width, line_height


def _extract_columns(rows: list[dict[str, str]]) -> list[str]:
    columns: list[str] = []
    for row in rows:
        for key in row:
            if key not in columns:
                columns.append(key)
    return columns


def _estimate_column_width_chars(
    columns: list[str], rows: list[dict[str, str]]
) -> list[int]:
    widths: list[int] = []
    for column in columns:
        max_length = len(column)
        for row in rows:
            cell_value = row.get(column, "")
            max_length = max(max_length, len(cell_value))
        widths.append(min(max(max_length, MIN_COLUMN_CHARS), MAX_COLUMN_CHARS))
    return widths


def _calculate_page_width(table_width: int) -> int:
    """
    Calculate page width based on table content width with safe bounds.
    """
    return min(max((PAGE_MARGIN * 2) + table_width, MIN_PAGE_WIDTH), MAX_PAGE_WIDTH)


def _wrap_cell(value: str, width_chars: int) -> list[str]:
    wrapped = textwrap.wrap(
        value,
        width=width_chars,
        replace_whitespace=False,
        drop_whitespace=False,
        break_long_words=True,
        break_on_hyphens=False,
    )
    return wrapped or [""]


def _draw_row_chunk(
    draw: Any,
    x_origin: int,
    y_origin: int,
    row_cells: list[list[str]],
    chunk_start: int,
    chunk_line_count: int,
    column_widths_px: list[int],
    font: Any,
    line_height: int,
    header: bool = False,
) -> int:
    row_height = (chunk_line_count * line_height) + (CELL_PADDING_Y * 2)
    x_position = x_origin
    for idx, cell_lines in enumerate(row_cells):
        cell_width = column_widths_px[idx]
        draw.rectangle(
            (
                x_position,
                y_origin,
                x_position + cell_width,
                y_origin + row_height,
            ),
            fill=HEADER_BG_COLOR if header else "white",
            outline=GRID_COLOR,
        )
        line_cursor = y_origin + CELL_PADDING_Y
        for line_index in range(chunk_start, chunk_start + chunk_line_count):
            text_line = cell_lines[line_index] if line_index < len(cell_lines) else ""
            draw.text(
                (x_position + CELL_PADDING_X, line_cursor),
                text_line,
                fill=TEXT_COLOR,
                font=font,
            )
            line_cursor += line_height
        x_position += cell_width
    return row_height


def build_pdf_from_chart_data(rows: list[dict[str, Any]]) -> bytes:  # noqa: C901
    """
    Build a paginated table PDF document from chart row data.
    """
    try:
        normalized_rows = [
            {str(key): _normalize_chart_row_value(value) for key, value in row.items()}
            for row in rows
        ]
        columns = _extract_columns(normalized_rows)
        if not columns:
            columns = ["message"]
            normalized_rows = [{"message": "No data available."}]

        font = _load_table_font()
        char_width, line_height = _measure_text_metrics(font)
        column_widths_chars = _estimate_column_width_chars(columns, normalized_rows)
        column_widths_px = [
            (width_chars * char_width) + (CELL_PADDING_X * 2)
            for width_chars in column_widths_chars
        ]
        table_width = sum(column_widths_px)
        page_width = _calculate_page_width(table_width)
        page_height = DEFAULT_PAGE_HEIGHT
        x_origin = PAGE_MARGIN

        header_cells = [
            _wrap_cell(column_name, column_widths_chars[idx])
            for idx, column_name in enumerate(columns)
        ]
        header_line_count = max(len(cell) for cell in header_cells)
        for cell in header_cells:
            if len(cell) < header_line_count:
                cell.extend([""] * (header_line_count - len(cell)))

        pages: list[Any] = []
        page = Image.new("RGB", (page_width, page_height), "white")
        draw = ImageDraw.Draw(page)
        y_cursor = PAGE_MARGIN

        def begin_new_page() -> tuple[Any, Any, int]:
            next_page = Image.new("RGB", (page_width, page_height), "white")
            next_draw = ImageDraw.Draw(next_page)
            next_y = PAGE_MARGIN
            next_y += _draw_row_chunk(
                draw=next_draw,
                x_origin=x_origin,
                y_origin=next_y,
                row_cells=header_cells,
                chunk_start=0,
                chunk_line_count=header_line_count,
                column_widths_px=column_widths_px,
                font=font,
                line_height=line_height,
                header=True,
            )
            return next_page, next_draw, next_y

        # Draw header on the first page.
        y_cursor += _draw_row_chunk(
            draw=draw,
            x_origin=x_origin,
            y_origin=y_cursor,
            row_cells=header_cells,
            chunk_start=0,
            chunk_line_count=header_line_count,
            column_widths_px=column_widths_px,
            font=font,
            line_height=line_height,
            header=True,
        )

        for row in normalized_rows:
            row_cells = [
                _wrap_cell(row.get(column_name, ""), column_widths_chars[idx])
                for idx, column_name in enumerate(columns)
            ]
            total_row_lines = max(len(cell) for cell in row_cells)
            for cell in row_cells:
                if len(cell) < total_row_lines:
                    cell.extend([""] * (total_row_lines - len(cell)))

            line_start = 0
            while line_start < total_row_lines:
                available_height = page_height - PAGE_MARGIN - y_cursor
                max_lines_for_chunk = max(
                    (available_height - (CELL_PADDING_Y * 2)) // line_height,
                    0,
                )

                if max_lines_for_chunk <= 0:
                    pages.append(page)
                    page, draw, y_cursor = begin_new_page()
                    continue

                chunk_line_count = min(
                    max_lines_for_chunk,
                    total_row_lines - line_start,
                )
                y_cursor += _draw_row_chunk(
                    draw=draw,
                    x_origin=x_origin,
                    y_origin=y_cursor,
                    row_cells=row_cells,
                    chunk_start=line_start,
                    chunk_line_count=chunk_line_count,
                    column_widths_px=column_widths_px,
                    font=font,
                    line_height=line_height,
                )
                line_start += chunk_line_count

                if line_start < total_row_lines:
                    pages.append(page)
                    page, draw, y_cursor = begin_new_page()

        pages.append(page)
        output = BytesIO()
        pages[0].save(output, "PDF", save_all=True, append_images=pages[1:])
        output.seek(0)
    except Exception as ex:
        raise ReportSchedulePdfFailedError(
            f"Failed converting chart data to pdf {str(ex)}"
        ) from ex

    return output.read()
