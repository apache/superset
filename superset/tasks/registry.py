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
"""Task registry for the Global Task Framework (GTF)"""

import logging
from typing import Any, Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from superset.tasks.subscription import TaskSubscriptionPolicy

logger = logging.getLogger(__name__)


class TaskRegistry:
    """
    Registry for task functions.

    Stores task functions by name, allowing the Celery executor to look up
    and execute registered tasks. This enables the decorator pattern where
    functions are registered at module import time.

    A task type may also register a :class:`TaskSubscriptionPolicy`, which the
    submit/cancel commands look up by ``task_type`` to refine per-client
    subscription semantics (see ``superset.tasks.subscription``).
    """

    _tasks: dict[str, Callable[..., Any]] = {}
    # Optional per-task-type subscription policies, keyed by the same task name
    # as ``_tasks``. Absent for task types that use plain principal-grain
    # subscriptions.
    _subscription_policies: dict[str, "TaskSubscriptionPolicy"] = {}

    @classmethod
    def register(
        cls,
        task_name: str,
        func: Callable[..., Any],
        subscription_policy: "TaskSubscriptionPolicy | None" = None,
    ) -> None:
        """
        Register a task function by name.

        :param task_name: Unique task identifier (e.g., "superset.generate_thumbnail")
        :param func: The task function to register
        :param subscription_policy: Optional per-client subscription policy for
            this task type (see ``superset.tasks.subscription``)
        :raises ValueError: If task name is already registered
        """
        if task_name in cls._tasks:
            existing_func = cls._tasks[task_name]
            if existing_func is not func:
                raise ValueError(
                    f"Task '{task_name}' is already registered with a different "
                    "function. "
                    f"Existing: {existing_func.__module__}.{existing_func.__name__}, "
                    f"New: {func.__module__}.{func.__name__}"
                )
            # Same function being registered again (e.g., module reload) - allow it
            logger.debug("Task '%s' re-registered with same function", task_name)
            return

        cls._tasks[task_name] = func
        if subscription_policy is not None:
            cls._subscription_policies[task_name] = subscription_policy
        logger.info(
            "Registered async task: %s -> %s.%s",
            task_name,
            func.__module__,
            func.__name__,
        )

    @classmethod
    def get_executor(cls, task_name: str) -> Callable[..., Any]:
        """
        Get the executor function for a task.

        :param task_name: Task identifier to look up
        :returns: The registered task function
        :raises KeyError: If task name is not registered
        """
        if task_name not in cls._tasks:
            raise KeyError(
                f"Task '{task_name}' is not registered. "
                f"Available tasks: {', '.join(sorted(cls._tasks.keys()))}"
            )
        return cls._tasks[task_name]

    @classmethod
    def is_registered(cls, task_name: str) -> bool:
        """
        Check if a task is registered.

        :param task_name: Task identifier to check
        :returns: True if task is registered
        """
        return task_name in cls._tasks

    @classmethod
    def get_subscription_policy(cls, task_name: str) -> "TaskSubscriptionPolicy | None":
        """
        Get the subscription policy for a task type, if one was registered.

        :param task_name: Task identifier to look up
        :returns: The registered policy, or ``None`` for plain principal-grain
            subscriptions
        """
        return cls._subscription_policies.get(task_name)

    @classmethod
    def list_tasks(cls) -> list[str]:
        """
        Get list of all registered task names.

        :returns: Sorted list of task names
        """
        return sorted(cls._tasks.keys())

    @classmethod
    def clear(cls) -> None:
        """
        Clear all registered tasks.

        WARNING: This is primarily for testing purposes. In production,
        tasks should remain registered for the lifetime of the process.
        """
        cls._tasks.clear()
        cls._subscription_policies.clear()
        logger.warning("Task registry cleared")
