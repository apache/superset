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
"""One-time login tokens for establishing a session inside an iframe.

An SSO redirect flow cannot run inside an iframe: identity providers commonly
refuse to be framed, and the redirect chain depends on cookies that browsers
treat as third-party in an embedded context. A parent application that already
holds a trustworthy proof of the user's identity uses these tokens to turn that
proof into an ordinary Superset session in two steps:

1. its backend mints a token, presenting a credential that an operator-supplied
   resolver validates (server-to-server, so the credential never reaches the
   browser), and
2. the browser navigates the iframe to the consume endpoint, which exchanges the
   token for a session cookie.

The token is an opaque handle to a short-lived server-side record; no identity
data travels in the URL.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Callable, cast, TypedDict
from uuid import UUID, uuid4

from flask import current_app, Request

from superset.daos.key_value import KeyValueDAO
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource

logger = logging.getLogger(__name__)

LOGIN_TOKEN_RESOURCE = KeyValueResource.LOGIN_TOKEN
LOGIN_TOKEN_CODEC = JsonKeyValueCodec()

# Kept short deliberately: the token is handed to a browser as an iframe URL, so
# it lands in access logs and the parent page's DOM. A lifetime measured in
# seconds bounds the window in which an observer could replay it.
DEFAULT_LOGIN_TOKEN_TTL_SECONDS = 60


class LoginTokenUserInfo(TypedDict, total=False):
    """The identity a resolver returns for a one-time login token.

    This mirrors the ``userinfo`` contract of Flask-AppBuilder's
    ``auth_user_oauth``, which the consume step delegates to. ``username``
    identifies the user, falling back to ``email`` when absent. ``role_keys`` are
    resolved through ``AUTH_ROLES_MAPPING``, so a caller can only ever request
    roles the operator has already mapped -- authorization stays with the
    operator rather than moving to the parent application.
    """

    username: str
    email: str
    first_name: str
    last_name: str
    role_keys: list[str]


LoginTokenIdentityResolver = Callable[..., LoginTokenUserInfo | None]


def is_enabled() -> bool:
    """Whether the flow is usable: feature flag on and a resolver configured."""
    # Deferred: ``superset/__init__`` imports the app factory, so a module-level
    # import here would be circular via superset.daos / superset.security.
    from superset import (  # pylint: disable=import-outside-toplevel
        is_feature_enabled,
    )

    if not is_feature_enabled("LOGIN_TOKEN"):
        return False

    return current_app.config.get("LOGIN_TOKEN_IDENTITY_RESOLVER") is not None


def get_ttl_seconds() -> int:
    """The configured token lifetime, falling back to the default."""
    configured = current_app.config.get(
        "LOGIN_TOKEN_TTL_SECONDS", DEFAULT_LOGIN_TOKEN_TTL_SECONDS
    )
    try:
        ttl = int(configured)
    except (TypeError, ValueError):
        logger.warning(
            "LOGIN_TOKEN_TTL_SECONDS is not an integer (%r); using %s",
            configured,
            DEFAULT_LOGIN_TOKEN_TTL_SECONDS,
        )
        return DEFAULT_LOGIN_TOKEN_TTL_SECONDS

    return ttl if ttl > 0 else DEFAULT_LOGIN_TOKEN_TTL_SECONDS


# Each rejection below is a distinct failure with its own diagnostic — an
# unconfigured resolver is normal and silent, a misconfigured or misbehaving one
# is logged. Merging the branches to satisfy the return-count limit would lose
# that distinction, which is the only signal an operator gets.
def resolve_identity(  # pylint: disable=too-many-return-statements
    request: Request, **kwargs: Any
) -> LoginTokenUserInfo | None:
    """Run the operator-supplied resolver against an inbound mint request.

    The resolver is the whole authentication boundary for minting: it decides
    what counts as proof of identity (an OIDC id token, an existing session, a
    credential checked against an internal service). A resolver that raises, or
    returns something other than a mapping, is treated as a rejection rather
    than a server error, so a failing validation can never be mistaken for a
    successful one.
    """
    resolver = current_app.config.get("LOGIN_TOKEN_IDENTITY_RESOLVER")
    if resolver is None:
        return None

    if not callable(resolver):
        logger.error("LOGIN_TOKEN_IDENTITY_RESOLVER is not callable")
        return None

    try:
        userinfo = resolver(request, **kwargs)
    except Exception:  # pylint: disable=broad-except
        logger.exception("LOGIN_TOKEN_IDENTITY_RESOLVER rejected the request")
        return None

    if not userinfo:
        return None

    if not isinstance(userinfo, dict):
        # A truthy non-mapping would otherwise raise on the ``.get`` below and
        # surface as a 500, contradicting the rejection contract above.
        logger.error(
            "LOGIN_TOKEN_IDENTITY_RESOLVER returned %s, expected a mapping",
            type(userinfo).__name__,
        )
        return None

    if not (userinfo.get("username") or userinfo.get("email")):
        # auth_user_oauth derives the username from one of these two; without
        # either there is no identity to provision.
        logger.error("LOGIN_TOKEN_IDENTITY_RESOLVER returned no username or email")
        return None

    # The resolver is operator-supplied and typed Any, so the isinstance guard
    # above narrows it only as far as a plain dict. Its keys are the resolver's
    # contract, checked here to the extent that matters (a usable identifier);
    # anything extra is ignored by auth_user_oauth.
    return cast(LoginTokenUserInfo, userinfo)


def mint(userinfo: LoginTokenUserInfo) -> tuple[str, datetime]:
    """Store ``userinfo`` behind a fresh opaque token.

    Returns the token and its expiry. The token is a ``uuid4``, so it carries no
    identity data and is not guessable.
    """
    token = uuid4()
    expires_on = datetime.now() + timedelta(seconds=get_ttl_seconds())

    # Opportunistic GC rather than collision avoidance: a fresh uuid4 cannot
    # collide, but with a TTL measured in seconds these rows turn over quickly,
    # and the scheduled prune job runs far less often than tokens are minted.
    # Minting is not a hot path, so one indexed DELETE here is cheap insurance
    # against the table filling with dead entries between prunes.
    KeyValueDAO.delete_expired_entries(LOGIN_TOKEN_RESOURCE)
    KeyValueDAO.create_entry(
        resource=LOGIN_TOKEN_RESOURCE,
        value=dict(userinfo),
        codec=LOGIN_TOKEN_CODEC,
        key=token,
        expires_on=expires_on,
    )
    return str(token), expires_on


def consume(token: str) -> LoginTokenUserInfo | None:
    """Exchange a token for its ``userinfo``, deleting it in the same breath.

    The entry is row-locked before it is read, so two concurrent requests cannot
    both observe it: the second blocks until the first commits and then finds it
    gone. That is what makes the token genuinely single-use rather than
    single-use-unless-raced.

    Returns ``None`` for an unknown, malformed, or expired token -- callers must
    not distinguish between those cases in their response.
    """
    try:
        key = UUID(token)
    except (AttributeError, TypeError, ValueError):
        return None

    entry = KeyValueDAO.get_entry(LOGIN_TOKEN_RESOURCE, key, for_update=True)
    if entry is None:
        return None

    # Delete regardless of expiry: an expired token is spent either way, and
    # leaving it behind would only wait for the pruning job.
    expired = entry.is_expired()
    try:
        userinfo = LOGIN_TOKEN_CODEC.decode(entry.value)
    except Exception:  # pylint: disable=broad-except
        logger.exception("Unable to decode stored login token payload")
        userinfo = None

    KeyValueDAO.delete_entry(LOGIN_TOKEN_RESOURCE, key)

    if expired or not userinfo:
        return None

    # The codec decodes to a plain dict. The row was written by ``mint`` from a
    # ``LoginTokenUserInfo``, so the shape holds by construction; a foreign or
    # malformed row is caught by the falsy check above and, failing that, by
    # ``auth_user_oauth`` requiring a username or email.
    return cast(LoginTokenUserInfo, userinfo)
