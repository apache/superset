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
"""Integration tests for abort handlers"""

import time

from superset_core.api.tasks import get_context, task, TaskStatus

from superset.commands.tasks.bulk_abort import BulkAbortTasksCommand
from superset.extensions import db
from tests.integration_tests.base_tests import SupersetTestCase


class TestAbortHandlers(SupersetTestCase):
    """Integration tests for on_abort functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.cleanup_flag = False
        self.abort_flag = False

    def test_abort_handler_fires_on_task_abort(self):
        """Test that abort handler fires when task is aborted"""

        @task(name="test_abort_handler")
        def test_task():
            ctx = get_context()

            @ctx.on_abort
            def handle_abort():
                # Set a flag that we can check
                test_task.abort_called = True

            # Sleep to allow abort to happen during execution
            time.sleep(0.5)

        test_task.abort_called = False

        # Schedule the task
        created_task = test_task.schedule()

        # Give task time to start
        time.sleep(0.2)

        # Abort the task
        BulkAbortTasksCommand([created_task.uuid]).run()

        # Wait for abort handler to fire
        time.sleep(1.0)

        # Verify handler was called
        assert test_task.abort_called

    def test_abort_handler_cleanup_partial_work(self):
        """Test abort handler cleans up partial work"""
        temp_data = {"key": "value"}

        @task(name="test_cleanup_partial")
        def test_task():
            ctx = get_context()

            @ctx.on_abort
            def cleanup():
                temp_data.clear()

            # Update task payload
            ctx.update_task(payload={"processing": True})

            # Sleep to allow abort
            time.sleep(0.5)

        # Schedule and abort
        created_task = test_task.schedule()
        time.sleep(0.2)
        BulkAbortTasksCommand([created_task.uuid]).run()
        time.sleep(1.0)

        # Verify cleanup happened
        assert len(temp_data) == 0

    def test_multiple_abort_handlers_execute(self):
        """Test that multiple abort handlers all execute"""
        calls = []

        @task(name="test_multiple_handlers")
        def test_task():
            ctx = get_context()

            @ctx.on_abort
            def handler1():
                calls.append(1)

            @ctx.on_abort
            def handler2():
                calls.append(2)

            time.sleep(0.5)

        # Schedule and abort
        created_task = test_task.schedule()
        time.sleep(0.2)
        BulkAbortTasksCommand([created_task.uuid]).run()
        time.sleep(1.0)

        # Both handlers should have been called
        assert 1 in calls
        assert 2 in calls

    def test_abort_handler_with_cleanup_handler(self):
        """Test that both abort and cleanup handlers run"""
        abort_called = False
        cleanup_called = False

        @task(name="test_abort_and_cleanup")
        def test_task():
            ctx = get_context()

            @ctx.on_abort
            def handle_abort():
                nonlocal abort_called
                abort_called = True

            @ctx.on_cleanup
            def handle_cleanup():
                nonlocal cleanup_called
                cleanup_called = True

            time.sleep(0.5)

        # Schedule and abort
        created_task = test_task.schedule()
        time.sleep(0.2)
        BulkAbortTasksCommand([created_task.uuid]).run()
        time.sleep(1.0)

        # Both should have been called
        assert abort_called
        assert cleanup_called

    def test_abort_handler_not_called_on_success(self):
        """Test that abort handler doesn't run on successful completion"""
        abort_called = False

        @task(name="test_success_no_abort")
        def test_task():
            ctx = get_context()

            @ctx.on_abort
            def handle_abort():
                nonlocal abort_called
                abort_called = True

            # Complete successfully
            ctx.update_task(progress=1.0)

        # Schedule and let complete
        test_task.schedule()
        time.sleep(1.0)

        # Abort handler should NOT have been called
        assert not abort_called

    def test_custom_polling_interval(self):
        """Test that custom polling interval can be set"""
        abort_called = False

        @task(name="test_custom_interval")
        def test_task():
            ctx = get_context()

            @ctx.on_abort
            def handle_abort():
                nonlocal abort_called
                abort_called = True

            # Override default polling interval
            ctx.start_abort_polling(interval=0.5)

            time.sleep(1.0)

        # Schedule and abort
        created_task = test_task.schedule()
        time.sleep(0.2)
        BulkAbortTasksCommand([created_task.uuid]).run()
        time.sleep(1.5)

        assert abort_called

    def test_abort_handler_exception_logged(self):
        """Test that exceptions in abort handlers are logged but don't fail task"""
        good_handler_called = False

        @task(name="test_handler_exception")
        def test_task():
            ctx = get_context()

            @ctx.on_abort
            def bad_handler():
                raise ValueError("Handler failed")

            @ctx.on_abort
            def good_handler():
                nonlocal good_handler_called
                good_handler_called = True

            time.sleep(0.5)

        # Schedule and abort
        created_task = test_task.schedule()
        time.sleep(0.2)
        BulkAbortTasksCommand([created_task.uuid]).run()
        time.sleep(1.0)

        # Good handler should still have been called
        assert good_handler_called

        # Task should be aborted (not failed)
        task_obj = (
            db.session.query(type(created_task))
            .filter_by(uuid=created_task.uuid)
            .first()
        )
        assert task_obj.status == TaskStatus.ABORTED.value

    def test_abort_before_execution_starts(self):
        """Test that tasks aborted before execution don't run handlers"""
        handler_called = False

        @task(name="test_abort_before_start")
        def test_task():
            ctx = get_context()

            @ctx.on_abort
            def handle_abort():
                nonlocal handler_called
                handler_called = True

            # This code shouldn't run if aborted before start
            ctx.update_task(progress=0.5)

        # Schedule the task
        created_task = test_task.schedule()

        # Abort immediately (before execution starts)
        BulkAbortTasksCommand([created_task.uuid]).run()

        # Wait a bit
        time.sleep(1.0)

        # Handler should NOT have been called (task never started executing)
        assert not handler_called

        # Verify task is aborted
        task_obj = (
            db.session.query(type(created_task))
            .filter_by(uuid=created_task.uuid)
            .first()
        )
        assert task_obj.status == TaskStatus.ABORTED.value
