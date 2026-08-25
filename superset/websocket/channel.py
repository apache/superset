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
"""Per-principal websocket channel identity and connection tokens.

The realtime transport requires a JWT cookie minted by Superset after the
request principal passes the ``can_read Realtime`` gate. The JWT carries the
principal identity and a deterministic routing channel — ``user:<id>`` for a
logged-in user, a stable HMAC for an embedded guest — so the
``superset-websocket`` server can validate the socket and bind it to that
channel.

Per-principal messages are delivered only to sockets bound to that principal's
channel. The lossy list-view Pub/Sub tier (``entity-changes:*``) is broadcast to
all authenticated realtime sockets, but carries only opaque entity nudges — see
``TaskManager.publish_entity_change``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Literal, NotRequired, TypedDict

import jwt
from flask import Flask, g, request, Response

from superset import security_manager
from superset.tasks.guest import get_current_guest_subscriber_key
from superset.utils.core import get_user_id
from superset.websocket.permissions import (
    can_access_realtime_notifications,
    REALTIME_NOTIFICATION_CLAIM,
    REALTIME_NOTIFICATION_JWT_AUDIENCE,
    REALTIME_NOTIFICATION_JWT_ISSUER,
)

logger = logging.getLogger(__name__)


PrincipalType = Literal["user", "guest"]


class RealtimePrincipal(TypedDict):
    channel: str
    principal_type: PrincipalType
    sub: str
    username: NotRequired[str]


def channel_id_for(user_id: int | None, guest_key: str | None) -> str | None:
    """Derive a principal's realtime channel from its identity, or ``None``.

    The single source of truth for the channel-id format, shared by the
    request-scoped :func:`get_channel_id` (cookie minting) and the task layer's
    per-subscriber publish (``TaskDAO.get_subscriber_channels``) so a message
    published to a subscriber's channel lands on the socket whose cookie bound
    that same channel. ``user:<id>`` for an authenticated user; the guest's
    token-derived key (already namespaced ``guest-…``) for an embedded guest;
    ``None`` when neither identifies a principal.
    """
    if user_id is not None:
        return f"user:{user_id}"
    if guest_key:
        return guest_key
    return None


def get_channel_id() -> str | None:
    """Return the realtime channel for the current request principal, or ``None``.

    ``user:<id>`` for a logged-in user, ``guest:<hmac>`` for an embedded guest
    (reusing the guest identity from ``superset.tasks.guest`` for consistency),
    and ``None`` for an anonymous request (no channel, no cookie).
    """
    if security_manager.get_current_guest_user_if_guest():
        return channel_id_for(None, get_current_guest_subscriber_key())
    return channel_id_for(get_user_id(), None)


def get_realtime_principal() -> RealtimePrincipal | None:
    """Return JWT principal claims for the current websocket-eligible principal."""
    if security_manager.get_current_guest_user_if_guest():
        guest_key = get_current_guest_subscriber_key()
        if not guest_key:
            return None
        return {
            "channel": guest_key,
            "principal_type": "guest",
            "sub": guest_key,
        }

    user_id = get_user_id()
    if user_id is None:
        return None
    channel = channel_id_for(user_id, None)
    if channel is None:
        return None

    claims: RealtimePrincipal = {
        "channel": channel,
        "principal_type": "user",
        "sub": str(user_id),
    }
    username = getattr(getattr(g, "user", None), "username", None)
    if username:
        claims["username"] = str(username)
    return claims


def mint_channel_token(principal: RealtimePrincipal) -> str:
    """Sign a JWT binding a websocket connection to ``principal``.

    The ``superset-websocket`` server verifies this with the same secret, checks
    the principal and permission claims, then uses ``channel`` as the routing key
    for per-principal messages.
    """
    from flask import current_app

    now = datetime.now(tz=timezone.utc)
    expiration = current_app.config["WEBSOCKET_JWT_EXPIRATION_SECONDS"]
    payload = {
        **principal,
        "aud": REALTIME_NOTIFICATION_JWT_AUDIENCE,
        "iat": now,
        "iss": REALTIME_NOTIFICATION_JWT_ISSUER,
        "permissions": [REALTIME_NOTIFICATION_CLAIM],
        "exp": now + timedelta(seconds=expiration),
    }
    return jwt.encode(
        payload, current_app.config["WEBSOCKET_JWT_SECRET"], algorithm="HS256"
    )


def _valid_payload_channel(payload: dict[str, object]) -> str | None:
    channel = payload.get("channel")
    subject = payload.get("sub")
    principal_type = payload.get("principal_type")
    permissions = payload.get("permissions")

    if not isinstance(channel, str) or not channel:
        return None
    if not isinstance(subject, str) or not subject:
        return None
    if principal_type not in ("user", "guest"):
        return None
    if not isinstance(permissions, list) or REALTIME_NOTIFICATION_CLAIM not in {
        permission for permission in permissions if isinstance(permission, str)
    }:
        return None

    if principal_type == "user" and channel != f"user:{subject}":
        return None
    if principal_type == "guest" and channel != subject:
        return None
    return channel


def _cookie_channel(token: str) -> str | None:
    """Return the ``channel`` claim of a valid, unexpired channel token, else None."""
    from flask import current_app

    try:
        payload = jwt.decode(
            token,
            current_app.config["WEBSOCKET_JWT_SECRET"],
            algorithms=["HS256"],
            audience=REALTIME_NOTIFICATION_JWT_AUDIENCE,
            issuer=REALTIME_NOTIFICATION_JWT_ISSUER,
        )
    except jwt.InvalidTokenError:
        return None
    if not isinstance(payload, dict):
        return None
    return _valid_payload_channel(payload)


def register_ws_channel_cookie(app: Flask) -> None:
    """Keep the websocket channel-token cookie in sync with the request principal.

    Sets an ``httponly`` JWT cookie (which the ``superset-websocket`` server
    verifies) bound to the current principal's channel. Critically, it re-mints
    the cookie whenever the bound channel no longer matches the current principal
    — e.g. after a logout/login in the same browser — and deletes it when there is
    no principal (anonymous / logged out), so a stale token can never bind a new
    session to a previous user's channel.
    """
    cookie_name = app.config["WEBSOCKET_JWT_COOKIE_NAME"]
    cookie_domain = app.config["WEBSOCKET_JWT_COOKIE_DOMAIN"]

    @app.after_request
    def set_ws_channel_cookie(response: Response) -> Response:
        principal = (
            get_realtime_principal() if can_access_realtime_notifications() else None
        )
        existing = request.cookies.get(cookie_name)

        if principal is None:
            # No channel for this principal (anonymous / just logged out): drop any
            # stale cookie so it can't be reused by a later session or after the
            # realtime notification permission is removed.
            if existing:
                response.delete_cookie(cookie_name, domain=cookie_domain)
            return response

        channel_id = principal["channel"]

        # Leave a cookie that already binds the current channel; re-mint when it is
        # missing, invalid/expired, or bound to a different principal's channel.
        if existing and _cookie_channel(existing) == channel_id:
            return response

        response.set_cookie(
            cookie_name,
            value=mint_channel_token(principal),
            httponly=True,
            secure=app.config["WEBSOCKET_JWT_COOKIE_SECURE"],
            domain=cookie_domain,
            samesite=app.config["WEBSOCKET_JWT_COOKIE_SAMESITE"],
            max_age=app.config["WEBSOCKET_JWT_EXPIRATION_SECONDS"],
        )
        return response
