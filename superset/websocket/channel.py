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

The realtime transport requires a short-lived JWT ticket minted by Superset
(``GET /api/v1/realtime/token/``) after the request principal passes the
``can_read Realtime`` gate. The client presents it in-band as the first frame of
the socket and again, on the open socket, to refresh it before expiry. The JWT
carries the principal identity and a deterministic routing key - ``user:<id>`` for a
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

from superset import security_manager
from superset.tasks.guest import get_current_guest_subscriber_key
from superset.utils.core import get_user_id
from superset.websocket.permissions import (
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
    token yields no subscriber key), in which case no ticket is minted.
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
    """Sign a JWT ticket binding a websocket connection to ``principal``.

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
