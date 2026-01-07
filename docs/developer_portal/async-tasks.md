---
title: Async Task Framework
sidebar_label: Async Tasks
sidebar_position: 5
---

# Global Async Task Framework (GATF)

The Global Async Task Framework provides a unified way to manage asynchronous tasks in Apache Superset. It handles task registration, execution, status tracking, cancellation, and deduplication.

## Overview

GATF uses the **ambient context pattern** where tasks access their execution context via `get_context()` instead of receiving it as a parameter. This results in clean, business-focused function signatures without framework boilerplate.

### Key Features

- **Clean Signatures**: Task functions contain only business args
- **Ambient Context**: Access context via `get_context()` - no parameter passing
- **Dual Execution**: Synchronous (for testing) and asynchronous (via Celery)
- **Optional Deduplication**: Use idempotency keys to prevent duplicate execution
- **Progressive Updates**: Update payload and check cancellation during execution
- **Type Safety**: Full type hints with ParamSpec support

## Quick Start

### Define a Task

```python
from superset_core.api.types import async_task, get_context, TaskOptions

@async_task(name="generate_thumbnail")  # name is optional
def generate_chart_thumbnail(chart_id: int, force: bool = False) -> None:
    """Generate chart thumbnail asynchronously."""
    ctx = get_context()  # Access ambient context

    # Update task payload
    task = ctx.task

    # Check for cancellation
    if ctx.task.is_cancelled:
        return

    task.set_payload({"chart_id": chart_id, "started": True})
    ctx.update_task(task)

    # Your business logic
    thumbnail_url = generate_thumbnail_for_chart(chart_id)

    # Update with results
    task = ctx.task
    task.set_payload({"thumbnail_url": thumbnail_url})
    ctx.update_task(task)
```

### Schedule Tasks

```python
# Auto-generated task ID (no deduplication)
task = generate_chart_thumbnail.schedule(chart_id=123)

# Custom idempotency key for deduplication
task = generate_chart_thumbnail.schedule(
    123,
    force=True,
    options=TaskOptions(idempotency_key=f"thumbnail_chart_123")
)
```

### Test Synchronously

```python
# Direct call executes synchronously (perfect for testing)
task = generate_chart_thumbnail(chart_id=123)
assert task.is_finished
assert task.status == "success"
```

## Core Concepts

### Ambient Context

Tasks access execution context via `get_context()`:

```python
@async_task()
def my_task(business_arg: int) -> None:
    ctx = get_context()  # Ambient context access
    task = ctx.task      # Task entity
    user = ctx.user      # User who dispatched task

    task.set_payload({"arg": business_arg})
    ctx.update_task(task)
```

### Task Lifecycle

1. **PENDING**: Task created, awaiting execution
2. **IN_PROGRESS**: Currently executing
3. **SUCCESS**: Completed successfully  
4. **FAILURE**: Failed with error
5. **CANCELLED**: Cancelled before/during execution

### Deduplication

By default, each task gets a random UUID. Use `idempotency_key` for explicit deduplication:

```python
# Without deduplication - creates new task each time
task1 = my_task.schedule(arg=1)
task2 = my_task.schedule(arg=1)  # Separate task

# With deduplication - returns existing if active
task1 = my_task.schedule(arg=1, options=TaskOptions(idempotency_key="key"))
task2 = my_task.schedule(arg=1, options=TaskOptions(idempotency_key="key"))
# task2 is the same as task1 if task1 is PENDING or IN_PROGRESS
```

## Advanced Usage

### Cancellation Support

```python
@async_task()
def long_running_task(num_items: int) -> None:
    ctx = get_context()

    for i in range(num_items):
        if ctx.task.is_cancelled:
            return
        process_item(i)
```

### Progressive Updates

```python
@async_task()
def multi_step_task(item_ids: list[int]) -> None:
    ctx = get_context()

    for i, item_id in enumerate(item_ids):
        task = ctx.task
        task.set_payload({
            "progress": f"{i+1}/{len(item_ids)}",
            "current_item": item_id
        })
        ctx.update_task(task)

        process_item(item_id)
```

## Testing

### Unit Tests

```python
def test_my_task():
    # Synchronous execution
    task = my_task(arg=123)

    assert task.is_successful
    assert task.get_payload()["result"] == expected_value
```

### Integration Tests

```python
def test_my_task_async():
    # Async execution
    task = my_task.schedule(arg=123)
    assert task.status == "pending"

    # Poll for completion
    # ...
```

## Best Practices

1. **Idempotency**: Design tasks to be safely retryable
2. **Check Cancellation**: Before expensive operations
3. **Update Progress**: For long-running tasks
4. **Descriptive Names**: Use globally unique task names
5. **Test Sync First**: Direct calls are easier to debug

## API Reference

### Decorator

```python
@async_task(name: str | None = None)
```

Registers a function as an async task.

**Parameters:**
- `name`: Optional task name (defaults to function name)

**Returns:** Wrapped function with `.schedule()` method

### Context Access

```python
get_context() -> TaskContext
```

Gets the current task execution context.

**Returns:** TaskContext with `task` and `user` properties

**Raises:** RuntimeError if called outside task execution

### Task Options

```python
TaskOptions(idempotency_key: str | None = None)
```

Execution metadata for tasks.

**Parameters:**
- `idempotency_key`: Optional key for deduplication

### Task Context

```python
class TaskContext:
    @property
    def task(self) -> AsyncTask:
        """Latest task entity from metastore"""

    @property  
    def user(self) -> User:
        """User who dispatched the task"""

    def update_task(self, task: AsyncTask) -> None:
        """Update task in metastore"""
```

## Architecture

### Components

- **TaskRegistry**: Global registry of task functions
- **TaskManager**: Creates and schedules tasks
- **TaskContext**: Provides task/user access
- **AsyncTaskWrapper**: Adds `.schedule()` to decorated functions
- **Celery Executor**: Generic executor for all task types

### Dependency Injection

Public APIs in `superset-core` are injected with concrete implementations from `superset` at import time. Extension developers import from `superset_core.api.types` for compatibility.

## Troubleshooting

### "get_context() called outside task execution context"

Only call `get_context()` from within `@async_task` decorated functions.

### Task Not Executing

1. Check Celery workers: `celery -A superset.tasks.celery_app:app worker`
2. Verify registration: Check logs for "Registered async task"
3. Check database: `SELECT * FROM async_tasks WHERE uuid = '...'`

### Duplicate Tasks Despite Idempotency Key

Deduplication only prevents duplicates while task is PENDING or IN_PROGRESS. Once complete, new tasks with same key can be created.
