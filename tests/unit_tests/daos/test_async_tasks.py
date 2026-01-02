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
from superset_core.api.types import TaskStatus

from superset.daos.async_tasks import AsyncTaskDAO
from superset.daos.exceptions import DAOCreateFailedError
from superset.models.async_tasks import AsyncTask


class TestAsyncTaskDAO:
    """Test AsyncTaskDAO functionality"""

    @patch("superset.daos.async_tasks.db.session")
    def test_find_by_task_id_active(self, mock_session):
        """Test finding active task by task_id"""
        mock_task = MagicMock(spec=AsyncTask)
        mock_task.task_id = "test-id"
        mock_task.task_type = "test_type"
        mock_task.status = TaskStatus.PENDING.value

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_filter.one_or_none.return_value = mock_task

        result = AsyncTaskDAO.find_by_task_id("test_type", "test-id")

        assert result == mock_task
        mock_session.query.assert_called_once_with(AsyncTask)

    @patch("superset.daos.async_tasks.db.session")
    def test_find_by_task_id_not_found(self, mock_session):
        """Test finding task by task_id returns None when not found"""
        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_filter.one_or_none.return_value = None

        result = AsyncTaskDAO.find_by_task_id("test_type", "nonexistent-id")

        assert result is None

    @patch("superset.daos.async_tasks.db.session")
    def test_find_by_task_id_ignores_finished_tasks(self, mock_session):
        """Test that find_by_task_id only returns pending/in-progress tasks"""
        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_filter.one_or_none.return_value = None

        # Should not find SUCCESS task
        result = AsyncTaskDAO.find_by_task_id("test_type", "finished-id")
        assert result is None

    @patch("superset.daos.async_tasks.AsyncTaskDAO.create")
    @patch("superset.daos.async_tasks.AsyncTaskDAO.find_by_task_id")
    @patch("superset.daos.async_tasks.db.session")
    def test_create_task_success(self, mock_session, mock_find, mock_create):
        """Test successful task creation"""
        mock_find.return_value = None  # No existing task
        mock_task = MagicMock(spec=AsyncTask)
        mock_task.task_id = "new-task"
        mock_task.task_type = "test_type"
        mock_create.return_value = mock_task

        result = AsyncTaskDAO.create_task(
            task_type="test_type",
            task_id="new-task",
        )

        assert result == mock_task
        mock_find.assert_called_once_with("test_type", "new-task")
        mock_session.commit.assert_called_once()

    @patch("superset.daos.async_tasks.AsyncTaskDAO.find_by_task_id")
    def test_create_task_duplicate(self, mock_find):
        """Test that creating duplicate task raises error"""
        existing_task = MagicMock(spec=AsyncTask)
        existing_task.status = TaskStatus.PENDING.value
        mock_find.return_value = existing_task

        with pytest.raises(DAOCreateFailedError) as exc_info:
            AsyncTaskDAO.create_task(
                task_type="test_type",
                task_id="existing-task",
            )

        assert "already exists" in str(exc_info.value)

    @patch("superset.daos.async_tasks.AsyncTaskDAO.create")
    @patch("superset.daos.async_tasks.AsyncTaskDAO.find_by_task_id")
    @patch("superset.daos.async_tasks.db.session")
    @patch("superset.daos.async_tasks.uuid.uuid4")
    def test_create_task_without_task_id(
        self, mock_uuid, mock_session, mock_find, mock_create
    ):
        """Test task creation without task_id generates UUID"""
        mock_uuid.return_value = "generated-uuid"
        mock_find.return_value = None
        mock_task = MagicMock(spec=AsyncTask)
        mock_create.return_value = mock_task

        result = AsyncTaskDAO.create_task(
            task_type="test_type",
            task_id=None,
        )

        assert result == mock_task
        # Should call find_by_task_id with generated UUID
        mock_uuid.assert_called_once()

    @patch("superset.daos.async_tasks.AsyncTaskDAO.find_one_or_none")
    @patch("superset.daos.async_tasks.db.session")
    def test_cancel_task_success(self, mock_session, mock_find):
        """Test successful task cancellation"""
        mock_task = MagicMock(spec=AsyncTask)
        mock_task.status = TaskStatus.PENDING.value
        mock_find.return_value = mock_task

        result = AsyncTaskDAO.cancel_task("test-uuid")

        assert result is True
        mock_task.set_status.assert_called_once_with(TaskStatus.CANCELLED.value)
        mock_session.commit.assert_called_once()

    @patch("superset.daos.async_tasks.AsyncTaskDAO.find_one_or_none")
    def test_cancel_task_not_found(self, mock_find):
        """Test cancel fails when task not found"""
        mock_find.return_value = None

        result = AsyncTaskDAO.cancel_task("nonexistent-uuid")

        assert result is False

    @patch("superset.daos.async_tasks.AsyncTaskDAO.find_one_or_none")
    def test_cancel_task_already_finished(self, mock_find):
        """Test cancel fails when task already finished"""
        mock_task = MagicMock(spec=AsyncTask)
        mock_task.status = TaskStatus.SUCCESS.value
        mock_find.return_value = mock_task

        result = AsyncTaskDAO.cancel_task("finished-uuid")

        assert result is False
        mock_task.set_status.assert_not_called()

    @patch("superset.daos.async_tasks.db.session")
    def test_delete_old_completed_tasks(self, mock_session):
        """Test deletion of old completed tasks"""
        cutoff_date = datetime.utcnow() - timedelta(days=30)

        # First batch
        mock_task1 = MagicMock(spec=AsyncTask)
        mock_task2 = MagicMock(spec=AsyncTask)
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

        result = AsyncTaskDAO.delete_old_completed_tasks(
            older_than=cutoff_date,
            batch_size=2,
        )

        assert result == 2
        assert mock_session.delete.call_count == 2
        assert mock_session.commit.call_count == 1

    @patch("superset.daos.async_tasks.db.session")
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

        result = AsyncTaskDAO.delete_old_completed_tasks(
            older_than=cutoff_date,
            batch_size=1000,
        )

        assert result == 0
        mock_session.delete.assert_not_called()

    @patch("superset.daos.async_tasks.db.session")
    def test_delete_old_completed_tasks_multiple_batches(self, mock_session):
        """Test deletion processes multiple batches"""
        cutoff_date = datetime.utcnow() - timedelta(days=30)

        # Three batches
        batch1 = [MagicMock(spec=AsyncTask) for _ in range(3)]
        batch2 = [MagicMock(spec=AsyncTask) for _ in range(3)]
        batch3 = [MagicMock(spec=AsyncTask) for _ in range(2)]
        batch4 = []  # Done

        mock_query = MagicMock()
        mock_session.query.return_value = mock_query
        mock_filter = MagicMock()
        mock_query.filter.return_value = mock_filter
        mock_limit = MagicMock()
        mock_filter.limit.return_value = mock_limit
        mock_limit.all.side_effect = [batch1, batch2, batch3, batch4]

        result = AsyncTaskDAO.delete_old_completed_tasks(
            older_than=cutoff_date,
            batch_size=3,
        )

        assert result == 8  # 3 + 3 + 2
        assert mock_session.delete.call_count == 8
        assert mock_session.commit.call_count == 1
