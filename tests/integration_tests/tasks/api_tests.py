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
                    payload='{"test": "data"}',
                )

                # Set created_by for test purposes (DAO uses Flask-AppBuilder context)
                task.created_by = admin

                # Alternate between pending and finished tasks
                if i % 2 != 0:
                    # Set to SUCCESS for odd-numbered tasks
                    task.set_status(TaskStatus.SUCCESS)

                db.session.commit()
                tasks.append(task)

            # Create in progress task for gamma user
            gamma_task = TaskDAO.create_task(
                task_type="test_type",
                task_key="gamma_task",
                task_name="Gamma Task",
                scope=TaskScope.PRIVATE,
                user_id=gamma.id,
                payload='{"user": "gamma"}',
            )
            # Set created_by for test purposes
            gamma_task.created_by = gamma
            # Set to IN_PROGRESS
            gamma_task.set_status(TaskStatus.IN_PROGRESS)
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

    def test_info_async_task(self):
        """
        Task API: Test info endpoint
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/_info"
        rv = self.client.get(uri)
        assert rv.status_code == 200
        data = json.loads(rv.data.decode("utf-8"))
        assert "permissions" in data

    def test_get_async_task_by_id(self):
        """
        Task API: Test get async task by ID
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

    def test_get_async_task_by_uuid(self):
        """
        Task API: Test get async task by UUID and verify dedup_key
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            # Get a pending task to verify active dedup_key format
            task = (
                db.session.query(Task)
                .filter_by(created_by_fk=admin.id, status=TaskStatus.PENDING.value)
                .first()
            )
            assert task is not None

            # Verify active task has composite dedup_key with user_id
            assert task.dedup_key.startswith("private|test_type|")
            assert f"|{admin.id}" in task.dedup_key
            assert task.dedup_key != task.uuid

            uri = f"{self.TASK_API_BASE}/{task.uuid}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["result"]["uuid"] == task.uuid
            assert data["result"]["id"] == task.id

    def test_get_async_task_not_found(self):
        """
        Task API: Test get async task not found
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/99999"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    def test_get_async_task_invalid_uuid(self):
        """
        Task API: Test get async task with invalid UUID
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/invalid-uuid"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    def test_get_async_task_list(self):
        """
        Task API: Test get async task list
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            uri = f"{self.TASK_API_BASE}/"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["count"] >= 6  # At least the fixtures we created
            assert "result" in data

    def test_get_async_task_list_filtered_by_status(self):
        """
        Task API: Test get async task list filtered by status
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

    def test_get_async_task_list_filtered_by_type(self):
        """
        Task API: Test get async task list filtered by type
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

    def test_get_async_task_list_ordered(self):
        """
        Task API: Test get async task list with ordering
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

    def test_get_async_task_list_paginated(self):
        """
        Task API: Test get async task list with pagination
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

    def test_abort_async_task_by_id(self):
        """
        Task API: Test abort async task by ID
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            # Find a pending task
            task = (
                db.session.query(Task)
                .filter_by(created_by_fk=admin.id, status=TaskStatus.PENDING.value)
                .first()
            )
            assert task is not None

            # Verify active task has composite dedup_key
            original_dedup_key = task.dedup_key
            assert original_dedup_key.startswith("private|test_type|")
            assert f"|{admin.id}" in original_dedup_key

            uri = f"{self.TASK_API_BASE}/{task.id}/abort"
            rv = self.client.post(uri, json={})
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["message"] == "Task aborted successfully"
            assert data["task"]["status"] == TaskStatus.ABORTED.value

            # Verify task was aborted and dedup_key changed to UUID
            db.session.refresh(task)
            assert task.status == TaskStatus.ABORTED.value
            assert task.dedup_key == task.uuid
            assert task.dedup_key != original_dedup_key

    def test_abort_async_task_by_uuid(self):
        """
        Task API: Test abort async task by UUID
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

            uri = f"{self.TASK_API_BASE}/{task.uuid}/abort"
            rv = self.client.post(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            assert data["task"]["uuid"] == task.uuid
            assert data["task"]["status"] == TaskStatus.ABORTED.value

    def test_abort_async_task_not_found(self):
        """
        Task API: Test abort async task not found
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/99999/abort"
        rv = self.client.post(uri)
        assert rv.status_code == 404

    def test_abort_async_task_not_owned(self):
        """
        Task API: Test abort async task not owned by user
        """
        with self._create_tasks():
            self.login(GAMMA_USERNAME)
            admin = self.get_user("admin")

            # Try to abort admin's task as gamma user
            task = db.session.query(Task).filter_by(created_by_fk=admin.id).first()
            assert task is not None

            uri = f"{self.TASK_API_BASE}/{task.id}/abort"
            rv = self.client.post(uri)
            assert rv.status_code == 404

    def test_abort_async_task_admin_can_abort_others(self):
        """
        Task API: Test admin can abort other users' tasks
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            gamma = self.get_user("gamma")

            # Admin aborts gamma's task
            task = db.session.query(Task).filter_by(created_by_fk=gamma.id).first()
            assert task is not None

            uri = f"{self.TASK_API_BASE}/{task.id}/abort"
            rv = self.client.post(uri)
            assert rv.status_code == 200

    def test_get_async_task_status_by_id(self):
        """
        Task API: Test get async task status by ID (lightweight)
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

    def test_get_async_task_status_by_uuid(self):
        """
        Task API: Test get async task status by UUID
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

    def test_get_async_task_status_not_found(self):
        """
        Task API: Test get async task status not found
        """
        self.login(ADMIN_USERNAME)
        uri = f"{self.TASK_API_BASE}/99999/status"
        rv = self.client.get(uri)
        assert rv.status_code == 404

    def test_get_async_task_status_not_owned(self):
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

    def test_get_async_task_status_admin_can_see_others(self):
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

    def test_get_async_task_list_user_sees_own_tasks(self):
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

    def test_get_async_task_list_admin_sees_all_tasks(self):
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

    def test_async_task_response_schema(self):
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
                "changed_on",
                "started_at",
                "ended_at",
                "created_by",
                "user_id",
                "database_id",
                "error_message",
                "payload",
                "duration_seconds",
                "is_finished",
                "is_successful",
                "is_aborted",
                "progress",
            ]

            for field in expected_fields:
                assert field in result, f"Field {field} missing from response"

    def test_async_task_payload_serialization(self):
        """
        Task API: Test payload is properly serialized as dict
        """
        with self._create_tasks():
            self.login(ADMIN_USERNAME)
            admin = self.get_user("admin")

            task = db.session.query(Task).filter_by(created_by_fk=admin.id).first()
            uri = f"{self.TASK_API_BASE}/{task.id}"
            rv = self.client.get(uri)
            assert rv.status_code == 200

            data = json.loads(rv.data.decode("utf-8"))
            payload = data["result"]["payload"]

            # Payload should be a dict, not a string
            assert isinstance(payload, dict)
            assert "test" in payload
            assert payload["test"] == "data"

    def test_async_task_computed_properties(self):
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

            # Check computed properties
            assert result["is_finished"] is True
            assert result["is_successful"] is True
            assert result["is_aborted"] is False
