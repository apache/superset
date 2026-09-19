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

from datetime import datetime, timedelta
from typing import Any

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.key_value.models import KeyValueEntry
from superset.security import login_token
from superset.security.login_token import (
    DEFAULT_LOGIN_TOKEN_TTL_SECONDS,
    LoginTokenUserInfo,
)

USERINFO: LoginTokenUserInfo = {
    "username": "jdoe",
    "email": "jdoe@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "role_keys": ["Gamma"],
}


@pytest.fixture
def kv_table(session: Session) -> Session:
    """The key-value table, on the in-memory session the DAO is patched onto."""
    KeyValueEntry.metadata.create_all(session.get_bind())
    return session


def _set_resolver(value: Any) -> None:
    current_app.config["LOGIN_TOKEN_IDENTITY_RESOLVER"] = value


@pytest.mark.parametrize(
    "flag_on,resolver_set,expected",
    [
        (False, False, False),
        (False, True, False),
        (True, False, False),
        (True, True, True),
    ],
)
def test_is_enabled_requires_flag_and_resolver(
    app_context: None,
    mocker: MockerFixture,
    flag_on: bool,
    resolver_set: bool,
    expected: bool,
) -> None:
    """Both the feature flag and a resolver are needed; either alone is closed.

    The flag is patched rather than written to ``config["FEATURE_FLAGS"]``:
    ``FeatureFlagManager.init_app`` snapshots the merged flags at app
    initialization, so a runtime mutation of that dict has no effect.
    """
    original = current_app.config.get("LOGIN_TOKEN_IDENTITY_RESOLVER")
    mocker.patch("superset.is_feature_enabled", return_value=flag_on)
    try:
        _set_resolver((lambda request, **kwargs: USERINFO) if resolver_set else None)
        assert login_token.is_enabled() is expected
    finally:
        _set_resolver(original)


def test_get_ttl_seconds_falls_back(app_context: None) -> None:
    """A missing, non-numeric or non-positive TTL falls back to the default."""
    original = current_app.config.get("LOGIN_TOKEN_TTL_SECONDS")
    try:
        current_app.config["LOGIN_TOKEN_TTL_SECONDS"] = 30
        assert login_token.get_ttl_seconds() == 30

        # Strings (e.g. from an env var) are coerced rather than crashing.
        current_app.config["LOGIN_TOKEN_TTL_SECONDS"] = "45"  # noqa: S105
        assert login_token.get_ttl_seconds() == 45

        for bad in ("not-a-number", 0, -1, None):
            current_app.config["LOGIN_TOKEN_TTL_SECONDS"] = bad
            assert login_token.get_ttl_seconds() == DEFAULT_LOGIN_TOKEN_TTL_SECONDS
    finally:
        current_app.config["LOGIN_TOKEN_TTL_SECONDS"] = original


@pytest.mark.parametrize(
    "resolver,reason",
    [
        (None, "no resolver configured"),
        ("not-callable", "resolver is not callable"),
        (lambda request, **kwargs: None, "resolver declined"),
        (lambda request, **kwargs: {}, "resolver returned an empty dict"),
        (lambda request, **kwargs: {"first_name": "Jane"}, "no username or email"),
        # A truthy non-mapping must reject rather than raise on `.get` and
        # surface as a 500 — the contract is rejection, never a server error.
        (lambda request, **kwargs: "jdoe", "resolver returned a string"),
        (lambda request, **kwargs: ["jdoe"], "resolver returned a list"),
        (lambda request, **kwargs: object(), "resolver returned an opaque object"),
    ],
)
def test_resolve_identity_rejections(
    app_context: None, resolver: Any, reason: str
) -> None:
    """Every failure mode resolves to None rather than a partial identity."""
    original = current_app.config.get("LOGIN_TOKEN_IDENTITY_RESOLVER")
    try:
        _set_resolver(resolver)
        assert login_token.resolve_identity(object()) is None, reason
    finally:
        _set_resolver(original)


def test_resolve_identity_treats_a_raising_resolver_as_rejection(
    app_context: None,
) -> None:
    """A resolver that raises must reject, never surface as a server error.

    A validation failure escaping as a 500 would be indistinguishable from an
    outage, and a caller retrying could otherwise be treated as authenticated.
    """
    original = current_app.config.get("LOGIN_TOKEN_IDENTITY_RESOLVER")

    def boom(request: Any, **kwargs: Any) -> LoginTokenUserInfo:
        raise ValueError("bad signature")

    try:
        _set_resolver(boom)
        assert login_token.resolve_identity(object()) is None
    finally:
        _set_resolver(original)


def test_resolve_identity_accepts_email_only(app_context: None) -> None:
    """`email` alone is a valid identity — auth_user_oauth derives the username."""
    original = current_app.config.get("LOGIN_TOKEN_IDENTITY_RESOLVER")
    try:
        _set_resolver(lambda request, **kwargs: {"email": "jdoe@example.com"})
        assert login_token.resolve_identity(object()) == {"email": "jdoe@example.com"}
    finally:
        _set_resolver(original)


def test_mint_then_consume_round_trip(app_context: None, kv_table: Session) -> None:
    """A minted token returns exactly the stored userinfo."""
    token, expires_on = login_token.mint(USERINFO)

    assert token
    assert expires_on > datetime.now()
    assert login_token.consume(token) == USERINFO


def test_consume_is_single_use(app_context: None, kv_table: Session) -> None:
    """The second consume of the same token fails — the entry is deleted on use."""
    token, _ = login_token.mint(USERINFO)

    assert login_token.consume(token) == USERINFO
    assert login_token.consume(token) is None


def test_consume_rejects_unknown_and_malformed_tokens(
    app_context: None, kv_table: Session
) -> None:
    """Garbage and well-formed-but-unknown tokens are both rejected."""
    assert login_token.consume("") is None
    assert login_token.consume("not-a-uuid") is None
    assert login_token.consume("6d2b9921-2274-43b8-94d6-e5e1f05372c4") is None


def test_consume_rejects_an_expired_token(
    app_context: None, kv_table: Session, mocker: MockerFixture
) -> None:
    """An expired token is rejected and removed rather than left to the pruner."""
    mocker.patch.object(login_token, "get_ttl_seconds", return_value=1)
    token, _ = login_token.mint(USERINFO)

    # Move the stored expiry into the past rather than sleeping.
    entry = kv_table.query(KeyValueEntry).one()
    entry.expires_on = datetime.now() - timedelta(seconds=1)

    assert login_token.consume(token) is None
    assert kv_table.query(KeyValueEntry).count() == 0


def test_token_carries_no_identity_data(app_context: None, kv_table: Session) -> None:
    """The token is an opaque handle — no claims travel in the URL."""
    token, _ = login_token.mint(USERINFO)

    for value in ("jdoe", "jdoe@example.com", "Jane", "Doe", "Gamma"):
        assert value not in token


def test_consume_burn_survives_a_later_failure(
    app_context: None, kv_table: Session
) -> None:
    """The deletion must not be undone if provisioning fails afterwards.

    ``@transaction()`` does not nest, so the whole consume endpoint shares one
    unit of work: an exception escaping after ``consume`` would roll the delete
    back and make a token that has already been handed out redeemable again. The
    endpoint therefore catches provisioning failures rather than propagating
    them. This pins the invariant at the storage level -- once consumed, the
    entry is gone even if the caller then errors and the session is rolled back.
    """
    token, _ = login_token.mint(USERINFO)
    kv_table.commit()

    assert login_token.consume(token) == USERINFO
    kv_table.commit()

    # Simulate a caller that fails after consuming and rolls back.
    kv_table.rollback()

    assert kv_table.query(KeyValueEntry).count() == 0
    assert login_token.consume(token) is None
