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
import logging
import traceback
from datetime import datetime
from typing import cast

import pytest
from freezegun import freeze_time
from pytest_mock import MockerFixture
from sqlalchemy import Column, create_engine, DateTime, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from superset.db_engine_specs.base import BaseEngineSpec
from superset.exceptions import (
    OAuth2Error,
    OAuth2RedirectError,
    OAuth2TokenRefreshError,
)
from superset.superset_typing import OAuth2ClientConfig
from superset.utils.oauth2 import (
    check_for_oauth2,
    decode_oauth2_state,
    encode_oauth2_state,
    execute_with_oauth2_retry,
    generate_code_challenge,
    generate_code_verifier,
    get_oauth2_access_token,
    get_oauth2_redirect_uri,
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


def test_refresh_oauth2_token_force_refreshes_valid_token(
    mocker: MockerFixture,
) -> None:
    """A forced refresh must not reuse an unexpired access token."""
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.Session", return_value=db.session)
    mocker.patch("superset.utils.oauth2.DistributedLock")
    db_engine_spec = mocker.MagicMock()
    db_engine_spec.get_oauth2_fresh_token.return_value = {
        "access_token": "new-token",
        "expires_in": 3600,
    }
    token = mocker.MagicMock()
    token.access_token = "stale-token"  # noqa: S105
    token.access_token_expiration = datetime(2024, 1, 2)
    token.refresh_token = "refresh-token"  # noqa: S105
    db.session.query().populate_existing().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-01"):
        result = refresh_oauth2_token(
            DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec, force=True
        )

    assert result == "new-token"
    db_engine_spec.get_oauth2_fresh_token.assert_called_once_with(
        DUMMY_OAUTH2_CONFIG, "refresh-token"
    )
    db.session.commit.assert_called_once_with()


def test_force_refresh_reuses_concurrently_refreshed_token(
    mocker: MockerFixture,
) -> None:
    """A lock waiter must not exchange a rotated refresh token again."""
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.Session", return_value=db.session)
    mocker.patch("superset.utils.oauth2.DistributedLock")
    db_engine_spec = mocker.MagicMock()
    token = mocker.MagicMock(access_token="winning-token")  # noqa: S106
    db.session.query().populate_existing().filter_by().one_or_none.return_value = token

    result = refresh_oauth2_token(
        DUMMY_OAUTH2_CONFIG,
        1,
        1,
        db_engine_spec,
        force=True,
        rejected_access_token="rejected-token",  # noqa: S106
    )

    assert result == "winning-token"
    db_engine_spec.get_oauth2_fresh_token.assert_not_called()
    db.session.delete.assert_not_called()


def test_force_refresh_commits_deletion_without_refresh_token(
    mocker: MockerFixture,
) -> None:
    """The isolated forced-refresh session durably removes unusable rows."""
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.Session", return_value=db.session)
    mocker.patch("superset.utils.oauth2.DistributedLock")
    token = mocker.MagicMock(
        access_token="rejected-token",  # noqa: S106
        refresh_token=None,
    )
    db.session.query().populate_existing().filter_by().one_or_none.return_value = token

    result = refresh_oauth2_token(
        DUMMY_OAUTH2_CONFIG,
        1,
        1,
        mocker.MagicMock(),
        force=True,
        rejected_access_token="rejected-token",  # noqa: S106
    )

    assert result is None
    db.session.delete.assert_called_once_with(token)
    db.session.commit.assert_called_once_with()


def test_execute_with_oauth2_retry_forces_refresh_once(
    mocker: MockerFixture,
) -> None:
    """A tightly classified auth error triggers one refresh and one retry."""
    auth_error = RuntimeError("stale OAuth token")
    operation = mocker.Mock(side_effect=[auth_error, "result"])
    database = mocker.MagicMock()
    database.id = 1
    database.is_oauth2_enabled.return_value = True
    database.db_engine_spec.engine = "snowflake"
    database.db_engine_spec.needs_oauth2.return_value = True
    database.get_oauth2_config.return_value = DUMMY_OAUTH2_CONFIG
    mocker.patch("superset.utils.oauth2.g").user.id = 2
    db = mocker.patch("superset.utils.oauth2.db")
    token = mocker.MagicMock(access_token="stale-token")  # noqa: S106
    db.session.query().filter_by().one_or_none.return_value = token
    refresh = mocker.patch(
        "superset.utils.oauth2.refresh_oauth2_token", return_value="new-token"
    )

    assert execute_with_oauth2_retry(database, operation) == "result"

    assert operation.call_count == 2
    refresh.assert_called_once_with(
        DUMMY_OAUTH2_CONFIG,
        1,
        2,
        database.db_engine_spec,
        force=True,
        rejected_access_token="stale-token",  # noqa: S106
    )
    db.session.expire.assert_called_once_with(token)


def test_execute_with_oauth2_retry_expires_token_from_ambient_session(
    mocker: MockerFixture,
) -> None:
    """The retry observes a forced refresh committed by an isolated session."""
    base = declarative_base()

    class OAuthToken(base):  # type: ignore[valid-type,misc]
        __tablename__ = "oauth_token"

        id = Column(Integer, primary_key=True)
        user_id = Column(Integer, nullable=False)
        database_id = Column(Integer, nullable=False)
        access_token = Column(String, nullable=True)
        access_token_expiration = Column(DateTime, nullable=True)
        refresh_token = Column(String, nullable=True)

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    base.metadata.create_all(engine)
    ambient_session = sessionmaker(bind=engine)()
    ambient_session.add(
        OAuthToken(
            user_id=2,
            database_id=1,
            access_token="stale-token",  # noqa: S106
            access_token_expiration=datetime(2024, 1, 2),
            refresh_token="refresh-token",  # noqa: S106
        )
    )
    ambient_session.commit()

    db = mocker.patch("superset.utils.oauth2.db")
    db.session = ambient_session
    mocker.patch("superset.models.core.DatabaseUserOAuth2Tokens", OAuthToken)
    mocker.patch("superset.utils.oauth2.DistributedLock")
    mocker.patch("superset.utils.oauth2.g").user.id = 2

    auth_error = RuntimeError("stale OAuth token")
    observed_tokens: list[str | None] = []

    def operation() -> str:
        if not observed_tokens:
            observed_tokens.append(None)
            raise auth_error
        observed_tokens.append(
            ambient_session.query(OAuthToken)
            .filter_by(user_id=2, database_id=1)
            .one()
            .access_token
        )
        return "result"

    database = mocker.MagicMock(id=1)
    database.is_oauth2_enabled.return_value = True
    database.db_engine_spec.engine = "snowflake"
    database.db_engine_spec.needs_oauth2.return_value = True
    database.db_engine_spec.oauth2_exception = OAuth2TokenRefreshError
    database.db_engine_spec.get_oauth2_fresh_token.return_value = {
        "access_token": "new-token",
        "expires_in": 3600,
        "refresh_token": "rotated-refresh-token",
    }
    database.get_oauth2_config.return_value = DUMMY_OAUTH2_CONFIG

    assert execute_with_oauth2_retry(database, operation) == "result"
    assert observed_tokens == [None, "new-token"]


def test_execute_with_oauth2_retry_does_not_retry_unrelated_error(
    mocker: MockerFixture,
) -> None:
    """Network and other unclassified failures must not discard valid tokens."""
    network_error = RuntimeError("connection timed out")
    operation = mocker.Mock(side_effect=network_error)
    database = mocker.MagicMock()
    database.is_oauth2_enabled.return_value = True
    database.db_engine_spec.needs_oauth2.return_value = False
    db = mocker.patch("superset.utils.oauth2.db")
    db.session.query().filter_by().one_or_none.return_value = None
    refresh = mocker.patch("superset.utils.oauth2.refresh_oauth2_token")

    with pytest.raises(RuntimeError, match="connection timed out"):
        execute_with_oauth2_retry(database, operation)

    operation.assert_called_once_with()
    refresh.assert_not_called()


def test_execute_with_oauth2_retry_propagates_second_auth_error(
    mocker: MockerFixture,
) -> None:
    """A second authentication failure is surfaced without another refresh."""
    auth_error = RuntimeError("stale OAuth token")
    operation = mocker.Mock(side_effect=auth_error)
    database = mocker.MagicMock(id=1)
    database.is_oauth2_enabled.return_value = True
    database.db_engine_spec.needs_oauth2.return_value = True
    database.get_oauth2_config.return_value = DUMMY_OAUTH2_CONFIG
    mocker.patch("superset.utils.oauth2.g").user.id = 2
    db = mocker.patch("superset.utils.oauth2.db")
    db.session.query().filter_by().one_or_none.return_value = None
    refresh = mocker.patch(
        "superset.utils.oauth2.refresh_oauth2_token", return_value="new-token"
    )

    with pytest.raises(RuntimeError, match="stale OAuth token"):
        execute_with_oauth2_retry(database, operation)

    assert operation.call_count == 2
    refresh.assert_called_once()


def test_execute_with_oauth2_retry_does_not_replay_after_progress(
    mocker: MockerFixture,
) -> None:
    """Completed statements prevent replay of a multi-statement query."""
    auth_error = RuntimeError("stale OAuth token")
    operation = mocker.Mock(side_effect=auth_error)
    database = mocker.MagicMock(id=1)
    database.is_oauth2_enabled.return_value = True
    database.db_engine_spec.needs_oauth2.return_value = True
    mocker.patch("superset.utils.oauth2.g").user.id = 2
    db = mocker.patch("superset.utils.oauth2.db")
    db.session.query().filter_by().one_or_none.return_value = None
    refresh = mocker.patch("superset.utils.oauth2.refresh_oauth2_token")

    with pytest.raises(RuntimeError, match="stale OAuth token"):
        execute_with_oauth2_retry(database, operation, can_retry=lambda: False)

    operation.assert_called_once_with()
    refresh.assert_not_called()
    database.start_oauth2_dance.assert_called_once_with()


def test_refresh_oauth2_token_deletes_token_on_oauth2_exception(
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
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
    db_engine_spec.engine = "postgresql"
    db_engine_spec.oauth2_exception = OAuth2ExceptionError
    db_engine_spec.get_oauth2_fresh_token.side_effect = OAuth2ExceptionError(
        "provider-error-sentinel"
    )
    token = mocker.MagicMock()
    token.access_token = None
    token.refresh_token = "refresh-token-sentinel"  # noqa: S105
    db.session.query().filter_by().one_or_none.return_value = token

    with (
        caplog.at_level(logging.WARNING, logger="superset.utils.oauth2"),
        pytest.raises(OAuth2TokenRefreshError) as exc_info,
    ):
        refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec)

    db.session.delete.assert_called_with(token)
    db.session.flush.assert_called_once()
    assert (
        "OAuth2 token refresh failed: database_id=1 engine=postgresql "
        "error_type=OAuth2ExceptionError; deleting token"
    ) in caplog.messages
    assert "refresh-token-sentinel" not in caplog.text
    assert "provider-error-sentinel" not in caplog.text
    assert "provider-error-sentinel" not in "".join(
        traceback.format_exception(exc_info.value)
    )


def test_refresh_oauth2_token_starts_dance_for_vendor_exception(
    mocker: MockerFixture,
) -> None:
    """A sanitized vendor refresh failure must still start re-authentication."""
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.DistributedLock")

    class VendorOAuthError(Exception):
        pass

    class VendorEngineSpec(BaseEngineSpec):
        engine = "vendor"
        oauth2_exception = VendorOAuthError

    mocker.patch.object(
        VendorEngineSpec,
        "get_oauth2_fresh_token",
        side_effect=VendorOAuthError("provider-payload-sentinel"),
    )
    needs_oauth2 = mocker.patch.object(
        VendorEngineSpec,
        "needs_oauth2",
        return_value=False,
    )
    redirect = OAuth2RedirectError(
        "https://provider.example/authorize",
        "tab-id",
        "https://superset.example/oauth2/",
    )
    start_oauth2_dance = mocker.patch.object(
        VendorEngineSpec,
        "start_oauth2_dance",
        side_effect=redirect,
    )
    database = mocker.MagicMock()
    database.is_oauth2_enabled.return_value = True
    database.db_engine_spec = VendorEngineSpec
    token = mocker.MagicMock()
    token.access_token = None
    token.refresh_token = "refresh-token-sentinel"  # noqa: S105
    db.session.query().filter_by().one_or_none.return_value = token

    with pytest.raises(OAuth2RedirectError) as exc_info:
        with check_for_oauth2(database):
            refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, VendorEngineSpec)

    assert exc_info.value is redirect
    db.session.delete.assert_called_once_with(token)
    db.session.flush.assert_called_once()
    start_oauth2_dance.assert_called_once_with(database)
    needs_oauth2.assert_not_called()


def test_refresh_oauth2_token_keeps_token_on_other_exception(
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
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
    db_engine_spec.engine = "postgresql"
    db_engine_spec.oauth2_exception = OAuth2ExceptionError
    db_engine_spec.get_oauth2_fresh_token.side_effect = Exception(
        "Network error: provider-payload-sentinel"
    )
    token = mocker.MagicMock()
    token.access_token = None
    token.refresh_token = "refresh-token-sentinel"  # noqa: S105
    db.session.query().filter_by().one_or_none.return_value = token

    with (
        caplog.at_level(logging.ERROR, logger="superset.utils.oauth2"),
        pytest.raises(OAuth2Error) as exc_info,
    ):
        refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec)

    db.session.delete.assert_not_called()
    assert (
        "OAuth2 token refresh failed: database_id=1 engine=postgresql "
        "error_type=Exception"
    ) in caplog.messages
    assert "refresh-token-sentinel" not in caplog.text
    assert "provider-payload-sentinel" not in caplog.text
    assert "provider-payload-sentinel" not in "".join(
        traceback.format_exception(exc_info.value)
    )


def test_refresh_oauth2_token_no_access_token_in_response(
    mocker: MockerFixture,
) -> None:
    """
    Test that refresh_oauth2_token returns None when no access_token in response.

    This can happen when the refresh token was revoked.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.DistributedLock")
    db_engine_spec = mocker.MagicMock()
    db_engine_spec.get_oauth2_fresh_token.return_value = {
        "error": "invalid_grant",
    }
    token = mocker.MagicMock()
    token.access_token = None
    token.refresh_token = "refresh-token"  # noqa: S105
    db.session.query().filter_by().one_or_none.return_value = token

    result = refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec)

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
    token.access_token = None
    token.refresh_token = "old-refresh-token"  # noqa: S105
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-01"):
        refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec)

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
    token.access_token = None
    token.refresh_token = "original-refresh-token"  # noqa: S105
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-01"):
        refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec)

    assert token.access_token == "new-access-token"  # noqa: S105
    assert token.refresh_token == "original-refresh-token"  # noqa: S105
    db.session.add.assert_called_with(token)


def test_refresh_oauth2_token_refreshes_when_access_token_expired_under_lock(
    mocker: MockerFixture,
) -> None:
    """
    Test that refresh_oauth2_token triggers a refresh when the access_token is expired.

    When the re-query under the lock returns a token whose access_token has expired
    but a refresh_token is available, the function should call the token endpoint
    and persist the new access_token.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.DistributedLock")
    db_engine_spec = mocker.MagicMock()
    db_engine_spec.get_oauth2_fresh_token.return_value = {
        "access_token": "new-access-token",
        "expires_in": 3600,
    }
    token = mocker.MagicMock()
    token.access_token = "expired-token"  # noqa: S105
    token.access_token_expiration = datetime(2024, 1, 1)
    token.refresh_token = "refresh-token"  # noqa: S105
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-02"):
        result = refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec)

    assert result == "new-access-token"
    db_engine_spec.get_oauth2_fresh_token.assert_called_once_with(
        DUMMY_OAUTH2_CONFIG, "refresh-token"
    )
    db.session.add.assert_called_with(token)


def test_refresh_oauth2_token_returns_existing_token_when_still_valid_under_lock(
    mocker: MockerFixture,
) -> None:
    """
    Test that refresh_oauth2_token returns the existing access_token if still valid.

    When concurrent requests are triggered and the first one refreshes the token and
    releases the lock before the second one gets to `refresh_oauth2_token`, the second
    request should pick up the already-refreshed access_token instead of refreshing
    it again.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.DistributedLock")
    db_engine_spec = mocker.MagicMock()
    token = mocker.MagicMock()
    token.access_token = "fresh-access-token"  # noqa: S105
    token.access_token_expiration = datetime(2024, 1, 2)
    token.refresh_token = "refresh-token"  # noqa: S105
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-01"):
        result = refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec)

    assert result == "fresh-access-token"
    db_engine_spec.get_oauth2_fresh_token.assert_not_called()
    db.session.delete.assert_not_called()


def test_refresh_oauth2_token_deletes_when_no_refresh_token_under_lock(
    mocker: MockerFixture,
) -> None:
    """
    Test that refresh_oauth2_token deletes the row when there's no refresh_token.

    When the token has expired and the re-query under the lock shows no refresh_token
    is available, the row should be deleted and None returned so the caller can
    trigger the OAuth2 dance.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.DistributedLock")
    db_engine_spec = mocker.MagicMock()
    token = mocker.MagicMock()
    token.access_token = "expired-token"  # noqa: S105
    token.access_token_expiration = datetime(2024, 1, 1)
    token.refresh_token = None
    db.session.query().filter_by().one_or_none.return_value = token

    with freeze_time("2024-01-02"):
        result = refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec)

    assert result is None
    db.session.delete.assert_called_with(token)
    db_engine_spec.get_oauth2_fresh_token.assert_not_called()


def test_refresh_oauth2_token_returns_none_when_row_deleted_under_lock(
    mocker: MockerFixture,
) -> None:
    """
    Test that refresh_oauth2_token returns None when the row is gone under the lock.

    When concurrent requests are triggered and the first one deletes the token row and
    releases the lock before the second one gets to `refresh_oauth2_token`, the token
    is queried again to avoid a stale reference.
    """
    db = mocker.patch("superset.utils.oauth2.db")
    mocker.patch("superset.utils.oauth2.DistributedLock")
    db_engine_spec = mocker.MagicMock()
    db.session.query().filter_by().one_or_none.return_value = None

    result = refresh_oauth2_token(DUMMY_OAUTH2_CONFIG, 1, 1, db_engine_spec)

    assert result is None
    db_engine_spec.get_oauth2_fresh_token.assert_not_called()


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


def test_get_oauth2_access_token_lock_not_acquired_no_error_log(
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """
    Test that when a distributed lock can't be acquired, no error is logged and
    the function returns None instead of raising.

    This scenario occurs when a dashboard with multiple charts from the same
    OAuth2-enabled DB has an expired token: simultaneous requests compete for
    the lock, and only the first one wins. The rest should silently return None.
    """
    import logging

    from superset.exceptions import AcquireDistributedLockFailedException

    mocker.patch("time.sleep")  # avoid backoff delays in tests

    db = mocker.patch("superset.utils.oauth2.db")
    db_engine_spec = mocker.MagicMock()
    token = mocker.MagicMock()
    token.access_token = "access-token"  # noqa: S105
    token.access_token_expiration = datetime(2024, 1, 1)
    token.refresh_token = "refresh-token"  # noqa: S105
    db.session.query().filter_by().one_or_none.return_value = token

    mocker.patch(
        "superset.utils.oauth2.refresh_oauth2_token",
        side_effect=AcquireDistributedLockFailedException("Lock not available"),
    )

    with freeze_time("2024-01-02"):
        with caplog.at_level(logging.DEBUG):
            result = get_oauth2_access_token({}, 1, 1, db_engine_spec)

    assert result is None
    assert not any(record.levelno >= logging.ERROR for record in caplog.records)


def test_get_oauth2_redirect_uri_from_config(mocker: MockerFixture) -> None:
    """
    Test that get_oauth2_redirect_uri returns the configured value when set.
    """
    custom_uri = "https://proxy.example.com/oauth2/"
    mocker.patch(
        "flask.current_app.config",
        {"DATABASE_OAUTH2_REDIRECT_URI": custom_uri},
    )
    assert get_oauth2_redirect_uri() == custom_uri


def test_get_oauth2_redirect_uri_falls_back_to_url_for(mocker: MockerFixture) -> None:
    """
    Test that get_oauth2_redirect_uri falls back to url_for when config is not set.
    """
    fallback_uri = "http://localhost:8088/api/v1/database/oauth2/"
    mocker.patch("flask.current_app.config", {})
    mocker.patch(
        "superset.utils.oauth2.url_for",
        return_value=fallback_uri,
    )
    assert get_oauth2_redirect_uri() == fallback_uri


def test_get_oauth2_redirect_uri_raises_on_build_error(
    mocker: MockerFixture,
) -> None:
    """
    Test that get_oauth2_redirect_uri raises OAuth2Error when url_for raises
    BuildError (e.g. in headless/MCP contexts).
    """
    from werkzeug.routing import BuildError

    from superset.exceptions import OAuth2Error

    mocker.patch("flask.current_app.config", {})
    mocker.patch(
        "superset.utils.oauth2.url_for",
        side_effect=BuildError("DatabaseRestApi.oauth2", {}, ("GET",)),
    )
    with pytest.raises(OAuth2Error):
        get_oauth2_redirect_uri()


def test_get_oauth2_redirect_uri_raises_on_runtime_error(
    mocker: MockerFixture,
) -> None:
    """
    Test that get_oauth2_redirect_uri raises OAuth2Error when url_for raises
    RuntimeError (e.g. no request context and no SERVER_NAME).
    """
    from superset.exceptions import OAuth2Error

    mocker.patch("flask.current_app.config", {})
    mocker.patch(
        "superset.utils.oauth2.url_for",
        side_effect=RuntimeError("Unable to build URL outside of request context"),
    )
    with pytest.raises(OAuth2Error):
        get_oauth2_redirect_uri()
