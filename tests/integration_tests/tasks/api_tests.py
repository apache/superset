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

import prison
from superset_core.api.tasks import TaskStatus

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
        from superset_core.api.tasks import TaskScope

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

    def test_get_task_by_id(self):
        """
        Task API: Test get task by ID
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            # Get first task created by admin
            task = db.session.query(Task).filter_by(created_by_fk=admin.id).first()
            assert task is not None

            uri = f"{self.TASK_API_BASE}/{task.id}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["result"]["id"] == task.id
            assert data["result"]["task_key"] == task.task_key
            assert data["result"]["task_type"] == task.task_type
            assert data["result"]["status"] == task.status

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
            assert task.dedup_key != task.uuid

            uri = f"{self.TASK_API_BASE}/{task.uuid}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["result"]["uuid"] == task.uuid
            assert data["result"]["id"] == task.id

    def test_get_task_not_found(self):
        """
        Task API: Test get task not found
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/99999"
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
            uri = f"{self.TASK_API_BASE}/?q={prison.dumps(arguments)}"
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
            uri = f"{self.TASK_API_BASE}/?q={prison.dumps(arguments)}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["count"] >= 6
            for task in data["result"]:
                assert task["task_type"] == "test_type"

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
            uri = f"{self.TASK_API_BASE}/?q={prison.dumps(arguments)}"
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
            uri = f"{self.TASK_API_BASE}/?q={prison.dumps(arguments)}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert len(data["result"]) <= 2
            assert data["count"] >= 6

    def test_cancel_task_by_id(self):
        """
        Task API: Test cancel task by ID
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            # Find a pending task
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
            original_dedup_key = task.dedup_key
            assert len(original_dedup_key) == 64
            assert all(c in "0123456789abcdef" for c in original_dedup_key)

            uri = f"{self.TASK_API_BASE}/{task.id}/cancel"
            rv = self.client.post(uri, json={})
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["message"] == "Task cancelled"
            assert data["action"] == "aborted"
            assert data["task"]["status"] == TaskStatus.ABORTED.value

            # Verify task was aborted and dedup_key changed to UUID
            db.session.refresh(task)
            assert task.status == TaskStatus.ABORTED.value
            assert task.dedup_key == task.uuid
            assert task.dedup_key != original_dedup_key

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
            assert data["task"]["uuid"] == task.uuid
            assert data["task"]["status"] == TaskStatus.ABORTED.value
            assert data["action"] == "aborted"

    def test_cancel_task_not_found(self):
        """
        Task API: Test cancel task not found
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/99999/cancel"
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

            uri = f"{self.TASK_API_BASE}/{task.id}/cancel"
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

            uri = f"{self.TASK_API_BASE}/{task.id}/cancel"
            rv = self.client.post(uri)
            assert rv.status_code == 200

    def test_get_task_status_by_id(self):
        """
        Task API: Test get task status by ID (lightweight)
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            task = db.session.query(Task).filter_by(created_by_fk=admin.id).first()
            assert task is not None

            uri = f"{self.TASK_API_BASE}/{task.id}/status"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            # Should only return status, not full task details
            assert "status" in data
            assert data["status"] == task.status
            # Verify it's lightweight - no other fields
            assert "payload" not in data
            assert "created_by" not in data
            assert "error_message" not in data

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
        Task API: Test get task status not found
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/99999/status"
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

            uri = f"{self.TASK_API_BASE}/{task.id}/status"
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

            uri = f"{self.TASK_API_BASE}/{task.id}/status"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["status"] == task.status

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
            uri = f"{self.TASK_API_BASE}/{task.id}"
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
            ]

            for field in expected_fields:
                assert field in result, f"Field {field} missing from response"

            # Verify properties is a dict with expected structure
            properties = result["properties"]
            assert isinstance(properties, dict)

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
            uri = f"{self.TASK_API_BASE}/{task.id}"
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

            # Verify finished task has UUID as dedup_key
            assert task.dedup_key == task.uuid

            uri = f"{self.TASK_API_BASE}/{task.id}"
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
