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
"""Tests for guest-token issuance audit metadata."""

import hashlib
import inspect
from unittest.mock import MagicMock, patch

import pytest
from flask import Flask

from superset.security.guest_token import build_guest_token_audit_payload


def test_build_guest_token_audit_payload_captures_issuance_metadata() -> None:
    body = {
        "user": {"username": "guest"},
        "resources": [{"type": "dashboard", "id": "abc-123"}],
        "datasets": [1, 2],
        "rls": [{"dataset": 1, "clause": "tenant_id = 9"}],
    }
    payload = build_guest_token_audit_payload(
        issuer_user_id=42,
        source_ip="10.0.0.1",
        body=body,
        token="the-secret-token",  # noqa: S106
    )

    assert payload["issuer_user_id"] == 42
    assert payload["source_ip"] == "10.0.0.1"
    assert payload["resources"] == ["dashboard:abc-123"]
    assert payload["datasets"] == [1, 2]
    assert payload["rls_datasets"] == [1]
    assert payload["rls_rule_count"] == 1


def test_build_guest_token_audit_payload_hashes_token_and_omits_raw() -> None:
    token = "the-secret-token"  # noqa: S105
    payload = build_guest_token_audit_payload(
        issuer_user_id=1,
        source_ip=None,
        body={"resources": [], "rls": []},
        token=token,
    )

    # The raw token is never present; only its hash is recorded.
    assert token not in payload.values()
    assert payload["token_sha256"] == hashlib.sha256(token.encode("utf-8")).hexdigest()


def test_build_guest_token_audit_payload_omits_rls_clause_text() -> None:
    body = {
        "resources": [],
        "rls": [{"dataset": 7, "clause": "secret_value = 'pii'"}],
    }
    payload = build_guest_token_audit_payload(
        issuer_user_id=1,
        source_ip=None,
        body=body,
        token="t",  # noqa: S106
    )

    # Clause text (which can carry data values) is not recorded.
    assert "secret_value = 'pii'" not in str(payload)
    assert payload["rls_datasets"] == [7]


@pytest.mark.parametrize(
    "budget,exceeded",
    [(20, True), (21, False), (22, False), (None, False), (0, False), (-1, False)],
)
def test_guest_token_size_budget(budget: int | None, exceeded: bool) -> None:
    """Budget includes UTF-8 header name, colon-space, token and CRLF."""
    payload = build_guest_token_audit_payload(
        None, None, {}, "é" * 3, header_name="X-Custom-É", header_budget_bytes=budget
    )
    assert payload["token_bytes"] == 6
    assert payload["header_bytes"] == 21
    assert payload["header_budget_exceeded"] is exceeded


@pytest.mark.parametrize(
    "budget,warning",
    [(None, False), (19, True), (20, False), (21, False), ("19", False), (True, False)],
)
def test_guest_token_issuance_preserves_response(budget: object, warning: bool) -> None:
    """Diagnostics neither reject issuance nor change the encoded token or grants."""
    from superset.security.api import SecurityRestApi

    app = Flask(__name__)
    app.config.update(
        GUEST_TOKEN_HEADER_NAME="X-Test",  # noqa: S106
        GUEST_TOKEN_HEADER_MAX_BYTES=budget,
    )
    api = MagicMock()
    token = "encodedjwt"  # noqa: S105
    api.appbuilder.sm.create_guest_access_token.return_value = token
    body = {
        "user": {"username": "guest"},
        "resources": [],
        "rls": [{"clause": "private_sql = 1"}],
    }
    with (
        app.test_request_context(json=body),
        patch("superset.security.api.guest_token_create_schema") as schema,
        patch("superset.security.api.get_user_id", return_value=1),
        patch("superset.security.api.logger") as log,
    ):
        schema.load.return_value = body
        result = inspect.unwrap(SecurityRestApi.guest_token)(api)
    api.response.assert_called_once_with(200, token=token)
    assert result is api.response.return_value
    api.appbuilder.sm.create_guest_access_token.assert_called_once_with(
        body["user"], body["resources"], body["rls"]
    )
    assert log.warning.called is warning
    assert token not in str(log.mock_calls)
    assert "private_sql" not in str(log.mock_calls)


@pytest.mark.parametrize(
    "configured,expected",
    [
        ("16384", None),
        ("invalid", None),
        (True, None),
        (False, None),
        ([], None),
        ({}, None),
        (20.5, None),
        (float("nan"), None),
        (float("inf"), None),
        (float("-inf"), None),
        (2**53, None),
        (2**53 - 1, 2**53 - 1),
        (16384.0, 16384),
    ],
)
def test_guest_token_budget_normalization(
    configured: object, expected: int | None
) -> None:
    """Normalize invalid configuration safely and match browser integer semantics."""
    payload = build_guest_token_audit_payload(
        None, None, {}, "t", header_budget_bytes=configured
    )
    assert payload["header_budget_bytes"] == expected
    assert payload["header_budget_exceeded"] is False
