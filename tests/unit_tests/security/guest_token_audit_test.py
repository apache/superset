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
