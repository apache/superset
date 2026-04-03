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

import pytest

from superset.utils import pdf as pdf_utils
from superset.utils.pdf import apply_column_labels_to_rows, build_pdf_from_chart_data

pytest.importorskip("PIL")


def test_build_pdf_from_chart_data_with_rows() -> None:
    pdf_bytes = build_pdf_from_chart_data(
        [
            {"country": "TR", "value": 10},
            {"country": "US", "value": 25},
        ]
    )

    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 100


def test_build_pdf_from_chart_data_with_empty_rows() -> None:
    pdf_bytes = build_pdf_from_chart_data([])

    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 100


def _capture_page_width(
    monkeypatch: pytest.MonkeyPatch, rows: list[dict[str, str]]
) -> int:
    captured_widths: list[int] = []
    original_image_new = pdf_utils.Image.new

    def image_new_spy(mode: str, size: tuple[int, int], color: str) -> object:
        captured_widths.append(size[0])
        return original_image_new(mode, size, color)

    monkeypatch.setattr(pdf_utils.Image, "new", image_new_spy)
    build_pdf_from_chart_data(rows)
    # Ignore tiny probe canvases and return the real document width.
    return max(width for width in captured_widths if width > 10)


def test_build_pdf_from_chart_data_adjusts_page_width_to_content(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    narrow_width = _capture_page_width(monkeypatch, [{"country": "TR"}])
    wide_width = _capture_page_width(
        monkeypatch,
        [
            {
                "description": "network-device-" * 20,
                "details": "cisco-ios-release-" * 20,
            }
        ],
    )

    assert narrow_width < wide_width


def test_apply_column_labels_to_rows_uses_dataset_labels() -> None:
    rows = apply_column_labels_to_rows(
        [{"country": "TR", "sales": 10}],
        {"country": "\u00dclke", "sales": "Sat\u0131\u015f"},
    )

    assert rows == [{"\u00dclke": "TR", "Sat\u0131\u015f": 10}]


def test_apply_column_labels_to_rows_avoids_header_collisions() -> None:
    rows = apply_column_labels_to_rows(
        [{"src_a": 1, "src_b": 2}],
        {"src_a": "Ayn\u0131", "src_b": "Ayn\u0131"},
    )

    assert rows == [{"Ayn\u0131": 1, "Ayn\u0131 (src_b)": 2}]


def test_build_pdf_from_chart_data_handles_turkish_characters() -> None:
    pdf_bytes = build_pdf_from_chart_data(
        [
            {
                "\u00dclke": "T\u00fcrkiye",
                "\u015eehir": "\u0130zmir",
                "A\u00e7\u0131klama": "\u00c7al\u0131\u015f\u0131yor",
            }
        ]
    )

    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 100
