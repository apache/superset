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

The realtime transport delivers a **per-principal** channel's events only to
that principal's sockets. A channel is derived deterministically from the
authenticated request principal — ``user:<id>`` for a logged-in user, a stable
HMAC for an embedded guest — so the task layer can publish a user's events to
their channel without threading a per-request channel id (unlike the legacy
per-session-random channel). The channel is minted into a JWT cookie that the
``superset-websocket`` server verifies to bind a socket to its channel.

This is the connection-auth tier. The lossy public list-view pub/sub
(``entity-changes:*``) needs no per-principal channel — see
``TaskManager.publish_entity_change``.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import jwt
from flask import Flask, request, Response

from superset import security_manager
from superset.tasks.guest import get_current_guest_subscriber_key
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


def get_channel_id() -> str | None:
    """Return the realtime channel for the current request principal, or ``None``.

    ``user:<id>`` for a logged-in user, ``guest:<hmac>`` for an embedded guest
    (reusing the guest identity from ``superset.tasks.guest`` for consistency),
    and ``None`` for an anonymous request (no channel, no cookie).
    """
    if security_manager.get_current_guest_user_if_guest():
        return get_current_guest_subscriber_key()
    if (user_id := get_user_id()) is not None:
        return f"user:{user_id}"
    return None


def mint_channel_token(channel_id: str) -> str:
    """Sign a JWT binding a websocket connection to ``channel_id``.

    The ``superset-websocket`` server verifies this with the same secret and
    reads the ``channel`` claim to route per-principal events to the socket.
    """
    from flask import current_app

    now = datetime.now(tz=timezone.utc)
    expiration = current_app.config["WEBSOCKET_JWT_EXPIRATION_SECONDS"]
    payload = {"channel": channel_id, "exp": now + timedelta(seconds=expiration)}
    return jwt.encode(
        payload, current_app.config["WEBSOCKET_JWT_SECRET"], algorithm="HS256"
    )


def _cookie_channel(token: str) -> str | None:
    """Return the ``channel`` claim of a valid, unexpired channel token, else None."""
    from flask import current_app

    try:
        payload = jwt.decode(
            token, current_app.config["WEBSOCKET_JWT_SECRET"], algorithms=["HS256"]
        )
    except jwt.InvalidTokenError:
        return None
    return payload.get("channel")


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
        channel_id = get_channel_id()
        existing = request.cookies.get(cookie_name)

        if channel_id is None:
            # No channel for this principal (anonymous / just logged out): drop any
            # stale cookie so it can't be reused by a later session.
            if existing:
                response.delete_cookie(cookie_name, domain=cookie_domain)
            return response

        # Leave a cookie that already binds the current channel; re-mint when it is
        # missing, invalid/expired, or bound to a different principal's channel.
        if existing and _cookie_channel(existing) == channel_id:
            return response

        response.set_cookie(
            cookie_name,
            value=mint_channel_token(channel_id),
            httponly=True,
            secure=app.config["WEBSOCKET_JWT_COOKIE_SECURE"],
            domain=cookie_domain,
            samesite=app.config["WEBSOCKET_JWT_COOKIE_SAMESITE"],
            max_age=app.config["WEBSOCKET_JWT_EXPIRATION_SECONDS"],
        )
        return response
