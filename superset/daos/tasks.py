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
"""Task DAO for Global Task Framework (GTF)"""

import logging
from datetime import datetime, timedelta
from typing import Any, cast, Literal, TypedDict
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.orm import object_session
from sqlalchemy.sql.elements import ColumnElement
from superset_core.tasks.types import TaskProperties, TaskScope, TaskStatus

from superset.daos.base import BaseDAO
from superset.daos.exceptions import DAODeleteFailedError
from superset.extensions import db
from superset.models.task_dependencies import TaskDependency
from superset.models.task_subscribers import TaskSubscriber
from superset.models.tasks import Task
from superset.tasks.constants import ABORTABLE_STATES, ACTIVE_STATES, TERMINAL_STATES
from superset.tasks.filters import TaskFilter
from superset.tasks.utils import (
    floored_status_cursor,
    get_active_dedup_key,
    get_finished_dedup_key,
    json,
    naive_utcnow,
    parse_payload,
    parse_properties,
)

logger = logging.getLogger(__name__)


SubscriberPrincipalType = Literal["user", "guest"]


class TaskSubscriberPrincipal(TypedDict):
    principal_type: SubscriberPrincipalType
    sub: str


class TaskDAO(BaseDAO[Task]):
    """
    Concrete TaskDAO for the Global Task Framework (GTF).

    Provides database access operations for async tasks including
    creation, status management, filtering, and subscription management
    for shared tasks.
    """

    base_filter = TaskFilter
    # Task rows are cross-worker state. A Celery worker can hold a ``Task``
    # instance while another worker commits a status transition for the same row,
    # so TaskDAO entity lookups refresh identity-map instances by default.
    force_fetch = True

    @classmethod
    def get_status(cls, task_uuid: UUID) -> str | None:
        """
        Get only the status of a task by UUID.

        This is a lightweight query that only fetches the status column,
        optimized for polling endpoints where full entity loading is unnecessary.
        Applies the base filter (TaskFilter) to enforce permission checks.

        :param task_uuid: UUID of the task
        :returns: Task status string, or None if task not found or not accessible
        """
        # Start with query on Task model so base filter can be applied
        query = cls._query()
        query = cls._apply_base_filter(query)
        query = query.filter(Task.uuid == task_uuid)

        # Select only the status column for efficiency
        result = query.with_entities(Task.status).one_or_none()
        return result[0] if result else None

    @classmethod
    def get_id(cls, task_uuid: UUID) -> int | None:
        """Return a task's integer primary key by UUID, or None if not found.

        Lightweight scalar lookup (no entity load, no base filter): used to carry
        the primary id in the realtime entity-change nudge, which the list view
        matches and refetches by. Internal plumbing on a task the caller already
        owns, not a user-facing lookup.
        """
        return db.session.query(Task.id).filter(Task.uuid == task_uuid).scalar()

    @classmethod
    def visible_task_ids_query(cls) -> Any:
        """Base-filtered query of task ids the current user can access.

        Applies ``TaskFilter`` (subscribed tasks for regular users, all for
        admins). Used to scope task-adjacent listings — e.g. the subscriber
        filter dropdown — to tasks the caller can actually see, rather than
        leaking the whole subscriber set.
        """
        return cls._apply_base_filter(db.session.query(Task.id))

    # Dialect SQL for the database's current time as a naive UTC timestamp. Used
    # so the heartbeat write and the orphan scan share one clock (the DB's) rather
    # than the worker's and the reaper's host clocks, which can skew and cause a
    # live task to be reaped early. None -> fall back to an app-side timestamp on
    # unrecognized dialects (correct if hosts are NTP-synced).
    _DB_UTCNOW_SQL = {
        "postgresql": "timezone('UTC', now())",
        "mysql": "UTC_TIMESTAMP()",
        "sqlite": "CURRENT_TIMESTAMP",
    }

    @classmethod
    def _db_utcnow_sql(cls) -> str | None:
        """Return the dialect's naive-UTC-now SQL, or None to use an app clock."""
        return cls._DB_UTCNOW_SQL.get(db.session.get_bind().dialect.name)

    @classmethod
    def _db_utcnow(cls) -> datetime:
        """Read the database's current time as a naive UTC datetime."""
        if (expr := cls._db_utcnow_sql()) is None:
            return naive_utcnow()
        # type_coerce applies DateTime result processing so SQLite's text value is
        # parsed into a datetime like the other drivers already return.
        return db.session.scalar(
            sa.select(sa.type_coerce(sa.text(expr), sa.DateTime()))
        )

    @classmethod
    def touch_heartbeat(cls, task_id: int) -> None:
        """Bump a task's ``last_heartbeat`` to now without touching ``changed_on``.

        Called on an interval by the executing worker's heartbeat thread so the
        reaper can tell a live task from an orphaned one. Uses a raw textual
        UPDATE on the single column: ``changed_on`` carries a client-side
        ``onupdate`` default that ORM/Core updates would fire, and any bump to
        ``changed_on`` would resurface the task in ``get_statuses_changed_since``
        every heartbeat (resetting client polling backoff). A textual statement
        bypasses that default processing entirely. Bound by integer ``id`` to
        sidestep ``UUIDType`` dialect handling.

        Stamps the *database* clock (via ``_db_utcnow_sql``) rather than the
        worker's host clock so the value is comparable to the reaper's scan
        without cross-host skew (see ``find_orphaned``).
        """
        if (expr := cls._db_utcnow_sql()) is not None:
            # expr is a fixed per-dialect literal, not user input.
            sql = f"UPDATE tasks SET last_heartbeat = {expr} WHERE id = :id"  # noqa: S608
            db.session.execute(sa.text(sql), {"id": task_id})
        else:
            db.session.execute(
                sa.text("UPDATE tasks SET last_heartbeat = :ts WHERE id = :id"),
                {"ts": naive_utcnow(), "id": task_id},
            )
        # Deliberate standalone commit: this is a single out-of-band column write,
        # not a unit of work, and must not be wrapped in the ORM transaction flow.
        db.session.commit()  # pylint: disable=consider-using-transaction

    @classmethod
    def find_orphaned(cls, orphan_timeout_seconds: int) -> list[UUID]:
        """Return UUIDs of active tasks abandoned by a dead worker.

        An orphan is any active task (PENDING/IN_PROGRESS/ABORTING) whose liveness
        heartbeat has gone stale (``last_heartbeat < now - orphan_timeout_seconds``)
        — no worker is refreshing it. A NULL heartbeat means no worker has picked
        the task up yet (still legitimately queued), so it is excluded. A task
        still being worked on (fresh heartbeat) is never returned, so this never
        interferes with a live worker's cooperative abort/cleanup.

        The staleness cutoff is anchored on the *database* clock (the same clock
        the heartbeat is stamped with) so it does not depend on this host's clock
        agreeing with the workers'.

        Skips the base filter: internal maintenance over all tasks, not a
        user-facing listing.
        """
        stale_before = cls._db_utcnow() - timedelta(seconds=orphan_timeout_seconds)
        rows = (
            db.session.query(Task.uuid)
            .filter(
                Task.status.in_(ACTIVE_STATES),
                Task.last_heartbeat.isnot(None),
                Task.last_heartbeat < stale_before,
            )
            .all()
        )
        return [uuid for (uuid,) in rows]

    @classmethod
    def get_statuses_changed_since(
        cls, cursor: datetime | None, task_type: str | None = None
    ) -> tuple[dict[str, dict[str, Any]], datetime]:
        """Return ``{uuid: {status, progress}}`` for tasks changed since ``cursor``.

        The minimal-IO polling primitive behind both the async chart-data
        completion poll and the realtime task list. The base filter
        (``TaskFilter``) scopes results to tasks the caller can see (subscribed
        tasks for regular users, all tasks for admins), so callers never pass an
        explicit id list. ``task_type`` optionally narrows to a single kind (e.g.
        chart-data query tasks) so a client tracks only the work it cares about.

        Without a ``cursor`` this establishes a **baseline**: it returns no
        statuses and a fresh watermark (the current server clock), so a client
        gets a definitive starting point without dumping every task in the
        metastore. Subsequent calls pass that watermark back and receive only
        tasks whose ``changed_on >= cursor`` (``>=``, not ``>``, so no transition
        straddling the boundary is missed — re-delivery of an already-seen status
        is idempotent for the client, a miss would hang it).

        Returns the ``{uuid: {status, progress}}`` map (``progress`` is the
        0.0–1.0 percent from the task's properties, or ``None`` when unknown) plus
        the next cursor to poll with — the server clock captured *before* the read,
        so the watermark always advances. (Using the batch's ``max(changed_on)``
        would freeze the cursor on a task whose ``changed_on`` sits exactly at it —
        the ``>=`` bound re-delivers that row every poll, so ``max`` never moves and
        an idle/orphaned in-progress task is re-fetched forever.)
        """
        # Baseline: no cursor → start "from now", surfacing only later changes.
        # Floor to whole seconds: changed_on is stored at the metastore column's
        # precision (MySQL DATETIME truncates to seconds), so a sub-second cursor
        # could sit *after* a same-second change and miss it under the >= bound.
        # Flooring keeps >= inclusive on every backend; re-delivering an earlier
        # same-second change is harmless (idempotent for the client).
        if cursor is None:
            return {}, floored_status_cursor()

        # Watermark for the *next* poll, captured before the read so a change
        # landing during the query is caught next time (>= is inclusive), never
        # skipped. Same naive-local clock as ``changed_on`` (FAB AuditMixin),
        # floored to whole seconds (see the baseline case above).
        next_cursor = floored_status_cursor()
        query = cls._apply_base_filter(db.session.query(Task)).filter(
            # Task.changed_on's type is shadowed by CoreTask's bare annotation
            # (datetime | None), so reference the real column for the comparison.
            Task.__table__.c.changed_on >= cursor
        )
        if task_type is not None:
            query = query.filter(Task.task_type == task_type)
        rows = query.with_entities(
            Task.uuid, Task.status, Task.changed_on, Task.properties
        ).all()

        statuses: dict[str, dict[str, Any]] = {}
        for uuid, status, _changed_on, properties in rows:
            progress = parse_properties(properties).get("progress_percent")
            statuses[str(uuid)] = {"status": status, "progress": progress}
        return statuses, next_cursor

    @classmethod
    def find_by_task_key(
        cls,
        task_type: str,
        task_key: str,
        scope: TaskScope | str = TaskScope.PRIVATE,
        user_id: int | None = None,
    ) -> Task | None:
        """
        Find active task by type, key, scope, and user.

        Uses dedup_key internally for efficient querying with a unique index.
        Only returns tasks that are active (pending or in progress).

        Uniqueness logic by scope:
        - private: scope + task_type + task_key + user_id
        - shared/system: scope + task_type + task_key (user-agnostic)

        :param task_type: Task type to filter by
        :param task_key: Task identifier for deduplication
        :param scope: Task scope (private/shared/system)
        :param user_id: User ID (required for private tasks)
        :returns: Task instance or None if not found or not active
        """
        dedup_key = get_active_dedup_key(
            scope=scope,
            task_type=task_type,
            task_key=task_key,
            user_id=user_id,
        )

        # Simple single-column query with unique index
        return cls._query().filter(Task.dedup_key == dedup_key).one_or_none()

    @classmethod
    def create_task(
        cls,
        task_type: str,
        task_key: str,
        scope: TaskScope | str = TaskScope.PRIVATE,
        user_id: int | None = None,
        guest_key: str | None = None,
        payload: dict[str, Any] | None = None,
        properties: TaskProperties | None = None,
        **kwargs: Any,
    ) -> Task:
        """
        Create a new task record in the database.

        This is a pure data operation - assumes caller holds lock and has
        already checked for existing tasks. Business logic (create vs join)
        is handled by SubmitTaskCommand.

        :param task_type: Type of task to create
        :param task_key: Task identifier (required)
        :param scope: Task scope (private/shared/system), defaults to private
        :param user_id: User ID creating the task
        :param payload: Optional user-defined context data (dict)
        :param properties: Optional framework-managed runtime state (e.g., timeout)
        :param kwargs: Additional task attributes (e.g., task_name)
        :returns: Created Task instance
        """
        # Handle both TaskScope enum and string values
        scope_value = scope.value if isinstance(scope, TaskScope) else scope
        scope_enum = scope if isinstance(scope, TaskScope) else TaskScope(scope)

        # Validate user_id is required for private tasks
        if scope_enum == TaskScope.PRIVATE and user_id is None:
            raise ValueError("user_id is required for private tasks")

        # Build dedup_key for active task
        dedup_key = get_active_dedup_key(
            scope=scope,
            task_type=task_type,
            task_key=task_key,
            user_id=user_id,
        )

        # Note: properties is handled separately via update_properties()
        task_data = {
            "task_type": task_type,
            "task_key": task_key,
            "scope": scope_value,
            "status": TaskStatus.PENDING.value,
            "dedup_key": dedup_key,
            **kwargs,
        }

        # Handle payload - serialize to JSON if dict provided
        if payload:
            task_data["payload"] = json.dumps(payload)

        if user_id is not None:
            task_data["user_id"] = user_id

        task = cls.create(attributes=task_data)

        # Set properties after creation via update_properties (handles caching).
        # Seed dedupe_count so every task carries it from the start (bumped each
        # time a later submit joins this task instead of creating a new one), and
        # the two internal ``private`` namespaces (framework/task) so internal
        # runtime state always has an isolated home.
        task.update_properties(
            {
                "dedupe_count": 0,
                "private": {"framework": {}, "task": {}},
                **(properties or {}),
            }
        )

        # Flush to get the task ID (auto-incremented primary key)
        db.session.flush()

        # Auto-subscribe creator for all tasks
        # This enables consistent subscriber display across all task types
        if user_id:
            cls.add_subscriber(task.id, user_id)
            logger.info(
                "Creator %s auto-subscribed to task: %s (scope: %s)",
                user_id,
                task_key,
                scope_value,
            )
        elif guest_key:
            # Embedded guest creator: subscribe by token-derived key so the guest
            # can see the task it just created (see superset.tasks.guest).
            cls.add_guest_subscriber(task.id, guest_key)

        logger.info(
            "Created new async task: %s (type: %s, scope: %s)",
            task_key,
            task_type,
            scope_value,
        )
        return task

    @classmethod
    def abort_task(cls, task_uuid: UUID, skip_base_filter: bool = False) -> Task | None:
        """
        Abort a task by UUID.

        This is a pure data operation. Business logic (subscriber count checks,
        permission validation) is handled by CancelTaskCommand which holds the lock.

        Abort behavior by status:
        - PENDING: Goes directly to ABORTED (always abortable)
        - IN_PROGRESS with is_abortable=True: Goes to ABORTING
        - IN_PROGRESS with is_abortable=False/None: Raises TaskNotAbortableError
        - ABORTING: Returns task (idempotent)
        - Finished statuses: Returns None

        Note: Caller is responsible for calling TaskManager.publish_abort() AFTER
        the transaction commits if task.status == ABORTING. This prevents race
        conditions where listeners check the DB before the status is visible.

        :param task_uuid: UUID of task to abort
        :param skip_base_filter: If True, skip base filter (for admin abortions)
        :returns: Task if aborted/aborting, None if not found or already finished
        :raises TaskNotAbortableError: If in-progress task has no abort handler
        """
        from superset.commands.tasks.exceptions import TaskNotAbortableError

        task = cls.find_one_or_none(skip_base_filter=skip_base_filter, uuid=task_uuid)
        if not task:
            return None

        # Already aborting - idempotent success
        if task.status == TaskStatus.ABORTING.value:
            logger.info("Task %s is already aborting", task_uuid)
            return task

        # Already finished - cannot abort
        if task.status not in ABORTABLE_STATES:
            return None

        # PENDING: Go directly to ABORTED
        if task.status == TaskStatus.PENDING.value:
            task.set_status(TaskStatus.ABORTED)
            logger.info("Aborted pending task: %s (scope: %s)", task_uuid, task.scope)
            return task

        # IN_PROGRESS: Check if abortable
        if task.status == TaskStatus.IN_PROGRESS.value:
            if task.properties_dict.get("is_abortable") is not True:
                raise TaskNotAbortableError(
                    f"Task {task_uuid} is in progress but has not registered "
                    "an abort handler (is_abortable is not true)"
                )

            # Transition to ABORTING (not ABORTED yet)
            task.set_status(TaskStatus.ABORTING)
            db.session.merge(task)
            logger.info("Set task %s to ABORTING (scope: %s)", task_uuid, task.scope)

            # NOTE: publish_abort is NOT called here - caller handles it after commit
            # This prevents race conditions where listeners check DB before commit

            return task

        return None

    # Subscription management methods

    @classmethod
    def get_subscriber_principals(cls, task_id: int) -> list[TaskSubscriberPrincipal]:
        """Return the principals subscribed to a task.

        Skips the base filter: this is internal plumbing for a task the executor
        already owns, not a user-facing listing. The websocket server maps these
        principal identities to its own socket routing keys.

        :param task_id: internal id of the task
        :returns: distinct subscriber principals; empty
            when the task has no resolvable subscribers
        """
        rows = (
            db.session.query(TaskSubscriber.user_id, TaskSubscriber.guest_key)
            .filter(TaskSubscriber.task_id == task_id)
            .order_by(TaskSubscriber.id.asc())
            .all()
        )
        principals: list[TaskSubscriberPrincipal] = []
        seen: set[tuple[SubscriberPrincipalType, str]] = set()
        for user_id, guest_key in rows:
            if user_id is not None:
                principal: TaskSubscriberPrincipal = {
                    "principal_type": "user",
                    "sub": str(user_id),
                }
            elif guest_key:
                principal = {"principal_type": "guest", "sub": guest_key}
            else:
                continue
            key = (principal["principal_type"], principal["sub"])
            if key not in seen:
                seen.add(key)
                principals.append(principal)
        return principals

    @classmethod
    def add_subscriber(cls, task_id: int, user_id: int) -> bool:
        """
        Add a user as a subscriber to a task.

        :param task_id: ID of the task
        :param user_id: ID of the user to subscribe
        :returns: True if subscriber was added, False if already exists
        """
        added = cls._add_subscription(task_id, user_id=user_id)
        if added:
            logger.info("Added subscriber %s to task %s", user_id, task_id)
        else:
            logger.debug(
                "Subscriber %s already subscribed to task %s", user_id, task_id
            )
        return added

    @classmethod
    def add_guest_subscriber(cls, task_id: int, guest_key: str) -> bool:
        """
        Subscribe an embedded guest (by token-derived key) to a task.

        The guest counterpart of ``add_subscriber``: guests have no ``ab_user``
        row, so they subscribe by ``guest_key`` (see ``superset.tasks.guest``),
        which grants them visibility of the task through ``TaskFilter``.

        :param task_id: ID of the task
        :param guest_key: Stable guest identity to subscribe
        :returns: True if subscriber was added, False if already exists
        """
        added = cls._add_subscription(task_id, guest_key=guest_key)
        if added:
            logger.info("Added guest subscriber to task %s", task_id)
        return added

    @classmethod
    def _add_subscription(
        cls,
        task_id: int,
        user_id: int | None = None,
        guest_key: str | None = None,
    ) -> bool:
        # Check first to avoid IntegrityError which invalidates the session
        # in nested transaction contexts (IntegrityError can't be recovered from)
        criteria: dict[str, int | str | None] = (
            {"user_id": user_id} if user_id is not None else {"guest_key": guest_key}
        )
        existing = (
            db.session.query(TaskSubscriber)
            .filter_by(task_id=task_id, **criteria)
            .first()
        )
        if existing:
            return False

        db.session.add(
            TaskSubscriber(
                task_id=task_id,
                user_id=user_id,
                guest_key=guest_key,
                subscribed_at=naive_utcnow(),
            )
        )
        db.session.flush()
        return True

    @classmethod
    def remove_subscriber(cls, task_id: int, user_id: int) -> Task | None:
        """
        Remove a user's subscription from a task and return the updated task.

        This is a pure data operation. Business logic (whether to abort after
        last subscriber leaves) is handled by CancelTaskCommand which holds
        the lock and decides whether to call abort_task() separately.

        :param task_id: ID of the task
        :param user_id: ID of the user to unsubscribe
        :returns: Updated Task if subscriber was removed, None if not subscribed
        :raises DAODeleteFailedError: If subscription removal fails
        """
        return cls._remove_subscription(
            task_id, TaskSubscriber.user_id == user_id, f"user {user_id}"
        )

    @classmethod
    def remove_guest_subscriber(cls, task_id: int, guest_key: str) -> Task | None:
        """
        Remove an embedded guest's subscription (by ``guest_key``) from a task.

        The guest counterpart of ``remove_subscriber`` (see ``superset.tasks.guest``).

        :param task_id: ID of the task
        :param guest_key: Guest identity to unsubscribe
        :returns: Updated Task if subscriber was removed, None if not subscribed
        :raises DAODeleteFailedError: If subscription removal fails
        """
        return cls._remove_subscription(
            task_id, TaskSubscriber.guest_key == guest_key, "guest"
        )

    @classmethod
    def _remove_subscription(
        cls, task_id: int, subscriber_clause: ColumnElement[bool], label: str
    ) -> Task | None:
        subscription = (
            db.session.query(TaskSubscriber)
            .filter(TaskSubscriber.task_id == task_id, subscriber_clause)
            .one_or_none()
        )

        if not subscription:
            return None

        try:
            db.session.delete(subscription)
            db.session.flush()
            logger.info("Removed subscriber %s from task %s", label, task_id)

            # Return the updated task
            task = cls.find_by_id(task_id, skip_base_filter=True)
            if task:
                db.session.refresh(task)  # Ensure subscribers list is fresh
            return task

        except DAODeleteFailedError:
            raise
        except Exception as ex:
            raise DAODeleteFailedError(
                f"Failed to remove subscription for task {task_id} ({label})"
            ) from ex

    # Dependency (DAG) management methods

    @classmethod
    def find_by_uuids(cls, uuids: list[UUID]) -> list[Task]:
        """
        Resolve a list of task UUIDs to Task instances.

        Used when persisting dependency edges, which are declared with public
        UUIDs but stored against the internal integer ``id``. The base filter is
        intentionally skipped: dependency resolution is a structural operation on
        tasks the caller is wiring together (typically its own), not a
        user-facing listing.

        :param uuids: Task UUIDs to resolve
        :returns: Matching Task instances (order not guaranteed; missing UUIDs
            are simply absent from the result)
        """
        if not uuids:
            return []
        return cls._query().filter(Task.uuid.in_(uuids)).all()

    @classmethod
    def add_dependencies(cls, task_id: int, depends_on_task_ids: list[int]) -> None:
        """
        Bulk-insert prerequisite edges: ``task_id`` depends on each id given.

        Only ever called for a freshly created task (see ``SubmitTaskCommand``)
        with already-deduplicated prerequisite ids, so no edge can pre-exist —
        the per-row existence check that ``add_subscriber`` needs is unnecessary
        here, and the edges are inserted in a single flush (one INSERT).

        :param task_id: ID of the dependent task
        :param depends_on_task_ids: IDs of the prerequisite tasks
        """
        if not depends_on_task_ids:
            return
        db.session.add_all(
            TaskDependency(task_id=task_id, depends_on_task_id=prerequisite_id)
            for prerequisite_id in depends_on_task_ids
        )
        db.session.flush()
        logger.info(
            "Added %d dependencies to task %s",
            len(depends_on_task_ids),
            task_id,
        )

    @classmethod
    def get_dependency_payloads(cls, task_uuid: UUID) -> list[dict[str, Any]]:
        """
        Return payload dictionaries for a task's prerequisite dependencies.

        The query reads scalar payload columns through the dependency table so
        task code observes committed prerequisite output without relying on
        identity-map state from an earlier relationship load.

        :param task_uuid: UUID of the dependent task
        :returns: prerequisite payloads in dependency edge order
        """
        task_id = (
            db.session.query(Task.id).filter(Task.uuid == task_uuid).scalar_subquery()
        )
        rows = (
            db.session.query(Task.payload)
            .join(TaskDependency, TaskDependency.depends_on_task_id == Task.id)
            .filter(TaskDependency.task_id == task_id)
            .order_by(TaskDependency.id.asc())
            .all()
        )
        return [parse_payload(payload) for (payload,) in rows]

    @classmethod
    def get_required_by_uuids(cls, task_uuid: UUID) -> list[UUID]:
        """Return the UUIDs of the tasks that depend on ``task_uuid``.

        The reverse of the dependency edge (indexed on ``depends_on_task_id``) —
        i.e. the task's ``required_by`` set. Used to nudge those tasks' realtime
        rows when this task's status changes, since a dependent row displays its
        prerequisites' statuses.
        """
        prerequisite_id = (
            db.session.query(Task.id).filter(Task.uuid == task_uuid).scalar_subquery()
        )
        rows = (
            db.session.query(Task.uuid)
            .join(TaskDependency, TaskDependency.task_id == Task.id)
            .filter(TaskDependency.depends_on_task_id == prerequisite_id)
            .all()
        )
        return [required_by_uuid for (required_by_uuid,) in rows]

    @classmethod
    def _with_current_subscription_state(
        cls, task_uuid: UUID, properties: TaskProperties
    ) -> TaskProperties:
        """Return ``properties`` with ``private.subscription`` as it is on the row.

        Reads the row under ``FOR UPDATE`` so the subsequent UPDATE and a
        concurrent policy write (:meth:`merge_subscription_state`, which takes the
        same lock) serialize instead of racing; a missing row yields the input
        unchanged and the caller's UPDATE then matches nothing.
        """
        from superset.tasks.utils import preserve_subscription_state

        current_raw = (
            db.session.query(Task.properties)
            .filter(Task.uuid == task_uuid)
            .with_for_update()
            .scalar()
        )
        if current_raw is None:
            return properties
        return preserve_subscription_state(properties, parse_properties(current_raw))

    @classmethod
    def merge_subscription_state(cls, task: Task, updates: dict[str, Any]) -> None:
        """Merge ``updates`` into the task's ``private.subscription`` namespace.

        The write path for subscription-policy hooks (chart-data's per-tab
        consumer list). Hooks run under the submit/cancel lock, but the executor
        does not hold that lock and keeps writing the task's properties while it
        runs (``is_abortable``, the engine cancel handle, progress), so two things
        are needed for the two writers not to clobber each other: the entity is
        refreshed from a row-locked read before merging, so the merge lands on top
        of whatever the executor has committed since the caller loaded the task
        rather than on the caller's stale copy; and the executor's whole-blob
        writes take the same row lock and re-read this namespace
        (:meth:`_with_current_subscription_state`). Pending changes on the
        session are flushed first so the refresh cannot discard them. A task not
        attached to a session (a bare model in a unit test) is merged in memory.
        """
        from superset.tasks.utils import SUBSCRIPTION_PRIVATE_NAMESPACE

        if object_session(task) is not None and task.id is not None:
            db.session.flush()
            (
                db.session.query(Task)
                .filter(Task.id == task.id)
                .with_for_update()
                .populate_existing()
                .one()
            )
        task.update_properties(
            cast(
                TaskProperties,
                {"private": {SUBSCRIPTION_PRIVATE_NAMESPACE: updates}},
            )
        )

    @classmethod
    def set_properties_and_payload(
        cls,
        task_uuid: UUID,
        properties: TaskProperties | None = None,
        payload: dict[str, Any] | None = None,
    ) -> bool:
        """
        Perform a zero-read SQL UPDATE on properties and/or payload columns.

        This method directly writes the provided values without reading first.
        The caller (TaskContext) is responsible for maintaining the authoritative
        cached state and passing complete values to write.

        This method is designed for internal task updates (progress, is_abortable)
        where the executor owns the state and doesn't need to read before writing.

        IMPORTANT: This method only touches properties and payload columns.
        It does NOT touch the status column, so it's safe to use concurrently
        with operations that modify status (like abort).

        The one exception to "zero-read" is the ``private.subscription`` subtree:
        it is owned by the task type's subscription policy and written under the
        submit/cancel lock, which the executor does not hold, so a complete-blob
        write re-reads that subtree from the row (under a row lock) and carries it
        through instead of overwriting it with the executor's pickup-time snapshot.

        :param task_uuid: UUID of the task to update
        :param properties: Complete properties dict to write (replaces existing,
            except ``private.subscription`` which is preserved from the row)
        :param payload: Complete payload dict to write (replaces existing)
        :returns: True if task was updated, False if not found or nothing to update
        """
        if properties is None and payload is None:
            return False

        # Build update values dict - no reads, just write what caller provides
        update_values: dict[str, Any] = {}

        if properties is not None:
            # Write complete properties (caller manages merging in their cache),
            # keeping the policy-owned subscription subtree as it is on the row.
            properties = cls._with_current_subscription_state(task_uuid, properties)
            update_values["properties"] = json.dumps(properties)

        if payload is not None:
            # Write complete payload (payload column name matches attribute name)
            update_values["payload"] = json.dumps(payload)

        if not update_values:
            return False

        # Execute targeted UPDATE - zero read, just write
        rows_updated = (
            db.session.query(Task)
            .filter(Task.uuid == task_uuid)
            .update(update_values, synchronize_session=False)
        )

        return rows_updated > 0

    @classmethod
    def conditional_status_update(
        cls,
        task_uuid: UUID,
        new_status: TaskStatus | str,
        expected_status: TaskStatus | str | list[TaskStatus | str],
        properties: TaskProperties | None = None,
        set_started_at: bool = False,
        set_ended_at: bool = False,
    ) -> bool:
        """
        Atomically update task status only if current status matches expected.

        This provides atomic compare-and-swap semantics for status transitions,
        preventing race conditions between executor status updates and concurrent
        abort operations. Uses a single UPDATE with WHERE clause for atomicity.

        Use cases:
        - Executor transitioning IN_PROGRESS → SUCCESS (only if not ABORTING)
        - Executor transitioning ABORTING → ABORTED/TIMED_OUT (cleanup complete)
        - Initial PENDING → IN_PROGRESS (task pickup)

        :param task_uuid: UUID of the task to update
        :param new_status: Target status to set
        :param expected_status: Current status(es) required for update to succeed.
            Can be a single status or list of statuses.
        :param properties: Optional properties to update atomically with status
        :param set_started_at: If True, also set started_at to current timestamp
        :param set_ended_at: If True, also set ended_at to current timestamp
        :returns: True if status was updated (expected matched), False otherwise
        """
        # Normalize status values
        new_status_val = (
            new_status.value if isinstance(new_status, TaskStatus) else new_status
        )

        # Build list of expected status values
        if isinstance(expected_status, list):
            expected_vals = [
                s.value if isinstance(s, TaskStatus) else s for s in expected_status
            ]
        else:
            expected_vals = [
                expected_status.value
                if isinstance(expected_status, TaskStatus)
                else expected_status
            ]

        # Build update values
        update_values: dict[str, Any] = {"status": new_status_val}

        if properties is not None:
            # A terminal write carries the executor's full property cache; keep the
            # policy-owned subscription subtree from the row (see
            # ``set_properties_and_payload``) so a late-joining client is still
            # routed the completion it is waiting for.
            properties = cls._with_current_subscription_state(task_uuid, properties)
            update_values["properties"] = json.dumps(properties)

        # Store as naive UTC (see ``naive_utcnow``), matching Task.set_status.
        if set_started_at:
            update_values["started_at"] = naive_utcnow()

        if set_ended_at:
            update_values["ended_at"] = naive_utcnow()

        # Update dedup_key if transitioning to terminal state
        if new_status_val in TERMINAL_STATES:
            update_values["dedup_key"] = get_finished_dedup_key(task_uuid)

        # Atomic compare-and-swap: only update if status matches expected
        rows_updated = (
            db.session.query(Task)
            .filter(Task.uuid == task_uuid, Task.status.in_(expected_vals))
            .update(update_values, synchronize_session=False)
        )

        if rows_updated > 0:
            logger.debug(
                "Conditional status update succeeded: %s -> %s (expected: %s)",
                task_uuid,
                new_status_val,
                expected_vals,
            )
        else:
            logger.debug(
                "Conditional status update skipped: %s -> %s "
                "(current status not in expected: %s)",
                task_uuid,
                new_status_val,
                expected_vals,
            )

        return rows_updated > 0
