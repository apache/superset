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
"""Per-principal websocket routing identity and connection tokens.

The realtime transport requires a JWT cookie minted by Superset after the
request principal passes the ``can_read Realtime`` gate. The JWT carries the
principal identity and a deterministic routing key - ``user:<id>`` for a
logged-in user, a stable HMAC for an embedded guest - so the
``superset-websocket`` server can validate the socket and bind it to that
routing key.

Targeted messages (``scope=principal``/``tab``) are delivered only to sockets
bound to the intended routing key. Broadcast messages (``scope=authenticated_global``,
e.g. the ``entity.changed`` list-view nudge) go to all authenticated
realtime sockets but carry only opaque entity nudges - see
``TaskManager.publish_entity_change``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Literal, TypedDict

import jwt
from flask import Flask, request, Response

from superset import security_manager
from superset.tasks.guest import get_current_guest_subscriber_key
from superset.utils.core import get_user_id
from superset.websocket.permissions import (
    can_access_realtime_notifications,
    REALTIME_NOTIFICATION_JWT_AUDIENCE,
    REALTIME_NOTIFICATION_JWT_ISSUER,
)

logger = logging.getLogger(__name__)


PrincipalType = Literal["user", "guest"]


class RealtimePrincipal(TypedDict):
    channel: str
    principal_type: PrincipalType
    sub: str


def channel_id_for(user_id: int | None, guest_key: str | None) -> str | None:
    """Derive a principal's realtime channel from its identity, or ``None``.

    The socket routing-key format used by the JWT cookie and the websocket
    server's targeted fanout. ``user:<id>`` for an authenticated user; the
    guest's token-derived key (already namespaced ``guest:<hmac>``) for an
    embedded guest; ``None`` when neither identifies a principal. This is the
    same principal-grain routing string GTF subscription policies key off, so it
    delegates to the single source of truth in ``superset.tasks.subscription``.
    """
    from superset.tasks.subscription import principal_channel

    return principal_channel(user_id, guest_key)


def get_realtime_principal() -> RealtimePrincipal | None:
    """Return JWT principal claims for the current websocket-eligible principal.

    ``None`` for a request with no realtime identity (anonymous, or a guest whose
    token yields no subscriber key), in which case no cookie is minted.
    """
    if security_manager.get_current_guest_user_if_guest():
        guest_channel = channel_id_for(None, get_current_guest_subscriber_key())
        if guest_channel is None:
            return None
        return {
            "channel": guest_channel,
            "principal_type": "guest",
            "sub": guest_channel,
        }

    user_id = get_user_id()
    channel = channel_id_for(user_id, None)
    if channel is None:
        return None

    return {
        "channel": channel,
        "principal_type": "user",
        "sub": str(user_id),
    }


def mint_channel_token(principal: RealtimePrincipal) -> str:
    """Sign a JWT binding a websocket connection to ``principal``.

    The ``superset-websocket`` server verifies this with the same secret, checks
    the identity claims, then uses ``channel`` as the routing key for targeted
    fanout.
    """
    from flask import current_app

    now = datetime.now(tz=timezone.utc)
    expiration = current_app.config["WEBSOCKET_JWT_EXPIRATION_SECONDS"]
    payload = {
        **principal,
        "aud": REALTIME_NOTIFICATION_JWT_AUDIENCE,
        "iat": now,
        "iss": REALTIME_NOTIFICATION_JWT_ISSUER,
        "exp": now + timedelta(seconds=expiration),
    }
    return jwt.encode(
        payload, current_app.config["WEBSOCKET_JWT_SECRET"], algorithm="HS256"
    )


def _valid_payload_channel(payload: dict[str, object]) -> str | None:
    channel = payload.get("channel")
    subject = payload.get("sub")
    principal_type = payload.get("principal_type")

    if not isinstance(channel, str) or not channel:
        return None
    if not isinstance(subject, str) or not subject:
        return None
    if principal_type not in ("user", "guest"):
        return None

    if principal_type == "user" and channel != f"user:{subject}":
        return None
    if principal_type == "guest" and channel != subject:
        return None
    return channel


def _decode_cookie(token: str) -> dict[str, object] | None:
    """Return the claims of a valid, unexpired channel token, else None."""
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
    return payload if isinstance(payload, dict) else None


def _should_remint(existing: str | None, channel_id: str) -> bool:
    """Whether the channel cookie must be (re)minted for ``channel_id``.

    Re-mints when the cookie is missing, invalid/expired, bound to a different
    principal's channel, or inside a sliding refresh window before expiry (less
    than half its lifetime remaining). The sliding window keeps an active
    surface's socket alive indefinitely: any request in the second half of the
    token's life issues a fresh cookie, so the socket reconnects before the
    server terminates it at expiry (rather than only re-minting after expiry).
    """
    from flask import current_app

    if not existing:
        return True
    payload = _decode_cookie(existing)
    if payload is None:
        return True
    if _valid_payload_channel(payload) != channel_id:
        return True
    exp = payload.get("exp")
    if not isinstance(exp, (int, float)):
        return True
    lifetime = current_app.config["WEBSOCKET_JWT_EXPIRATION_SECONDS"]
    remaining = exp - datetime.now(tz=timezone.utc).timestamp()
    return remaining < lifetime / 2


def register_ws_channel_cookie(app: Flask) -> None:
    """Keep the websocket channel-token cookie in sync with the request principal.

    Sets an ``httponly`` JWT cookie (which the ``superset-websocket`` server
    verifies) bound to the current principal's channel. Re-mints the cookie
    whenever the bound channel no longer matches the current principal — e.g.
    after a logout/login in the same browser — or when it is inside the sliding
    refresh window before expiry, and deletes it when there is no principal
    (anonymous / logged out), so a stale token can never bind a new session to a
    previous user's channel and an active surface never silently loses realtime.
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
        if not _should_remint(existing, channel_id):
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
