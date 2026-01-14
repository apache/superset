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
        assert my_task.default_options.scope == TaskScope.PRIVATE

    def test_decorator_with_default_scope_private(self):
        """Test decorator with explicit PRIVATE scope"""

        @task(name="private_task", options=TaskOptions(scope=TaskScope.PRIVATE))
        def my_private_task(arg1: int) -> None:
            pass

        assert my_private_task.default_options.scope == TaskScope.PRIVATE

    def test_decorator_with_default_scope_shared(self):
        """Test decorator with SHARED scope"""

        @task(name="shared_task", options=TaskOptions(scope=TaskScope.SHARED))
        def my_shared_task(arg1: int) -> None:
            pass

        assert my_shared_task.default_options.scope == TaskScope.SHARED

    def test_decorator_with_default_scope_system(self):
        """Test decorator with SYSTEM scope"""

        @task(name="system_task", options=TaskOptions(scope=TaskScope.SYSTEM))
        def my_system_task() -> None:
            pass

        assert my_system_task.default_options.scope == TaskScope.SYSTEM

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

        @task(
            name="test_merge_no_override",
            options=TaskOptions(
                task_key="default_key",
                task_name="Default Name",
                scope=TaskScope.SHARED,
            ),
        )
        def my_task() -> None:
            pass

        merged = my_task._merge_options(None)
        assert merged.task_key == "default_key"
        assert merged.task_name == "Default Name"
        assert merged.scope == TaskScope.SHARED

    def test_merge_options_override_task_key(self):
        """Test overriding task_key at call time"""

        @task(
            name="test_merge_override_key",
            options=TaskOptions(task_key="default_key", scope=TaskScope.PRIVATE),
        )
        def my_task() -> None:
            pass

        override = TaskOptions(task_key="override_key")
        merged = my_task._merge_options(override)
        assert merged.task_key == "override_key"
        assert merged.scope == TaskScope.PRIVATE  # Default preserved

    def test_merge_options_override_scope(self):
        """Test overriding scope at call time"""

        @task(
            name="test_merge_override_scope",
            options=TaskOptions(scope=TaskScope.PRIVATE),
        )
        def my_task() -> None:
            pass

        override = TaskOptions(scope=TaskScope.SHARED)
        merged = my_task._merge_options(override)
        assert merged.scope == TaskScope.SHARED

    def test_merge_options_override_all(self):
        """Test overriding all options at call time"""

        @task(
            name="test_merge_override_all",
            options=TaskOptions(
                task_key="default_key",
                task_name="Default Name",
                scope=TaskScope.PRIVATE,
            ),
        )
        def my_task() -> None:
            pass

        override = TaskOptions(
            task_key="override_key",
            task_name="Override Name",
            scope=TaskScope.SHARED,
        )
        merged = my_task._merge_options(override)
        assert merged.task_key == "override_key"
        assert merged.task_name == "Override Name"
        assert merged.scope == TaskScope.SHARED


class TestTaskWrapperSchedule:
    """Tests for TaskWrapper.schedule() with scope"""

    def setup_method(self):
        """Clear task registry before each test"""
        TaskRegistry._tasks.clear()

    @patch("superset.tasks.decorators.TaskManager.submit_task")
    def test_schedule_uses_default_scope(self, mock_submit):
        """Test schedule() uses decorator's default scope"""
        mock_submit.return_value = MagicMock()

        @task(name="test_schedule_default", options=TaskOptions(scope=TaskScope.SHARED))
        def my_task(arg1: int) -> None:
            pass

        my_task.schedule(123)

        # Verify TaskManager.submit_task was called with correct scope
        mock_submit.assert_called_once()
        call_args = mock_submit.call_args
        assert call_args[1]["scope"] == TaskScope.SHARED

    @patch("superset.tasks.decorators.TaskManager.submit_task")
    def test_schedule_overrides_scope(self, mock_submit):
        """Test schedule() can override decorator's default scope"""
        mock_submit.return_value = MagicMock()

        @task(
            name="test_schedule_override", options=TaskOptions(scope=TaskScope.PRIVATE)
        )
        def my_task(arg1: int) -> None:
            pass

        # Override scope at call time
        my_task.schedule(123, options=TaskOptions(scope=TaskScope.SYSTEM))

        # Verify overridden scope was used
        mock_submit.assert_called_once()
        call_args = mock_submit.call_args
        assert call_args[1]["scope"] == TaskScope.SYSTEM

    @patch("superset.tasks.decorators.TaskManager.submit_task")
    def test_schedule_with_no_decorator_options(self, mock_submit):
        """Test schedule() uses default PRIVATE scope when no options provided"""
        mock_submit.return_value = MagicMock()

        @task(name="test_schedule_no_options")
        def my_task(arg1: int) -> None:
            pass

        my_task.schedule(123)

        # Verify default PRIVATE scope
        mock_submit.assert_called_once()
        call_args = mock_submit.call_args
        assert call_args[1]["scope"] == TaskScope.PRIVATE


class TestTaskWrapperCall:
    """Tests for TaskWrapper.__call__() with scope"""

    def setup_method(self):
        """Clear task registry before each test"""
        TaskRegistry._tasks.clear()

    @patch("superset.extensions.db")
    @patch("superset.tasks.decorators.TaskDAO.find_one_or_none")
    @patch("superset.tasks.decorators.TaskDAO.create_task")
    def test_call_uses_default_scope(self, mock_create_task, mock_find, mock_db):
        """Test direct call uses decorator's default scope"""
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.status = "in_progress"
        mock_create_task.return_value = mock_task
        mock_find.return_value = mock_task  # Mock the subsequent find call

        @task(name="test_call_default", options=TaskOptions(scope=TaskScope.SHARED))
        def my_task(arg1: int) -> None:
            pass

        my_task(123)

        # Verify create_task was called with correct scope
        mock_create_task.assert_called_once()
        call_args = mock_create_task.call_args
        assert call_args[1]["scope"] == TaskScope.SHARED.value

    @patch("superset.extensions.db")
    @patch("superset.tasks.decorators.TaskDAO.find_one_or_none")
    @patch("superset.tasks.decorators.TaskDAO.create_task")
    def test_call_overrides_scope(self, mock_create_task, mock_find, mock_db):
        """Test direct call can override decorator's default scope"""
        mock_task = MagicMock()
        mock_task.uuid = "test-uuid"
        mock_task.status = "in_progress"
        mock_create_task.return_value = mock_task
        mock_find.return_value = mock_task  # Mock the subsequent find call

        @task(name="test_call_override", options=TaskOptions(scope=TaskScope.PRIVATE))
        def my_task(arg1: int) -> None:
            pass

        # Override scope at call time
        my_task(123, options=TaskOptions(scope=TaskScope.SYSTEM))

        # Verify overridden scope was used
        mock_create_task.assert_called_once()
        call_args = mock_create_task.call_args
        assert call_args[1]["scope"] == TaskScope.SYSTEM.value
