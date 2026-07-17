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
from unittest import mock
from urllib.error import HTTPError, URLError

import pytest

from scripts import change_detector


def _make_response(body: bytes) -> mock.MagicMock:
    """Builds a mock that mimics urlopen's context-manager response."""
    response = mock.MagicMock()
    response.__enter__.return_value.read.return_value = body
    return response


def test_fetch_retries_transient_error_then_succeeds() -> None:
    payload = [{"filename": "superset/foo.py"}]
    side_effects = [
        HTTPError("http://api", 500, "Server Error", {}, None),  # type: ignore
        HTTPError("http://api", 502, "Bad Gateway", {}, None),  # type: ignore
        _make_response(b'[{"filename": "superset/foo.py"}]'),
    ]
    with (
        mock.patch.object(
            change_detector, "urlopen", side_effect=side_effects
        ) as urlopen_mock,
        mock.patch.object(change_detector.time, "sleep") as sleep_mock,
    ):
        result = change_detector.fetch_files_github_api("http://api")

    assert result == payload
    assert urlopen_mock.call_count == 3
    assert sleep_mock.call_count == 2


def test_fetch_does_not_retry_client_error() -> None:
    with (
        mock.patch.object(
            change_detector,
            "urlopen",
            side_effect=HTTPError("http://api", 404, "Not Found", {}, None),  # type: ignore
        ) as urlopen_mock,
        mock.patch.object(change_detector.time, "sleep") as sleep_mock,
    ):
        with pytest.raises(HTTPError):
            change_detector.fetch_files_github_api("http://api")

    assert urlopen_mock.call_count == 1
    assert sleep_mock.call_count == 0


def test_fetch_gives_up_after_max_retries() -> None:
    with (
        mock.patch.object(
            change_detector, "urlopen", side_effect=URLError("connection reset")
        ) as urlopen_mock,
        mock.patch.object(change_detector.time, "sleep"),
    ):
        with pytest.raises(URLError):
            change_detector.fetch_files_github_api("http://api")

    assert urlopen_mock.call_count == change_detector.MAX_RETRIES
