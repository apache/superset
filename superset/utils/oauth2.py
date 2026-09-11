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

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterator, TYPE_CHECKING, TypeVar

import backoff
import jwt
from flask import current_app as app, g, url_for
from marshmallow import EXCLUDE, fields, post_load, Schema, validate
from sqlalchemy.orm import Session
from werkzeug.routing import BuildError

from superset import db
from superset.distributed_lock import DistributedLock
from superset.exceptions import (
    AcquireDistributedLockFailedException,
    OAuth2Error,
    OAuth2TokenRefreshError,
)
from superset.superset_typing import OAuth2ClientConfig, OAuth2State

if TYPE_CHECKING:
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.models.core import Database

JWT_EXPIRATION = timedelta(minutes=5)

logger = logging.getLogger(__name__)
T = TypeVar("T")
_oauth2_retry_active: ContextVar[bool] = ContextVar(
    "oauth2_retry_active", default=False
)

# PKCE code verifier length (RFC 7636 recommends 43-128 characters)
PKCE_CODE_VERIFIER_LENGTH = 64


def generate_code_verifier() -> str:
    """
    Generate a PKCE code verifier (RFC 7636).

    The code verifier is a high-entropy cryptographic random string using
    unreserved characters [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~",
    with a minimum length of 43 characters and a maximum length of 128.
    """
    # Generate random bytes and encode as URL-safe base64
    random_bytes = secrets.token_bytes(PKCE_CODE_VERIFIER_LENGTH)
    # Use URL-safe base64 encoding without padding
    code_verifier = base64.urlsafe_b64encode(random_bytes).rstrip(b"=").decode("ascii")
    return code_verifier


def generate_code_challenge(code_verifier: str) -> str:
    """
    Generate a PKCE code challenge from a code verifier (RFC 7636).

    Uses the S256 method: BASE64URL(SHA256(code_verifier))
    """
    # Compute SHA-256 hash of the code verifier
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    # Encode as URL-safe base64 without padding
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return code_challenge


@backoff.on_exception(
    backoff.expo,
    AcquireDistributedLockFailedException,
    factor=0.1,
    base=2,
    max_tries=8,
    raise_on_giveup=False,
    giveup_log_level=logging.DEBUG,
)
def get_oauth2_access_token(
    config: OAuth2ClientConfig,
    database_id: int,
    user_id: int,
    db_engine_spec: type[BaseEngineSpec],
) -> str | None:
    """
    Return a valid OAuth2 access token.

    If the token exists but is expired and a refresh token is available the function will
    return a fresh token and store it in the database for further requests. The function
    has a retry decorator, in case a dashboard with multiple charts triggers
    simultaneous requests for refreshing a stale token; in that case only the first
    process to acquire the lock will perform the refresh, and other processes should find
    a valid token when they retry.
    """  # noqa: E501
    # pylint: disable=import-outside-toplevel
    from superset.models.core import DatabaseUserOAuth2Tokens

    token = (
        db.session.query(DatabaseUserOAuth2Tokens)
        .filter_by(user_id=user_id, database_id=database_id)
        .one_or_none()
    )
    if token is None:
        return None

    if token.access_token and datetime.now() < token.access_token_expiration:
        return token.access_token

    if token.refresh_token:
        return refresh_oauth2_token(config, database_id, user_id, db_engine_spec)

    # since the access token is expired and there's no refresh token, delete the entry
    db.session.delete(token)

    return None


def refresh_oauth2_token(  # noqa: C901
    config: OAuth2ClientConfig,
    database_id: int,
    user_id: int,
    db_engine_spec: type[BaseEngineSpec],
    *,
    force: bool = False,
    rejected_access_token: str | None = None,
) -> str | None:
    # Forced refreshes use an isolated transaction so rotated tokens become durable
    # without committing unrelated work in the caller's scoped session.
    token_session = Session(bind=db.session.get_bind()) if force else db.session
    try:
        return _refresh_oauth2_token_locked(
            config,
            database_id,
            user_id,
            db_engine_spec,
            token_session,
            force=force,
            rejected_access_token=rejected_access_token,
        )
    finally:
        if force:
            token_session.close()


def _refresh_oauth2_token_locked(  # noqa: C901
    config: OAuth2ClientConfig,
    database_id: int,
    user_id: int,
    db_engine_spec: type[BaseEngineSpec],
    token_session: Session,
    *,
    force: bool,
    rejected_access_token: str | None,
) -> str | None:
    """Refresh a token while serializing and durably persisting the exchange."""
    # pylint: disable=import-outside-toplevel
    from superset.models.core import DatabaseUserOAuth2Tokens

    # Use longer TTL for OAuth2 token refresh (may involve network calls)
    with DistributedLock(
        namespace="refresh_oauth2_token",
        ttl_seconds=30,
        user_id=user_id,
        database_id=database_id,
    ):
        # Short circuit in case another request already deleted the token
        query = token_session.query(DatabaseUserOAuth2Tokens)
        if force:
            query = query.populate_existing()
        token = query.filter_by(user_id=user_id, database_id=database_id).one_or_none()
        if token is None:
            return None

        # Another request may have refreshed the token while this caller waited
        # for the distributed lock. Reuse the winner rather than exchanging a
        # rotating/single-use refresh token again.
        if (
            force
            and rejected_access_token is not None
            and token.access_token != rejected_access_token
        ):
            return token.access_token

        if (
            not force
            and token.access_token
            and datetime.now() < token.access_token_expiration
        ):
            return token.access_token

        if not token.refresh_token:
            token_session.delete(token)
            if force:
                token_session.commit()  # pylint: disable=consider-using-transaction
            return None

        try:
            token_response = db_engine_spec.get_oauth2_fresh_token(
                config,
                token.refresh_token,
            )
        except db_engine_spec.oauth2_exception as ex:
            # OAuth token is no longer valid, delete it and start OAuth2 dance
            logger.warning(
                "OAuth2 token refresh failed: database_id=%s engine=%s error_type=%s; "
                "deleting token",
                database_id,
                db_engine_spec.engine,
                type(ex).__name__,
            )
            token_session.delete(token)
            token_session.flush()
            if force:
                token_session.commit()  # pylint: disable=consider-using-transaction
            raise OAuth2TokenRefreshError() from None
        # Engine specs can delegate to arbitrary provider clients that do not share an
        # exception base class. Sanitize every other provider-boundary failure while
        # preserving the refresh token for a later retry.
        except Exception as ex:  # pylint: disable=broad-except
            logger.error(
                "OAuth2 token refresh failed: database_id=%s engine=%s error_type=%s",
                database_id,
                db_engine_spec.engine,
                type(ex).__name__,
            )
            raise OAuth2Error("Token refresh failed") from None

        # store new access token; note that the refresh token might be revoked, in which
        # case there would be no access token in the response
        if "access_token" not in token_response:
            return None

        token.access_token = token_response["access_token"]
        token.access_token_expiration = datetime.now() + timedelta(
            seconds=token_response["expires_in"]
        )
        # Support single-use refresh tokens
        if new_refresh_token := token_response.get("refresh_token"):
            token.refresh_token = new_refresh_token

        token_session.add(token)
        if force:
            # Make rotated access and refresh tokens visible to other workers before
            # releasing the distributed lock. Query execution already commits its
            # audit/progress state, so this does not introduce a new transaction
            # boundary for the query paths using forced refresh.
            token_session.commit()  # pylint: disable=consider-using-transaction

    return token.access_token


def execute_with_oauth2_retry(  # noqa: C901
    database: Database,
    operation: Callable[[], T],
    can_retry: Callable[[], bool] | None = None,
) -> T:
    """Refresh a rejected access token and retry an operation once."""
    # pylint: disable=import-outside-toplevel
    from superset.models.core import DatabaseUserOAuth2Tokens

    user = getattr(g, "user", None)
    user_id = getattr(user, "id", None)
    rejected_access_token = None
    if user_id is not None:
        with db.session.no_autoflush:
            token = (
                db.session.query(DatabaseUserOAuth2Tokens)
                .filter_by(user_id=user_id, database_id=database.id)
                .one_or_none()
            )
        rejected_access_token = token.access_token if token is not None else None

    retry_context = _oauth2_retry_active.set(True)
    try:
        try:
            return operation()
        finally:
            _oauth2_retry_active.reset(retry_context)
    except Exception as ex:
        is_oauth2_error = (
            database.is_oauth2_enabled() and database.db_engine_spec.needs_oauth2(ex)
        )
        if not is_oauth2_error:
            raise
        if can_retry is not None and not can_retry():
            app.config["STATS_LOGGER"].incr(
                "oauth2.forced_refresh.query_retry_skipped_progress"
            )
            database.start_oauth2_dance()
            raise

        config = database.get_oauth2_config()
        if config is None or user_id is None:
            app.config["STATS_LOGGER"].incr("oauth2.forced_refresh.unavailable")
            raise

        stats_logger = app.config["STATS_LOGGER"]
        stats_logger.incr("oauth2.forced_refresh.exchange_attempt")
        logger.info(
            "Forcing OAuth2 token refresh after authentication failure: "
            "database_id=%s engine=%s",
            database.id,
            database.db_engine_spec.engine,
        )
        try:
            access_token = refresh_oauth2_token(
                config,
                database.id,
                user_id,
                database.db_engine_spec,
                force=True,
                rejected_access_token=rejected_access_token,
            )
        except OAuth2TokenRefreshError:
            stats_logger.incr("oauth2.forced_refresh.exchange_rejected")
            database.start_oauth2_dance()
            raise
        except Exception:
            stats_logger.incr("oauth2.forced_refresh.exchange_transient_failure")
            raise

        if access_token is None:
            stats_logger.incr("oauth2.forced_refresh.unavailable")
            database.start_oauth2_dance()

        # The forced refresh commits through an isolated session. Expire the token
        # loaded above so connection creation for the retry observes that commit.
        if token is not None:
            db.session.expire(token)

        stats_logger.incr("oauth2.forced_refresh.exchange_success")
        try:
            result = operation()
        except Exception:
            stats_logger.incr("oauth2.forced_refresh.query_retry_failure")
            raise
        stats_logger.incr("oauth2.forced_refresh.query_retry_success")
        return result


def is_oauth2_retry_active() -> bool:
    """Return whether an outer query execution can retry an OAuth2 failure."""
    return _oauth2_retry_active.get()


def encode_oauth2_state(state: OAuth2State) -> str:
    """
    Encode the OAuth2 state.
    """
    payload: dict[str, Any] = {
        "exp": datetime.now(tz=timezone.utc) + JWT_EXPIRATION,
        "database_id": state["database_id"],
        "user_id": state["user_id"],
        "default_redirect_uri": state["default_redirect_uri"],
        "tab_id": state["tab_id"],
    }

    encoded_state = jwt.encode(
        payload=payload,
        key=app.config["SECRET_KEY"],
        algorithm=app.config["DATABASE_OAUTH2_JWT_ALGORITHM"],
    )

    # Google OAuth2 needs periods to be escaped.
    encoded_state = encoded_state.replace(".", "%2E")

    return encoded_state


class OAuth2StateSchema(Schema):
    database_id = fields.Int(required=True)
    user_id = fields.Int(required=True)
    default_redirect_uri = fields.Str(required=True)
    tab_id = fields.Str(required=True)

    # pylint: disable=unused-argument
    @post_load
    def make_oauth2_state(
        self,
        data: dict[str, Any],
        **kwargs: Any,
    ) -> OAuth2State:
        return {
            "database_id": data["database_id"],
            "user_id": data["user_id"],
            "default_redirect_uri": data["default_redirect_uri"],
            "tab_id": data["tab_id"],
        }

    class Meta:  # pylint: disable=too-few-public-methods
        # ignore `exp`
        unknown = EXCLUDE


oauth2_state_schema = OAuth2StateSchema()


def decode_oauth2_state(encoded_state: str) -> OAuth2State:
    """
    Decode the OAuth2 state.
    """
    # Google OAuth2 needs periods to be escaped.
    encoded_state = encoded_state.replace("%2E", ".")

    payload = jwt.decode(
        jwt=encoded_state,
        key=app.config["SECRET_KEY"],
        algorithms=[app.config["DATABASE_OAUTH2_JWT_ALGORITHM"]],
    )
    state = oauth2_state_schema.load(payload)

    return state


def get_oauth2_redirect_uri() -> str:
    """
    Return the OAuth2 redirect URI.

    Tries the explicit config first, then falls back to url_for().
    If url_for() fails (e.g. in headless/MCP contexts where the
    DatabaseRestApi blueprint may not be registered), raises
    OAuth2Error so callers don't silently proceed with an invalid URI.
    """
    if configured := app.config.get("DATABASE_OAUTH2_REDIRECT_URI"):
        return configured

    try:
        return url_for("DatabaseRestApi.oauth2", _external=True)
    except (BuildError, RuntimeError):
        raise OAuth2Error(
            "Unable to determine the OAuth2 redirect URI. "
            "Set DATABASE_OAUTH2_REDIRECT_URI in the configuration."
        ) from None


class OAuth2ClientConfigSchema(Schema):
    id = fields.String(required=True)
    secret = fields.String(required=True)
    scope = fields.String(required=True)
    redirect_uri = fields.String(
        required=False,
        load_default=get_oauth2_redirect_uri,
    )
    authorization_request_uri = fields.String(required=True)
    token_request_uri = fields.String(required=True)
    request_content_type = fields.String(
        required=False,
        load_default=lambda: "json",
        validate=validate.OneOf(["json", "data"]),
    )


@contextmanager
def check_for_oauth2(database: Database) -> Iterator[None]:
    """
    Run code and check if OAuth2 is needed.
    """
    try:
        yield
    except Exception as ex:
        if (
            not is_oauth2_retry_active()
            and database.is_oauth2_enabled()
            and (
                isinstance(ex, OAuth2TokenRefreshError)
                or database.db_engine_spec.needs_oauth2(ex)
            )
        ):
            database.db_engine_spec.start_oauth2_dance(database)
        raise
