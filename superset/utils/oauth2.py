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
from datetime import datetime, timedelta, timezone
from typing import Any, Iterator, TYPE_CHECKING

import backoff
import jwt
from flask import current_app as app, url_for
from marshmallow import EXCLUDE, fields, post_load, Schema, validate
from werkzeug.routing import BuildError

from superset import db
from superset.distributed_lock import DistributedLock
from superset.exceptions import AcquireDistributedLockFailedException, OAuth2Error
from superset.superset_typing import OAuth2ClientConfig, OAuth2State

if TYPE_CHECKING:
    from superset.db_engine_specs.base import BaseEngineSpec
    from superset.models.core import (
        Database,
        DatabaseUserOAuth2Tokens,
        UpstreamOAuthToken,
    )

logger = logging.getLogger(__name__)

JWT_EXPIRATION = timedelta(minutes=5)

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
    factor=10,
    base=2,
    max_tries=5,
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
    process to acquire the lock will perform the refresh, and othe process should find a
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
        return refresh_oauth2_token(config, database_id, user_id, db_engine_spec, token)

    # since the access token is expired and there's no refresh token, delete the entry
    db.session.delete(token)

    return None


def refresh_oauth2_token(
    config: OAuth2ClientConfig,
    database_id: int,
    user_id: int,
    db_engine_spec: type[BaseEngineSpec],
    token: DatabaseUserOAuth2Tokens,
) -> str | None:
    # Use longer TTL for OAuth2 token refresh (may involve network calls)
    with DistributedLock(
        namespace="refresh_oauth2_token",
        ttl_seconds=30,
        user_id=user_id,
        database_id=database_id,
    ):
        try:
            token_response = db_engine_spec.get_oauth2_fresh_token(
                config,
                token.refresh_token,
            )
        except db_engine_spec.oauth2_exception:
            # OAuth token is no longer valid, delete it and start OAuth2 dance
            logger.warning(
                "OAuth2 token refresh failed for user=%s db=%s, deleting invalid token",
                user_id,
                database_id,
            )
            db.session.delete(token)
            raise
        except Exception:
            # non-OAuth related failure, log the exception
            logger.warning(
                "OAuth2 token refresh failed for user=%s db=%s",
                user_id,
                database_id,
            )
            raise

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

        db.session.add(token)

    return token.access_token


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
        if database.is_oauth2_enabled() and database.db_engine_spec.needs_oauth2(ex):
            database.db_engine_spec.start_oauth2_dance(database)
        raise


def get_access_token_for_database(database: Database, user_id: int) -> str | None:
    """
    Return a valid OAuth2 access token for the given database and user.

    First checks if the database has an upstream OAuth provider configured in its
    ``extra`` JSON (key ``oauth2_upstream_provider``). If so, returns the saved
    upstream login token for that provider.

    Otherwise, falls back to the database-specific OAuth2 flow.
    """
    upstream_provider = database.get_extra().get("oauth2_upstream_provider")
    if upstream_provider:
        access_token = get_upstream_provider_token(upstream_provider, user_id)
        if access_token:
            logger.info(
                "Using upstream OAuth token from provider '%s' "
                "for database '%s' (id=%s, user_id=%d)",
                upstream_provider,
                database.database_name,
                database.id,
                user_id,
            )
            return access_token
        logger.warning(
            "Upstream provider '%s' configured for database '%s' "
            "(id=%s) but no valid token found for user_id=%d, "
            "falling back to database-specific OAuth2",
            upstream_provider,
            database.database_name,
            database.id,
            user_id,
        )

    # Fall back to database-specific OAuth2 (also used when upstream token is
    # unavailable, e.g. expired without a refresh token).
    # Database-specific OAuth2 requires a persisted database (needs database.id
    # to look up stored tokens).
    if database.id is None:
        logger.debug(
            "Database '%s' has no persisted id, "
            "skipping database-specific OAuth2 token lookup",
            database.database_name,
        )
        return None

    oauth2_config = database.get_oauth2_config()
    if oauth2_config:
        logger.info(
            "Using database-specific OAuth2 token "
            "for database '%s' (id=%d, user_id=%d)",
            database.database_name,
            database.id,
            user_id,
        )
        return get_oauth2_access_token(
            oauth2_config, database.id, user_id, database.db_engine_spec
        )

    logger.warning(
        "No OAuth2 token available for database '%s' (id=%d, user_id=%d)",
        database.database_name,
        database.id,
        user_id,
    )
    return None


def save_user_provider_token(
    user_id: int,
    provider: str,
    token_response: dict[str, Any],
) -> None:
    """
    Upsert an UpstreamOAuthToken row for the given user + provider.
    """
    from superset.models.core import UpstreamOAuthToken

    token: UpstreamOAuthToken | None = (
        db.session.query(UpstreamOAuthToken)
        .filter_by(user_id=user_id, provider=provider)
        .one_or_none()
    )
    if token is None:
        token = UpstreamOAuthToken(user_id=user_id, provider=provider)

    token.access_token = token_response.get("access_token")
    expires_in = token_response.get("expires_in")
    token.access_token_expiration = (
        datetime.now() + timedelta(seconds=expires_in) if expires_in else None
    )
    token.refresh_token = token_response.get("refresh_token")
    db.session.add(token)
    db.session.commit()


@backoff.on_exception(
    backoff.expo,
    AcquireDistributedLockFailedException,
    factor=10,
    base=2,
    max_tries=5,
)
def get_upstream_provider_token(provider: str, user_id: int) -> str | None:
    """
    Retrieve a valid access token for the given provider and user.

    If the token is expired and a refresh token exists, attempt to refresh it.
    Returns None if no valid token is available.
    """
    from superset.models.core import UpstreamOAuthToken

    token: UpstreamOAuthToken | None = (
        db.session.query(UpstreamOAuthToken)
        .filter_by(user_id=user_id, provider=provider)
        .one_or_none()
    )
    if token is None:
        return None

    now = datetime.now()
    if token.access_token_expiration is None or token.access_token_expiration > now:
        return token.access_token

    # Token is expired
    if token.refresh_token:
        return _refresh_upstream_provider_token(token, provider)

    db.session.delete(token)
    db.session.commit()
    return None


def _refresh_upstream_provider_token(
    token: UpstreamOAuthToken,
    provider: str,
) -> str | None:
    """
    Use the refresh token to obtain a new access token from the provider.
    Updates and persists the token if successful; deletes it on failure.
    """
    from flask import current_app as flask_app

    with DistributedLock(
        namespace="refresh_upstream_oauth_token",
        user_id=token.user_id,
        provider=provider,
    ):
        try:
            remote_app = flask_app.extensions["authlib.integrations.flask_client"][
                provider
            ]
            token_response = remote_app.fetch_access_token(
                grant_type="refresh_token",
                refresh_token=token.refresh_token,
            )
        except Exception:  # pylint: disable=broad-except
            logger.warning(
                "Failed to refresh upstream OAuth token for provider %s",
                provider,
                exc_info=True,
            )
            db.session.delete(token)
            db.session.commit()
            return None

        if "access_token" not in token_response:
            db.session.delete(token)
            db.session.commit()
            return None

        token.access_token = token_response["access_token"]
        expires_in = token_response.get("expires_in")
        token.access_token_expiration = (
            datetime.now() + timedelta(seconds=expires_in) if expires_in else None
        )
        if "refresh_token" in token_response:
            token.refresh_token = token_response["refresh_token"]
        db.session.add(token)
        db.session.commit()

    return token.access_token
