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

from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from superset_core.api.tasks import TaskStatus

from superset.daos.exceptions import DAOCreateFailedError
from superset.daos.tasks import TaskDAO
from superset.models.tasks import Task


class TestTaskDAO:
    """Test TaskDAO functionality"""

    @patch("superset.daos.tasks.db.session")
    def test_find_by_task_key_active(self, mock_session):
        """Test finding active task by task_key"""
        mock_task = MagicMock(spec=Task)
        mock_task.task_key = "test-id"
        mock_task.task_type = "test_type"
        mock_task.status = TaskStatus.PENDING.value

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_filter.one_or_none.return_value = mock_task

        result = TaskDAO.find_by_task_key("test_type", "test-key")

        assert result == mock_task
        mock_session.query.assert_called_once_with(Task)

    @patch("superset.daos.tasks.db.session")
    def test_find_by_task_key_not_found(self, mock_session):
        """Test finding task by task_key returns None when not found"""
        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_filter.one_or_none.return_value = None

        result = TaskDAO.find_by_task_key("test_type", "nonexistent-key")

        assert result is None

    @patch("superset.daos.tasks.db.session")
    def test_find_by_task_key_ignores_finished_tasks(self, mock_session):
        """Test that find_by_task_key only returns pending/in-progress tasks"""
        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_filter.one_or_none.return_value = None

        # Should not find SUCCESS task
        result = TaskDAO.find_by_task_key("test_type", "finished-key")
        assert result is None

    @patch("superset.daos.tasks.TaskDAO.create")
    @patch("superset.daos.tasks.TaskDAO.find_by_task_key")
    @patch("superset.daos.tasks.db.session")
    def test_create_task_success(self, mock_session, mock_find, mock_create):
        """Test successful task creation"""
        mock_find.return_value = None  # No existing task
        mock_task = MagicMock(spec=Task)
        mock_task.task_key = "new-task"
        mock_task.task_type = "test_type"
        mock_create.return_value = mock_task

        result = TaskDAO.create_task(
            task_type="test_type",
            task_key="new-task",
        )

        assert result == mock_task
        mock_find.assert_called_once_with("test_type", "new-task")
        mock_session.commit.assert_called_once()

    @patch("superset.daos.tasks.TaskDAO.find_by_task_key")
    def test_create_task_duplicate(self, mock_find):
        """Test that creating duplicate task raises error"""
        existing_task = MagicMock(spec=Task)
        existing_task.status = TaskStatus.PENDING.value
        mock_find.return_value = existing_task

        with pytest.raises(DAOCreateFailedError) as exc_info:
            TaskDAO.create_task(
                task_type="test_type",
                task_key="existing-task",
            )

        assert "already exists" in str(exc_info.value)

    @patch("superset.daos.tasks.TaskDAO.create")
    @patch("superset.daos.tasks.TaskDAO.find_by_task_key")
    @patch("superset.daos.tasks.db.session")
    @patch("superset.daos.tasks.uuid.uuid4")
    def test_create_task_without_task_key(
        self, mock_uuid, mock_session, mock_find, mock_create
    ):
        """Test task creation without task_key generates UUID"""
        mock_uuid.return_value = "generated-uuid"
        mock_find.return_value = None
        mock_task = MagicMock(spec=Task)
        mock_create.return_value = mock_task

        result = TaskDAO.create_task(
            task_type="test_type",
            task_key=None,
        )

        assert result == mock_task
        # Should call find_by_task_key with generated UUID
        mock_uuid.assert_called_once()

    @patch("superset.daos.tasks.TaskDAO.find_one_or_none")
    @patch("superset.daos.tasks.db.session")
    def test_abort_task_success(self, mock_session, mock_find):
        """Test successful task abortlation"""
        mock_task = MagicMock(spec=Task)
        mock_task.status = TaskStatus.PENDING.value
        mock_find.return_value = mock_task

        result = TaskDAO.abort_task("test-uuid")

        assert result is True
        mock_task.set_status.assert_called_once_with(TaskStatus.ABORTED.value)
        mock_session.commit.assert_called_once()

    @patch("superset.daos.tasks.TaskDAO.find_one_or_none")
    def test_abort_task_not_found(self, mock_find):
        """Test abort fails when task not found"""
        mock_find.return_value = None

        result = TaskDAO.abort_task("nonexistent-uuid")

        assert result is False

    @patch("superset.daos.tasks.TaskDAO.find_one_or_none")
    def test_abort_task_already_finished(self, mock_find):
        """Test abort fails when task already finished"""
        mock_task = MagicMock(spec=Task)
        mock_task.status = TaskStatus.SUCCESS.value
        mock_find.return_value = mock_task

        result = TaskDAO.abort_task("finished-uuid")

        assert result is False
        mock_task.set_status.assert_not_called()

    @patch("superset.daos.tasks.db.session")
    def test_delete_old_completed_tasks(self, mock_session):
        """Test deletion of old completed tasks"""
        cutoff_date = datetime.utcnow() - timedelta(days=30)

        # First batch
        mock_task1 = MagicMock(spec=Task)
        mock_task2 = MagicMock(spec=Task)
        batch1 = [mock_task1, mock_task2]

        # Second call returns empty (done)
        batch2 = []

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_limit = MagicMock()
        mock_filter.limit.return_value = mock_limit
        mock_limit.all.side_effect = [batch1, batch2]

        result = TaskDAO.delete_old_completed_tasks(
            older_than=cutoff_date,
            batch_size=2,
        )

        assert result == 2
        assert mock_session.delete.call_count == 2
        assert mock_session.commit.call_count == 1

    @patch("superset.daos.tasks.db.session")
    def test_delete_old_completed_tasks_no_tasks(self, mock_session):
        """Test deletion when no old tasks exist"""
        cutoff_date = datetime.utcnow() - timedelta(days=30)

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_limit = MagicMock()
        mock_filter.limit.return_value = mock_limit
        mock_limit.all.return_value = []

        result = TaskDAO.delete_old_completed_tasks(
            older_than=cutoff_date,
            batch_size=1000,
        )

        assert result == 0
        mock_session.delete.assert_not_called()

    @patch("superset.daos.tasks.db.session")
    def test_delete_old_completed_tasks_multiple_batches(self, mock_session):
        """Test deletion processes multiple batches"""
        cutoff_date = datetime.utcnow() - timedelta(days=30)

        # Three batches
        batch1 = [MagicMock(spec=Task) for _ in range(3)]
        batch2 = [MagicMock(spec=Task) for _ in range(3)]
        batch3 = [MagicMock(spec=Task) for _ in range(2)]
        batch4 = []  # Done

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_limit = MagicMock()
        mock_filter.limit.return_value = mock_limit
        mock_limit.all.side_effect = [batch1, batch2, batch3, batch4]

        result = TaskDAO.delete_old_completed_tasks(
            older_than=cutoff_date,
            batch_size=3,
        )

        assert result == 8  # 3 + 3 + 2
        assert mock_session.delete.call_count == 8
        assert mock_session.commit.call_count == 1

    @patch("superset.daos.tasks.TaskDAO.find_by_ids")
    @patch("superset.daos.tasks.db.session")
    def test_bulk_abort_tasks_success(self, mock_session, mock_find_by_ids):
        """Test successful bulk abortlation of tasks"""
        mock_task1 = MagicMock(spec=Task)
        mock_task1.uuid = "uuid1"
        mock_task1.status = TaskStatus.PENDING.value

        mock_task2 = MagicMock(spec=Task)
        mock_task2.uuid = "uuid2"
        mock_task2.status = TaskStatus.IN_PROGRESS.value

        mock_find_by_ids.return_value = [mock_task1, mock_task2]

        aborted_count, total_requested = TaskDAO.bulk_abort_tasks(["uuid1", "uuid2"])

        assert aborted_count == 2
        assert total_requested == 2
        mock_task1.set_status.assert_called_once_with(TaskStatus.ABORTED.value)
        mock_task2.set_status.assert_called_once_with(TaskStatus.ABORTED.value)
        assert mock_session.commit.call_count == 2

    @patch("superset.daos.tasks.TaskDAO.find_all")
    def test_bulk_abort_tasks_empty_list(self, mock_find_all):
        """Test bulk abort with empty list"""
        aborted_count, total_requested = TaskDAO.bulk_abort_tasks([])

        assert aborted_count == 0
        assert total_requested == 0
        mock_find_all.assert_not_called()

    @patch("superset.daos.tasks.TaskDAO.find_by_ids")
    @patch("superset.daos.tasks.db.session")
    def test_bulk_abort_tasks_partial_success(self, mock_session, mock_find_by_ids):
        """Test bulk abort with partial success (some tasks fail)"""
        mock_task1 = MagicMock(spec=Task)
        mock_task1.uuid = "uuid1"
        mock_task1.status = TaskStatus.PENDING.value

        mock_task2 = MagicMock(spec=Task)
        mock_task2.uuid = "uuid2"
        mock_task2.status = TaskStatus.IN_PROGRESS.value
        mock_task2.set_status.side_effect = Exception("Database error")

        mock_find_by_ids.return_value = [mock_task1, mock_task2]

        aborted_count, total_requested = TaskDAO.bulk_abort_tasks(
            ["uuid1", "uuid2", "uuid3"]
        )

        assert aborted_count == 1  # Only task1 succeeded
        assert total_requested == 3
        mock_task1.set_status.assert_called_once_with(TaskStatus.ABORTED.value)
        mock_task2.set_status.assert_called_once_with(TaskStatus.ABORTED.value)
        # One commit for successful task, one rollback for failed task
        assert mock_session.commit.call_count == 1
        assert mock_session.rollback.call_count == 1

    @patch("superset.daos.tasks.TaskDAO.find_by_ids")
    def test_bulk_abort_tasks_no_abortlable_tasks(self, mock_find_by_ids):
        """Test bulk abort when no tasks are in abortlable state"""
        # Simulate tasks exist but are not in abortlable state
        mock_task1 = MagicMock(spec=Task)
        mock_task1.status = TaskStatus.SUCCESS.value

        mock_task2 = MagicMock(spec=Task)
        mock_task2.status = TaskStatus.FAILURE.value

        mock_find_by_ids.return_value = [mock_task1, mock_task2]

        aborted_count, total_requested = TaskDAO.bulk_abort_tasks(["uuid1", "uuid2"])

        assert aborted_count == 0
        assert total_requested == 2

    @patch("superset.daos.tasks.TaskDAO.find_by_ids")
    @patch("superset.daos.tasks.db.session")
    def test_bulk_abort_tasks_with_skip_base_filter(
        self, mock_session, mock_find_by_ids
    ):
        """Test bulk abort respects skip_base_filter parameter"""
        mock_task = MagicMock(spec=Task)
        mock_task.status = TaskStatus.PENDING.value
        mock_find_by_ids.return_value = [mock_task]

        TaskDAO.bulk_abort_tasks(["uuid1"], skip_base_filter=True)

        # Verify find_by_ids was called with skip_base_filter=True
        mock_find_by_ids.assert_called_once()
        call_args = mock_find_by_ids.call_args
        assert call_args.kwargs.get("skip_base_filter") is True
        assert call_args.kwargs.get("id_column") == "uuid"
