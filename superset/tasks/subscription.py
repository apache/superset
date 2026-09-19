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

import re
from typing import cast, TYPE_CHECKING

from flask import has_request_context, request
from superset_core.tasks.subscription import TaskSubscriptionPolicy

from superset.tasks.utils import SUBSCRIPTION_PRIVATE_NAMESPACE

if TYPE_CHECKING:
    from superset_core.tasks.models import Task as CoreTask

    from superset.models.tasks import Task

__all__ = [
    "TaskSubscriptionPolicy",
    "PerTabConsumerPolicy",
    "principal_channel",
    "get_request_tab_id",
]

# Body/query key a client uses to advertise its per-tab id on submit and cancel.
TAB_ID_KEY = "tab_id"

# Key under ``private["subscription"]`` holding the per-tab consumer list a
# :class:`PerTabConsumerPolicy` maintains.
CONSUMERS_PRIVATE_KEY = "consumers"


# A client-supplied tab id is concatenated into routing keys, private task
# properties, Redis channels, logs, and URLs. The principal prefix is
# server-derived, but the tab suffix is client-controlled, so bound it: at most 64
# chars from a conservative charset. Kept in lockstep with the websocket server's
# ingress guard (superset-websocket/src/index.ts TAB_ID_PATTERN).
_TAB_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _is_valid_tab_id(value: object) -> bool:
    """Return whether ``value`` is a well-formed, safely-bounded tab id."""
    return isinstance(value, str) and bool(_TAB_ID_RE.match(value))


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
    worker), when the caller supplied none, or when the supplied value is not a
    well-formed tab id (see ``_is_valid_tab_id``), in which case the task's
    subscription policy falls back to principal-grain behavior.
    """
    if not has_request_context():
        return None
    body = request.get_json(silent=True)
    if isinstance(body, dict):
        tab_id = body.get(TAB_ID_KEY)
        if _is_valid_tab_id(tab_id):
            return tab_id
    tab_id = request.args.get(TAB_ID_KEY)
    return tab_id if _is_valid_tab_id(tab_id) else None


class PerTabConsumerPolicy(TaskSubscriptionPolicy):
    """Route a task's ``task.status`` fanout to exactly the browser tabs watching it.

    A reusable subscription policy for any task type whose completion should be
    delivered to the specific tabs awaiting it rather than to every tab of the
    principal. It keeps a list of ``"<principal>:<tab_id>"`` entries in the task's
    ``private["subscription"]`` namespace (policy-owned, debug-gated): on subscribe
    it adds the calling tab; on unsubscribe it removes the calling tab and reports
    whether the principal has any tab left, so the framework aborts the task only
    once the principal's last watching tab is gone; ``routing_channels`` returns
    those per-tab keys so a status message reaches only those tabs.

    This matters for a ``SHARED`` task deduplicated across tabs/requests (one
    principal viewing the same work in two tabs is a single subscriber row, so
    either tab's detach must not abort work the other still awaits) and equally
    lets a ``PRIVATE`` task deliver completion to just its originating tab. Both
    hooks run under the submit/cancel lock, so the read-modify-write on the list is
    race-free against other submits/cancels; the executor, which does not hold that
    lock, writes the task's properties while it runs, so the list is written
    through ``TaskDAO.merge_subscription_state`` (a row-locked merge) and the
    executor's whole-blob writes preserve this namespace (see
    ``preserve_subscription_state``) rather than replacing it with their pickup-time
    snapshot.

    A request without a ``tab_id`` (a non-interactive or legacy caller) is a no-op
    on subscribe and proceeds (principal-grain) on unsubscribe.
    """

    @staticmethod
    def _consumers(task: "CoreTask") -> list[str]:
        private = task.properties_dict.get("private") or {}
        subscription = private.get(SUBSCRIPTION_PRIVATE_NAMESPACE) or {}
        consumers = subscription.get(CONSUMERS_PRIVATE_KEY) or []
        return [entry for entry in consumers if isinstance(entry, str)]

    @staticmethod
    def _write_consumers(task: "CoreTask", consumers: list[str]) -> None:
        from superset.daos.tasks import TaskDAO

        TaskDAO.merge_subscription_state(
            cast("Task", task), {CONSUMERS_PRIVATE_KEY: consumers}
        )

    def on_subscribe(
        self, task: "CoreTask", *, principal: str, client_ref: str | None
    ) -> None:
        if client_ref is None:
            return
        entry = f"{principal}:{client_ref}"
        if entry not in (consumers := self._consumers(task)):
            self._write_consumers(task, [*consumers, entry])

    def on_unsubscribe(
        self, task: "CoreTask", *, principal: str, client_ref: str | None
    ) -> bool:
        consumers = self._consumers(task)
        prefix = f"{principal}:"
        if client_ref is None:
            # Principal-grain unsubscribe (no tab id): the whole principal is
            # leaving, so drop ALL of its recorded tab entries. Otherwise a later
            # status transition would still route to this principal's tab channels
            # (via routing_channels) after it unsubscribed.
            remaining = [c for c in consumers if not c.startswith(prefix)]
        else:
            entry = f"{principal}:{client_ref}"
            remaining = [c for c in consumers if c != entry]
        if remaining != consumers:
            self._write_consumers(task, remaining)
        # Proceed to unsubscribe the principal only once it has no tab left on this
        # task; a surviving tab of the same principal keeps it subscribed.
        return not any(c.startswith(prefix) for c in remaining)

    def routing_channels(self, task: "CoreTask") -> list[str] | None:
        # The consumer entries are exactly the per-tab realtime routing keys
        # (`"<principal>:<tab_id>"`), so a task-status message reaches only the
        # tabs watching this task. Empty -> None so a task with no recorded tab
        # (all detached, or a no-tab caller) falls back to principal-grain fanout
        # instead of dropping it.
        return self._consumers(task) or None
