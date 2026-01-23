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

# Global Task Framework

The Global Task Framework (GTF) provides a unified way to manage background tasks in Apache Superset. It handles task execution, progress tracking, cancellation, and deduplication for both synchronous and asynchronous execution.

## Quick Start

### Define a Task

```python
from superset_core.api.types import task, get_context

@task
def process_data(dataset_id: int) -> None:
    ctx = get_context()

    @ctx.on_cleanup
    def cleanup():
        logger.info("Processing complete")

    data = fetch_dataset(dataset_id)
    process_and_cache(data)
```

### Execute Tasks

```python
# Async execution (production) - schedules on Celery
task = process_data.schedule(dataset_id=123)
print(task.status)  # "pending"

# Sync execution (testing/development) - runs inline
task = process_data(dataset_id=123)
print(task.status)  # "success"
```

## Task Lifecycle

```
PENDING ──→ IN_PROGRESS ──→ SUCCESS
   │             │  
   │             ↓  
   │         ABORTING ──→ ABORTED
   │             │
   └─────────────┴──────→ FAILURE
```

| Status | Description |
|--------|-------------|
| `PENDING` | Queued, awaiting execution |
| `IN_PROGRESS` | Executing |
| `ABORTING` | Abort requested, handlers running |
| `SUCCESS` | Completed successfully |
| `FAILURE` | Failed with error |
| `ABORTED` | Cancelled before completion |

## Context API

Access task context via `get_context()` from within any `@task` function:

```python
@task
def my_task(items: list[int]) -> None:
    ctx = get_context()

    for i, item in enumerate(items):
        result = process(item)

        # Update progress once per iteration (see format options below)
        ctx.update_task(
            progress=(i + 1, len(items)),
            payload={"last_result": result}
        )
```

**Tip:** Call `update_task()` once per iteration for best performance—it writes to the database.

### Progress Formats

| Format | Example | Display |
|--------|---------|---------|
| `float` (0.0-1.0) | `progress=0.5` | 50% |
| `int` | `progress=42` | 42 processed |
| `tuple[int, int]` | `progress=(3, 100)` | 3 of 100 (3%)" with ETA |

## Cancellation

### Making Tasks Cancellable

Pending tasks can always be cancelled. In-progress tasks require an abort handler to be cancellable:

```python
@task
def cancellable_task(items: list[str]) -> None:
    ctx = get_context()
    should_stop = False

    @ctx.on_abort
    def handle_abort():
        nonlocal should_stop
        should_stop = True
        logger.info("Abort signal received")

    @ctx.on_cleanup
    def cleanup():
        logger.info("Task ended, cleaning up")

    for item in items:
        if should_stop:
            return  # Exit gracefully
        process(item)
```

**Key points:**
- Registering `on_abort` marks the task as abortable and starts the abort listener
- The abort handler fires automatically when cancellation is requested
- Use a flag pattern to gracefully stop processing at safe points
- Without an abort handler, in-progress tasks cannot be cancelled

### Handler Types

| Handler | When it runs | Use case |
|---------|--------------|----------|
| `on_abort` | When cancellation is requested | Set stop flag, cancel external operations |
| `on_cleanup` | Always (success, failure, abort) | Release resources, close connections |

### Pre-execution Check

The framework automatically skips execution if a task was aborted while pending—no manual check needed at task start.

## Deduplication

Use `task_key` to prevent duplicate task execution. Behavior varies by scope:

```python
from superset_core.api.types import TaskOptions

# Without key - creates new task each time (random UUID)
task1 = my_task.schedule(x=1)
task2 = my_task.schedule(x=1)  # Different task

# With key - deduplication behavior depends on scope
task1 = my_task.schedule(x=1, options=TaskOptions(task_key="report_123"))
task2 = my_task.schedule(x=1, options=TaskOptions(task_key="report_123"))
```

| Scope | Duplicate Key Behavior |
|-------|----------------------|
| `PRIVATE` | Returns existing task (same user only) |
| `SHARED` | Subscribes user to existing task |
| `SYSTEM` | Returns existing task |

Deduplication only applies to active tasks (pending/in-progress). Once a task completes, a new task with the same key can be created.

## Task Scopes

```python
from superset_core.api.types import task, TaskScope

@task  # Private by default
def private_task(): ...

@task(scope=TaskScope.SHARED)  # Multiple users can subscribe
def shared_task(): ...

@task(scope=TaskScope.SYSTEM)  # Admin-only visibility
def system_task(): ...
```

| Scope | Visibility | Cancel Behavior |
|-------|------------|-----------------|
| `PRIVATE` | Creator only | Cancels immediately |
| `SHARED` | All subscribers | Last subscriber cancels; others unsubscribe |
| `SYSTEM` | Admins only | Admin cancels |

## Configuration

### Redis Abort Notifications (Optional)

By default, abort detection uses database polling. For faster response, configure Redis pub/sub:

```python
# superset_config.py
TASKS_BACKEND = {
    "CACHE_TYPE": "RedisCache",
    "CACHE_REDIS_HOST": "localhost",
    "CACHE_REDIS_PORT": 6379,
    "CACHE_REDIS_DB": 0,
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `TASKS_BACKEND` | None | Redis config for pub/sub |
| `TASKS_ABORT_CHANNEL_PREFIX` | `"gtf:abort:"` | Channel prefix |
| `TASK_ABORT_POLLING_DEFAULT_INTERVAL` | 10 | Polling interval (seconds, only needed when using database polling) |

## API Reference

### @task Decorator

```python
@task(name: str | None = None, scope: TaskScope = TaskScope.PRIVATE)
```

- `name`: Task identifier (defaults to function name)
- `scope`: `PRIVATE`, `SHARED`, or `SYSTEM`

### TaskContext Methods

| Method | Description |
|--------|-------------|
| `update_task(progress, payload)` | Update progress and/or custom payload |
| `is_aborted()` | Check if task should stop |
| `on_cleanup(handler)` | Register cleanup handler |
| `on_abort(handler)` | Register abort handler (makes task cancellable) |
| `run(callable)` | Execute if not aborted, returns None if aborted |

### TaskOptions

```python
TaskOptions(task_key: str | None = None, task_name: str | None = None)
```

- `task_key`: Deduplication key
- `task_name`: Human-readable display name

## Error Handling

Let exceptions propagate—the framework captures them automatically and sets task status to `FAILURE`:

```python
@task
def risky_task() -> None:
    # No try/catch needed - framework handles it
    result = operation_that_might_fail()
```

On failure, the framework records:
- `error_message`: Exception message
- `exception_type`: Exception class name
- `stack_trace`: Full traceback (visible when `SHOW_STACKTRACE=True`)

Cleanup handlers still run after an exception, so resources can be properly released as necessary.
