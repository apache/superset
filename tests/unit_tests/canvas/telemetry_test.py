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
"""Canvas instrumentation: error counters and canvas attribution."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

# The canvas API only exists while its feature flag is on.
pytestmark = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"CANVAS": True}}], indirect=True
)

BASE = "/api/v1/canvas"


def _draft(canvas_id: int = 100) -> MagicMock:
    return MagicMock(token="token", canvas_id=canvas_id)  # noqa: S106


def _log_calls(mock_log: MagicMock, action_suffix: str) -> list[dict[str, Any]]:
    """The ``log()`` keyword arguments for one action."""
    return [
        dict(call.kwargs)
        for call in mock_log.call_args_list
        if str(
            call.args[1] if len(call.args) > 1 else call.kwargs.get("action", "")
        ).endswith(action_suffix)
    ]


def test_a_canvas_error_is_counted_and_recorded(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    """A 404 returns silently today; it must leave a counter and a row."""
    from superset.commands.canvas.exceptions import CanvasNotFoundError

    mocker.patch("superset.canvas.api.load_draft", side_effect=CanvasNotFoundError())
    stats = mocker.patch("superset.canvas.api.stats_logger_manager")
    logged = mocker.patch("superset.canvas.api.event_logger")

    response = client.get(f"{BASE}/draft", headers={"X-Canvas-Draft": "token"})

    assert response.status_code == 404
    stats.instance.incr.assert_called_once_with("canvas.error.CanvasNotFoundError")
    kwargs = logged.log_with_context.call_args.kwargs
    assert kwargs["action"] == "canvas_error"
    assert kwargs["error_type"] == "CanvasNotFoundError"
    assert kwargs["status"] == 404


@pytest.mark.parametrize(
    "error_name,expected_status",
    [
        ("CanvasNotFoundError", 404),
        ("CanvasForbiddenError", 403),
        ("CanvasDraftNotFoundError", 404),
    ],
)
def test_each_error_class_gets_its_own_counter(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    error_name: str,
    expected_status: int,
) -> None:
    """The key is the exception class, so failures are distinguishable."""
    import superset.commands.canvas.exceptions as exceptions

    error = getattr(exceptions, error_name)()
    mocker.patch("superset.canvas.api.load_draft", side_effect=error)
    stats = mocker.patch("superset.canvas.api.stats_logger_manager")

    response = client.get(f"{BASE}/draft", headers={"X-Canvas-Draft": "token"})

    assert response.status_code == expected_status
    stats.instance.incr.assert_called_once_with(f"canvas.error.{error_name}")


def test_an_error_never_records_the_request_body(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    """``include_request_data=False`` is what keeps the ops array -- and the
    filter values a placement request carries -- out of ``logs.json``."""
    from superset.commands.canvas.exceptions import DraftConflictError

    mocker.patch("superset.canvas.api.load_draft", return_value=_draft())
    command = mocker.patch("superset.canvas.api.CommitCanvasDraftCommand")
    command.return_value.run.side_effect = DraftConflictError(2)
    logged = mocker.patch("superset.canvas.api.event_logger")

    response = client.post(
        f"{BASE}/draft/commit",
        json={"revision": 1},
        headers={"X-Canvas-Draft": "token"},
    )

    assert response.status_code == 409
    kwargs = logged.log_with_context.call_args.kwargs
    assert kwargs["include_request_data"] is False
    # The message can quote user input, so it is deliberately not recorded.
    assert "message" not in kwargs
    assert set(kwargs) == {
        "action",
        "log_to_statsd",
        "include_request_data",
        "canvas_id",
        "error_type",
        "status",
        "scope",
    }


def test_reporting_never_masks_the_error_it_reports(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    """Telemetry is best-effort: a broken stats backend must not turn a 404
    into a 500, nor hide the original failure from the caller."""
    from superset.commands.canvas.exceptions import CanvasNotFoundError

    mocker.patch("superset.canvas.api.load_draft", side_effect=CanvasNotFoundError())
    stats = mocker.patch("superset.canvas.api.stats_logger_manager")
    stats.instance.incr.side_effect = RuntimeError("statsd is down")

    response = client.get(f"{BASE}/draft", headers={"X-Canvas-Draft": "token"})

    assert response.status_code == 404


@pytest.mark.parametrize(
    "method,path,body,action",
    [
        ("post", "/draft/commit", {"revision": 1}, "commit_draft"),
        ("delete", "/draft", None, "delete_draft"),
        ("get", "/draft", None, "get_draft"),
    ],
)
def test_a_draft_route_attributes_its_canvas(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    method: str,
    path: str,
    body: dict[str, Any] | None,
    action: str,
) -> None:
    """A draft is named by a header, so the event logger cannot resolve the
    canvas from the URL. These routes report it themselves."""
    from superset.utils.log import DBEventLogger

    mocker.patch("superset.canvas.api.load_draft", return_value=_draft(100))
    commit = mocker.patch("superset.canvas.api.CommitCanvasDraftCommand")
    commit.return_value.run.return_value.revision = 2
    # The delete command returns the draft it discarded; that return is where
    # the canvas id comes from, so there is no second read.
    discard = mocker.patch("superset.canvas.api.DeleteCanvasDraftCommand")
    discard.return_value.run.return_value = _draft(100)
    mocker.patch("superset.canvas.api.draft_payload", return_value={})
    mock_log = mocker.patch.object(DBEventLogger, "log")

    response = getattr(client, method)(
        f"{BASE}{path}",
        headers={"X-Canvas-Draft": "token"},
        **({"json": body} if body is not None else {}),
    )

    assert response.status_code == 200
    calls = _log_calls(mock_log, action)
    assert calls, f"no log row for {action}"
    assert calls[-1]["records"][0]["canvas_id"] == 100


def test_a_draft_route_never_logs_its_token(
    client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    """The token travels in a header precisely so it stays out of logs."""
    from superset.utils.log import DBEventLogger

    mocker.patch("superset.canvas.api.load_draft", return_value=_draft(100))
    mocker.patch("superset.canvas.api.draft_payload", return_value={})
    mock_log = mocker.patch.object(DBEventLogger, "log")

    response = client.get(f"{BASE}/draft", headers={"X-Canvas-Draft": "s3cret-token"})

    assert response.status_code == 200
    recorded = str(mock_log.call_args_list)
    assert "s3cret-token" not in recorded
