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

"""Task-type subscription policies for the Global Task Framework (GTF).

The framework's own subscription model is **principal-oriented**: a task has one
subscriber row per principal (an authenticated user, or an embedded guest keyed
by a token-derived identity), and cancel/abort decisions are made from that
principal-grain subscriber count. That model — and everything built on it
(``TaskFilter`` visibility, ``subscriber_count``, ``raise_for_access``) — is
intentionally kept free of any finer notion of "who exactly is watching".

Some task types need a finer grain than the principal. The canonical case is
async chart-data: a single ``SHARED`` task is deduplicated across every request
for the same ``query_cache_key``, so one user watching it from **two browser
tabs** is still a single principal. If either tab's "cancel" (an explicit cancel
or a navigate-away teardown) were treated as *the* principal leaving, it would
abort the shared task and kill the other tab's still-pending query.

A **subscription policy** lets a task type refine this without the framework
knowing anything about tabs (or any other per-client grain). A task registers a
policy on its :func:`superset_core.tasks.decorators.task` decorator; the
framework invokes it, under the same lock that serializes submit/cancel, at two
points:

- **on subscribe** — after the framework has ensured the principal's subscriber
  row (create or dedup-join). The policy records the calling client.
- **on unsubscribe** — when a principal cancels. The policy drops the calling
  client and returns whether the principal has *any client left*. ``False`` means
  "one client detached, keep the principal subscribed and the task running";
  ``True`` means "the principal's last client is gone" and the framework then
  applies its normal principal-grain rule (unsubscribe the principal, and abort
  if it was the last subscriber).

A task type with no policy behaves exactly as before (principal-grain). The
policy owns its own bookkeeping — the chart-data policy, for instance, stores
its per-tab set in the task's ``private["subscription"]`` namespace (see
:class:`superset_core.tasks.types.PrivateProperties`), which the framework never
inspects. ``client_ref`` is an opaque, client-supplied identifier (e.g. a
browser-tab id); it is **not** an authorization token — the framework has
already authorized the calling principal before the policy runs, and the policy
only ever records/removes entries scoped to that principal.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from superset_core.tasks.models import Task


class TaskSubscriptionPolicy(ABC):
    """Per-client subscription refinement for a task type (see module docstring).

    Register an instance on the ``@task`` decorator
    (``@task(..., subscription_policy=MyPolicy())``). Both hooks run in the web
    request process, inside the distributed lock that serializes concurrent
    submit/cancel for the task, so an implementation may safely read-modify-write
    task state (e.g. a list in ``private["subscription"]``) without additional locking.
    """

    @abstractmethod
    def on_subscribe(
        self,
        task: "Task",
        *,
        principal: str,
        client_ref: str | None,
    ) -> None:
        """Record that ``client_ref`` (a client of ``principal``) joined ``task``.

        Called after the framework has ensured ``principal``'s subscriber row.
        Should be idempotent: the same ``(principal, client_ref)`` may be
        submitted more than once (e.g. a resubmit from the same tab).

        :param task: the task being subscribed to
        :param principal: the calling principal's stable routing id
            (``user:<id>`` for a user, the guest key for an embedded guest)
        :param client_ref: the opaque per-client id (e.g. a browser-tab id), or
            ``None`` when the caller supplied none (the policy should then no-op,
            preserving principal-grain behavior)
        """

    @abstractmethod
    def on_unsubscribe(
        self,
        task: "Task",
        *,
        principal: str,
        client_ref: str | None,
    ) -> bool:
        """Drop ``client_ref`` and report whether ``principal`` has any client left.

        Called when ``principal`` cancels the task.

        :param task: the task being cancelled
        :param principal: the calling principal's stable routing id
        :param client_ref: the opaque per-client id being removed, or ``None``
        :returns: ``True`` if the framework should proceed to unsubscribe
            ``principal`` (its last client is gone, or the caller supplied no
            ``client_ref``); ``False`` to keep ``principal`` subscribed because it
            still has other clients on this task (a single client detached).
        """

    def routing_channels(self, task: "Task") -> list[str] | None:
        """Realtime websocket routing keys for this task's status fanout.

        Lets a task type deliver ``task-status`` at a finer grain than the
        principal — e.g. only to the specific browser tab watching the task,
        rather than every tab the principal has open. Returns the list of opaque
        routing keys the realtime transport should target (it prefixes each with
        ``realtime:`` and never parses them); the caller delivers to exactly those
        keys.

        Return ``None`` (the default) to keep principal-grain fanout — the
        framework then derives one key per subscriber principal. A concrete policy
        that manages per-client keys should also return ``None`` (not an empty
        list) when it currently has no keys, so fanout falls back to
        principal-grain rather than silently delivering to no one.

        :param task: the task whose status is being published
        :returns: the routing keys to target, or ``None`` for principal-grain
        """
        return None
