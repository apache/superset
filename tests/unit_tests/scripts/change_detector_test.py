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
from unittest import mock
from urllib.error import HTTPError, URLError

import pytest

from scripts import change_detector
from superset.utils import json


def _make_response(body: bytes) -> mock.MagicMock:
    """Builds a mock that mimics urlopen's context-manager response."""
    response: mock.MagicMock = mock.MagicMock()
    response.__enter__.return_value.read.return_value = body
    return response


def test_fetch_retries_transient_error_then_succeeds() -> None:
    payload: list[dict[str, str]] = [{"filename": "superset/foo.py"}]
    side_effects: list[object] = [
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


def test_fetch_retries_rate_limit_then_succeeds() -> None:
    side_effects: list[object] = [
        HTTPError("http://api", 429, "Too Many Requests", {}, None),  # type: ignore
        _make_response(b"[]"),
    ]
    with (
        mock.patch.object(
            change_detector, "urlopen", side_effect=side_effects
        ) as urlopen_mock,
        mock.patch.object(change_detector.time, "sleep") as sleep_mock,
    ):
        result = change_detector.fetch_files_github_api("http://api")

    assert result == []
    assert urlopen_mock.call_count == 2
    assert sleep_mock.call_count == 1


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


def _http_error(
    status: int, headers: dict[str, str] | None = None, body: bytes = b""
) -> HTTPError:
    """Builds an HTTPError carrying headers and a readable body, as urllib does."""
    return HTTPError(
        "http://api",
        status,
        "Forbidden",
        headers or {},  # type: ignore[arg-type]
        io.BytesIO(body),
    )


def test_fetch_does_not_retry_a_permission_denied_403() -> None:
    """A missing token scope is deterministic; retrying only delays the failure."""
    error = _http_error(
        403,
        headers={"x-ratelimit-remaining": "4998"},
        body=b'{"message": "Resource not accessible by integration"}',
    )
    with (
        mock.patch.object(
            change_detector, "urlopen", side_effect=error
        ) as urlopen_mock,
        mock.patch.object(change_detector.time, "sleep") as sleep_mock,
    ):
        with pytest.raises(HTTPError):
            change_detector.fetch_files_github_api("http://api")

    assert urlopen_mock.call_count == 1
    sleep_mock.assert_not_called()


def test_fetch_retries_a_rate_limited_403() -> None:
    """GitHub signals rate limiting with 403 and an exhausted remaining count."""
    side_effects: list[object] = [
        _http_error(403, headers={"x-ratelimit-remaining": "0"}),
        _make_response(b'[{"filename": "superset/foo.py"}]'),
    ]
    with (
        mock.patch.object(change_detector, "urlopen", side_effect=side_effects),
        mock.patch.object(change_detector.time, "sleep"),
    ):
        result = change_detector.fetch_files_github_api("http://api")

    assert result == [{"filename": "superset/foo.py"}]


def test_fetch_reports_the_api_error_message(capsys) -> None:
    """The response body names the cause; without it a 403 is unactionable."""
    error = _http_error(
        403,
        headers={"x-ratelimit-remaining": "4998"},
        body=b'{"message": "Resource not accessible by integration"}',
    )
    with mock.patch.object(change_detector, "urlopen", side_effect=error):
        with pytest.raises(HTTPError):
            change_detector.fetch_files_github_api("http://api")

    assert "Resource not accessible by integration" in capsys.readouterr().out


def test_image_tag_compose_changes_trigger_python_tests() -> None:
    assert change_detector.detect_changes(
        ["docker-compose-image-tag.yml"],
        change_detector.PATTERNS["python"],
    )


def test_docker_workflow_changes_trigger_docker_build() -> None:
    """A change to only the docker-build workflow file itself (no
    Dockerfile/docker-compose/app-code changes) must still be classified as
    "docker", or docker-build's job-level `if:` skips the job entirely and a
    broken workflow edit -- including to the vulnerability scan step it
    runs -- is never actually exercised on merge."""
    assert change_detector.detect_changes(
        [".github/workflows/docker.yml"],
        change_detector.PATTERNS["docker"],
    )


def test_grype_config_changes_trigger_docker_build() -> None:
    """A change to only `.grype.yaml` (the vulnerability-scan config) must
    still be classified as "docker", or an accidental broad exclusion in it
    goes unexercised by CI until it reaches master."""
    assert change_detector.detect_changes(
        [".grype.yaml"],
        change_detector.PATTERNS["docker"],
    )


def test_fetch_changed_files_push_uses_full_push_range() -> None:
    changed_files = [
        {"filename": "superset/foo.py"},
        {"filename": "superset-frontend/src/foo.tsx"},
    ]

    with mock.patch.object(
        change_detector,
        "fetch_files_github_api",
        return_value={"files": changed_files},
    ) as fetch_mock:
        result = change_detector.fetch_changed_files_push(
            "apache/superset",
            "after-sha",
            "before-sha",
        )

    assert result == [
        "superset/foo.py",
        "superset-frontend/src/foo.tsx",
    ]

    fetch_mock.assert_called_once_with(
        "https://api.github.com/repos/apache/superset/compare/before-sha...after-sha"
    )


def test_get_push_before_sha() -> None:
    event = {"before": "before-sha", "after": "after-sha"}

    with mock.patch.dict(
        change_detector.os.environ,
        {"GITHUB_EVENT_PATH": "github-event.json"},
    ):
        with mock.patch(
            "builtins.open",
            mock.mock_open(read_data=json.dumps(event)),
        ):
            assert change_detector.get_push_before_sha() == "before-sha"


def test_get_push_before_sha_returns_none_for_initial_push() -> None:
    event = {"before": "0" * 40, "after": "after-sha"}

    with mock.patch.dict(
        change_detector.os.environ,
        {"GITHUB_EVENT_PATH": "github-event.json"},
    ):
        with mock.patch(
            "builtins.open",
            mock.mock_open(read_data=json.dumps(event)),
        ):
            assert change_detector.get_push_before_sha() is None


def test_main_push_detects_changes_from_multiple_commits(tmp_path) -> None:
    event = {"before": "before-sha", "after": "after-sha"}

    changed_files = {
        "files": [
            {"filename": "superset/foo.py"},
            {"filename": "superset-frontend/src/foo.tsx"},
        ]
    }

    with mock.patch.dict(
        change_detector.os.environ,
        {
            "GITHUB_EVENT_PATH": "github-event.json",
            "GITHUB_OUTPUT": str(tmp_path / "github-output"),
        },
    ):
        with mock.patch(
            "builtins.open",
            mock.mock_open(read_data=json.dumps(event)),
        ) as open_mock:
            with mock.patch.object(
                change_detector,
                "fetch_files_github_api",
                return_value=changed_files,
            ):
                change_detector.main(
                    "push",
                    "after-sha",
                    "apache/superset",
                )

    output = open_mock()
    written = "".join(call.args[0] for call in output.write.call_args_list)

    assert "python=true" in written
    assert "frontend=true" in written
