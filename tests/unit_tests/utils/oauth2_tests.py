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

from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.utils.oauth2 import (
    decode_oauth2_state,
    encode_oauth2_state,
    generate_code_challenge,
    generate_code_verifier,
    get_oauth2_access_token,
)


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


def test_encode_decode_oauth2_state_with_code_verifier(mocker: MockerFixture) -> None:
    """
    Test that code_verifier is preserved through encode/decode cycle.
    """
    from superset.superset_typing import OAuth2State

    mocker.patch(
        "flask.current_app.config",
        {
            "SECRET_KEY": "test-secret-key",
            "DATABASE_OAUTH2_JWT_ALGORITHM": "HS256",
        },
    )

    code_verifier = generate_code_verifier()
    state: OAuth2State = {
        "database_id": 1,
        "user_id": 2,
        "default_redirect_uri": "http://localhost:8088/api/v1/oauth2/",
        "tab_id": "test-tab-id",
        "code_verifier": code_verifier,
    }

    with freeze_time("2024-01-01"):
        encoded = encode_oauth2_state(state)
        decoded = decode_oauth2_state(encoded)

    assert decoded["code_verifier"] == code_verifier
    assert decoded["database_id"] == 1
    assert decoded["user_id"] == 2


def test_encode_decode_oauth2_state_without_code_verifier(
    mocker: MockerFixture,
) -> None:
    """
    Test backward compatibility: state without code_verifier still works.
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
