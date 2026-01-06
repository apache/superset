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

from superset.commands.async_tasks.bulk_cancel import BulkCancelAsyncTasksCommand


class TestBulkCancelAsyncTasksCommand:
    """Test BulkCancelAsyncTasksCommand"""

    @patch("superset.commands.async_tasks.bulk_cancel.security_manager")
    @patch("superset.commands.async_tasks.bulk_cancel.AsyncTaskDAO")
    def test_bulk_cancel_success(self, mock_dao, mock_security_manager):
        """Test successful bulk cancellation"""
        mock_security_manager.is_admin.return_value = True
        mock_dao.bulk_cancel_tasks.return_value = (2, 2)

        command = BulkCancelAsyncTasksCommand(["uuid1", "uuid2"])
        cancelled_count, total_requested = command.run()

        assert cancelled_count == 2
        assert total_requested == 2
        mock_dao.bulk_cancel_tasks.assert_called_once_with(
            ["uuid1", "uuid2"], skip_base_filter=True
        )

    @patch("superset.commands.async_tasks.bulk_cancel.security_manager")
    @patch("superset.commands.async_tasks.bulk_cancel.AsyncTaskDAO")
    def test_bulk_cancel_non_admin(self, mock_dao, mock_security_manager):
        """Test bulk cancellation as non-admin (uses base filter)"""
        mock_security_manager.is_admin.return_value = False
        mock_dao.bulk_cancel_tasks.return_value = (1, 2)

        command = BulkCancelAsyncTasksCommand(["uuid1", "uuid2"])
        cancelled_count, total_requested = command.run()

        assert cancelled_count == 1
        assert total_requested == 2
        mock_dao.bulk_cancel_tasks.assert_called_once_with(
            ["uuid1", "uuid2"], skip_base_filter=False
        )

    @patch("superset.commands.async_tasks.bulk_cancel.security_manager")
    @patch("superset.commands.async_tasks.bulk_cancel.AsyncTaskDAO")
    def test_bulk_cancel_partial_success(self, mock_dao, mock_security_manager):
        """Test bulk cancellation with partial success"""
        mock_security_manager.is_admin.return_value = True
        mock_dao.bulk_cancel_tasks.return_value = (2, 5)  # Only 2 out of 5 cancelled

        command = BulkCancelAsyncTasksCommand(
            ["uuid1", "uuid2", "uuid3", "uuid4", "uuid5"]
        )
        cancelled_count, total_requested = command.run()

        assert cancelled_count == 2
        assert total_requested == 5
