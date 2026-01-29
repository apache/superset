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
"""Unit tests for task decorators"""

from unittest.mock import MagicMock, patch

import pytest
from superset_core.api.tasks import TaskOptions, TaskScope

from superset.tasks.decorators import task, TaskWrapper
from superset.tasks.registry import TaskRegistry


class TestTaskDecorator:
    """Tests for @task decorator"""

    def test_decorator_basic(self):
        """Test basic decorator usage without options"""

        @task(name="test_task")
        def my_task(arg1: int, arg2: str) -> None:
            pass

        assert isinstance(my_task, TaskWrapper)
        assert my_task.name == "test_task"
        assert my_task.scope == TaskScope.PRIVATE

    def test_decorator_without_parentheses(self):
        """Test decorator usage without parentheses"""

        @task
        def my_no_parens_task(arg1: int, arg2: str) -> None:
            pass

        assert isinstance(my_no_parens_task, TaskWrapper)
        assert my_no_parens_task.name == "my_no_parens_task"  # Uses function name
        assert my_no_parens_task.scope == TaskScope.PRIVATE

    def test_decorator_with_default_scope_private(self):
        """Test decorator with explicit PRIVATE scope"""

        @task(name="private_task", scope=TaskScope.PRIVATE)
        def my_private_task(arg1: int) -> None:
            pass

        assert my_private_task.scope == TaskScope.PRIVATE

    def test_decorator_with_default_scope_shared(self):
        """Test decorator with SHARED scope"""

        @task(name="shared_task", scope=TaskScope.SHARED)
        def my_shared_task(arg1: int) -> None:
            pass

        assert my_shared_task.scope == TaskScope.SHARED

    def test_decorator_with_default_scope_system(self):
        """Test decorator with SYSTEM scope"""

        @task(name="system_task", scope=TaskScope.SYSTEM)
        def my_system_task() -> None:
            pass

        assert my_system_task.scope == TaskScope.SYSTEM

    def test_decorator_forbids_ctx_parameter(self):
        """Test decorator rejects functions with ctx parameter"""

        with pytest.raises(TypeError, match="must not define 'ctx'"):

            @task(name="bad_task")
            def bad_task(ctx, arg1: int) -> None:  # noqa: ARG001
                pass

    def test_decorator_forbids_options_parameter(self):
        """Test decorator rejects functions with options parameter"""

        with pytest.raises(TypeError, match="must not define.*'options'"):

            @task(name="bad_task")
            def bad_task(options, arg1: int) -> None:  # noqa: ARG001
                pass


class TestTaskWrapperMergeOptions:
    """Tests for TaskWrapper._merge_options()"""

    def setup_method(self):
        """Clear task registry before each test"""
        TaskRegistry._tasks.clear()

    def test_merge_options_no_override(self):
        """Test merging with no override returns defaults"""

        @task(name="test_merge_no_override_unique")
        def merge_task_1() -> None:
            pass

        # Set default options for testing
        merge_task_1.default_options = TaskOptions(
            task_key="default_key",
            task_name="Default Name",
        )

        merged = merge_task_1._merge_options(None)
        assert merged.task_key == "default_key"
        assert merged.task_name == "Default Name"

    def test_merge_options_override_task_key(self):
        """Test overriding task_key at call time"""

        @task(name="test_merge_override_key_unique")
        def merge_task_2() -> None:
            pass

        # Set default options for testing
        merge_task_2.default_options = TaskOptions(task_key="default_key")

        override = TaskOptions(task_key="override_key")
        merged = merge_task_2._merge_options(override)
        assert merged.task_key == "override_key"

    def test_merge_options_override_task_name(self):
        """Test overriding task_name at call time"""

        @task(name="test_merge_override_name_unique")
        def merge_task_3() -> None:
            pass

        # Set default options for testing
        merge_task_3.default_options = TaskOptions(task_name="Default Name")

        override = TaskOptions(task_name="Override Name")
        merged = merge_task_3._merge_options(override)
        assert merged.task_name == "Override Name"

    def test_merge_options_override_all(self):
        """Test overriding all options at call time"""

        @task(name="test_merge_override_all_unique")
        def merge_task_4() -> None:
            pass

        # Set default options for testing
        merge_task_4.default_options = TaskOptions(
            task_key="default_key",
            task_name="Default Name",
        )

        override = TaskOptions(
            task_key="override_key",
            task_name="Override Name",
        )
        merged = merge_task_4._merge_options(override)
        assert merged.task_key == "override_key"
        assert merged.task_name == "Override Name"


class TestTaskWrapperSchedule:
    """Tests for TaskWrapper.schedule() with scope"""

    def setup_method(self):
        """Clear task registry before each test"""
        TaskRegistry._tasks.clear()

    @patch("superset.tasks.decorators.TaskManager.submit_task")
    def test_schedule_uses_default_scope(self, mock_submit):
        """Test schedule() uses decorator's default scope"""
        mock_submit.return_value = MagicMock()

        @task(name="test_schedule_default_unique", scope=TaskScope.SHARED)
        def schedule_task_1(arg1: int) -> None:
            pass

        # Shared tasks require explicit task_key
        schedule_task_1.schedule(123, options=TaskOptions(task_key="test_key"))

        # Verify TaskManager.submit_task was called with correct scope
        mock_submit.assert_called_once()
        call_args = mock_submit.call_args
        assert call_args[1]["scope"] == TaskScope.SHARED

    @patch("superset.tasks.decorators.TaskManager.submit_task")
    def test_schedule_uses_private_scope_by_default(self, mock_submit):
        """Test schedule() uses PRIVATE scope when no scope specified"""
        mock_submit.return_value = MagicMock()

        @task(name="test_schedule_override_unique")
        def schedule_task_2(arg1: int) -> None:
            pass

        schedule_task_2.schedule(123)

        # Verify PRIVATE scope was used (default)
        mock_submit.assert_called_once()
        call_args = mock_submit.call_args
        assert call_args[1]["scope"] == TaskScope.PRIVATE

    @patch("superset.tasks.decorators.TaskManager.submit_task")
    def test_schedule_with_custom_options(self, mock_submit):
        """Test schedule() with custom task options"""
        mock_submit.return_value = MagicMock()

        @task(name="test_schedule_custom_unique", scope=TaskScope.SYSTEM)
        def schedule_task_3(arg1: int) -> None:
            pass

        # Use custom task key and name
        schedule_task_3.schedule(
            123,
            options=TaskOptions(task_key="custom_key", task_name="Custom Task Name"),
        )

        # Verify scope from decorator and options from call time
        mock_submit.assert_called_once()
        call_args = mock_submit.call_args
        assert call_args[1]["scope"] == TaskScope.SYSTEM
        assert call_args[1]["task_key"] == "custom_key"
        assert call_args[1]["task_name"] == "Custom Task Name"

    @patch("superset.tasks.decorators.TaskManager.submit_task")
    def test_schedule_with_no_decorator_options(self, mock_submit):
        """Test schedule() uses default PRIVATE scope when no options provided"""
        mock_submit.return_value = MagicMock()

        @task(name="test_schedule_no_options_unique")
        def schedule_task_4(arg1: int) -> None:
            pass

        schedule_task_4.schedule(123)

        # Verify default PRIVATE scope
        mock_submit.assert_called_once()
        call_args = mock_submit.call_args
        assert call_args[1]["scope"] == TaskScope.PRIVATE

    @patch("superset.tasks.decorators.TaskManager.submit_task")
    def test_schedule_shared_task_requires_task_key(self, mock_submit):
        """Test shared task schedule() requires explicit task_key"""

        @task(name="test_shared_requires_key", scope=TaskScope.SHARED)
        def shared_task(arg1: int) -> None:
            pass

        # Should raise ValueError when no task_key provided
        with pytest.raises(
            ValueError,
            match="Shared task.*requires an explicit task_key.*for deduplication",
        ):
            shared_task.schedule(123)

        # Should work with task_key provided
        mock_submit.return_value = MagicMock()
        shared_task.schedule(123, options=TaskOptions(task_key="valid_key"))
        mock_submit.assert_called_once()

    @patch("superset.tasks.decorators.TaskManager.submit_task")
    def test_schedule_private_task_allows_no_task_key(self, mock_submit):
        """Test private task schedule() works without task_key"""
        mock_submit.return_value = MagicMock()

        @task(name="test_private_no_key", scope=TaskScope.PRIVATE)
        def private_task(arg1: int) -> None:
            pass

        # Should work without task_key (generates random UUID)
        private_task.schedule(123)
        mock_submit.assert_called_once()


class TestTaskWrapperCall:
    """Tests for TaskWrapper.__call__() with scope"""

    def setup_method(self):
        """Clear task registry before each test"""
        TaskRegistry._tasks.clear()

    @patch("superset.commands.tasks.update.UpdateTaskCommand.run")
    @patch("superset.daos.tasks.TaskDAO.find_one_or_none")
    @patch("superset.commands.tasks.submit.SubmitTaskCommand.run_with_info")
    def test_call_uses_default_scope(
        self, mock_submit_run_with_info, mock_find, mock_update_run
    ):
        """Test direct call uses decorator's default scope"""
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.status = "in_progress"
        mock_submit_run_with_info.return_value = (mock_task, True)  # (task, is_new)
        mock_update_run.return_value = mock_task
        mock_find.return_value = mock_task  # Mock the subsequent find call

        @task(name="test_call_default_unique", scope=TaskScope.SHARED)
        def call_task_1(arg1: int) -> None:
            pass

        # Shared tasks require explicit task_key
        call_task_1(123, options=TaskOptions(task_key="test_key"))

        # Verify SubmitTaskCommand.run_with_info was called
        mock_submit_run_with_info.assert_called_once()

    @patch("superset.utils.core.get_user_id")
    @patch("superset.commands.tasks.update.UpdateTaskCommand.run")
    @patch("superset.daos.tasks.TaskDAO.find_one_or_none")
    @patch("superset.commands.tasks.submit.SubmitTaskCommand.run_with_info")
    def test_call_uses_private_scope_by_default(
        self, mock_submit_run_with_info, mock_find, mock_update_run, mock_get_user_id
    ):
        """Test direct call uses PRIVATE scope when no scope specified"""
        mock_get_user_id.return_value = 1
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.status = "in_progress"
        mock_submit_run_with_info.return_value = (mock_task, True)  # (task, is_new)
        mock_update_run.return_value = mock_task
        mock_find.return_value = mock_task  # Mock the subsequent find call

        @task(name="test_call_private_default_unique")
        def call_task_2(arg1: int) -> None:
            pass

        call_task_2(123)

        # Verify SubmitTaskCommand.run_with_info was called
        mock_submit_run_with_info.assert_called_once()

    @patch("superset.commands.tasks.update.UpdateTaskCommand.run")
    @patch("superset.daos.tasks.TaskDAO.find_one_or_none")
    @patch("superset.commands.tasks.submit.SubmitTaskCommand.run_with_info")
    def test_call_with_custom_options(
        self, mock_submit_run_with_info, mock_find, mock_update_run
    ):
        """Test direct call with custom task options"""
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.status = "in_progress"
        mock_submit_run_with_info.return_value = (mock_task, True)  # (task, is_new)
        mock_update_run.return_value = mock_task
        mock_find.return_value = mock_task  # Mock the subsequent find call

        @task(name="test_call_custom_unique", scope=TaskScope.SYSTEM)
        def call_task_3(arg1: int) -> None:
            pass

        # Use custom task key and name
        call_task_3(
            123,
            options=TaskOptions(task_key="custom_key", task_name="Custom Task Name"),
        )

        # Verify SubmitTaskCommand.run_with_info was called
        mock_submit_run_with_info.assert_called_once()

    def test_call_shared_task_requires_task_key(self):
        """Test shared task direct call requires explicit task_key"""

        @task(name="test_shared_call_requires_key", scope=TaskScope.SHARED)
        def shared_task(arg1: int) -> None:
            pass

        # Should raise ValueError when no task_key provided
        with pytest.raises(
            ValueError,
            match="Shared task.*requires an explicit task_key.*for deduplication",
        ):
            shared_task(123)

    @patch("superset.commands.tasks.update.UpdateTaskCommand.run")
    @patch("superset.daos.tasks.TaskDAO.find_one_or_none")
    @patch("superset.commands.tasks.submit.SubmitTaskCommand.run_with_info")
    def test_call_shared_task_works_with_task_key(
        self, mock_submit_run_with_info, mock_find, mock_update_run
    ):
        """Test shared task direct call works with task_key"""
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.status = "in_progress"
        mock_submit_run_with_info.return_value = (mock_task, True)  # (task, is_new)
        mock_update_run.return_value = mock_task
        mock_find.return_value = mock_task

        @task(name="test_shared_call_with_key", scope=TaskScope.SHARED)
        def shared_task(arg1: int) -> None:
            pass

        # Should work with task_key provided
        shared_task(123, options=TaskOptions(task_key="valid_key"))
        mock_submit_run_with_info.assert_called_once()

    @patch("superset.utils.core.get_user_id")
    @patch("superset.commands.tasks.update.UpdateTaskCommand.run")
    @patch("superset.daos.tasks.TaskDAO.find_one_or_none")
    @patch("superset.commands.tasks.submit.SubmitTaskCommand.run_with_info")
    def test_call_private_task_allows_no_task_key(
        self, mock_submit_run_with_info, mock_find, mock_update_run, mock_get_user_id
    ):
        """Test private task direct call works without task_key"""
        mock_get_user_id.return_value = 1
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.status = "in_progress"
        mock_submit_run_with_info.return_value = (mock_task, True)  # (task, is_new)
        mock_update_run.return_value = mock_task
        mock_find.return_value = mock_task

        @task(name="test_private_call_no_key", scope=TaskScope.PRIVATE)
        def private_task(arg1: int) -> None:
            pass

        # Should work without task_key (generates random UUID)
        private_task(123)
        mock_submit_run_with_info.assert_called_once()
