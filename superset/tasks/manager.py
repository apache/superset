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
"""Task manager for the Global Task Framework (GTF)"""

from __future__ import annotations

import logging
from typing import Any, Callable, TYPE_CHECKING, TypeVar
from uuid import UUID

import redis
from flask import has_app_context
from superset_core.tasks.types import TaskProperties, TaskScope, TaskStatus

from superset.tasks.constants import ABORT_STATES, TERMINAL_STATES
from superset.tasks.utils import generate_random_task_key

if TYPE_CHECKING:
    from flask import Flask

    from superset.coordination.types import SignalListener
    from superset.models.tasks import Task

logger = logging.getLogger(__name__)

T = TypeVar("T")


def _in_app_context(app: "Flask | None", fn: Callable[[], T]) -> Callable[[], T]:
    """Wrap ``fn`` so it runs inside ``app``'s context when none is active.

    Completion waits and abort listeners run from background threads and Celery
    workers, where the metastore reads they perform need an explicit app context.
    When a context is already pushed (or no app was supplied) ``fn`` runs as-is.
    """

    def wrapped() -> T:
        if app and not has_app_context():
            with app.app_context():
                return fn()
        return fn()

    return wrapped


class TaskManager:
    """
    Handles task creation, scheduling, and abort notifications.

    The TaskManager is responsible for:
    1. Creating task entries in the metastore (Task model)
    2. Scheduling task execution via Celery
    3. Handling deduplication (returning existing active task if duplicate)
    4. Managing real-time abort notifications (optional)

    Signal delivery is opt-in via DISTRIBUTED_COORDINATION_CONFIG. When configured,
    completion/abort are delivered over Redis Streams; when not, tasks use database
    polling for abort detection and completion waits.
    """

    # Class-level state (initialized once via init_app)
    _channel_prefix: str = "gtf:abort:"
    _completion_channel_prefix: str = "gtf:complete:"
    _realtime_channel_prefix: str = ""
    _initialized: bool = False

    @classmethod
    def init_app(cls, app: Flask) -> None:
        """
        Initialize the TaskManager with Flask app config.

        Redis connection is managed by CacheManager - this just reads channel prefixes.

        :param app: Flask application instance
        """
        if cls._initialized:
            return

        cls._channel_prefix = app.config.get("TASKS_ABORT_CHANNEL_PREFIX", "gtf:abort:")
        cls._completion_channel_prefix = app.config.get(
            "TASKS_COMPLETION_CHANNEL_PREFIX", "gtf:complete:"
        )
        # The realtime prefix may be configured as a string or a zero-argument
        # callable; resolve it once here so the channel is fixed for the process
        # lifetime (the consumer subscribes to a single channel and cannot follow
        # a value that changes between publishes).
        realtime_prefix = app.config.get("REALTIME_CHANNEL_PREFIX", "")
        cls._realtime_channel_prefix = (
            realtime_prefix() if callable(realtime_prefix) else realtime_prefix
        )

        cls._initialized = True

    # Single best-effort Pub/Sub channel carrying every browser-bound realtime message
    # (superset-websocket subscribes to just this one). Each message is a
    # self-describing envelope ``{topic, scope, routes, payload}``:
    #   - ``topic``   - the semantic stream (``task.status``, ``entity.changed``,
    #     later ``notification.*`` etc.); the browser dispatches on it.
    #   - ``scope``   - the delivery breadth the server routes by:
    #     ``authenticated_global`` (broadcast to every authenticated socket) or
    #     ``principal``/``tab`` (targeted to the keys in ``routes`` — the server
    #     treats both the same way; the distinction is only descriptive).
    #   - ``routes``  - server-computed routing keys (``user:<id>`` /
    #     ``guest:<hmac>`` / per-tab ``user:<id>:<tabId>``), omitted for a
    #     broadcast. They never reach the browser.
    #   - ``payload`` - the feature-defined body forwarded to the browser.
    # This separates the semantic topic (what a message is) from the route (who
    # receives it): a new surface adds a topic without inventing channel names or
    # overloading payload shapes. The channel name and envelope shape are a
    # wire-protocol contract with the Node server. The name is
    # ``<REALTIME_CHANNEL_PREFIX>realtime``: Redis Pub/Sub is not scoped by DB
    # number, so deployments sharing one Redis/Valkey set a per-deployment prefix
    # (identically on both sides) to keep their channels isolated. Pub/Sub is
    # best-effort, so no message here may carry a signal a receiver must not miss —
    # each feature's authorized REST poll/fetch is the correctness backstop. Moving
    # a surface to websocket-only (retiring its poll) requires guaranteed,
    # replayable delivery first (e.g. Redis Streams with a per-consumer cursor).
    _REALTIME_CHANNEL_BASE = "realtime"

    # Envelope topics.
    TOPIC_TASK_STATUS = "task.status"
    TOPIC_ENTITY_CHANGED = "entity.changed"

    # Envelope scopes (delivery breadth).
    SCOPE_AUTHENTICATED_GLOBAL = "authenticated_global"
    SCOPE_PRINCIPAL = "principal"
    SCOPE_TAB = "tab"

    @classmethod
    def get_realtime_channel(cls) -> str:
        """Return the realtime pub/sub channel name (prefix + base).

        The prefix is resolved once from config in ``init_app`` (string, or a
        zero-argument callable evaluated there), so the channel is stable for the
        process lifetime and stays in lockstep with the consumer's single
        subscription.
        """
        return f"{cls._realtime_channel_prefix}{cls._REALTIME_CHANNEL_BASE}"

    @classmethod
    def _publish_realtime(
        cls,
        topic: str,
        scope: str,
        payload: dict[str, Any],
        routes: list[str] | None = None,
    ) -> bool:
        """Publish one realtime envelope on the shared channel (best-effort).

        Returns False (no-op) when no coordination backend is configured; a
        transient publish error propagates to the caller's best-effort guard.
        ``routes`` carries the targeted routing keys and is omitted for a
        broadcast (``authenticated_global``) scope.
        """
        from superset.coordination.base import CoordinationService
        from superset.utils import json

        if not CoordinationService.is_backend_defined():
            return False
        envelope: dict[str, Any] = {"topic": topic, "scope": scope, "payload": payload}
        if routes is not None:
            envelope["routes"] = routes
        CoordinationService.publish(cls.get_realtime_channel(), json.dumps(envelope))
        return True

    @staticmethod
    def _authorized_routes(routes: list[str], principals: list[str]) -> list[str]:
        """Keep only routing keys within one of the task's subscriber principals.

        A subscription policy computes its own routing keys (e.g. per-tab
        ``user:<id>:<tabId>``). This guards against a policy bug — or a future
        policy — routing to a principal that is not a subscriber of the task: a key
        is allowed only when it equals a subscriber principal channel or is a
        per-client suffix of one (``<principal>:...``). Rejected keys are logged
        and dropped.
        """
        allowed = set(principals)
        authorized: list[str] = []
        for route in routes:
            if route in allowed or any(route.startswith(f"{p}:") for p in allowed):
                authorized.append(route)
            else:
                logger.warning(
                    "Dropping task-status route %s outside subscriber principals",
                    route,
                )
        return authorized

    @classmethod
    def publish_entity_change(cls, task_uuid: UUID) -> bool:
        """Publish an opaque "entity changed" nudge for realtime UIs.

        Best-effort broadcast (may be dropped) carrying only ``{entity_type, id}``
        (the integer primary key, which a realtime list view matches and refetches
        by) — no status or payload, which are task-specific and would not
        generalize across entity types. Broadcast to every authenticated socket
        (``scope=authenticated_global``); each client filters to the ids and types
        it renders and re-fetches the actual (authz-scoped) state through the
        authorized REST API. No-op when no coordination backend is configured or
        the task no longer exists.

        :param task_uuid: UUID of the changed task
        :returns: True if the nudge was published, False otherwise
        """
        from superset.coordination.base import CoordinationService
        from superset.daos.tasks import TaskDAO

        if not CoordinationService.is_backend_defined():
            return False
        try:
            task_id = TaskDAO.get_id(task_uuid)
            if task_id is None:
                return False
            return cls._publish_realtime(
                cls.TOPIC_ENTITY_CHANGED,
                cls.SCOPE_AUTHENTICATED_GLOBAL,
                {"entity_type": "task", "id": task_id},
            )
        except Exception as ex:  # noqa: BLE001 pylint: disable=broad-except
            # Strictly best-effort: a Redis or serialization hiccup here must never
            # disrupt completion signalling - the client's interval poll is the
            # backstop.
            logger.warning(
                "Failed to publish entity change for task %s: %s", task_uuid, ex
            )
            return False

    @classmethod
    def publish_required_by_changed(cls, task_uuid: UUID) -> None:
        """Nudge the realtime rows of the tasks that depend on ``task_uuid``.

        A dependent's list row shows its prerequisites' statuses (the "depends on"
        detail and the "waiting on N" indicator), so a prerequisite's status
        change must also refresh the rows of the tasks in its ``required_by`` set
        — the prerequisite's own entity-change nudge only refetches its own row.
        Best-effort: no-op without a coordination backend or when nothing depends
        on the task.
        """
        from superset.coordination.base import CoordinationService
        from superset.daos.tasks import TaskDAO

        if not CoordinationService.is_backend_defined():
            return
        try:
            for required_by_uuid in TaskDAO.get_required_by_uuids(task_uuid):
                cls.publish_entity_change(required_by_uuid)
        except Exception as ex:  # noqa: BLE001 pylint: disable=broad-except
            logger.warning(
                "Failed to publish required-by changes for task %s: %s",
                task_uuid,
                ex,
            )

    @classmethod
    def publish_task_status(cls, task_uuid: UUID, status: str) -> bool:
        """Publish one task ``status`` message for websocket fanout.

        Best-effort targeted delivery: publish a ``task.status`` envelope carrying
        ``{task_id, status}`` and the realtime routing keys the websocket server
        delivers to (it forwards ``{topic, payload}`` to the sockets bound to each
        key). By default the keys are principal-grain (``user:<id>`` /
        ``guest:<hmac>``, ``scope=principal``), so
        the submitter and any SHARED-dedup joiners see the transition on their
        principal channel. A task type may narrow delivery via its subscription
        policy's ``routing_channels`` — chart-data returns its per-tab keys
        (``user:<id>:<tabId>``, ``scope=tab``) so only the tab watching the task is
        notified. Policy-returned keys are validated against the task's own
        subscriber principals (see ``_authorized_routes``) so a policy can never
        route to another principal. No-op when no coordination backend is
        configured or the task has no resolvable routing keys; callers must never
        let a failure here disrupt completion signalling (the interval poll is the
        backstop).

        :param task_uuid: public UUID of the task (also carried in the payload)
        :param status: the task's current status
        :returns: True if a message was published, False otherwise
        """
        from superset.coordination.base import CoordinationService
        from superset.daos.tasks import TaskDAO
        from superset.tasks.registry import TaskRegistry

        if not CoordinationService.is_backend_defined():
            return False
        try:
            task = TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True)
            if task is None:
                return False
            # Principal-grain keys derived from the task's own subscribers: always
            # trusted (built here from the authorized subscriber rows) and the set a
            # policy's keys are validated against.
            principal_routes = [
                f"user:{p['sub']}" if p["principal_type"] == "user" else p["sub"]
                for p in TaskDAO.get_subscriber_principals(task.id)
            ]
            # A task type may target specific routing keys (e.g. chart-data's
            # per-tab channels). Distinguish "no policy narrowing" from "policy
            # scoped delivery but nothing survived validation".
            policy = TaskRegistry.get_subscription_policy(task.task_type)
            policy_routes = policy.routing_channels(task) if policy else None
            if policy_routes is None:
                # No policy (or the policy declined to narrow): principal-grain
                # fanout to every subscriber principal.
                routes, scope = principal_routes, cls.SCOPE_PRINCIPAL
            else:
                # The policy explicitly scoped delivery (e.g. per-tab). Keep only
                # its keys within the task's subscriber principals; if that leaves
                # none, publish nothing rather than broadening to every tab of the
                # principal (which would break the policy's intended isolation) —
                # the interval poll remains the correctness path.
                routes = cls._authorized_routes(policy_routes, principal_routes)
                scope = cls.SCOPE_TAB
            if not routes:
                return False
            return cls._publish_realtime(
                cls.TOPIC_TASK_STATUS,
                scope,
                {"task_id": str(task_uuid), "status": status},
                routes=routes,
            )
        except Exception as ex:  # noqa: BLE001 pylint: disable=broad-except
            # Strictly best-effort (mirrors publish_entity_change): a Redis or
            # serialization hiccup must never disrupt completion signalling.
            logger.warning(
                "Failed to publish task status for task %s: %s", task_uuid, ex
            )
            return False

    @classmethod
    def get_abort_channel(cls, task_uuid: UUID) -> str:
        """
        Get the abort channel name for a task.

        :param task_uuid: UUID of the task
        :returns: Channel name for the task's abort notifications
        """
        return f"{cls._channel_prefix}{task_uuid}"

    @classmethod
    def publish_abort(cls, task_uuid: UUID) -> bool:
        """
        Signal that the task should abort so any abort listener wakes and re-checks.

        Emits the abort signal through the coordination service (Redis Streams when
        a backend is configured), so an abort listener wakes and re-checks. Best-effort:
        no-op (returns False) when no coordination backend is configured, in which case
        listeners poll the task row instead.

        :param task_uuid: UUID of the task to abort
        :returns: True if the signal was emitted, False if no backend / Redis error
        """
        from superset.coordination.base import CoordinationService

        if not CoordinationService.is_backend_defined():
            return False

        try:
            channel = cls.get_abort_channel(task_uuid)
            CoordinationService.notify(channel, "abort")
            logger.debug("Signalled abort on %s", channel)
            return True
        except redis.RedisError as ex:
            # Best-effort: listeners fall back to polling, so a transient Redis
            # error here is not a correctness problem.
            logger.warning("Failed to signal abort for task %s: %s", task_uuid, ex)
            return False

    @classmethod
    def get_completion_channel(cls, task_uuid: UUID) -> str:
        """
        Get the completion channel name for a task.

        :param task_uuid: UUID of the task
        :returns: Channel name for the task's completion notifications
        """
        return f"{cls._completion_channel_prefix}{task_uuid}"

    @classmethod
    def publish_completion(cls, task_uuid: UUID, status: str) -> bool:
        """
        Signal task completion so any waiter wakes and re-checks.

        Called when the task reaches a terminal state (SUCCESS, FAILURE, ABORTED,
        TIMED_OUT); wakes waiters (e.g. sync join-and-wait, DAG dependents) through
        the coordination service (Redis Streams when a backend is configured).
        Best-effort: no-op (returns False) when no coordination backend is configured,
        in which case waiters poll the task row instead.

        :param task_uuid: UUID of the completed task
        :param status: Final status of the task
        :returns: True if the signal was emitted, False if no backend / Redis error
        """
        from superset.coordination.base import CoordinationService

        if not CoordinationService.is_backend_defined():
            return False

        try:
            channel = cls.get_completion_channel(task_uuid)
            CoordinationService.notify(channel, status)
            logger.debug("Signalled completion on %s (status=%s)", channel, status)
            # The tier-1 entity-change nudge for the terminal transition is emitted
            # by InternalStatusTransitionCommand (post-commit), so it is not
            # repeated here. Push one targeted fanout message (tier-2) so each
            # subscribed chart-data client can learn completion detail over the
            # socket instead of re-polling the REST API.
            cls.publish_task_status(task_uuid, status)
            return True
        except redis.RedisError as ex:
            # Best-effort: waiters fall back to polling, so a transient Redis
            # error here is not a correctness problem.
            logger.warning("Failed to signal completion for task %s: %s", task_uuid, ex)
            return False

    @classmethod
    def wait_for_completion(
        cls,
        task_uuid: UUID,
        timeout: float | None = None,
        poll_interval: float = 1.0,
        app: "Flask | None" = None,
    ) -> "Task":
        """
        Block until task reaches terminal state.

        Delegates the wake-else-poll orchestration to
        :meth:`CoordinationService.wait_for_signal`; here we only supply the
        completion channel and a metastore predicate that returns the task once it is
        terminal.

        :param task_uuid: UUID of the task to wait for
        :param timeout: Maximum time to wait in seconds (None = no limit)
        :param poll_interval: Interval for database polling (seconds)
        :param app: Flask app for database access
        :returns: Task in terminal state
        :raises TimeoutError: If timeout expires before task completes
        :raises ValueError: If task not found
        """
        from superset.coordination.base import CoordinationService
        from superset.daos.tasks import TaskDAO

        # Reads back the task named by the caller's own task_uuid, not a
        # user-requested lookup; see TaskFilter for the request-scoped vs.
        # internal-plumbing split.
        get_task = _in_app_context(
            app,
            lambda: TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True),
        )

        # Fail fast if the task doesn't exist at all.
        if get_task() is None:
            raise ValueError(f"Task {task_uuid} not found")

        def terminal_task() -> "Task | None":
            task = get_task()
            return task if task and task.status in TERMINAL_STATES else None

        return CoordinationService.wait_for_signal(
            cls.get_completion_channel(task_uuid),
            terminal_task,
            timeout=timeout,
            poll_interval=poll_interval,
        )

    @classmethod
    def listen_for_abort(
        cls,
        task_uuid: UUID,
        callback: Callable[[], None],
        poll_interval: float,
        app: "Flask | None" = None,
    ) -> "SignalListener":
        """
        Start listening for abort notifications for a task.

        Delegates the pub/sub-wake-else-poll orchestration to
        :meth:`CoordinationService.listen_for_signal`; here we only supply the abort
        channel and an (app-context-aware) abort predicate + callback.

        :param task_uuid: UUID of the task to monitor (native UUID)
        :param callback: Function to call when abort is detected
        :param poll_interval: Interval for database polling (when Redis not configured)
        :param app: Flask app for database access in background thread
        :returns: SignalListener handle to stop listening
        """
        from superset.coordination.base import CoordinationService

        return CoordinationService.listen_for_signal(
            cls.get_abort_channel(task_uuid),
            check=_in_app_context(app, lambda: cls._check_abort_status(task_uuid)),
            on_signal=_in_app_context(app, callback),
            poll_interval=poll_interval,
            name=str(task_uuid),
        )

    @classmethod
    def _check_abort_status(cls, task_uuid: UUID) -> bool:
        """
        Check if task has been aborted via database query.

        :param task_uuid: UUID of the task to check (native UUID)
        :returns: True if task is in ABORTING or ABORTED state
        """
        from superset.daos.tasks import TaskDAO

        # Internal control-flow check on the task the executor is already
        # running, not a user-facing lookup; see TaskFilter.
        task = TaskDAO.find_one_or_none(uuid=task_uuid, skip_base_filter=True)
        return task is not None and task.status in ABORT_STATES

    @staticmethod
    def submit_task(
        task_type: str,
        task_key: str | None,
        task_name: str | None,
        scope: TaskScope,
        timeout: int | None,
        args: tuple[Any, ...],
        kwargs: dict[str, Any],
        depends_on: list[Task | UUID | str] | None = None,
    ) -> "Task":
        """
        Create task entry and schedule for async execution.

        Flow:
        1. Generate task_key if not provided (random UUID)
        2. Submit to SubmitTaskCommand which handles locking and create-vs-join
        3. Schedule Celery task ONLY for new tasks (not deduplicated ones)
        4. Return Task model to caller

        The SubmitTaskCommand uses a distributed lock to prevent race conditions,
        returning either a new task or an existing active task with the same key.

        :param task_type: Task type identifier (e.g., "superset.generate_thumbnail")
        :param task_key: Optional deduplication key (None for random UUID)
        :param task_name: Human readable task name
        :param scope: Task scope (TaskScope.PRIVATE, SHARED, or SYSTEM)
        :param timeout: Optional timeout in seconds
        :param args: Positional arguments for the task function
        :param kwargs: Keyword arguments for the task function
        :param depends_on: Optional prerequisite tasks (as Task entities, UUIDs,
            or UUID strings). The task is still enqueued immediately; ordering is
            enforced in the scheduler, which defers execution (via Celery retry,
            without holding a worker) until prerequisites are terminal.
        :returns: Task model representing the scheduled task
        """
        from superset.commands.tasks.submit import SubmitTaskCommand

        if task_key is None:
            task_key = generate_random_task_key()

        properties: TaskProperties = {"execution_mode": "async"}
        if timeout:
            properties["timeout"] = timeout

        # SubmitTaskCommand holds the dedup lock and decides create-vs-join, so
        # is_new tells us whether execution still has to be enqueued below.
        task, is_new = SubmitTaskCommand(
            {
                "task_key": task_key,
                "task_type": task_type,
                "task_name": task_name,
                "scope": scope.value,
                "properties": properties,
                "depends_on": depends_on,
            }
        ).run_with_info()

        # A joined task is already pending or running, so it must not be enqueued
        # a second time.
        if is_new:
            # Import here to avoid circular dependency
            from superset.tasks.scheduler import execute_task

            try:
                execute_task.delay(
                    task_uuid=str(task.uuid),
                    task_type=task_type,
                    args=args,
                    kwargs=kwargs,
                )
            except Exception:
                # The task row is committed but the broker rejected the enqueue
                # (e.g. broker down). Leaving it PENDING would poison the dedup
                # key — future identical submits would join a task that never
                # runs. Fail it so the key frees up and any waiter/client sees a
                # terminal state, then re-raise so the caller learns the submit
                # failed.
                TaskManager._fail_unenqueued_task(task.uuid, task_type)
                raise

            logger.debug(
                "Scheduled task %s (uuid=%s) for async execution",
                task_type,
                task.uuid,
            )
        else:
            logger.debug(
                "Joined existing task %s (uuid=%s) - no new Celery task scheduled",
                task_type,
                task.uuid,
            )

        return task

    @classmethod
    def _fail_unenqueued_task(cls, task_uuid: UUID, task_type: str) -> None:
        """Mark a just-created task FAILURE after its Celery enqueue failed.

        Best-effort: any exception here is swallowed and logged so it never masks
        the original enqueue error the caller is about to re-raise.
        """
        from superset.commands.tasks.internal_update import (
            InternalStatusTransitionCommand,
        )

        logger.exception(
            "Failed to enqueue task %s (uuid=%s); marking it FAILURE to free the "
            "dedup key",
            task_type,
            task_uuid,
        )
        try:
            transitioned = InternalStatusTransitionCommand(
                task_uuid=task_uuid,
                new_status=TaskStatus.FAILURE,
                expected_status=TaskStatus.PENDING,
                set_ended_at=True,
                properties={"error_message": "Failed to enqueue task for execution"},
            ).run()
            if transitioned:
                cls.publish_completion(task_uuid, TaskStatus.FAILURE.value)
        except Exception:  # noqa: BLE001
            logger.exception(
                "Cleanup after failed enqueue of task %s (uuid=%s) also failed; it "
                "is left PENDING with no heartbeat and will NOT be auto-reaped "
                "(the reaper only reclaims tasks that have started). Its dedup key "
                "stays occupied until it is manually cleared or its row is pruned",
                task_type,
                task_uuid,
            )
