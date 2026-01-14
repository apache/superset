---
title: Task Framework
sidebar_label: Tasks
sidebar_position: 5
---


<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Global Task Framework (GTF)

The Global Task Framework provides a unified way to manage tasks in Apache Superset. It handles task registration, execution, status tracking, cancellation, and deduplication, and supports both synchronous and asynchronous execution.

## Overview

GTF uses the **ambient context pattern** where tasks access their execution context via `get_context()` instead of receiving it as a parameter. This results in clean, business-focused function signatures without framework boilerplate.

### Key Features

- **Clean Signatures**: Task functions contain only business args
- **Ambient Context**: Access context via `get_context()` - no parameter passing
- **Dual Execution**: Synchronous and asynchronous
- **Optional Deduplication**: Use idempotency keys to prevent duplicate execution
- **Progressive Updates**: Update payload and check cancellation during execution
- **Type Safety**: Full type hints with ParamSpec support

## Quick Start

### Define a Task

```python
import requests
from superset_core.api.types import task, get_context

@task
def fetch_data(api_url: str) -> None:
    """
    Example task that fetches data from an external API.

    Features:
    - Automatic abort check before execution
    - Simple cleanup handler
    - Abort checking during execution
    """
    ctx = get_context()

    # Cleanup runs automatically on success, failure, or cancellation
    @ctx.on_cleanup
    def cleanup():
        logger.info("Data fetch completed")

    # No initial check needed - framework checks before execution!
    # Fetch data with timeout (prevents hanging)
    response = requests.get(api_url, timeout=60)
    data = response.json()

    # Check before next operation
    if ctx.is_aborted():
        return

    # Process and cache the data
    process_and_cache(data)
```

### Execute Tasks Asynchronously or Synchronously

The `@task` decorator enables flexible execution modes:

```python
# Asynchronous execution via Celery for long running tasks
task = long_running_task.schedule()
# Task is scheduled to run in background worker, returns immediately
print(task.status)  # "pending"

# Synchronous execution
task = long_running_task()
# Task executes inline, blocks until complete
print(task.status)  # "success"
```

**When to use each mode:**
- **Async (`.schedule()`)**: Production workloads, long-running operations, non-blocking execution
- **Sync (direct call)**: Unit testing, development, or lightweight operations

## Core Concepts

### Ambient Context

Tasks access execution context via `get_context()`:

```python
@task
def my_task(business_arg: int) -> None:
    ctx = get_context()  # Ambient context access

    # Update progress and payload atomically
    ctx.update_task(
        progress=0.5,
        payload={"arg": business_arg}
    )
```

### Task Lifecycle

1. **PENDING**: Task created, awaiting execution
2. **IN_PROGRESS**: Currently executing
3. **SUCCESS**: Completed successfully  
4. **FAILURE**: Failed with error
5. **ABORTED**: Aborted before/during execution

### Deduplication

By default, each task gets a random UUID. Use `task_key` for explicit deduplication:

```python
# Without deduplication - creates new task each time
task1 = my_task.schedule(arg=1)
task2 = my_task.schedule(arg=1)  # Separate task

# With deduplication - returns existing if active
task1 = my_task.schedule(arg=1, options=TaskOptions(task_key="key"))
task2 = my_task.schedule(arg=1, options=TaskOptions(task_key="key"))
# task2 is the same as task1 if task1 is PENDING or IN_PROGRESS
```

## Abort Support

The framework provides built-in abort support with minimal boilerplate.

### Cleanup Handlers

Register cleanup functions that run automatically when a task ends (success, failure, or abort):

```python
@task
def my_task() -> None:
    ctx = get_context()

    @ctx.on_cleanup
    def cleanup():
        """Runs automatically when task ends"""
        logger.info("Task completed")
```

**Multiple cleanup handlers** (execute in LIFO order):

```python
@ctx.on_cleanup
def cleanup_cache():
    cache.clear()

@ctx.on_cleanup
def cleanup_log():
    logger.info("Done")
```

### Automatic Pre-Execution Check

**The framework automatically checks if a task was aborted before execution starts.** You don't need an initial `if ctx.is_aborted()` check - just start working!

### Checking During Execution

Check for abort at key points during execution:

```python
@task
def process_items(items: list[int]) -> None:
    ctx = get_context()

    @ctx.on_cleanup
    def cleanup():
        logger.info("Processing ended")

    # No initial check needed - framework handles it!

    for i, item in enumerate(items):
        # Check every 10 items
        if i % 10 == 0 and ctx.is_aborted():
            return

        process_single_item(item)
```

### Using Helper Methods

**`ctx.run()` - Pre-check wrapper (optional):**

```python
@task
def fetch_and_process(api_url: str) -> None:
    ctx = get_context()

    @ctx.on_cleanup
    def cleanup():
        logger.info("Fetch completed")

    # Helper checks abort before executing
    response = ctx.run(lambda: requests.get(api_url, timeout=60))
    if response is None:
        return  # Aborted

    data = ctx.run(lambda: response.json())
    if data is None:
        return

    cache.set("data", data)
```

**`ctx.update_task()` - Progress tracking:**

```python
@task
def process_batch(item_ids: list[int]) -> None:
    ctx = get_context()

    for i, item_id in enumerate(item_ids):
        # Update progress
        ctx.update_task(
            progress=(i + 1) / len(item_ids),
            payload={"current_item": item_id}
        )

        # Check abort separately if needed
        if ctx.is_aborted():
            return

        process_single_item(item_id)
```

## Advanced Usage

### Complete Example: API Fetch with Cleanup

```python
@task
def fetch_and_cache(api_url: str, chart_id: int) -> None:
    """Fetch from external API and cache results."""
    ctx = get_context()
    cache_key = f"chart_{chart_id}_data"

    @ctx.on_cleanup
    def cleanup():
        if ctx.is_aborted():
            # Clear partial cache on abort
            cache.delete(cache_key)
            logger.info(f"Fetch aborted, cleared cache: {cache_key}")
        else:
            logger.info(f"Fetch completed: {cache_key}")

    # Fetch with timeout (prevents hanging)
    response = requests.get(api_url, timeout=60)
    data = response.json()

    # Check before expensive processing
    if ctx.is_aborted():
        return

    processed = process_data(data)
    cache.set(cache_key, processed)
```

### Progressive Updates

Update progress and payload during execution:

```python
@task
def multi_step_task(item_ids: list[int]) -> None:
    ctx = get_context()

    @ctx.on_cleanup
    def cleanup():
        logger.info("Task processing completed")

    for i, item_id in enumerate(item_ids):
        # Update progress and payload atomically
        ctx.update_task(
            progress=(i + 1) / len(item_ids),
            payload={"current_item": item_id, "count": i + 1}
        )

        # Check abort
        if ctx.is_aborted():
            return

        process_item(item_id)
```

### Important: Use Timeouts

Abort checks happen at specific points - they cannot interrupt operations mid-execution. **Always use timeouts** to prevent operations from hanging:

**Good:**
```python
# Timeout prevents hanging if server is slow
response = requests.get(url, timeout=30)
```

**Bad:**
```python
# No timeout - could hang indefinitely
response = requests.get(url)
```

### How Abort Works

1. **Before execution:** Framework checks if task aborted → skips if true
2. **During execution:** Developer checks at key points → returns early if aborted
3. **Cannot interrupt:** Operations run to completion once started
4. **Cleanup handlers:** Run automatically regardless of how task ends

**Cancellation flow:**
```
User cancels → Task.status = ABORTED
                    ↓
Framework checks before execution → Skip if already aborted
                    ↓
Task executes → Checks at developer-defined points → Returns early if aborted
                    ↓
Cleanup handlers run automatically
```

## Best Practices

1. **Idempotency**: Design tasks to be safely retryable
2. **Check Abort**: Before expensive operations
3. **Update Progress**: For long-running tasks
4. **Descriptive Names**: Use globally unique task names
5. **Test Sync First**: Direct calls are easier to debug

## API Reference

### Decorator

```python
@task(name: str | None = None, scope: TaskScope = TaskScope.PRIVATE)
```

Registers a function as an async task.

Can be used with or without parentheses:

```python
# No parentheses (uses default name and private scope)
@task
def my_function(): ...

# With parentheses (explicit configuration)
@task(name="custom_name", scope=TaskScope.SHARED)
def my_function(): ...
```

**Parameters:**
- `name`: Optional task name (defaults to function name)
- `scope`: Task scope (TaskScope.PRIVATE, SHARED, or SYSTEM). Defaults to TaskScope.PRIVATE.

**Returns:** Wrapped function with `.schedule()` method

**Examples:**

```python
from superset_core.api.types import task, TaskScope, get_context

# Private task (default) - no parentheses
@task
def generate_thumbnail(chart_id: int) -> None:
    ctx = get_context()
    # ... implementation

# Named shared task (multi-user subscription)
@task(name="generate_report", scope=TaskScope.SHARED)
def generate_expensive_report(report_id: int) -> None:
    ctx = get_context()
    # ... implementation

# System task (admin-only)
@task(scope=TaskScope.SYSTEM)
def cleanup_old_data() -> None:
    ctx = get_context()
    # ... implementation
```

### Context Access

```python
get_context() -> TaskContext
```

Gets the current task execution context.

**Returns:** TaskContext with `task` and `user` properties

**Raises:** RuntimeError if called outside task execution

### Task Options

```python
TaskOptions(task_key: str | None = None, task_name: str | None = None)
```

Execution metadata for tasks.

**Note:** The `scope` field has been removed from TaskOptions. Scope is now specified in the `@task` decorator itself.

**Parameters:**
- `task_key`: Optional key for deduplication
- `task_name`: Optional human-readable task name

**Examples:**

```python
from superset_core.api.types import TaskOptions

# Custom deduplication key
task = my_task.schedule(
    chart_id=123,
    options=TaskOptions(task_key="chart_thumb_123")
)

# Custom task name for better identification
task = my_task.schedule(
    report_id=456,
    options=TaskOptions(
        task_key="report_456",
        task_name="Monthly Sales Report Generation"
    )
)
```

### Task Context

```python
class TaskContext:
    def update_task(
        self,
        progress: float | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        """
        Update task progress and/or payload atomically.

        All parameters are optional. Payload is merged with existing data.
        Updates occur in a single database transaction.
        """

    def is_aborted(self) -> bool:
        """Check if task is aborted"""

    def on_cleanup(self, handler: Callable[[], None]) -> Callable[[], None]:
        """Register cleanup handler (runs on task end)"""

    def run(self, operation: Callable[[], T]) -> T | None:
        """Execute operation if not aborted (optional helper)"""
```

**Note:** The task object is no longer directly exposed. Tasks should use `update_task()` to modify state, as tasks are the source of state, not consumers of it.

## Architecture

### Components

- **TaskRegistry**: Global registry of task functions
- **TaskManager**: Creates and schedules tasks
- **TaskContext**: Provides task/user access
- **TaskWrapper**: Adds `.schedule()` to decorated functions
- **Celery Executor**: Generic executor for all task types

### Dependency Injection

Public APIs in `superset-core` are injected with concrete implementations from `superset` at import time. Extension developers import from `superset_core.api.types` for compatibility.

## Troubleshooting

### "get_context() called outside task execution context"

Only call `get_context()` from within `@task` decorated functions.

### Task Not Executing

1. Check Celery workers: `celery -A superset.tasks.celery_app:app worker`
2. Verify registration: Check logs for "Registered task"
3. Check database: `SELECT * FROM tasks WHERE uuid = '...'`

### Duplicate Tasks Despite Task Key

Deduplication only prevents duplicates while task is PENDING or IN_PROGRESS. Once complete, new tasks with same key can be created.
