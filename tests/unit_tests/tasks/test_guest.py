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
"""Unit tests for guest subscriber key derivation."""

from typing import Any
from unittest import mock

from pytest_mock import MockerFixture


def _guest_token(**overrides: Any) -> dict[str, Any]:
    """A representative guest token with all authorization-relevant claims set."""
    token: dict[str, Any] = {
        "user": {"username": "guest"},
        "resources": [{"type": "dashboard", "id": "abc"}],
        "iat": 1000,
        "exp": 2000,
        "aud": "superset",
        "datasets": [1, 2],
        "rev": 1,
        "rls_rules": [{"clause": "tenant_id = 1"}],
    }
    token.update(overrides)
    return token


def _patch_guest(mocker: MockerFixture, token: dict[str, Any] | None) -> None:
    guest = mock.MagicMock() if token is not None else None
    if guest is not None:
        guest.guest_token = token
    sm = mocker.patch("superset.tasks.guest.security_manager")
    sm.get_current_guest_user_if_guest = mock.MagicMock(return_value=guest)


def test_returns_none_when_not_a_guest(mocker: MockerFixture) -> None:
    from superset.tasks.guest import get_current_guest_subscriber_key

    _patch_guest(mocker, None)

    assert get_current_guest_subscriber_key() is None


def test_derives_prefixed_key_for_guest(mocker: MockerFixture) -> None:
    from superset.tasks.guest import get_current_guest_subscriber_key

    _patch_guest(mocker, _guest_token())

    key = get_current_guest_subscriber_key()

    assert key is not None
    assert key.startswith("guest:")
    # HMAC-SHA256 hex digest is 64 chars after the "guest:" prefix.
    assert len(key) == len("guest:") + 64


def test_same_token_derives_same_key(mocker: MockerFixture) -> None:
    from superset.tasks.guest import get_current_guest_subscriber_key

    _patch_guest(mocker, _guest_token())
    first = get_current_guest_subscriber_key()

    _patch_guest(mocker, _guest_token())
    second = get_current_guest_subscriber_key()

    assert first == second


def test_scope_affecting_claims_change_the_key(mocker: MockerFixture) -> None:
    """Two guests with different effective access must not share a key."""
    from superset.tasks.guest import get_current_guest_subscriber_key

    _patch_guest(mocker, _guest_token())
    baseline = get_current_guest_subscriber_key()

    for claim, value in (
        ("rls_rules", [{"clause": "tenant_id = 2"}]),
        ("resources", [{"type": "dashboard", "id": "xyz"}]),
        ("datasets", [3]),
        ("rev", 2),
        ("aud", "other-audience"),
        ("user", {"username": "other"}),
    ):
        _patch_guest(mocker, _guest_token(**{claim: value}))
        assert get_current_guest_subscriber_key() != baseline, (
            f"differing {claim} should derive a different key"
        )


def test_refreshed_token_with_same_scope_keeps_the_key(mocker: MockerFixture) -> None:
    """A re-issued token (new iat/exp, same scope) must keep the subscriber key.

    The embedded SDK refreshes the guest token on a fixed cadence, so a key that
    changed per issuance would stop matching the subscriber row mid-query and the
    polls after a refresh could no longer see the task.
    """
    from superset.tasks.guest import get_current_guest_subscriber_key

    _patch_guest(mocker, _guest_token(iat=1000, exp=2000))
    baseline = get_current_guest_subscriber_key()

    _patch_guest(mocker, _guest_token(iat=1995, exp=2995))
    assert get_current_guest_subscriber_key() == baseline


def test_unrelated_claims_do_not_change_the_key(mocker: MockerFixture) -> None:
    """Claims outside the identity set must not affect the derived key."""
    from superset.tasks.guest import get_current_guest_subscriber_key

    _patch_guest(mocker, _guest_token())
    baseline = get_current_guest_subscriber_key()

    _patch_guest(mocker, _guest_token(some_unrelated_claim="whatever"))
    assert get_current_guest_subscriber_key() == baseline
