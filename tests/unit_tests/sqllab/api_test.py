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
from __future__ import annotations

import re
from unittest.mock import MagicMock, patch

from flask import Flask


def _disposition_filename(form_filename: str | None) -> str:
    """Return the filename rendered into a streaming CSV Content-Disposition."""
    from superset.sqllab.api import SqlLabRestApi

    app = Flask(__name__)
    app.config["CSV_EXPORT"] = {"encoding": "utf-8"}
    with (
        app.app_context(),
        patch("superset.sqllab.api.StreamingSqlResultExportCommand") as command_cls,
    ):
        command = command_cls.return_value
        command.run.return_value = lambda: iter([b""])
        response = SqlLabRestApi._create_streaming_csv_response(
            MagicMock(), client_id="abc123", filename=form_filename
        )
    disposition = response.headers["Content-Disposition"]
    match = re.search(r'filename="([^"]*)"', disposition)
    assert match is not None, disposition
    return match.group(1)


def test_streaming_csv_sanitizes_user_filename() -> None:
    """A path-y / header-injecting filename is sanitized before the header."""
    filename = _disposition_filename('../../etc/pa"ss\r\nSet-Cookie: x.csv')

    for bad in ("/", "\\", '"', "\r", "\n", ".."):
        assert bad not in filename


def test_streaming_csv_preserves_normal_filename() -> None:
    """A normal filename passes through unchanged."""
    assert _disposition_filename("my_results.csv") == "my_results.csv"


def test_streaming_csv_falls_back_when_filename_empty() -> None:
    """An all-unsafe filename collapses to the generated default, not empty."""
    filename = _disposition_filename("///")

    assert filename.startswith("sqllab_abc123_")
    assert filename.endswith(".csv")
