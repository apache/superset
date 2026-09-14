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
"""Integration tests for Task REST API"""

from contextlib import contextmanager
from typing import Generator

import rison
from superset_core.tasks.types import TaskStatus

from superset import db
from superset.models.tasks import Task
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    GAMMA_USERNAME,
)


class TestTaskApi(SupersetTestCase):
    """Tests for Task REST API"""

    TASK_API_BASE = "api/v1/task"

    @contextmanager
    def _create_tasks(self) -> Generator[list[Task], None, None]:
        """
        Context manager to create test tasks with guaranteed cleanup.

        Uses TaskDAO to create tasks, testing the actual production code path.

        Usage:
            with self._create_tasks() as tasks:
                # Use tasks in test
                # Cleanup happens automatically even if test fails
        """
        from superset_core.tasks.types import TaskScope

        from superset.daos.tasks import TaskDAO

        admin = self.get_user("admin")
        gamma = self.get_user("gamma")

        tasks = []

        try:
            # Create tasks with different statuses using TaskDAO
            for i in range(5):
                task_key = f"test_task_{i}"

                # Create task using DAO (this tests the dedup_key creation logic)
                task = TaskDAO.create_task(
                    task_type="test_type",
                    task_key=task_key,
                    task_name=f"Test Task {i}",
                    scope=TaskScope.PRIVATE,
                    user_id=admin.id,
                    payload={"test": "data"},
                )

                # Set created_by for test purposes (DAO uses Flask-AppBuilder context)
                task.created_by = admin

                # Alternate between pending and finished tasks
                if i % 2 != 0:
                    # Simulate realistic task lifecycle: PENDING → IN_PROGRESS → SUCCESS
                    # This sets both started_at (on IN_PROGRESS) and ended_at (on
                    # SUCCESS) so duration_seconds returns a valid value
                    task.set_status(TaskStatus.IN_PROGRESS)
                    task.set_status(TaskStatus.SUCCESS)

                db.session.commit()
                tasks.append(task)

            # Create pending task for gamma user (use PENDING so it can be aborted)
            gamma_task = TaskDAO.create_task(
                task_type="test_type",
                task_key="gamma_task",
                task_name="Gamma Task",
                scope=TaskScope.PRIVATE,
                user_id=gamma.id,
                payload={"user": "gamma"},
            )
            # Set created_by for test purposes
            gamma_task.created_by = gamma
            db.session.commit()
            tasks.append(gamma_task)

            yield tasks
        finally:
            # Cleanup happens here regardless of test success/failure
            for task in tasks:
                try:
                    db.session.delete(task)
                except Exception:  # noqa: S110
                    # Task may already be deleted or session may be in bad state
                    pass
            try:
                db.session.commit()
            except Exception:
                # Rollback if commit fails
                db.session.rollback()

    def test_info_task(self):
        """
        Task API: Test info endpoint
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/_info"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert "permissions" in data

    def test_get_task_by_uuid(self):
        """
        Task API: Test get task by UUID and verify dedup_key is hashed
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            # Get a pending task to verify active dedup_key format
            task = (
                db.session.query(Task)
                .filter_by(
                    created_by_fk=admin.id,
                    status=TaskStatus.PENDING.value,
                    task_type="test_type",
                )
                .first()
            )
            assert task is not None

            # Verify active task has hashed dedup_key (64 chars for SHA-256)
            assert len(task.dedup_key) == 64
            assert all(c in "0123456789abcdef" for c in task.dedup_key)
            assert task.dedup_key != str(task.uuid)

            uri = f"{self.TASK_API_BASE}/{task.uuid}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            # Compare strings since JSON response contains string UUID
            assert data["result"]["uuid"] == str(task.uuid)
            assert data["result"]["id"] == task.id

    def test_get_task_not_found(self):
        """
        Task API: Test get task not found with non-existent UUID
        """
        self.login(ADMIN_USERNAME)
        # Use a valid UUID that doesn't exist in the database
        uri = f"{self.TASK_API_BASE}/00000000-0000-0000-0000-000000000000"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    def test_get_task_invalid_uuid(self):
        """
        Task API: Test get task with invalid UUID
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/invalid-uuid"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    def test_get_task_list(self):
        """
        Task API: Test get task list
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            uri = f"{self.TASK_API_BASE}/"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["count"] >= 6  # At least the fixtures we created
            assert "result" in data

    def test_get_task_list_filtered_by_status(self):
        """
        Task API: Test get task list filtered by status
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            arguments = {
                "filters": [
                    {"col": "status", "opr": "eq", "value": TaskStatus.PENDING.value}
                ]
            }
            uri = f"{self.TASK_API_BASE}/?q={rison.dumps(arguments)}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            for task in data["result"]:
                assert task["status"] == TaskStatus.PENDING.value

    def test_get_task_list_filtered_by_type(self):
        """
        Task API: Test get task list filtered by type
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            arguments = {
                "filters": [{"col": "task_type", "opr": "eq", "value": "test_type"}]
            }
            uri = f"{self.TASK_API_BASE}/?q={rison.dumps(arguments)}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["count"] >= 6
            for task in data["result"]:
                assert task["task_type"] == "test_type"

    def test_get_task_types_distinct(self):
        """
        Task API: Test /distinct/task_type powers the Type filter dropdown
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            uri = f"{self.TASK_API_BASE}/distinct/task_type"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            values = {item["value"] for item in data["result"]}
            assert "test_type" in values

    def test_get_task_distinct_rejects_disallowed_field(self):
        """
        Task API: Test /distinct only exposes allowed_distinct_fields
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/distinct/status"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    def test_related_subscribers_scoped_to_visible_tasks(self):
        """
        Task API: /related/subscribers only lists subscribers of visible tasks.

        Gamma sees only its own tasks (TaskFilter), so the admin who created the
        other fixture tasks must not appear in Gamma's subscriber dropdown, while
        the admin (who can see all tasks) sees both.
        """
        with self._create_tasks():
            admin = self.get_user("admin")
            gamma = self.get_user("gamma")
            uri = f"{self.TASK_API_BASE}/related/subscribers"

            # Log out before each login: the test client reuses one session, and
            # POST /login/ while already authenticated redirects without switching
            # users, so the second login would otherwise leave the request scoped
            # to the first user.
            self.logout()
            self.login(GAMMA_USERNAME)
            rv = self.client.get(uri)
            assert rv.status_code == 200
            gamma_ids = {
                item["value"] for item in json.loads(rv.data.decode("utf-8"))["result"]
            }
            assert gamma.id in gamma_ids
            assert admin.id not in gamma_ids

            self.logout()
            self.login(ADMIN_USERNAME)
            rv = self.client.get(uri)
            admin_ids = {
                item["value"] for item in json.loads(rv.data.decode("utf-8"))["result"]
            }
            assert {admin.id, gamma.id} <= admin_ids

    def test_get_task_list_ordered(self):
        """
        Task API: Test get task list with ordering
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            arguments = {
                "order_column": "created_on",
                "order_direction": "desc",
            }
            uri = f"{self.TASK_API_BASE}/?q={rison.dumps(arguments)}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert len(data["result"]) > 0

    def test_get_task_list_paginated(self):
        """
        Task API: Test get task list with pagination
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            arguments = {"page": 0, "page_size": 2}
            uri = f"{self.TASK_API_BASE}/?q={rison.dumps(arguments)}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert len(data["result"]) <= 2
            assert data["count"] >= 6

    def test_cancel_task_by_uuid(self):
        """
        Task API: Test cancel task by UUID
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            task = (
                db.session.query(Task)
                .filter_by(created_by_fk=admin.id, status=TaskStatus.PENDING.value)
                .first()
            )
            assert task is not None

            uri = f"{self.TASK_API_BASE}/{task.uuid}/cancel"
            rv = self.client.post(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            # Compare strings since JSON response contains string UUID
            assert data["task"]["uuid"] == str(task.uuid)
            assert data["task"]["status"] == TaskStatus.ABORTED.value
            assert data["action"] == "aborted"

    def test_cancel_task_not_found(self):
        """
        Task API: Test cancel task not found with non-existent UUID
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/00000000-0000-0000-0000-000000000000/cancel"
        rv = self.client.post(uri)
        assert rv.status_code == 404

    def test_cancel_task_not_owned(self):
        """
        Task API: Test cancel task not owned by user
        """
        with self._create_tasks():
            self.login(GAMMA_USERNAME)
            admin = self.get_user("admin")

            # Try to cancel admin's task as gamma user
            task = db.session.query(Task).filter_by(created_by_fk=admin.id).first()
            assert task is not None

            uri = f"{self.TASK_API_BASE}/{task.uuid}/cancel"
            rv = self.client.post(uri)
            assert rv.status_code == 404

    def test_cancel_task_admin_can_cancel_others(self):
        """
        Task API: Test admin can cancel other users' tasks
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            gamma = self.get_user("gamma")

            # Admin cancels gamma's task
            task = db.session.query(Task).filter_by(created_by_fk=gamma.id).first()
            assert task is not None

            uri = f"{self.TASK_API_BASE}/{task.uuid}/cancel"
            rv = self.client.post(uri)
            assert rv.status_code == 200

    def test_get_task_status_by_uuid(self):
        """
        Task API: Test get task status by UUID
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            task = db.session.query(Task).filter_by(created_by_fk=admin.id).first()
            assert task is not None

            uri = f"{self.TASK_API_BASE}/{task.uuid}/status"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert "status" in data
            assert data["status"] == task.status

    def test_get_task_status_not_found(self):
        """
        Task API: Test get task status not found with non-existent UUID
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/00000000-0000-0000-0000-000000000000/status"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    def test_get_task_status_not_owned(self):
        """
        Task API: Test non-owner can't see task status
        """
        with self._create_tasks():
            self.login(GAMMA_USERNAME)
            admin = self.get_user("admin")

            # Try to get status of admin's task as gamma user
            task = db.session.query(Task).filter_by(created_by_fk=admin.id).first()
            assert task is not None

            uri = f"{self.TASK_API_BASE}/{task.uuid}/status"
            rv = self.client.get(uri)
            # Should be forbidden due to base filter
            assert rv.status_code == 404

    def test_get_task_status_admin_can_see_others(self):
        """
        Task API: Test admin can see other users' task status
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            gamma = self.get_user("gamma")

            # Admin gets gamma's task status
            task = db.session.query(Task).filter_by(created_by_fk=gamma.id).first()
            assert task is not None

            uri = f"{self.TASK_API_BASE}/{task.uuid}/status"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["status"] == task.status

    def test_status_changes_baseline_then_change_round_trip(self):
        """
        Task API: Test /status_changes baseline → change → cursor round trip
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            # No cursor: establishes a baseline (no statuses, fresh watermark) so a
            # client never has to pull every task in the metastore.
            rv = self.client.get(f"{self.TASK_API_BASE}/status_changes")
            assert rv.status_code == 200
            baseline = json.loads(rv.data.decode("utf-8"))
            assert baseline["statuses"] == {}
            assert baseline["cursor"] is not None

            # A transition after the baseline is surfaced on the next poll.
            task = db.session.query(Task).filter_by(created_by_fk=admin.id).first()
            assert task is not None
            task.set_status(TaskStatus.IN_PROGRESS)
            task.update_properties({"progress_percent": 0.5})
            db.session.commit()

            uri = f"{self.TASK_API_BASE}/status_changes?cursor={baseline['cursor']}"
            rv = self.client.get(uri)
            assert rv.status_code == 200
            changed = json.loads(rv.data.decode("utf-8"))
            assert changed["statuses"][str(task.uuid)] == {
                "status": TaskStatus.IN_PROGRESS.value,
                "progress": 0.5,
            }
            # The returned cursor advances, so an idle task is not re-delivered
            # forever.
            assert changed["cursor"] >= baseline["cursor"]

    def test_status_changes_rejects_invalid_cursor(self):
        """
        Task API: Test /status_changes rejects an unparseable cursor
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/status_changes?cursor=not-a-timestamp"
        rv = self.client.get(uri)
        assert rv.status_code == 400

    def test_status_changes_narrows_by_task_type(self):
        """
        Task API: Test /status_changes only returns the requested task_type
        """
        from superset_core.tasks.types import TaskScope

        from superset.daos.tasks import TaskDAO

        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            rv = self.client.get(f"{self.TASK_API_BASE}/status_changes")
            baseline_cursor = json.loads(rv.data.decode("utf-8"))["cursor"]

            other = TaskDAO.create_task(
                task_type="other_type",
                task_key="other_type_task",
                task_name="Other Type Task",
                scope=TaskScope.PRIVATE,
                user_id=admin.id,
            )
            db.session.commit()
            try:
                task = (
                    db.session.query(Task)
                    .filter_by(created_by_fk=admin.id, task_type="test_type")
                    .first()
                )
                assert task is not None
                task.set_status(TaskStatus.IN_PROGRESS)
                db.session.commit()

                uri = (
                    f"{self.TASK_API_BASE}/status_changes"
                    f"?cursor={baseline_cursor}&task_type=other_type"
                )
                rv = self.client.get(uri)
                assert rv.status_code == 200
                statuses = json.loads(rv.data.decode("utf-8"))["statuses"]

                assert str(other.uuid) in statuses
                assert str(task.uuid) not in statuses
            finally:
                db.session.delete(other)
                db.session.commit()

    def test_status_changes_scoped_to_the_polling_principal(self):
        """
        Task API: Test /status_changes only returns tasks the caller can see
        """
        with self._create_tasks():
            self.login(GAMMA_USERNAME)
            admin = self.get_user("admin")

            rv = self.client.get(f"{self.TASK_API_BASE}/status_changes")
            baseline_cursor = json.loads(rv.data.decode("utf-8"))["cursor"]

            admin_task = (
                db.session.query(Task).filter_by(created_by_fk=admin.id).first()
            )
            assert admin_task is not None
            admin_task.set_status(TaskStatus.IN_PROGRESS)
            db.session.commit()

            uri = f"{self.TASK_API_BASE}/status_changes?cursor={baseline_cursor}"
            rv = self.client.get(uri)
            assert rv.status_code == 200
            statuses = json.loads(rv.data.decode("utf-8"))["statuses"]

            # Gamma is not subscribed to admin's task, so the transition is hidden.
            assert str(admin_task.uuid) not in statuses

    def test_get_task_list_user_sees_own_tasks(self):
        """
        Task API: Test non-admin user only sees their own tasks
        """
        with self._create_tasks():
            self.login(GAMMA_USERNAME)
            gamma = self.get_user("gamma")

            uri = f"{self.TASK_API_BASE}/"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            # Gamma should only see their own task
            for task in data["result"]:
                assert task["created_by"]["id"] == gamma.id

    def test_get_task_list_admin_sees_all_tasks(self):
        """
        Task API: Test admin sees all tasks
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)

            uri = f"{self.TASK_API_BASE}/"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            # Admin should see all tasks
            assert data["count"] >= 6

    def test_task_response_schema(self):
        """
        Task API: Test response schema includes all expected fields
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            task = db.session.query(Task).filter_by(created_by_fk=admin.id).first()
            uri = f"{self.TASK_API_BASE}/{task.uuid}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            result = data["result"]

            # Check all expected fields are present
            expected_fields = [
                "id",
                "uuid",
                "task_key",
                "task_type",
                "task_name",
                "status",
                "created_on",
                "created_on_delta_humanized",
                "changed_on",
                "changed_by",
                "started_at",
                "ended_at",
                "created_by",
                "user_id",
                "payload",
                "properties",
                "duration_seconds",
                "scope",
                "subscriber_count",
                "subscribers",
                "depends_on",
                "required_by",
            ]

            for field in expected_fields:
                assert field in result, f"Field {field} missing from response"

            # Verify properties is a dict with expected structure
            properties = result["properties"]
            assert isinstance(properties, dict)

            # A task with no declared prerequisites serializes an empty depends_on
            assert result["depends_on"] == []
            assert result["required_by"] == []

    def test_task_depends_on_serialization(self):
        """
        Task API: Test depends_on serializes prerequisite tasks (uuid/name/status)
        """
        from superset.commands.tasks import SubmitTaskCommand

        self.login(ADMIN_USERNAME)

        prerequisite = SubmitTaskCommand(
            data={
                "task_type": "test_type",
                "task_key": "api_dep_prereq",
                "task_name": "Prerequisite Task",
            }
        ).run()
        dependent = None
        try:
            dependent = SubmitTaskCommand(
                data={
                    "task_type": "test_type",
                    "task_key": "api_dep_child",
                    "depends_on": [prerequisite.uuid],
                }
            ).run()

            rv = self.client.get(f"{self.TASK_API_BASE}/{dependent.uuid}")
            assert rv.status_code == 200
            result = json.loads(rv.data.decode("utf-8"))["result"]

            assert len(result["depends_on"]) == 1
            dep = result["depends_on"][0]
            assert dep["uuid"] == str(prerequisite.uuid)
            assert dep["task_name"] == "Prerequisite Task"
            assert dep["status"] == prerequisite.status

            # The reverse edge: the prerequisite lists the dependent under
            # `required_by`, so the DAG is available from both directions.
            rv = self.client.get(f"{self.TASK_API_BASE}/{prerequisite.uuid}")
            assert rv.status_code == 200
            prereq_result = json.loads(rv.data.decode("utf-8"))["result"]
            assert prereq_result["depends_on"] == []
            assert len(prereq_result["required_by"]) == 1
            assert prereq_result["required_by"][0]["uuid"] == str(dependent.uuid)
        finally:
            if dependent is not None:
                db.session.delete(dependent)
            db.session.delete(prerequisite)
            db.session.commit()

    def test_task_payload_serialization(self):
        """
        Task API: Test payload is properly serialized as dict
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            task = (
                db.session.query(Task)
                .filter_by(created_by_fk=admin.id, task_type="test_type")
                .first()
            )
            uri = f"{self.TASK_API_BASE}/{task.uuid}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            payload = data["result"]["payload"]

            # Payload should be a dict, not a string
            assert isinstance(payload, dict)
            assert "test" in payload
            assert payload["test"] == "data"

    def test_task_computed_properties(self):
        """
        Task API: Test computed properties in response

        This test verifies that computed properties (status, duration_seconds)
        are correctly returned in the API response. Internal DB columns like
        dedup_key are tested in unit tests (test_find_by_task_key_finished_not_found).
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            # Get a successful task
            task = (
                db.session.query(Task)
                .filter_by(created_by_fk=admin.id, status=TaskStatus.SUCCESS.value)
                .first()
            )
            assert task is not None

            uri = f"{self.TASK_API_BASE}/{task.uuid}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            result = data["result"]

            # Check status field (computed properties are now derived from status)
            assert result["status"] == TaskStatus.SUCCESS.value

            # Properties dict should exist and be a dict
            assert "properties" in result
            assert isinstance(result["properties"], dict)

            # Verify duration_seconds is not null for completed tasks with timestamps
            # (requires both started_at and ended_at to be set)
            if result.get("started_at") and result.get("ended_at"):
                assert result["duration_seconds"] is not None
                assert result["duration_seconds"] >= 0.0
