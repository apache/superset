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

"""
Async Task Framework for superset-core.

This module provides decorators and utilities for creating and managing
asynchronous tasks that can be executed in the background by various backends.

Usage:
    from superset_core.async_tasks import async_task

    @async_task(max_retries=3)
    def my_task(param1: str, param2: int) -> dict:
        # Task implementation
        return {"result": "success"}

    # Execute task asynchronously
    task = my_task.delay("hello", 42)

    # Get task result when ready
    result = task.get()
"""

import hashlib
import json  # noqa: TID251
import logging
from functools import wraps
from typing import Any, Callable, TypeVar
from uuid import UUID

from superset_core.api.async_tasks import TaskStatus

# Type variable for decorated functions
F = TypeVar("F", bound=Callable[..., Any])

logger = logging.getLogger(__name__)

# Global task manager instance - will be injected by host
_task_manager = None


def set_task_manager(manager: Any) -> None:
    """Set the global task manager instance (called by host during initialization)."""
    global _task_manager
    _task_manager = manager


class AsyncTaskResult:
    """
    Result proxy for async tasks that provides access to task status and results.
    """

    def __init__(self, task_uuid: UUID, task_name: str):
        self.task_uuid = task_uuid
        self.task_name = task_name

    def get(self, timeout: float | None = None) -> Any:
        """
        Get the task result, blocking until completion.

        Args:
            timeout: Maximum time to wait in seconds

        Returns:
            The task result

        Raises:
            TimeoutError: If timeout is exceeded
            Exception: If task failed
        """
        if not _task_manager:
            raise RuntimeError("Task manager not initialized")
        return _task_manager.get_result(self.task_uuid, timeout)

    def ready(self) -> bool:
        """Check if the task has completed."""
        if not _task_manager:
            return False
        return _task_manager.is_ready(self.task_uuid)

    def successful(self) -> bool:
        """Check if the task completed successfully."""
        if not _task_manager:
            return False
        return _task_manager.is_successful(self.task_uuid)

    def failed(self) -> bool:
        """Check if the task failed."""
        if not _task_manager:
            return False
        return _task_manager.is_failed(self.task_uuid)

    @property
    def status(self) -> TaskStatus:
        """Get current task status."""
        if not _task_manager:
            return TaskStatus.PENDING
        return _task_manager.get_status(self.task_uuid)


class AsyncTaskWrapper:
    """
    Wrapper for functions decorated with @async_task.
    """

    def __init__(
        self,
        func: Callable[..., Any],
        task_name: str,
        max_retries: int = 3,
        enable_deduplication: bool = True,
    ):
        self.func = func
        self.task_name = task_name
        self.max_retries = max_retries
        self.enable_deduplication = enable_deduplication

        # Copy function metadata
        wraps(func)(self)

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        """Execute task synchronously (for testing or direct calls)."""
        return self.func(*args, **kwargs)

    def delay(self, *args: Any, **kwargs: Any) -> AsyncTaskResult:
        """
        Execute task asynchronously.

        Args:
            *args: Positional arguments for the task
            **kwargs: Keyword arguments for the task

        Returns:
            AsyncTaskResult instance for tracking task progress
        """
        if not _task_manager:
            raise RuntimeError("Task manager not initialized")

        # Prepare task parameters
        parameters = {
            "args": args,
            "kwargs": kwargs,
        }

        # Generate task signature for deduplication
        task_signature = None
        if self.enable_deduplication:
            task_signature = self._generate_signature(parameters)

        # Submit task to manager
        task_uuid = _task_manager.submit_task(
            task_name=self.task_name,
            parameters=parameters,
            max_retries=self.max_retries,
            task_signature=task_signature,
        )

        return AsyncTaskResult(task_uuid, self.task_name)

    def _generate_signature(self, parameters: dict[str, Any]) -> str:
        """
        Generate a deterministic signature for task deduplication.

        Args:
            parameters: Task parameters

        Returns:
            SHA256 hash of task name and parameters
        """
        # Create deterministic representation
        signature_data = {
            "task_name": self.task_name,
            "parameters": parameters,
        }

        # Sort keys to ensure deterministic JSON
        json_str = json.dumps(signature_data, sort_keys=True, separators=(",", ":"))

        # Generate SHA256 hash
        return hashlib.sha256(json_str.encode("utf-8")).hexdigest()


def async_task(
    task_name: str | None | Callable[..., Any] = None,
    max_retries: int = 3,
    enable_deduplication: bool = True,
) -> Callable[[F], AsyncTaskWrapper] | AsyncTaskWrapper:
    """
    Decorator to mark a function as an async task.

    Usage:
        @async_task
        def my_task(): ...  # Uses function name as task name

        @async_task()
        def my_task(): ...  # Uses function name as task name

        @async_task("custom_name")
        def my_task(): ...  # Uses custom task name

        @async_task(max_retries=5)
        def my_task(): ...  # Uses function name with custom options

    Args:
        task_name: Custom task name (defaults to module.function_name)
        max_retries: Maximum number of retry attempts on failure
        enable_deduplication: Whether to deduplicate identical tasks

    Returns:
        Decorated function with async task capabilities

    Example:
        @async_task(max_retries=5)
        def process_data(data_id: int) -> dict:
            # Long-running task
            return {"processed": data_id}

        # Execute asynchronously
        result = process_data.delay(123)
    """

    def decorator(func: F) -> AsyncTaskWrapper:
        # Determine task name
        actual_task_name = task_name if isinstance(task_name, str) else None
        if not actual_task_name:
            module_name = getattr(func, "__module__", "unknown")
            function_name = getattr(func, "__name__", "unknown")
            actual_task_name = f"{module_name}.{function_name}"

        # Create wrapper
        wrapper = AsyncTaskWrapper(
            func=func,
            task_name=actual_task_name,
            max_retries=max_retries,
            enable_deduplication=enable_deduplication,
        )

        return wrapper

    # Support both @async_task and @async_task() syntax
    if callable(task_name):
        # Called as @async_task (without parentheses)
        func = task_name
        task_name = None
        return decorator(func)

    return decorator


__all__ = [
    "async_task",
    "AsyncTaskResult",
    "AsyncTaskWrapper",
    "set_task_manager",
]
