---
title: Tasks
sidebar_position: 10
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

    # Update progress (percentage) and payload atomically
    ctx.update_task(
        progress=0.5,  # 50%
        payload={"arg": business_arg}
    )
```

### Task Lifecycle

1. **PENDING**: Task created, awaiting execution (always abortable)
2. **IN_PROGRESS**: Currently executing
   - `is_abortable=false` initially
   - `is_abortable=true` after first `on_abort` handler is registered
3. **ABORTING**: Abort requested, handlers running (only for in-progress abortable tasks)
4. **SUCCESS**: Completed successfully
5. **FAILURE**: Failed with error (including abort handler failures)
6. **ABORTED**: Aborted before/during execution

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

**Note:** Shared tasks (`scope=TaskScope.SHARED`) require an explicit `task_key` to enable proper deduplication across users.

## Abort Support

The framework provides built-in abort support with minimal boilerplate.

### Abortability Rules

- **Pending tasks**: Always abortable - they simply don't start if aborted before execution
- **In-progress tasks**: Only abortable if they have registered an `on_abort` handler
  - When a task starts executing, `is_abortable` is set to `false`
  - When the first `on_abort` handler is registered, `is_abortable` becomes `true`
  - Attempting to abort an in-progress task without an abort handler raises an error
- **Aborting tasks**: Already in the process of being aborted
- **Finished tasks**: Cannot be aborted (success, failure, or already aborted)

### UI Action Permissions

The Task List UI shows a unified **Cancel** action. The behavior adapts based on task scope, user role, subscriber count, and task status. Actions are only available for **active tasks** (pending or in_progress status).

| Task Scope | User Role | Cancel Behavior |
|------------|-----------|-----------------|
| **Private** | Owner | Cancels (aborts) the task |
| **Private** | Admin (not owner) | Cancels (aborts) the task |
| **Shared** | Subscriber (only subscriber) | Cancels (aborts) the task |
| **Shared** | Subscriber (multiple subscribers) | Removes you from task (task continues for others) |
| **Shared** | Admin (with Force Cancel) | Cancels (aborts) for all subscribers |
| **System** | Admin | Cancels (aborts) the task |
| **System** | Non-admin | *(not visible)* |

**Key behaviors:**
- **Unified Cancel button** - A single "Cancel" action replaces the old separate Abort/Unsubscribe buttons
- **Smart behavior** - The backend automatically determines whether to abort or unsubscribe based on context
- **Confirmation dialog** - Shows contextual messaging explaining what will happen:
  - For single/last subscriber: "This will cancel the task."
  - For shared tasks with multiple subscribers: "You'll be removed from this task. It will continue running for N other subscriber(s)."
- **Force Cancel (admin only)** - For shared tasks with multiple subscribers, admins see a checkbox to "Cancel for all subscribers" which forces immediate abort
- **For private tasks**, only the owner can see and cancel the task (admins can also cancel)
- **For system tasks**, only admins can see and cancel the task

### Abort Flow

When an abort is requested for an in-progress abortable task:

1. Task status changes from `IN_PROGRESS` → `ABORTING`
2. Background polling detects the status change
3. Registered abort handlers execute in LIFO order
4. If all handlers succeed, task transitions to `ABORTED` when execution finishes
5. If any handler fails, task transitions to `FAILURE` instead

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

### Abort Handlers

Register handlers that execute automatically when a task is aborted:

```python
@task
def process_large_batch(items: list[str]) -> None:
    """Process items with abort handling."""
    ctx = get_context()

    # Flag to signal early termination
    aborted = False

    # Handler fires automatically when abort is detected
    @ctx.on_abort
    def handle_abort():
        nonlocal aborted
        aborted = True
        logger.warning("Task aborted, will stop at next iteration")

    # Process items one by one
    results = []
    for i, item in enumerate(items):
        # Check abort flag at start of each iteration
        if aborted:
            raise RuntimeError("Task was aborted")

        # Process the item
        result = process_item(item)
        results.append(result)

        # Update progress using count and total (auto-computes percentage)
        ctx.update_task(
            progress=(i + 1, len(items)),  # e.g., (3, 100) = "3 of 100 (3%)"
            payload={"processed": i + 1, "results": results}
        )

        # Simulate work
        time.sleep(1)
```

**Abort Handlers vs Cleanup Handlers:**

| Feature | `on_cleanup` | `on_abort` |
|---------|-------------|-----------|
| **When runs** | Success, failure, OR abort | Only on abort |
| **Use case** | Always-run cleanup | Abort-specific cleanup |

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

Progress can be reported in three different ways depending on what information is available:

```python
@task
def process_batch(item_ids: list[int]) -> None:
    ctx = get_context()

    for i, item_id in enumerate(item_ids):
        # Option 1: Percentage only (float 0.0-1.0)
        # Displays as "In Progress: 50%"
        ctx.update_task(progress=0.5)

        # Option 2: Count only (int) - when total is unknown
        # Displays as "In Progress: 42 processed"
        ctx.update_task(progress=42)

        # Option 3: Count and total (tuple) - percentage auto-computed
        # Displays as:
        #   In Progress: 3 of 100 (3%)
        #   ETA: 52s
        ctx.update_task(
            progress=(i + 1, len(item_ids)),
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
        # Update progress using count and total (percentage auto-computed)
        # Displays as "In progress: 3 of 100 (3 %)"
        ctx.update_task(
            progress=(i + 1, len(item_ids)),
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

1. **Before execution:** Framework checks if task aborted/aborting → skips if true
2. **During execution:** Developer checks at key points → returns early if aborted
3. **Cannot interrupt:** Operations run to completion once started
4. **Cleanup handlers:** Run automatically regardless of how task ends
5. **Abort handlers:** Run when abort is detected, before cleanup

**Abort flow for pending tasks:**
```
User aborts → Task.status = ABORTED (immediate)
                    ↓
Framework checks before execution → Skip execution
                    ↓
Task never starts
```

**Abort flow for in-progress abortable tasks:**
```
User aborts → Task.status = ABORTING
                    ↓
Abort notification sent
                    ↓
Abort handlers execute (LIFO order)
                    ↓
Task continues until developer-defined check points
                    ↓
Task returns early when is_aborted() returns true
                    ↓
Cleanup handlers run → Task.status = ABORTED
```

**Abort handler failure flow:**
```
Abort handler throws exception
                    ↓
Task.status = FAILURE (not ABORTED)
                    ↓
Error message set to handler exception
                    ↓
Remaining abort handlers skipped
                    ↓
Cleanup handlers still run
```

### Event-Based Abort (Optional)

By default, GTF uses database polling to detect abort requests. For faster abort detection, you can enable Redis pub/sub notifications.

#### Configuration

Configure `TASKS_BACKEND` in `superset_config.py`:

**Standard Redis:**
```python
TASKS_BACKEND = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_HOST": "localhost",
    "CACHE_REDIS_PORT": 6379,
    "CACHE_REDIS_DB": 0,
    "CACHE_REDIS_PASSWORD": None,
}
```

**Redis Sentinel (High Availability):**
```python
TASKS_BACKEND = {
    "CACHE_TYPE": "RedisSentinelCache",
    "CACHE_REDIS_SENTINELS": [
        ("sentinel1.example.com", 26379),
        ("sentinel2.example.com", 26379),
        ("sentinel3.example.com", 26379),
    ],
    "CACHE_REDIS_SENTINEL_MASTER": "mymaster",
    "CACHE_REDIS_SENTINEL_PASSWORD": None,
    "CACHE_REDIS_PASSWORD": None,
    "CACHE_REDIS_DB": 0,
}
```

**Redis with SSL:**
```python
TASKS_BACKEND = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_HOST": "redis.example.com",
    "CACHE_REDIS_PORT": 6380,
    "CACHE_REDIS_SSL": True,
    "CACHE_REDIS_SSL_CERTFILE": "/path/to/cert.pem",
    "CACHE_REDIS_SSL_KEYFILE": "/path/to/key.pem",
    "CACHE_REDIS_SSL_CA_CERTS": "/path/to/ca.pem",
}
```

#### How It Works

When `TASKS_BACKEND` is configured:

1. **Abort Request:** When a task abort is requested, the framework publishes a message to a per-task Redis channel (`gtf:abort:{task_uuid}`)
2. **Listener:** Tasks with abort handlers subscribe to their channel and receive abort notifications instantly
3. **Fallback:** If Redis becomes unavailable, the framework automatically falls back to database polling

The channel prefix can be customized via `TASKS_ABORT_CHANNEL_PREFIX` (default: `"gtf:abort:"`).

#### Benefits

| Aspect | Polling (Default) | Pub/Sub (Redis) |
|--------|------------------|-----------------|
| **Latency** | Up to polling interval (default 10s) | Instant (~milliseconds) |
| **Database Load** | Periodic queries | No additional queries |
| **Infrastructure** | None | Requires Redis |
| **Reliability** | Always works | Falls back to polling on failure |

#### Task Code

No changes to task code are required. The framework automatically uses pub/sub when available:

```python
@task
def my_task() -> None:
    ctx = get_context()

    @ctx.on_abort
    def handle_abort():
        # This handler fires instantly with pub/sub enabled
        logger.info("Abort received!")

    # ... task logic
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
- `task_key`: Key for deduplication (optional for private tasks, required for shared tasks)
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
        progress: float | int | tuple[int, int] | None = None,
        payload: dict[str, Any] | None = None,
    ) -> None:
        """
        Update task progress and/or payload atomically.

        Progress can be specified in three ways:
        - float (0.0-1.0): Percentage only, e.g., 0.5 means 50%
          Displays as "In Progress: 50%"
        - int: Count only (total unknown), e.g., 42 means "42 items processed"
          Displays as "In Progress: 42 processed"
        - tuple[int, int]: Count and total, e.g., (3, 100) means "3 of 100"
          The percentage is automatically computed from count/total.
          Displays as "In Progress: 3 of 100 (3%)" with ETA on a separate line

        All parameters are optional. Payload is merged with existing data.
        Updates occur in a single database transaction.
        """

    def is_aborted(self) -> bool:
        """Check if task is aborted"""

    def on_cleanup(self, handler: Callable[[], None]) -> Callable[[], None]:
        """Register cleanup handler (runs on task end)"""

    def on_abort(self, handler: Callable[[], None]) -> Callable[[], None]:
        """Register abort handler (runs when abort detected)"""

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

## Error Handling

When a task raises an exception, the framework automatically captures detailed error information for debugging.

### Captured Error Information

| Field | Type | Description |
|-------|------|-------------|
| `error_message` | string | The exception message (`str(exception)`) |
| `exception_type` | string | The exception class name (e.g., `"ValueError"`, `"ZeroDivisionError"`) |
| `stack_trace` | string | Full formatted traceback (visibility controlled by config) |

### Automatic Error Capture

When a task raises an exception, the framework automatically:

1. Sets the task status to `FAILURE`
2. Captures the error message, exception type, and full stack trace
3. Runs any registered cleanup handlers

```python
@task
def my_task() -> None:
    ctx = get_context()

    @ctx.on_cleanup
    def cleanup():
        # This still runs even if the task fails
        logger.info("Cleaning up...")

    # If this raises, the error is automatically captured
    result = some_operation_that_might_fail()
```

### Stack Trace Visibility

The `stack_trace` field is **always stored** in the database but only exposed in API responses when `SHOW_STACKTRACE=True` is set in your Superset configuration.

| Environment | `SHOW_STACKTRACE` | Stack Trace in API |
|-------------|-------------------|-------------------|
| Development | `True` (default) | ✅ Visible |
| Production | `False` (recommended) | ❌ Hidden |

This allows:
- **Development**: Full stack traces visible for debugging
- **Production**: Stack traces hidden from end users but still accessible to operators via direct database access

### Example API Response

When `SHOW_STACKTRACE=True`:

```json
{
  "status": "failure",
  "error_message": "division by zero",
  "exception_type": "ZeroDivisionError",
  "stack_trace": "Traceback (most recent call last):\n  File \"/app/superset/tasks/scheduler.py\", line 108, in execute_task\n    executor_fn(*args, **kwargs)\n  File \"/app/my_task.py\", line 42, in my_task\n    result = 1 / 0\nZeroDivisionError: division by zero\n"
}
```

When `SHOW_STACKTRACE=False`:

```json
{
  "status": "failure",
  "error_message": "division by zero",
  "exception_type": "ZeroDivisionError",
  "stack_trace": null
}
```

### Best Practice: Let Exceptions Propagate

Tasks should raise exceptions for errors rather than trying to handle them manually. This ensures:

- Consistent error capture across all tasks
- Proper task status transitions
- Cleanup handlers still run

**Good:**
```python
@task
def my_task() -> None:
    # Let the framework handle the error
    result = risky_operation()
    process(result)
```

**Avoid:**
```python
@task
def my_task() -> None:
    try:
        result = risky_operation()
        process(result)
    except Exception as e:
        # Don't swallow exceptions - the framework won't know the task failed
        logger.error(f"Failed: {e}")
        return  # Task status will be SUCCESS, not FAILURE!
```

If you need custom error handling logic, re-raise the exception after your handling:

```python
@task
def my_task() -> None:
    try:
        result = risky_operation()
    except SpecificError as e:
        # Do custom cleanup
        cleanup_partial_work()
        # Re-raise so framework captures the error
        raise
```
