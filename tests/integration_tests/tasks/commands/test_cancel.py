# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file to you under
# the Apache License, Version 2.0 (the "License"); you may not
# use this file except in compliance with the License.  You may obtain
# a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from superset_core.api.tasks import TaskScope, TaskStatus

from superset import db
from superset.commands.tasks.cancel import CancelTaskCommand
from superset.commands.tasks.exceptions import (
    TaskAbortFailedError,
    TaskNotAbortableError,
    TaskNotFoundError,
    TaskPermissionDeniedError,
)
from superset.daos.tasks import TaskDAO
from superset.utils.core import override_user
from tests.integration_tests.test_app import app


def test_cancel_pending_task_aborts(app_context, get_user) -> None:
    """Test canceling a pending task directly aborts it"""
    admin = get_user("admin")

    # Create a pending private task
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="cancel_pending_test",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    db.session.commit()

    try:
        # Cancel the pending task with admin user context
        with override_user(admin):
            command = CancelTaskCommand(task_uuid=task.uuid)
            result = command.run()

        # Verify task is aborted (pending goes directly to ABORTED)
        assert result.uuid == task.uuid
        assert result.status == TaskStatus.ABORTED.value
        assert command.action_taken == "aborted"

        # Verify in database
        db.session.refresh(task)
        assert task.status == TaskStatus.ABORTED.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_in_progress_abortable_task_sets_aborting(app_context, get_user) -> None:
    """Test canceling an in-progress task with abort handler sets ABORTING"""
    admin = get_user("admin")

    # Create an in-progress abortable task
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="cancel_in_progress_test",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
        properties={"is_abortable": True},
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        # Cancel the in-progress task - mock publish_abort to avoid Redis dependency
        with (
            override_user(admin),
            patch("superset.tasks.manager.TaskManager.publish_abort"),
        ):
            command = CancelTaskCommand(task_uuid=task.uuid)
            result = command.run()

        # In-progress tasks go to ABORTING (not ABORTED)
        assert result.uuid == task.uuid
        assert result.status == TaskStatus.ABORTING.value
        assert command.action_taken == "aborted"

        # Verify in database
        db.session.refresh(task)
        assert task.status == TaskStatus.ABORTING.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_in_progress_not_abortable_raises_error(app_context, get_user) -> None:
    """Test canceling an in-progress task without abort handler raises error"""
    admin = get_user("admin")
    unique_key = f"cancel_not_abortable_test_{uuid4().hex[:8]}"

    # Create an in-progress non-abortable task
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key=unique_key,
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
        properties={"is_abortable": False},
    )
    task.created_by = admin
    task.set_status(TaskStatus.IN_PROGRESS)
    db.session.commit()

    try:
        with override_user(admin):
            command = CancelTaskCommand(task_uuid=task.uuid)

            with pytest.raises(TaskNotAbortableError):
                command.run()

        # Verify task status unchanged
        db.session.refresh(task)
        assert task.status == TaskStatus.IN_PROGRESS.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_task_not_found(app_context, get_user) -> None:
    """Test canceling non-existent task raises error"""
    admin = get_user("admin")

    with override_user(admin):
        command = CancelTaskCommand(
            task_uuid=UUID("00000000-0000-0000-0000-000000000000")
        )

        with pytest.raises(TaskNotFoundError):
            command.run()


def test_cancel_finished_task_raises_error(app_context, get_user) -> None:
    """Test canceling an already finished task raises error"""

    admin = get_user("admin")
    unique_key = f"cancel_finished_test_{uuid4().hex[:8]}"

    # Create a finished task
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key=unique_key,
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.SUCCESS)
    db.session.commit()

    try:
        with override_user(admin):
            command = CancelTaskCommand(task_uuid=task.uuid)

            with pytest.raises(TaskAbortFailedError):
                command.run()

        # Verify task status unchanged
        db.session.refresh(task)
        assert task.status == TaskStatus.SUCCESS.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_shared_task_with_multiple_subscribers_unsubscribes(
    app_context, get_user
) -> None:
    """Test canceling a shared task with multiple subscribers unsubscribes user"""
    admin = get_user("admin")
    gamma = get_user("gamma")

    # Create a shared task with admin as creator
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="cancel_shared_test",
        scope=TaskScope.SHARED,
        user_id=admin.id,
    )
    task.created_by = admin
    db.session.commit()

    # Add gamma as subscriber
    TaskDAO.add_subscriber(task.id, user_id=gamma.id)
    db.session.commit()

    try:
        # Verify we have 2 subscribers
        db.session.refresh(task)
        assert task.subscriber_count == 2

        # Cancel as gamma (non-admin subscriber)
        with override_user(gamma):
            command = CancelTaskCommand(task_uuid=task.uuid)
            result = command.run()

        # Should unsubscribe, not abort
        assert command.action_taken == "unsubscribed"
        assert result.status == TaskStatus.PENDING.value  # Status unchanged

        # Verify gamma was unsubscribed
        db.session.refresh(task)
        assert task.subscriber_count == 1
        assert not task.has_subscriber(gamma.id)
        assert task.has_subscriber(admin.id)
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_shared_task_last_subscriber_aborts(app_context, get_user) -> None:
    """Test canceling a shared task as last subscriber aborts it"""
    admin = get_user("admin")

    # Create a shared task with only admin as subscriber
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="cancel_last_subscriber_test",
        scope=TaskScope.SHARED,
        user_id=admin.id,
    )
    task.created_by = admin
    db.session.commit()

    try:
        # Verify only 1 subscriber
        db.session.refresh(task)
        assert task.subscriber_count == 1

        # Cancel as the only subscriber
        with override_user(admin):
            command = CancelTaskCommand(task_uuid=task.uuid)
            result = command.run()

        # Should abort since last subscriber
        assert command.action_taken == "aborted"
        assert result.status == TaskStatus.ABORTED.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_with_force_aborts_for_all_subscribers(app_context, get_user) -> None:
    """Test force cancel aborts shared task even with multiple subscribers"""
    admin = get_user("admin")
    gamma = get_user("gamma")

    # Create a shared task with multiple subscribers
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="force_cancel_test",
        scope=TaskScope.SHARED,
        user_id=admin.id,
    )
    task.created_by = admin
    db.session.commit()

    # Add gamma as subscriber
    TaskDAO.add_subscriber(task.id, user_id=gamma.id)
    db.session.commit()

    try:
        # Verify 2 subscribers
        db.session.refresh(task)
        assert task.subscriber_count == 2

        # Force cancel as admin
        with override_user(admin):
            command = CancelTaskCommand(task_uuid=task.uuid, force=True)
            result = command.run()

        # Should abort despite multiple subscribers
        assert command.action_taken == "aborted"
        assert result.status == TaskStatus.ABORTED.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_with_force_requires_admin(app_context, get_user) -> None:
    """Test force cancel requires admin privileges"""
    admin = get_user("admin")
    gamma = get_user("gamma")

    # Create a shared task
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="force_requires_admin_test",
        scope=TaskScope.SHARED,
        user_id=admin.id,
    )
    task.created_by = admin
    db.session.commit()

    # Add gamma as subscriber
    TaskDAO.add_subscriber(task.id, user_id=gamma.id)
    db.session.commit()

    try:
        # Try to force cancel as gamma (non-admin)
        with override_user(gamma):
            command = CancelTaskCommand(task_uuid=task.uuid, force=True)

            with pytest.raises(TaskPermissionDeniedError):
                command.run()

        # Verify task unchanged
        db.session.refresh(task)
        assert task.status == TaskStatus.PENDING.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_private_task_permission_denied(app_context, get_user) -> None:
    """Test non-owner cannot cancel private task"""
    admin = get_user("admin")
    gamma = get_user("gamma")
    unique_key = f"private_permission_test_{uuid4().hex[:8]}"

    # Use test_request_context to ensure has_request_context() returns True
    # so that TaskFilter properly applies permission filtering
    with app.test_request_context():
        # Create a private task owned by admin
        task = TaskDAO.create_task(
            task_type="test_type",
            task_key=unique_key,
            scope=TaskScope.PRIVATE,
            user_id=admin.id,
        )
        task.created_by = admin
        db.session.commit()

        try:
            # Try to cancel admin's private task as gamma (non-owner)
            with override_user(gamma):
                command = CancelTaskCommand(task_uuid=task.uuid)

                # Should fail because gamma can't see admin's private task (base filter)
                with pytest.raises(TaskNotFoundError):
                    command.run()

            # Verify task unchanged
            db.session.refresh(task)
            assert task.status == TaskStatus.PENDING.value
        finally:
            # Cleanup
            db.session.delete(task)
            db.session.commit()


def test_cancel_system_task_requires_admin(app_context, get_user) -> None:
    """Test system tasks can only be canceled by admin"""
    admin = get_user("admin")
    gamma = get_user("gamma")
    unique_key = f"system_task_test_{uuid4().hex[:8]}"

    # Use test_request_context to ensure has_request_context() returns True
    # so that TaskFilter properly applies permission filtering
    with app.test_request_context():
        # Create a system task
        task = TaskDAO.create_task(
            task_type="test_type",
            task_key=unique_key,
            scope=TaskScope.SYSTEM,
            user_id=None,
        )
        task.created_by = admin
        db.session.commit()

        try:
            # Try to cancel as gamma (non-admin)
            with override_user(gamma):
                command = CancelTaskCommand(task_uuid=task.uuid)

                # System tasks are not visible to non-admins via base filter
                with pytest.raises(TaskNotFoundError):
                    command.run()

            # Verify task unchanged
            db.session.refresh(task)
            assert task.status == TaskStatus.PENDING.value

            # But admin can cancel it
            with override_user(admin):
                command = CancelTaskCommand(task_uuid=task.uuid)
                result = command.run()

            assert result.status == TaskStatus.ABORTED.value
        finally:
            # Cleanup
            db.session.delete(task)
            db.session.commit()


def test_cancel_already_aborting_is_idempotent(app_context, get_user) -> None:
    """Test canceling an already aborting task is idempotent"""
    admin = get_user("admin")

    # Create a task already in ABORTING state
    task = TaskDAO.create_task(
        task_type="test_type",
        task_key="idempotent_cancel_test",
        scope=TaskScope.PRIVATE,
        user_id=admin.id,
    )
    task.created_by = admin
    task.set_status(TaskStatus.ABORTING)
    db.session.commit()

    try:
        # Cancel the already aborting task
        with override_user(admin):
            command = CancelTaskCommand(task_uuid=task.uuid)
            result = command.run()

        # Should succeed without error
        assert result.uuid == task.uuid
        assert result.status == TaskStatus.ABORTING.value
    finally:
        # Cleanup
        db.session.delete(task)
        db.session.commit()


def test_cancel_shared_task_not_subscribed_raises_not_found(
    app_context, get_user
) -> None:
    """Test non-subscriber cannot see or cancel shared task.

    With subscription-only filtering, users who aren't subscribed to a
    shared task can't see it at all, so canceling returns "not found"
    rather than "permission denied".
    """
    admin = get_user("admin")
    gamma = get_user("gamma")
    unique_key = f"not_subscribed_test_{uuid4().hex[:8]}"

    # Use test_request_context to ensure TaskFilter is applied
    with app.test_request_context():
        # Create a shared task with only admin as subscriber
        with override_user(admin):
            task = TaskDAO.create_task(
                task_type="test_type",
                task_key=unique_key,
                scope=TaskScope.SHARED,
                user_id=admin.id,
            )
            db.session.commit()

        try:
            # Try to cancel as gamma (not subscribed) - they can't see the task
            with override_user(gamma):
                command = CancelTaskCommand(task_uuid=task.uuid)

                # TaskNotFoundError because gamma isn't subscribed and can't see
                # the task
                with pytest.raises(TaskNotFoundError):
                    command.run()

            # Verify task unchanged
            db.session.refresh(task)
            assert task.status == TaskStatus.PENDING.value
        finally:
            # Cleanup
            db.session.delete(task)
            db.session.commit()
