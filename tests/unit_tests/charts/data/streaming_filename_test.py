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
import codecs
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask


def _build_response(filename: str | None, chunks: list[str] | None = None):
    from superset.charts.data.api import ChartDataRestApi

    api = ChartDataRestApi.__new__(ChartDataRestApi)
    result = {"query_context": MagicMock()}

    with patch(
        "superset.charts.data.api.StreamingCSVExportCommand"
    ) as mock_command_cls:
        mock_command = mock_command_cls.return_value
        mock_command.run.return_value = lambda: iter(chunks or ["a,b\n"])
        return api._create_streaming_csv_response(result, filename=filename)


@pytest.mark.parametrize(
    "provided,expected_substring",
    [
        ('"; evil="x', "evil"),  # quotes/special chars stripped
        ("../../etc/passwd", "etc_passwd"),
        ("report 2020.csv", "report_2020.csv"),
    ],
)
def test_client_filename_is_sanitized(provided: str, expected_substring: str) -> None:
    response = _build_response(provided)
    disposition = response.headers["Content-Disposition"]

    # No raw quotes/newlines/path separators leak into the header.
    assert "/" not in disposition.split("filename=")[1]
    assert "\n" not in disposition
    # Header is well-formed: exactly the opening/closing quotes around the name.
    assert disposition.count('"') == 2
    assert expected_substring in disposition


def test_blank_filename_falls_back_to_default() -> None:
    response = _build_response("...")
    disposition = response.headers["Content-Disposition"]
    assert 'filename="export.csv"' in disposition


def test_streamed_body_uses_csv_export_encoding(app: Flask) -> None:
    """The streamed body honors CSV_EXPORT encoding, writing the BOM once."""
    chunks = ["name;city\r\n", "Müller;Köln\r\n"]

    with patch.dict(app.config, {"CSV_EXPORT": {"encoding": "utf-8-sig"}}):
        response = _build_response("export.csv", chunks)
        body = b"".join(response.iter_encoded())

    assert response.headers["Content-Type"] == "text/csv; charset=utf-8-sig"
    assert body == codecs.BOM_UTF8 + "".join(chunks).encode("utf-8")
