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

import os
import subprocess
import sys
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.daos.key_value import KeyValueDAO
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


@pytest.mark.parametrize(
    "resolved,expected",
    [
        # The key must be dropped, not merely falsy: auth_user_oauth branches on
        # `if "username" in userinfo`, so an empty value still wins over the
        # email and is then rejected, 401ing a token that was minted happily.
        (
            {"username": "", "email": "jdoe@example.com"},
            {"email": "jdoe@example.com"},
        ),
        (
            {"username": "   ", "email": "jdoe@example.com"},
            {"email": "jdoe@example.com"},
        ),
        # None is the same key-present-but-unusable shape, and the common one:
        # `claims.get("preferred_username")` with the claim absent.
        (
            {"username": None, "email": "jdoe@example.com"},
            {"email": "jdoe@example.com"},
        ),
        (
            {"username": "jdoe", "first_name": None},
            {"username": "jdoe"},
        ),
        # Padding is PRESERVED, never trimmed. Usernames are unique but may
        # legally contain surrounding whitespace, so trimming " admin " to
        # "admin" would authenticate a different account if both exist --
        # find_user folds case but never trims. Only the resolver knows which.
        ({"username": "  jdoe  "}, {"username": "  jdoe  "}),
        ({"username": " admin "}, {"username": " admin "}),
        ({"email": "  jdoe@example.com  "}, {"email": "  jdoe@example.com  "}),
        # Empty optional fields are dropped too, rather than stored and later
        # written onto the user record as blanks.
        (
            {"username": "jdoe", "first_name": "", "last_name": "Doe"},
            {"username": "jdoe", "last_name": "Doe"},
        ),
        # Non-string values are passed through untouched.
        (
            {"username": "jdoe", "role_keys": ["Gamma"]},
            {"username": "jdoe", "role_keys": ["Gamma"]},
        ),
    ],
)
def test_resolve_identity_normalizes_empty_identity_keys(
    app_context: None, resolved: dict[str, Any], expected: dict[str, Any]
) -> None:
    """Empty identity values are stripped away before a token is ever minted."""
    original = current_app.config.get("LOGIN_TOKEN_IDENTITY_RESOLVER")
    try:
        _set_resolver(lambda request, **kwargs: resolved)
        assert login_token.resolve_identity(object()) == expected
    finally:
        _set_resolver(original)


@pytest.mark.parametrize(
    "resolved",
    [
        {"username": "", "email": ""},
        {"username": "   ", "email": "  "},
        {"username": None, "email": None},
        {"username": ""},
        {"email": ""},
    ],
)
def test_resolve_identity_rejects_only_empty_identifiers(
    app_context: None, resolved: dict[str, Any]
) -> None:
    """If nothing usable survives normalization, reject rather than mint."""
    original = current_app.config.get("LOGIN_TOKEN_IDENTITY_RESOLVER")
    try:
        _set_resolver(lambda request, **kwargs: resolved)
        assert login_token.resolve_identity(object()) is None
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


def test_consume_rejects_the_loser_of_a_concurrent_claim(
    app_context: None, kv_table: Session, mocker: MockerFixture
) -> None:
    """Only the request whose DELETE removed the row gets the identity.

    The read cannot be the gate. On SQLite -- the default metastore --
    ``with_for_update`` compiles to nothing, so two overlapping requests both
    read and decode the same entry; and ``KeyValueDAO.delete_entry`` returns the
    result of its own ``SELECT``, not of the write, so both would be told the
    burn succeeded and both would establish a session from one token.

    The interleaving is forced rather than raced: a competitor removes and
    commits the row after this request has read it but before it deletes, which
    is exactly the window the row lock does not cover on SQLite.
    """
    token, _ = login_token.mint(USERINFO)
    kv_table.commit()

    real_get_entry = KeyValueDAO.get_entry

    def read_then_lose_the_row(*args: Any, **kwargs: Any) -> Any:
        entry = real_get_entry(*args, **kwargs)
        # The competing request wins the claim and commits.
        kv_table.query(KeyValueEntry).filter_by(uuid=UUID(token)).delete()
        kv_table.commit()
        return entry

    mocker.patch.object(KeyValueDAO, "get_entry", side_effect=read_then_lose_the_row)

    assert login_token.consume(token) is None
    assert kv_table.query(KeyValueEntry).count() == 0


def test_consume_burn_survives_a_later_rollback(
    app_context: None, kv_table: Session
) -> None:
    """A rollback after ``consume`` must not resurrect the token.

    This is the ordering that matters, and the reason ``consume`` commits rather
    than leaving the delete pending. Flask-AppBuilder's ``add_user`` /
    ``update_user`` catch their own failures, call ``rollback()`` on this same
    session and return ``False`` without raising, and
    ``update_user_auth_stat`` ignores that return value -- so a provisioning
    error, or a failing ``user_updating`` handler, rolls back whatever the
    endpoint had pending. If the burn were not already committed, a token
    already handed to a browser would become redeemable again.

    The mint is committed first, deliberately. Without that, the rollback would
    discard the insert along with the delete and the assertions below would hold
    even with the burn left pending -- passing for the wrong reason. See
    ``tests/integration_tests/security/login_token_api_tests.py`` for the same
    property through the real endpoint and the real security manager.
    """
    token, _ = login_token.mint(USERINFO)
    # The token exists as far as any other transaction is concerned; that is the
    # state a browser holding it is in.
    kv_table.commit()

    assert login_token.consume(token) == USERINFO

    # Exactly what FAB does internally on a provisioning failure.
    kv_table.rollback()

    assert kv_table.query(KeyValueEntry).count() == 0
    assert login_token.consume(token) is None


@pytest.mark.parametrize(
    "path",
    [
        "/",
        "/dashboard/1/",
        "/sqllab/",
        "/dashboard/list/?pageIndex=0",
        "/dashboard/1/#anchor",
    ],
)
def test_is_safe_next_path_accepts_relative_paths(path: str) -> None:
    """A site-relative path is what the parent application is expected to send."""
    assert login_token.is_safe_next_path(path) is True


@pytest.mark.parametrize(
    "path",
    [
        "",
        "   ",
        # Absolute, including the deployment's own origin: relative-only by
        # contract, so there is no host comparison to get wrong.
        "https://superset.example.com/dashboard/1/",
        "http://evil.example.com/",
        # Protocol-relative, and the backslash variants browsers normalize to it.
        "//evil.example.com/",
        "/\\evil.example.com/",
        "\\\\evil.example.com/",
        # Control characters a URL parser strips, raw and percent-encoded.
        # Rejected outright rather than stripped: the value checked must be the
        # value redirected to. A surviving CR/LF reaches `redirect()`, which
        # Werkzeug refuses with a ValueError -- a 500 after the token is burned.
        "/\t/evil.example.com",
        "/%09/evil.example.com",
        "/\tdashboard",
        "/dashboard/1/\r\nX-Injected: yes",
        "/\ndashboard/",
        "/%0Adashboard/",
        "/%0D%0Adashboard/",
        # Schemes that never start with a slash.
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "mailto:someone@example.com",
        # Relative but not site-rooted.
        "dashboard/1/",
        "../dashboard/1/",
    ],
)
def test_is_safe_next_path_rejects_everything_else(path: str) -> None:
    """Anything that is not unambiguously a single-slash-rooted path is refused."""
    assert login_token.is_safe_next_path(path) is False


def test_module_is_importable_without_an_initialized_app() -> None:
    """``superset_config.py`` must be able to import this module.

    The documented way to write a resolver begins with ``from
    superset.security.login_token import LoginTokenUserInfo``, and the config is
    read before the app exists. A module-scope import of the key-value DAO or its
    model reaches ``superset.models.core``, which builds encrypted columns and
    ``relationship(security_manager.user_model, ...)`` at class-definition time
    and raises "App not initialized yet" -- so following the documentation would
    break startup.

    Run in a subprocess deliberately: by the time this suite runs, the app and
    the models are already imported, so an in-process import would pass whether
    or not the dependency exists.
    """
    result = subprocess.run(  # noqa: S603
        [
            sys.executable,
            "-c",
            "from superset.security.login_token import LoginTokenUserInfo; "
            "print(sorted(LoginTokenUserInfo.__annotations__))",
        ],
        capture_output=True,
        text=True,
        check=False,
        env={**os.environ, "SUPERSET_CONFIG": "", "SUPERSET_CONFIG_PATH": ""},
    )
    assert result.returncode == 0, (
        "superset.security.login_token is not importable without an app, so the "
        f"documented resolver example would break startup:\n{result.stderr[-2000:]}"
    )
    assert "username" in result.stdout
