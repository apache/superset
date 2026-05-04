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
"""Ambient context management for the Global Task Framework (GTF)"""

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator

from superset.tasks.context import TaskContext

# Global context variable for ambient context pattern
# This is thread-safe and async-safe via Python's contextvars
_current_context: ContextVar[TaskContext | None] = ContextVar(
    "task_context", default=None
)


def get_context() -> TaskContext:
    """
    Get the current task context from contextvars.

    This function provides ambient access to the task context without
    requiring it to be passed as a parameter. It can only be called
    from within a task execution.

    :returns: The current TaskContext
    :raises RuntimeError: If called outside a task execution context

    Example:
        >>> @task()
        >>> def my_task(chart_id: int) -> None:
        >>>     ctx = get_context()  # Access ambient context
        >>>
        >>>     # Update progress and payload atomically
        >>>     ctx.update_task(
        >>>         progress=0.5,
        >>>         payload={"chart_id": chart_id}
        >>>     )
    """
    ctx = _current_context.get()
    if ctx is None:
        raise RuntimeError(
            "get_context() called outside task execution context. "
            "This function can only be called from within a @task "
            "decorated function."
        )
    return ctx


@contextmanager
def use_context(ctx: TaskContext) -> Iterator[None]:
    """
    Context manager to set ambient context for task execution.

    This is used internally by the framework to establish the ambient context
    before executing a task function. The context is automatically cleaned up
    after execution, even if the task raises an exception.

    :param ctx: TaskContext to set as the current context
    :yields: None

    Example (internal framework use):
        >>> ctx = TaskContext(task_uuid=task.uuid)
        >>> with use_context(ctx):
        >>>     # Task function can now call get_context()
        >>>     task_function(*args, **kwargs)
        >>> # Context automatically reset after execution
    """
    token = _current_context.set(ctx)
    try:
        yield
    finally:
        _current_context.reset(token)
