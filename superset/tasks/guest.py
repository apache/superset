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
"""Guest identity for Global Task Framework subscriptions.

Embedded guest users have no ``ab_user`` row, so they cannot subscribe to tasks
by ``user_id``. Instead they subscribe by a ``guest_key``: a stable, unguessable
identity derived from their guest token, which the task filter honors to grant a
guest visibility of the tasks it created or (via SHARED-scope dedup) joined.
"""

from __future__ import annotations

import hashlib
import hmac

from flask import current_app

from superset import security_manager
from superset.utils import json


def get_current_guest_subscriber_key() -> str | None:
    """Return a stable subscriber key for the current guest, or ``None``.

    ``None`` when the request is not an embedded guest (an authenticated user
    subscribes by ``user_id`` instead). The key is an HMAC over the guest token's
    stable identifying claims, keyed with the app ``SECRET_KEY`` so it is
    unguessable to outside callers and reproducible across the request that
    schedules a task and the polls that await it, including polls made with a
    refreshed token carrying the same scope.
    """
    guest_user = security_manager.get_current_guest_user_if_guest()
    if not guest_user:
        return None
    token = guest_user.guest_token
    # Bind the key to every authorization-relevant claim so two tokens that differ
    # in their effective access scope derive different keys (and can't see each
    # other's tasks): ``resources``/``datasets``/``rev`` to the granted resources
    # and ``rls_rules`` to the row-level scope. Issuance claims (``iat``/``exp``)
    # are deliberately left out: the embedded SDK re-issues the token on a fixed
    # cadence (shortly before ``exp``), and a key that changed with each issuance
    # would stop matching the subscriber row mid-query, so the polls after a
    # refresh could no longer see the task and the chart would spin to the stale
    # timeout. Tokens with identical scope claims carry identical entitlements,
    # so sharing a key across them grants nothing extra.
    message = json.dumps(
        {
            "user": token.get("user"),
            "resources": token.get("resources"),
            "aud": token.get("aud"),
            "datasets": token.get("datasets"),
            "rev": token.get("rev"),
            "rls_rules": token.get("rls_rules"),
        },
        sort_keys=True,
    ).encode("utf-8")
    digest = hmac.new(
        current_app.config["SECRET_KEY"].encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()
    return f"guest:{digest}"


def get_guest_subscriber_key_for(user_id: int | None) -> str | None:
    """Return the guest subscriber key to use alongside ``user_id``.

    Authenticated callers subscribe by ``user_id``, so they get ``None``; only a
    request with no ``ab_user`` id falls back to the guest key. Keeps the
    "user_id XOR guest_key" rule that ``TaskSubscriber`` enforces in one place.
    """
    return None if user_id else get_current_guest_subscriber_key()
