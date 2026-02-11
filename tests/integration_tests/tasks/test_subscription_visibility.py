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
"""Integration tests for TaskFilter subscription-based visibility."""

from uuid import uuid4

from superset_core.api.tasks import TaskScope, TaskStatus

from superset import db
from superset.commands.tasks import SubmitTaskCommand
from superset.commands.tasks.cancel import CancelTaskCommand
from superset.daos.tasks import TaskDAO
from superset.utils.core import override_user
from tests.integration_tests.test_app import app


def test_unsubscribed_user_cannot_see_task(app_context, get_user) -> None:
    """
    Test that unsubscribing from a shared task removes visibility.

    Scenario:
    1. Gamma submits a shared task
    2. Admin joins the same task (becomes subscriber)
    3. Gamma cancels (unsubscribes since multiple subscribers)
    4. Verify gamma can no longer see the task in their list
    5. Verify admin still sees the task
    """
    gamma = get_user("gamma")
    admin = get_user("admin")
    unique_key = f"visibility_test_{uuid4().hex[:8]}"

    with app.test_request_context():
        # Step 1: Gamma submits a shared task
        with override_user(gamma):
            submit_command = SubmitTaskCommand(
                data={
                    "task_type": "test_type",
                    "task_key": unique_key,
                    "scope": TaskScope.SHARED.value,
                }
            )
            task = submit_command.run()

        task_uuid = task.uuid

        try:
            # Verify gamma is subscribed
            db.session.refresh(task)
            assert task.subscriber_count == 1
            assert task.has_subscriber(gamma.id)

            # Step 2: Admin joins the same task
            with override_user(admin):
                join_command = SubmitTaskCommand(
                    data={
                        "task_type": "test_type",
                        "task_key": unique_key,
                        "scope": TaskScope.SHARED.value,
                    }
                )
                joined_task = join_command.run()

            # Verify same task, now with 2 subscribers
            assert joined_task.uuid == task_uuid
            db.session.refresh(task)
            assert task.subscriber_count == 2
            assert task.has_subscriber(gamma.id)
            assert task.has_subscriber(admin.id)

            # Step 3: Gamma cancels (unsubscribes)
            with override_user(gamma):
                cancel_command = CancelTaskCommand(task_uuid=task_uuid)
                cancel_command.run()

            # Verify gamma was unsubscribed
            assert cancel_command.action_taken == "unsubscribed"
            db.session.refresh(task)
            assert task.subscriber_count == 1
            assert not task.has_subscriber(gamma.id)
            assert task.has_subscriber(admin.id)

            # Step 4: Verify gamma can no longer see the task
            with override_user(gamma):
                gamma_visible_task = TaskDAO.find_one_or_none(uuid=task_uuid)
                assert gamma_visible_task is None, (
                    "Gamma should not see task after unsubscribing"
                )

            # Step 5: Verify admin still sees the task
            with override_user(admin):
                admin_visible_task = TaskDAO.find_one_or_none(uuid=task_uuid)
                assert admin_visible_task is not None
                assert admin_visible_task.uuid == task_uuid

        finally:
            # Cleanup - use skip_base_filter to ensure we can delete
            db.session.delete(task)
            db.session.commit()


def test_task_creator_subscribed_automatically(app_context, get_user) -> None:
    """
    Test that task creators are automatically subscribed.

    This verifies the invariant that makes subscription-only filtering work:
    creators must always be subscribed to their own tasks.
    """
    gamma = get_user("gamma")
    unique_key = f"creator_subscribed_test_{uuid4().hex[:8]}"

    with app.test_request_context():
        # Create a private task
        with override_user(gamma):
            command = SubmitTaskCommand(
                data={
                    "task_type": "test_type",
                    "task_key": unique_key,
                    "scope": TaskScope.PRIVATE.value,
                }
            )
            task = command.run()

        try:
            db.session.refresh(task)

            # Creator should be subscribed
            assert task.subscriber_count == 1
            assert task.has_subscriber(gamma.id)

            # Creator should see their task
            with override_user(gamma):
                visible_task = TaskDAO.find_one_or_none(uuid=task.uuid)
                assert visible_task is not None
                assert visible_task.uuid == task.uuid

        finally:
            db.session.delete(task)
            db.session.commit()


def test_aborted_task_still_visible_to_subscribers(app_context, get_user) -> None:
    """
    Test that aborting a task does NOT remove subscriptions.

    When a task is aborted (not unsubscribed), all current subscribers
    should still be able to see the task in their list.
    """
    gamma = get_user("gamma")
    admin = get_user("admin")
    unique_key = f"abort_visibility_test_{uuid4().hex[:8]}"

    with app.test_request_context():
        # Create a shared task with gamma
        with override_user(gamma):
            submit_command = SubmitTaskCommand(
                data={
                    "task_type": "test_type",
                    "task_key": unique_key,
                    "scope": TaskScope.SHARED.value,
                }
            )
            task = submit_command.run()

        task_uuid = task.uuid

        try:
            # Admin joins the task
            with override_user(admin):
                join_command = SubmitTaskCommand(
                    data={
                        "task_type": "test_type",
                        "task_key": unique_key,
                        "scope": TaskScope.SHARED.value,
                    }
                )
                join_command.run()

            # Verify 2 subscribers
            db.session.refresh(task)
            assert task.subscriber_count == 2

            # Admin force-aborts the task (aborts for all, doesn't unsubscribe)
            with override_user(admin):
                cancel_command = CancelTaskCommand(task_uuid=task_uuid, force=True)
                cancel_command.run()

            # Verify task is aborted
            assert cancel_command.action_taken == "aborted"
            db.session.refresh(task)
            assert task.status == TaskStatus.ABORTED.value

            # Subscriptions should remain intact
            assert task.subscriber_count == 2
            assert task.has_subscriber(gamma.id)
            assert task.has_subscriber(admin.id)

            # Both users should still see the aborted task
            with override_user(gamma):
                gamma_task = TaskDAO.find_one_or_none(uuid=task_uuid)
                assert gamma_task is not None
                assert gamma_task.status == TaskStatus.ABORTED.value

            with override_user(admin):
                admin_task = TaskDAO.find_one_or_none(uuid=task_uuid)
                assert admin_task is not None
                assert admin_task.status == TaskStatus.ABORTED.value

        finally:
            db.session.delete(task)
            db.session.commit()
