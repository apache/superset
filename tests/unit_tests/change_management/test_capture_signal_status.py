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
"""The capture signal carries its own status, and says what it means.

Two issues meet here. ``ChangeRequestCreated`` was the only gate signal
that never set ``status``, so it inherited ``SupersetException``'s 500.
Anything reading the status off the exception rather than off the HTTP
response therefore read a successful capture as a server fault -- the MCP
middleware told the caller "Internal error", logged it at ERROR and fired
``MCP_ERROR_HOOK`` (QA-13).

And the message said the write had been "submitted for review" when the
gate writes every captured change as a DRAFT, which no approver sees until
the author requests review (QA-05).
"""

from asset_approval.exceptions import (
    AssetLockedError,
    ChangeRequestCreated,
    ImportOverwriteRefusedError,
    UnreviewableWriteRefusedError,
)
from asset_approval.http import (
    BULK_DELETE_MESSAGE,
    BULK_MESSAGE,
    CAPTURED_STATUS,
    DELETE_MESSAGE,
    DELETE_REPLACED_MESSAGE,
    SAVED_MESSAGE,
)

from superset.change_management import is_review_signal


def _captured(**kwargs: object) -> ChangeRequestCreated:
    defaults: dict[str, object] = {
        "change_request_id": 7,
        "asset_type": "chart",
        "asset_id": 42,
    }
    defaults.update(kwargs)
    return ChangeRequestCreated(**defaults)  # type: ignore[arg-type]


def test_capture_is_a_2xx_not_a_server_error() -> None:
    assert _captured().status == 202


def test_http_layer_reads_the_status_off_the_signal() -> None:
    # One source of truth: the two disagreeing is what hid QA-13 from the
    # HTTP tests, which never looked at the exception's own status.
    assert CAPTURED_STATUS == ChangeRequestCreated.status


def test_every_gate_signal_now_sets_a_status() -> None:
    # The gap was a missing attribute on one of four siblings, so assert on
    # all of them rather than on the one that was wrong.
    for exc in (
        ChangeRequestCreated,
        AssetLockedError,
        ImportOverwriteRefusedError,
        UnreviewableWriteRefusedError,
    ):
        assert isinstance(exc.status, int), exc
        assert exc.status != 500, exc


def test_core_recognises_a_capture_without_importing_the_extension() -> None:
    assert is_review_signal(_captured()) is True


def test_core_does_not_mistake_a_refusal_for_a_capture() -> None:
    # A refusal is a refusal: it must keep its own status and its own
    # treatment, or the fix for QA-13 would silence real problems.
    assert (
        is_review_signal(
            AssetLockedError(
                asset_type="chart",
                asset_id=42,
                author="someone",
            )
        )
        is False
    )


def test_core_does_not_mistake_an_ordinary_error_for_a_capture() -> None:
    assert is_review_signal(RuntimeError("boom")) is False


def test_the_message_does_not_claim_a_submission() -> None:
    # QA-05. This string is what MCP callers and the REST API see.
    assert "submitted" not in str(_captured()).lower()
    assert "draft" in str(_captured()).lower()


def test_the_bulk_message_does_not_claim_a_submission_either() -> None:
    assert "submitted" not in str(_captured(count=3)).lower()


def test_no_captured_response_copy_claims_a_submission() -> None:
    for message in (
        SAVED_MESSAGE,
        DELETE_MESSAGE,
        DELETE_REPLACED_MESSAGE,
        BULK_MESSAGE,
        BULK_DELETE_MESSAGE,
    ):
        assert "submitted" not in message.lower(), message


def test_delete_copy_still_says_nothing_was_removed() -> None:
    # The honest half of the old copy, which the rewrite must not lose.
    for message in (DELETE_MESSAGE, DELETE_REPLACED_MESSAGE, BULK_DELETE_MESSAGE):
        assert "nothing has been removed" in message.lower(), message
