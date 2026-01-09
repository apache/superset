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
Global Async Task Framework (GATF) package.

This package provides a unified framework for managing asynchronous tasks in Superset,
including SQL queries, thumbnail generation, reports, and other background operations.

Public API:
    - async_task: Decorator for defining async tasks
    - get_context: Get the current task context (ambient pattern)
    - TaskOptions: Execution metadata for tasks
    - TaskStatus: Task status enum

Example:
    from superset.async_tasks import async_task, get_context, TaskOptions

    @async_task(name="generate_thumbnail")
    def generate_chart_thumbnail(chart_id: int) -> None:
        ctx = get_context()  # Access ambient context
        task = ctx.task
        task.set_payload({"chart_id": chart_id})
        ctx.update_task(task)
        # ... thumbnail generation logic ...

    # Schedule task with automatic deduplication
    task = generate_chart_thumbnail.schedule(
        123,
        options=TaskOptions(task_key=f"thumbnail_chart_123")
    )
"""

# Re-export from superset-core (simple types with no dependencies)
from superset_core.api.async_tasks import TaskOptions, TaskStatus

# Re-export concrete implementations
from superset.async_tasks.ambient_context import get_context
from superset.async_tasks.decorators import async_task

# Note: Dependency injection for async tasks is handled in
# superset/core/api/core_api_injection.py via inject_async_task_implementations()
# The concrete implementations (TaskContext, TaskManager, TaskRegistry, etc.)
# are automatically available via the injection system.

__all__ = [
    "async_task",
    "get_context",
    "TaskOptions",
    "TaskStatus",
]
