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
"""Unified cancel task command for GTF."""

import logging
from functools import partial
from typing import TYPE_CHECKING
from uuid import UUID

from flask import current_app
from superset_core.tasks.types import TaskScope, TaskStatus

from superset.commands.base import BaseCommand
from superset.commands.tasks.exceptions import (
    TaskAbortFailedError,
    TaskNotAbortableError,
    TaskNotFoundError,
    TaskPermissionDeniedError,
)
from superset.extensions import security_manager
from superset.stats_logger import BaseStatsLogger
from superset.tasks.constants import TERMINAL_STATES
from superset.tasks.guest import get_guest_subscriber_key_for
from superset.tasks.locks import task_lock
from superset.tasks.registry import TaskRegistry
from superset.tasks.subscription import principal_channel
from superset.tasks.utils import get_active_dedup_key
from superset.utils.core import get_user_id
from superset.utils.decorators import on_error, transaction

if TYPE_CHECKING:
    from superset.models.tasks import Task

logger = logging.getLogger(__name__)


class CancelTaskCommand(BaseCommand):
    """
    Unified command to cancel a task.

    Behavior:
    - For private tasks or single-subscriber tasks: aborts the task
    - For shared tasks with multiple subscribers (non-admin): unsubscribes user
    - For shared tasks with force=True (admin only): aborts for all subscribers

    The term "cancel" is user-facing; internally this may abort or unsubscribe.

    This command acquires a distributed lock before starting a transaction to
    prevent race conditions with concurrent submit/cancel operations.

    Permission checks are deferred to inside the lock to minimize SELECTs:
    we only fetch the task once, then validate permissions on the fetched data.
    """

    def __init__(self, task_uuid: UUID, force: bool = False, tab_id: str | None = None):
        """
        Initialize the cancel command.

        :param task_uuid: UUID of the task to cancel
        :param force: If True, force abort even with multiple subscribers (admin only)
        :param tab_id: Opaque per-client (e.g. browser-tab) id, when the caller
            advertised one. Passed to the task type's subscription policy so a
            cancel from one client of a principal detaches only that client rather
            than aborting a SHARED task the principal's other clients still await
            (see ``superset.tasks.subscription``). ``None`` keeps principal-grain
            behavior.
        """
        self._task_uuid = task_uuid
        self._force = force
        self._tab_id = tab_id
        self._action_taken: str = (
            "cancelled"  # Will be set to 'aborted', 'unsubscribed', or 'detached'
        )
        self._should_publish_abort: bool = False
        # Terminal status when this cancel aborted the task straight to terminal
        # (see run(), which publishes it as completion); None otherwise.
        self._completed_status: str | None = None

    def run(self) -> "Task":
        """
        Execute the cancel command with distributed locking.

        The lock is acquired BEFORE starting the transaction to avoid holding
        a DB connection during lock acquisition. Uses dedup_key as lock key
        to ensure Submit and Cancel operations use the same lock.

        :returns: The updated task model
        """
        from superset.daos.tasks import TaskDAO

        # Lightweight fetch to compute dedup_key for locking
        # This is needed to use the same lock key as SubmitTaskCommand
        task = TaskDAO.find_one_or_none(
            skip_base_filter=security_manager.is_admin(), uuid=self._task_uuid
        )

        if not task:
            raise TaskNotFoundError()

        # Compute dedup_key using the same logic as SubmitTaskCommand
        dedup_key = get_active_dedup_key(
            scope=task.scope,
            task_type=task.task_type,
            task_key=task.task_key,
            user_id=task.user_id,
        )

        # Acquire lock BEFORE transaction starts
        # Using dedup_key ensures Submit and Cancel use the same lock
        with task_lock(dedup_key):
            result = self._execute_with_transaction()

        from superset.tasks.manager import TaskManager

        # Publish abort notification AFTER transaction commits
        # This prevents race conditions where listeners check DB before commit
        if self._should_publish_abort:
            TaskManager.publish_abort(self._task_uuid)

        # A cancel that drove the task straight to a terminal state (queued
        # PENDING → ABORTED) has no worker to finalize it, so it must publish
        # completion itself — otherwise a websocket-mode waiter (which does not
        # poll) only learns of the cancellation at the stale-timeout give-up.
        # The ABORTING case is handled by the worker's own completion publish
        # once its abort handlers finish.
        if self._completed_status is not None:
            TaskManager.publish_completion(self._task_uuid, self._completed_status)

        # Nudge realtime list views of the abort/cancel state change (post-commit).
        # Abort transitions (→ABORTING/ABORTED) don't go through
        # InternalStatusTransitionCommand, so they are emitted here instead.
        TaskManager.publish_entity_change(self._task_uuid)
        # A cancelled prerequisite fails its dependents' all-success gate, and its
        # status shows on their rows, so refresh those too.
        TaskManager.publish_required_by_changed(self._task_uuid)

        return result

    @transaction(on_error=partial(on_error, reraise=TaskAbortFailedError))
    def _execute_with_transaction(self) -> "Task":
        """
        Execute the cancel operation inside a transaction.

        Combines fetch + validation + execution in a single transaction,
        reducing the number of SELECTs from 3 to 1 (plus DAO operations).

        :returns: The updated task model
        """
        from superset.daos.tasks import TaskDAO

        # Check admin status (no DB access)
        is_admin = security_manager.is_admin()

        # Force flag requires admin
        if self._force and not is_admin:
            raise TaskPermissionDeniedError(
                "Only administrators can force cancel a task"
            )

        # Single SELECT: fetch task and validate permissions on it
        task = TaskDAO.find_one_or_none(skip_base_filter=is_admin, uuid=self._task_uuid)

        if not task:
            raise TaskNotFoundError()

        self._validate_permissions(task, is_admin)

        return self._do_cancel(task, is_admin)

    def _validate_permissions(self, task: "Task", is_admin: bool) -> None:
        """
        Validate permissions on an already-fetched task.

        Permission rules by scope:
        - private: Only creator or admin (already filtered by base_filter)
        - shared: Subscribers or admin
        - system: Only admin

        :param task: The task to validate permissions for
        :param is_admin: Whether current user is admin
        :raises TaskAbortFailedError: If task is not in cancellable state
        :raises TaskPermissionDeniedError: If user lacks permission
        """
        # Check if task is in a cancellable state
        if task.status not in [
            TaskStatus.PENDING.value,
            TaskStatus.IN_PROGRESS.value,
            TaskStatus.ABORTING.value,  # Already aborting is OK (idempotent)
        ]:
            raise TaskAbortFailedError()

        # Admin can cancel anything
        if is_admin:
            return

        # Non-admin permission checks by scope
        user_id = get_user_id()

        if task.scope == TaskScope.SYSTEM.value:
            # System tasks are admin-only
            raise TaskPermissionDeniedError(
                "Only administrators can cancel system tasks"
            )

        if task.is_shared:
            # Shared tasks: must be a subscriber. Embedded guests have no user_id
            # and subscribe by a token-derived guest_key instead (see
            # superset.tasks.guest), so honor either identity.
            guest_key = get_guest_subscriber_key_for(user_id)
            subscribed = (user_id and task.has_subscriber(user_id)) or (
                guest_key and task.has_guest_subscriber(guest_key)
            )
            if not subscribed:
                raise TaskPermissionDeniedError(
                    "You must be subscribed to cancel this shared task"
                )

        # Private tasks: already filtered by base_filter (only creator can see)
        # If we got here, user has permission

    def _do_cancel(self, task: "Task", is_admin: bool) -> "Task":
        """
        Execute the cancel operation (abort or unsubscribe).

        :param task: The task to cancel
        :param is_admin: Whether current user is admin
        :returns: The updated task model
        """
        user_id = get_user_id()
        force_abort = is_admin and self._force

        # Per-client subscription policy pre-gate. A task type may track a finer
        # grain than the principal (e.g. one browser tab per client); consult it
        # first so a cancel from one client of a principal detaches only that
        # client, keeping the (SHARED) task running for the principal's other
        # clients. Skipped for an admin force-abort, which must terminate the task
        # regardless of how many clients are watching.
        if not force_abort and (
            policy := TaskRegistry.get_subscription_policy(task.task_type)
        ):
            guest_key = get_guest_subscriber_key_for(user_id)
            principal = principal_channel(user_id, guest_key)
            if principal is not None and not policy.on_unsubscribe(
                task, principal=principal, client_ref=self._tab_id
            ):
                # One client detached but the principal still has other clients on
                # this task: keep it subscribed and running.
                self._action_taken = "detached"
                stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
                stats_logger.incr("gtf.task.detach")
                logger.info("Client detached from shared task: %s", task.uuid)
                return task

        # Principal-grain decision (unchanged): abort for an admin force, a
        # private/system task, or the last remaining subscriber; otherwise
        # unsubscribe the calling principal. When a policy is active we only reach
        # here once the principal's last client is gone (or for an admin force),
        # so ``subscriber_count <= 1`` still correctly covers private/single-tab
        # tasks.
        should_abort = (
            # Admin with force flag always aborts
            force_abort
            # Private tasks always abort (only one user)
            or task.is_private
            # System tasks always abort (admin only anyway)
            or task.is_system
            # Single or last subscriber - abort
            or task.subscriber_count <= 1
        )

        if should_abort:
            return self._do_abort(task, is_admin)
        else:
            return self._do_unsubscribe(task, user_id)

    def _do_abort(self, task: "Task", is_admin: bool) -> "Task":
        """
        Execute abort operation.

        :param task: The task to abort
        :param is_admin: Whether current user is admin
        :returns: The updated task model
        """
        from superset.daos.tasks import TaskDAO

        try:
            result: Task | None = TaskDAO.abort_task(
                task.uuid, skip_base_filter=is_admin
            )
        except TaskNotAbortableError:
            raise

        if result is None:
            # abort_task returned None - task wasn't aborted
            # This can happen if task is already finished
            raise TaskAbortFailedError()

        self._action_taken = "aborted"

        # Track if we need to publish abort after commit
        if TaskStatus(result.status) == TaskStatus.ABORTING:
            self._should_publish_abort = True
        elif result.status in TERMINAL_STATES:
            # Aborted straight to terminal (queued PENDING task): no worker will
            # publish completion, so run() must after commit.
            self._completed_status = result.status

        stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
        stats_logger.incr("gtf.task.abort")

        logger.info(
            "Task aborted: %s (scope: %s, force: %s)",
            task.uuid,
            task.scope,
            self._force,
        )

        return result

    def _do_unsubscribe(self, task: "Task", user_id: int | None) -> "Task":
        """
        Execute unsubscribe operation (user or embedded guest).

        :param task: The task to unsubscribe from
        :param user_id: ID of user to unsubscribe, or None for an embedded guest
        :returns: The updated task model
        """
        from superset.daos.tasks import TaskDAO

        self._action_taken = "unsubscribed"

        # Embedded guests subscribe by a token-derived key, not a user_id.
        guest_key = get_guest_subscriber_key_for(user_id)

        if user_id and task.has_subscriber(user_id):
            result = TaskDAO.remove_subscriber(task.id, user_id)
            subscriber = f"user {user_id}"
        elif guest_key and task.has_guest_subscriber(guest_key):
            result = TaskDAO.remove_guest_subscriber(task.id, guest_key)
            subscriber = "guest"
        else:
            # Not subscribed - they shouldn't be able to cancel
            raise TaskPermissionDeniedError(
                "You are not subscribed to this shared task"
            )

        if result is None:
            raise TaskPermissionDeniedError(
                "You are not subscribed to this shared task"
            )

        stats_logger: BaseStatsLogger = current_app.config["STATS_LOGGER"]
        stats_logger.incr("gtf.task.unsubscribe")

        logger.info(
            "%s unsubscribed from shared task: %s",
            subscriber,
            task.uuid,
        )

        return result

    def validate(self) -> None:
        pass

    @property
    def action_taken(self) -> str:
        """
        Get the action that was taken.

        :returns: 'aborted' (task terminated), 'unsubscribed' (principal removed
            from a shared task that keeps running), or 'detached' (one client of the
            principal detached while the principal's other clients keep it running)
        """
        return self._action_taken
