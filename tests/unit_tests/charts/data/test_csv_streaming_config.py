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

from flask import Response

from superset.charts.data.api import ChartDataRestApi
from tests.integration_tests.test_app import app  # type: ignore


class _CaptureStreamingCommand:  # pragma: no cover - simple test stub
    captured_chunk_size: int | None = None

    def __init__(self, query_context, chunk_size: int):  # noqa: D401
        _CaptureStreamingCommand.captured_chunk_size = chunk_size

    def validate(self) -> None:  # noqa: D401
        return None

    def run(self):  # noqa: D401
        # Return a callable that yields a generator
        def _gen():
            yield b"a,b\n1,2\n"

        return _gen


def test_csv_streaming_uses_configured_chunk_size(monkeypatch):
    # Patch the command used by the API to capture the chunk size
    monkeypatch.setattr(
        "superset.charts.data.api.StreamingCSVExportCommand",
        _CaptureStreamingCommand,
    )

    with app.app_context():
        app.config["CSV_STREAMING_CHUNK_SIZE"] = 131072

        api = ChartDataRestApi()
        # Minimal result structure expected by _create_streaming_csv_response
        result = {"query_context": object()}

        resp: Response = api._create_streaming_csv_response(result, form_data={}, filename="test.csv")
        assert resp.status_code == 200 or resp.status_code is None  # Flask may default later
        assert _CaptureStreamingCommand.captured_chunk_size == 131072

