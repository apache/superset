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

# pylint: disable=invalid-name, disallowed-name

import base64
import hashlib
from datetime import datetime
from typing import cast

import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.superset_typing import OAuth2ClientConfig
from superset.utils.oauth2 import (
    get_access_token_for_database,
    get_oauth2_access_token,
    get_upstream_provider_token,
    refresh_oauth2_token,
)

DUMMY_OAUTH2_CONFIG = cast(OAuth2ClientConfig, {})


def test_get_oauth2_access_token_base_no_token(mocker: MockerFixture) -> None:
    """
    Test `get_oauth2_access_token` when there's no token.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    db_engine_spec = mocker.MagicMock()
    db.session.query().filter_by().one_or_none.return_value = None

    assert get_oauth2_access_token({}, 1, 1, db_engine_spec) is None


def test_get_oauth2_access_token_base_token_valid(mocker: MockerFixture) -> None:
    """
    Test `get_oauth2_access_token` when the token is valid.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    db_engine_spec = mocker.MagicMock()
    token = mocker.MagicMock()
    token.access_token = "access-token"  # noqa: S105
    token.access_token_expiration = datetime(2024, 1, 2)
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-01"):
        assert get_oauth2_access_token({}, 1, 1, db_engine_spec) == "access-token"


def test_get_oauth2_access_token_base_refresh(mocker: MockerFixture) -> None:
    """
    Test `get_oauth2_access_token` when the token needs to be refreshed.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    db_engine_spec = mocker.MagicMock()
    db_engine_spec.get_oauth2_fresh_token.return_value = {
        "access_token": "new-token",
        "expires_in": 3600,
    }
    token = mocker.MagicMock()
    token.access_token = "access-token"  # noqa: S105
    token.access_token_expiration = datetime(2024, 1, 1)
    token.refresh_token = "refresh-token"  # noqa: S105
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-02"):
        assert get_oauth2_access_token({}, 1, 1, db_engine_spec) == "new-token"

    # check that token was updated
    assert token.access_token == "new-token"  # noqa: S105
    assert token.access_token_expiration == datetime(2024, 1, 2, 1)
    db.session.add.assert_called_with(token)


def test_get_oauth2_access_token_base_no_refresh(mocker: MockerFixture) -> None:
    """
    Test `get_oauth2_access_token` when token is expired and there's no refresh.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    db_engine_spec = mocker.MagicMock()
    token = mocker.MagicMock()
    token.access_token = "access-token"  # noqa: S105
    token.access_token_expiration = datetime(2024, 1, 1)
    token.refresh_token = None
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-02"):
        assert get_oauth2_access_token({}, 1, 1, db_engine_spec) is None

    # check that token was deleted
    db.session.delete.assert_called_with(token)


def test_refresh_oauth2_token_deletes_token_on_oauth2_exception(
    mocker: MockerFixture,
) -> None:
    """
    Test that refresh_oauth2_token deletes the token on OAuth2-specific exception.

    When the token refresh fails with an OAuth2-specific exception (e.g., token
    was revoked), the invalid token should be deleted and the exception re-raised.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.DistributedLock")

    class OAuth2ExceptionError(Exception):
        pass

    db_engine_spec = mocker.MagicMock()
    db_engine_spec.oauth2_exception = OAuth2ExceptionError
    db_engine_spec.get_oauth2_fresh_token.side_effect = OAuth2ExceptionError(
        "Token revoked"
    )
    token = mocker.MagicMock()
    token.refresh_token = "refresh-token"  # noqa: S105

    with pytest.raises(OAuth2ExceptionError):
        refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec, token)

    db.session.delete.assert_called_with(token)


def test_refresh_oauth2_token_keeps_token_on_other_exception(
    mocker: MockerFixture,
) -> None:
    """
    Test that refresh_oauth2_token keeps the token on non-OAuth2 exceptions.

    When the token refresh fails with a transient error (e.g., network issue),
    the token should be kept (refresh token may still be valid) and the
    exception re-raised.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.DistributedLock")

    class OAuth2ExceptionError(Exception):
        pass

    db_engine_spec = mocker.MagicMock()
    db_engine_spec.oauth2_exception = OAuth2ExceptionError
    db_engine_spec.get_oauth2_fresh_token.side_effect = Exception("Network error")
    token = mocker.MagicMock()
    token.refresh_token = "refresh-token"  # noqa: S105

    with pytest.raises(Exception, match="Network error"):
        refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec, token)

    db.session.delete.assert_not_called()


def test_refresh_oauth2_token_no_access_token_in_response(
    mocker: MockerFixture,
) -> None:
    """
    Test that refresh_oauth2_token returns None when no access_token in response.

    This can happen when the refresh token was revoked.
    """
    mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.DistributedLock")
    db_engine_spec = mocker.MagicMock()
    db_engine_spec.get_oauth2_fresh_token.return_value = {
        "error": "invalid_grant",
    }
    token = mocker.MagicMock()
    token.refresh_token = "refresh-token"  # noqa: S105

    result = refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec, token)

    assert result is None


def test_refresh_oauth2_token_updates_refresh_token(
    mocker: MockerFixture,
) -> None:
    """
    Test that refresh_oauth2_token updates the refresh token when a new one is returned.

    Some OAuth2 providers issue single-use refresh tokens, where each token refresh
    response includes a new refresh token that replaces the previous one.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.DistributedLock")
    db_engine_spec = mocker.MagicMock()
    db_engine_spec.get_oauth2_fresh_token.return_value = {
        "access_token": "new-access-token",
        "expires_in": 3600,
        "refresh_token": "new-refresh-token",
    }
    token = mocker.MagicMock()
    token.refresh_token = "old-refresh-token"  # noqa: S105

    with freeze_time("2024-01-01"):
        refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec, token)

    assert token.access_token == "new-access-token"  # noqa: S105
    assert token.access_token_expiration == datetime(2024, 1, 1, 1)
    assert token.refresh_token == "new-refresh-token"  # noqa: S105
    db.session.add.assert_called_with(token)


def test_refresh_oauth2_token_keeps_refresh_token(
    mocker: MockerFixture,
) -> None:
    """
    Test that refresh_oauth2_token keeps the existing refresh token when none returned.

    When the OAuth2 provider does not issue a new refresh token in the response,
    the original refresh token should be preserved.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.DistributedLock")
    db_engine_spec = mocker.MagicMock()
    db_engine_spec.get_oauth2_fresh_token.return_value = {
        "access_token": "new-access-token",
        "expires_in": 3600,
    }
    token = mocker.MagicMock()
    token.refresh_token = "original-refresh-token"  # noqa: S105

    with freeze_time("2024-01-01"):
        refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec, token)

    assert token.access_token == "new-access-token"  # noqa: S105
    assert token.refresh_token == "original-refresh-token"  # noqa: S105
    db.session.add.assert_called_with(token)


def test_generate_code_verifier_length() -> None:
    """
    Test that generate_code_verifier produces a string of valid length (RFC 7636).
    """
    code_verifier = generate_code_verifier()
    # RFC 7636 requires 43-128 characters
    assert 43 <= len(code_verifier) <= 128


def test_generate_code_verifier_uniqueness() -> None:
    """
    Test that generate_code_verifier produces unique values.
    """
    verifiers = {generate_code_verifier() for _ in range(100)}
    # All generated verifiers should be unique
    assert len(verifiers) == 100


def test_generate_code_verifier_valid_characters() -> None:
    """
    Test that generate_code_verifier only uses valid characters (RFC 7636).
    """
    code_verifier = generate_code_verifier()
    # RFC 7636 allows: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
    # URL-safe base64 uses: [A-Z] / [a-z] / [0-9] / "-" / "_"
    valid_chars = set(
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    )
    assert all(char in valid_chars for char in code_verifier)


def test_generate_code_challenge_s256() -> None:
    """
    Test that generate_code_challenge produces correct S256 challenge.
    """
    # Use a known code_verifier to verify the challenge computation
    code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"

    # Compute expected challenge manually
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    expected_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")

    code_challenge = generate_code_challenge(code_verifier)
    assert code_challenge == expected_challenge


def test_generate_code_challenge_rfc_example() -> None:
    """
    Test PKCE code challenge against RFC 7636 Appendix B example.

    See: https://datatracker.ietf.org/doc/html/rfc7636#appendix-B
    """
    # RFC 7636 example code_verifier (Appendix B)
    code_verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    # RFC 7636 expected code_challenge for S256 method
    expected_challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"

    code_challenge = generate_code_challenge(code_verifier)
    assert code_challenge == expected_challenge


def test_encode_decode_oauth2_state(
    mocker: MockerFixture,
) -> None:
    """
    Test that encode/decode cycle preserves state fields.
    """
    from superset.superset_typing import OAuth2State

    mocker.patch(
        "flask.current_app.config",
        {
            "SECRET_KEY": "test-secret-key",
            "DATABASE_OAUTH2_JWT_ALGORITHM": "HS256",
        },
    )

    state: OAuth2State = {
        "database_id": 1,
        "user_id": 2,
        "default_redirect_uri": "http://localhost:8088/api/v1/oauth2/",
        "tab_id": "test-tab-id",
    }

    with freeze_time("2024-01-01"):
        encoded = encode_oauth2_state(state)
        decoded = decode_oauth2_state(encoded)

    assert "code_verifier" not in decoded
    assert decoded["database_id"] == 1
    assert decoded["user_id"] == 2


# ---- Upstream provider token tests ----


def test_get_upstream_provider_token_valid(mocker: MockerFixture) -> None:
    """
    Test `get_upstream_provider_token` returns the access token when it is valid.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    token = mocker.MagicMock()
    token.access_token = "valid-token"  # noqa: S105
    token.access_token_expiration = datetime(2024, 1, 2)
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-01"):
        result = get_upstream_provider_token("keycloak", 1)

    assert result == "valid-token"


def test_get_upstream_provider_token_expired_no_refresh(mocker: MockerFixture) -> None:
    """
    Test `get_upstream_provider_token` deletes the record and returns None when
    the token is expired and there is no refresh token.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    token = mocker.MagicMock()
    token.access_token = "expired-token"  # noqa: S105
    token.access_token_expiration = datetime(2024, 1, 1)
    token.refresh_token = None
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-02"):
        result = get_upstream_provider_token("keycloak", 1)

    assert result is None
    db.session.delete.assert_called_once_with(token)
    db.session.commit.assert_called_once()


def test_get_upstream_provider_token_expired_calls_refresh(
    mocker: MockerFixture,
) -> None:
    """
    Test `get_upstream_provider_token` calls the refresh path when the token
    is expired but a refresh token is present.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    token = mocker.MagicMock()
    token.access_token = "expired-token"  # noqa: S105
    token.access_token_expiration = datetime(2024, 1, 1)
    token.refresh_token = "refresh-tok"  # noqa: S105
    db.session.query().filter_by().one_or_none.return_value = token

    refresh_mock = mocker.patch(
        "superset.utils.oauth2._refresh_upstream_provider_token",
        return_value="new-token",
    )

    with freeze_time("2024-01-02"):
        result = get_upstream_provider_token("keycloak", 1)

    assert result == "new-token"
    refresh_mock.assert_called_once_with(token, "keycloak")


# ---- get_access_token_for_database tests ----


def test_get_access_token_for_database_upstream_provider(
    mocker: MockerFixture,
) -> None:
    """
    Test that `get_access_token_for_database` uses the upstream provider token
    when ``oauth2_upstream_provider`` is set in extra.
    """
    database = mocker.MagicMock()
    database.get_extra.return_value = {
        "oauth2_upstream_provider": "keycloak",
    }

    upstream_mock = mocker.patch(
        "superset.utils.oauth2.get_upstream_provider_token",
        return_value="upstream-token",
    )

    result = get_access_token_for_database(database, user_id=1)

    assert result == "upstream-token"
    upstream_mock.assert_called_once_with("keycloak", 1)
    database.get_oauth2_config.assert_not_called()


def test_get_access_token_for_database_db_specific_oauth2(
    mocker: MockerFixture,
) -> None:
    """
    Test that `get_access_token_for_database` falls back to database-specific
    OAuth2 when no upstream provider is configured.
    """
    database = mocker.MagicMock()
    database.get_extra.return_value = {}
    database.get_oauth2_config.return_value = {"id": "client-id"}
    database.id = 42
    database.db_engine_spec = mocker.MagicMock()

    oauth2_mock = mocker.patch(
        "superset.utils.oauth2.get_oauth2_access_token",
        return_value="db-token",
    )

    result = get_access_token_for_database(database, user_id=1)

    assert result == "db-token"
    oauth2_mock.assert_called_once_with(
        {"id": "client-id"}, 42, 1, database.db_engine_spec
    )


def test_get_access_token_for_database_no_oauth(mocker: MockerFixture) -> None:
    """
    Test that `get_access_token_for_database` returns None when neither upstream
    provider nor database-specific OAuth2 is configured.
    """
    database = mocker.MagicMock()
    database.get_extra.return_value = {}
    database.get_oauth2_config.return_value = None

    result = get_access_token_for_database(database, user_id=1)

    assert result is None
