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
"""Framework support for task-type subscription policies (GTF).

Re-exports the public :class:`TaskSubscriptionPolicy` interface and adds the two
request-scoped helpers the framework uses to invoke a policy: the principal's
stable routing id and the caller's opaque per-client id.
"""

from __future__ import annotations

from flask import has_request_context, request
from superset_core.tasks.subscription import TaskSubscriptionPolicy

__all__ = ["TaskSubscriptionPolicy", "principal_channel", "get_request_tab_id"]

# Body/query key a client uses to advertise its per-tab id on submit and cancel.
TAB_ID_KEY = "tab_id"


def principal_channel(user_id: int | None, guest_key: str | None) -> str | None:
    """Return a principal's stable routing id, or ``None`` if unidentified.

    ``user:<id>`` for an authenticated user; the guest's token-derived key
    (already namespaced ``guest:<hmac>``) for an embedded guest; ``None`` when
    neither identifies a principal. This is the single source of truth for the
    principal-grain routing string — the websocket channel id
    (``superset.websocket.channel.channel_id_for``) delegates to it, and a
    subscription policy uses it to scope per-client bookkeeping to one principal.
    """
    if user_id is not None:
        return f"user:{user_id}"
    if guest_key:
        return guest_key
    return None


def get_request_tab_id() -> str | None:
    """Return the caller's opaque per-tab id from the current request, or ``None``.

    Clients advertise a stable per-tab id (see ``superset-frontend`` ``getTabId``)
    in the JSON body — falling back to a query arg — of chart-data submit and task
    cancel requests. It is ``None`` outside a request context (e.g. a Celery
    worker) or when the caller supplied none, in which case the task's
    subscription policy falls back to principal-grain behavior.
    """
    if not has_request_context():
        return None
    body = request.get_json(silent=True)
    if isinstance(body, dict):
        tab_id = body.get(TAB_ID_KEY)
        if isinstance(tab_id, str) and tab_id:
            return tab_id
    tab_id = request.args.get(TAB_ID_KEY)
    return tab_id or None
