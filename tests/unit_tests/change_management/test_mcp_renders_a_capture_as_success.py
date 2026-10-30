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
"""A captured write is a successful tool call, not a failed one.

The first half of QA-13 was the wording: a capture inherited a 500 and
came back as "Internal error in update_chart". That was fixed, and the
message now reads "Held for review".

The half left was the flag. The middleware still *raised*, so the result
reached the caller as CallToolResult(isError=true), and an agent reads
that as a failed call whatever the text says -- so it retries a write
that was accepted, and the retry either folds into the same draft or
comes back 409 against the asset it just locked.

Underneath both halves is one rule, and these tests are about it: the
HTTP layer and the MCP layer must describe the same capture the same
way, so they read it from the same place.
"""

import inspect
from typing import Any

import pytest
from asset_approval.exceptions import (
    AssetLockedError,
    ChangeRequestCreated,
    ImportOverwriteRefusedError,
    UnreviewableWriteRefusedError,
)
from asset_approval.http import signal_response

from superset.change_management import is_review_signal, review_signal_details
from superset.mcp_service.middleware import GlobalErrorHandlerMiddleware


def _captured(**kwargs: Any) -> ChangeRequestCreated:
    defaults: dict[str, Any] = {
        "change_request_id": 7,
        "asset_type": "chart",
        "asset_id": 42,
    }
    defaults.update(kwargs)
    return ChangeRequestCreated(**defaults)


def test_a_capture_is_not_flagged_as_an_error() -> None:
    result = GlobalErrorHandlerMiddleware._captured_result(
        _captured(), "update_chart"
    )

    assert result.is_error is False


def test_the_caller_is_told_which_request_to_look_for() -> None:
    result = GlobalErrorHandlerMiddleware._captured_result(
        _captured(change_request_id=29), "update_chart"
    )

    text = result.content[0].text
    assert "29" in text
    assert "update_chart" in text


def test_the_caller_is_told_not_to_retry() -> None:
    # The behavioural half of the bug: an agent that reads a failure
    # retries, and the retry lands on an asset its own draft now holds.
    text = GlobalErrorHandlerMiddleware._captured_result(
        _captured(), "update_chart"
    ).content[0].text

    assert "do not" in text.lower()


def test_a_bulk_capture_names_every_request() -> None:
    result = GlobalErrorHandlerMiddleware._captured_result(
        _captured(change_request_ids=[3, 4, 5], count=3), "delete_dashboard"
    )

    text = result.content[0].text
    assert "3" in text and "4" in text and "5" in text


def test_structured_content_stays_empty() -> None:
    # ToolResultCompatibilityMiddleware re-wraps a result whose structured
    # payload is set, and the structured payload is what transport
    # encoding failures track. Text only keeps this passing through.
    result = GlobalErrorHandlerMiddleware._captured_result(
        _captured(), "update_chart"
    )

    assert result.structured_content is None


@pytest.mark.parametrize(
    "refusal",
    [
        AssetLockedError("chart", 42),
        ImportOverwriteRefusedError(["a"]),
        UnreviewableWriteRefusedError("save", "ask an editor"),
    ],
)
def test_a_refusal_is_still_a_refusal(refusal: Exception) -> None:
    # The fix must not silence real problems: only a capture is a success.
    assert is_review_signal(refusal) is False


def test_the_two_layers_read_the_same_capture() -> None:
    """The anti-drift test, which is the point of the shared reader.

    The 202 body and the tool result are written for different readers,
    but they have to agree on what happened.
    """
    signal = _captured(change_request_id=29, change_request_ids=[29], count=1)

    body, status = signal_response(signal)
    details = review_signal_details(signal)

    assert status == 202
    assert body["id"] == details["id"] == 29
    assert body["count"] == details["count"]
    assert body["asset_type"] == details["asset_type"]
    assert body["asset_id"] == details["asset_id"]
    assert body["review_required"] is details["review_required"] is True
    assert str(details["id"]) in (
        GlobalErrorHandlerMiddleware._captured_result(signal, "update_chart")
        .content[0]
        .text
    )


def test_the_middleware_returns_rather_than_raises_for_a_tool_call() -> None:
    # Structural, because constructing a live MiddlewareContext here costs
    # more than it proves: a raise is what produced isError=true, so the
    # branch returning is the fix.
    source = inspect.getsource(GlobalErrorHandlerMiddleware._handle_error)
    capture_branch = source[source.index("is_review_signal(error)") :]
    head = capture_branch[: capture_branch.index("raise ToolError")]

    assert "_captured_result" in head
    assert 'context.method == "tools/call"' in head
