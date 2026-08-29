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

The Global Task Framework (GTF) provides a unified way to manage background tasks. It handles task execution, progress tracking, cancellation, and deduplication for both synchronous and asynchronous execution. The framework uses distributed locking internally to ensure race-free operations—you don't need to worry about concurrent task creation or cancellation conflicts.

## Enabling GTF

GTF is disabled by default and must be enabled via the `GLOBAL_TASK_FRAMEWORK` feature flag in your `superset_config.py`:

```python
FEATURE_FLAGS = {
    "GLOBAL_TASK_FRAMEWORK": True,
}
```

When GTF is disabled:

- The Task List UI menu item is hidden
- The `/api/v1/task/*` endpoints return 404
- Calling or scheduling a `@task`-decorated function raises `GlobalTaskFrameworkDisabledError`

:::note Future Migration
When GTF is considered stable, it will replace legacy Celery tasks for built-in features like thumbnails and alerts & reports. Enabling this flag prepares your deployment for that migration.
:::

## Quick Start

### Define a Task

```python
from superset_core.tasks.decorators import task, get_context

@task
def process_data(dataset_id: int) -> None:
    ctx = get_context()

    @ctx.on_cleanup
    def cleanup():
        logger.info("Processing complete")

    data = fetch_dataset(dataset_id)
    process_and_cache(data)
```

### Execute a Task

```python
# Async execution - schedules on Celery worker
task = process_data.schedule(dataset_id=123)
print(task.status)  # "pending"

# Sync execution - runs inline in current process
task = process_data(dataset_id=123)
# ... blocks until complete
print(task.status)  # "success"
```

### Async vs Sync Execution

| Method        | When to Use                                                                              |
| ------------- | ---------------------------------------------------------------------------------------- |
| `.schedule()` | Long-running operations, background processing, when you need to return immediately      |
| Direct call   | Short operations, when deduplication matters, when you need the result before responding |

Both execution modes provide the same task features: deduplication, progress tracking, cancellation, and visibility in the Task List UI. The difference is whether execution happens in a Celery worker (async) or inline (sync).

## Task Lifecycle

```
PENDING ──→ IN_PROGRESS ────→ SUCCESS
   │             │
   │             ├──────────→ FAILURE
   │             ↓                ↑
   │         ABORTING ────────────┘
   │             │
   │             ├──────────→ TIMED_OUT (timeout)
   │             │
   └─────────────┴──────────→ ABORTED (user cancel)
```

| Status        | Description                                          |
| ------------- | ---------------------------------------------------- |
| `PENDING`     | Queued, awaiting execution                           |
| `IN_PROGRESS` | Executing                                            |
| `ABORTING`    | Abort/timeout triggered, abort handlers running      |
| `SUCCESS`     | Completed successfully                               |
| `FAILURE`     | Failed with error, abort/cleanup handler exception, orphan reaping, or worker self-fence |
| `ABORTED`     | Cancelled by user/admin                              |
| `TIMED_OUT`   | Exceeded configured timeout                          |

## Context API

Access task context via `get_context()` from within any `@task` function. The context provides methods for updating task metadata and registering handlers.

### Updating Task Metadata

Use `update_task()` to report progress and store custom payload data:

```python
@task
def my_task(items: list[int]) -> None:
    ctx = get_context()

    for i, item in enumerate(items):
        result = process(item)
        ctx.update_task(
            progress=(i + 1, len(items)),
            payload={"last_result": result}
        )
```

:::tip
Call `update_task()` once per iteration for best performance. Frequent DB writes are throttled to limit metastore load, so batching progress and payload updates together in a single call ensures both are persisted at the same time.
:::

#### Progress Formats

The `progress` parameter accepts three formats:

| Format            | Example             | Display                |
| ----------------- | ------------------- | ---------------------- |
| `tuple[int, int]` | `progress=(3, 100)` | 3 of 100 (3%) with ETA |
| `float` (0.0-1.0) | `progress=0.5`      | 50% with ETA           |
| `int`             | `progress=42`       | 42 processed           |

:::tip
Use the tuple format `(current, total)` whenever possible. It provides the richest information to users: showing both the count and percentage, while still computing ETA automatically.
:::

#### Payload

The `payload` parameter stores custom metadata that can help users understand what the task is doing. Each call to `update_task()` replaces the previous payload completely.

In the Task List UI, when a payload is defined, an info icon appears in the **Details** column. Users can hover over it to see the JSON content.

#### Forcing an Immediate Write

By default `update_task()` throttles database writes (batching frequent updates to limit metastore load, at most one write per `TASK_PROGRESS_UPDATE_THROTTLE_INTERVAL` seconds, default 2). Pass `immediate=True` to bypass throttling and write synchronously:

```python
ctx.update_task(payload={"result_cache_key": key}, immediate=True)
```

Use this only when another consumer must observe the update as soon as the task finishes — for example, a dependent task that reads a prerequisite's payload the moment the dependency gate releases. For ordinary progress reporting, prefer the default throttled behavior.

#### Task state: public properties, private (debug-only), and results

A task's state lives in three tiers:

1. **Public `properties`** — named runtime state and execution config
   (`is_abortable`, `progress_*`, `dedupe_count`, `execution_mode`, `timeout`,
   `error_message`). Returned by the Task REST API and shown in the Task List UI.
2. **Private properties** — internal state that is surfaced to API consumers
   **only in debug mode** (otherwise the whole `private` key is stripped). It has
   two structurally isolated namespaces so a task type's freeform key can never
   collide with a framework key:
   - `private.framework` — framework-owned named keys: the Celery job id and the
     engine cancel handle the orphan reaper needs (`celery_task_id`,
     `cancel_query_id` lives under `task`, see below), plus error debug
     (`exception_type`, `stack_trace`). Written only by the framework via
     `task.update_framework_private({...})`.
   - `private.task` — freeform, task-type-specific internal handles (e.g. the
     engine `cancel_query_id`/`cancel_database_id`). Written by task/execution
     code via `task.update_task_private({...})`.
   Both namespaces merge independently (a write to one never clobbers the other).
3. **Results (`payload`)** — end-user-facing task output (intermediate/final):
   e.g. a `cache_key` or an engine tracking URL. Set via
   `ctx.update_task(payload=...)` and rendered in the Task List info bubble. In
   debug mode the bubble shows the `private` state in a separate section below.

Rule of thumb: user-facing status → top-level `properties`; user-facing output →
`payload`; framework plumbing → `private.framework`; task-specific internal
handles → `private.task`.


### Handlers

Register handlers to run cleanup logic or respond to abort requests:

| Handler      | When it runs                     | Use case                                  |
| ------------ | -------------------------------- | ----------------------------------------- |
| `on_cleanup` | Always (success, failure, abort) | Release resources, close connections      |
| `on_abort`   | When task is aborted             | Set stop flag, cancel external operations |

```python
@task
def my_task() -> None:
    ctx = get_context()

    @ctx.on_cleanup
    def cleanup():
        logger.info("Task ended, cleaning up")

    @ctx.on_abort
    def handle_abort():
        logger.info("Abort requested")

    # ... task logic
```

Multiple handlers of the same type execute in LIFO order (last registered runs first). Abort handlers run first when abort is detected, then cleanup handlers run when the task ends.

#### Best-Effort Execution

**All registered handlers will always be attempted, even if one fails.** This ensures that a failure in one handler doesn't prevent other handlers from running their cleanup logic.

For example, if you have three cleanup handlers and the second one throws an exception:

1. Handler 3 runs ✓
2. Handler 2 throws an exception ✗ (logged, but execution continues)
3. Handler 1 runs ✓

If any handler fails, the task is marked as `FAILURE` with combined error details showing all handler failures.

:::tip
Write handlers to be independent and self-contained. Don't assume previous handlers succeeded, and don't rely on shared state between handlers.
:::

## Making Tasks Abortable

When users click **Cancel** in the Task List, the system decides whether to **abort** (stop) the task or **unsubscribe** (remove the user from a shared task). Abort occurs when:

- It's a private or system task
- It's a shared task and the user is the last subscriber
- An admin checks **Force abort** to stop the task for all subscribers

Pending tasks can always be aborted: they simply won't start. In-progress tasks require an abort handler to be abortable:

```python
@task
def abortable_task(items: list[str]) -> None:
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
- The abort handler fires automatically when abort is triggered
- Use a flag pattern to gracefully stop processing at safe points
- Without an abort handler, in-progress tasks cannot be aborted: the Cancel button in the Task List UI will be disabled

The framework automatically skips execution if a task was aborted while pending: no manual check needed at task start.

:::tip
Always implement an abort handler for long-running tasks. This allows users to cancel unneeded tasks and free up worker capacity for other operations.
:::

## Timeouts

Set a timeout to automatically abort tasks that run too long:

```python
from superset_core.tasks.decorators import task, get_context
from superset_core.tasks.types import TaskOptions

# Set default timeout in decorator
@task(timeout=300)  # 5 minutes
def process_data(dataset_id: int) -> None:
    ctx = get_context()
    should_stop = False

    @ctx.on_abort
    def handle_abort():
        nonlocal should_stop
        should_stop = True

    for chunk in fetch_large_dataset(dataset_id):
        if should_stop:
            return
        process(chunk)

# Override timeout at call time
task = process_data.schedule(
    dataset_id=123,
    options=TaskOptions(timeout=600)  # Override to 10 minutes
)
```

### How Timeouts Work

The timeout timer starts when the task begins executing (status changes to `IN_PROGRESS`). When the timeout expires:

1. **With an abort handler registered:** The task transitions to `ABORTING`, abort handlers run, then cleanup handlers run. The final status depends on handler execution:
   - If handlers complete successfully → `TIMED_OUT` status
   - If handlers throw an exception → `FAILURE` status

2. **Without an abort handler:** The framework cannot forcibly terminate the task. A warning is logged, and the task continues running. The Task List UI shows a warning indicator (⚠️) in the Details column to alert users that the timeout cannot be enforced.

### Timeout Precedence

| Source                | Priority   | Example                            |
| --------------------- | ---------- | ---------------------------------- |
| `TaskOptions.timeout` | Highest    | `options=TaskOptions(timeout=600)` |
| `@task(timeout=...)`  | Default    | `@task(timeout=300)`               |
| Not set               | No timeout | Task runs indefinitely             |

Call-time options always override decorator defaults, allowing tasks to have sensible defaults while permitting callers to extend or shorten the timeout for specific use cases.

:::warning
Timeouts require an abort handler to be effective. Without one, the timeout triggers only a warning and the task continues running. Always implement an abort handler when using timeouts.
:::

## Deduplication

Use `task_key` to prevent duplicate task execution:

```python
from superset_core.tasks.types import TaskOptions

# Without key - creates new task each time (random UUID)
task1 = my_task.schedule(x=1)
task2 = my_task.schedule(x=1)  # Different task

# With key - joins existing task if active
task1 = my_task.schedule(x=1, options=TaskOptions(task_key="report_123"))
task2 = my_task.schedule(x=1, options=TaskOptions(task_key="report_123"))  # Returns same task
```

When a task with matching key already exists, the user is added as a subscriber and the existing task is returned. This behavior is consistent across all scopes—private tasks naturally have only one subscriber since their deduplication key includes the user ID.

Deduplication only applies to active tasks (pending/in-progress). Once a task completes, a new task with the same key can be created.

### Sync Join-and-Wait

When a sync call joins an existing task, it blocks until the task completes:

```python
# Schedule async task
task = my_task.schedule(options=TaskOptions(task_key="report_123"))

# Later sync call with same key blocks until completion of the active task
task2 = my_task(options=TaskOptions(task_key="report_123"))
assert task.uuid == task2.uuid  # True
print(task2.status)  # "success" (terminal status)
```

## Task Dependencies

Tasks can declare prerequisite tasks, forming a directed acyclic graph (DAG). Pass the prerequisite `Task` objects (returned by `.schedule()`) via `depends_on`:

```python
from superset_core.tasks.types import TaskOptions

totals = totals_task.schedule(options=TaskOptions(task_key="totals_123"))

# `dependent` only runs once `totals` has finished successfully.
dependent = dependent_task.schedule(
    options=TaskOptions(depends_on=[totals])
)
```

Passing the `Task` object is the canonical pattern. For convenience, a prerequisite's `UUID` (or UUID string) is also accepted where you don't hold the `Task` itself.

**Semantics (`all_success`).** A task runs only once **every** direct prerequisite has reached a terminal `SUCCESS`. If **any** prerequisite ends in a non-`SUCCESS` terminal state (`FAILURE`, `ABORTED`, or `TIMED_OUT`), the dependent does **not** run and is transitioned to `FAILURE`. This propagates transitively: because a failed dependent is itself non-`SUCCESS`, its own dependents fail in turn, so a failure anywhere short-circuits everything downstream.

**Scheduling model (block-and-wait).** All tasks in a DAG are enqueued immediately. Each dependent's worker blocks — holding its worker slot — until its prerequisites finish; while waiting, the task remains `PENDING` (shown as "waiting on N prerequisites" in the Task List). Tasks are enqueued in dependency order, so a dependent is rarely dequeued before its prerequisites.

:::warning Worker fleet sizing
Because dependents hold a worker slot while awaiting their prerequisites, a deep or wide DAG can occupy many workers simultaneously. Deployments that use chained tasks heavily must size their Celery worker fleet large enough to absorb the idle waiting, or a large DAG can exhaust the pool and deadlock.
:::

Cycles (including self-dependencies) are rejected at schedule time. Dependency edges are removed automatically when either endpoint task is pruned.

**Reading a prerequisite's output.** A dependent reads the payloads its prerequisites published via `ctx.get_dependency_payloads()`, which returns the prerequisites' payloads in dependency-edge order. Pair it with the prerequisite writing its result with `ctx.update_task(payload=..., immediate=True)` so the value is flushed (not held in the write-throttle buffer) by the time the dependency gate releases the dependent:

```python
@task
def totals_task() -> None:
    ctx = get_context()
    # immediate=True so the dependent observes this the moment the gate releases.
    ctx.update_task(payload={"result_cache_key": key}, immediate=True)

@task
def dependent_task() -> None:
    ctx = get_context()
    upstream = ctx.get_dependency_payloads()  # [{"result_cache_key": ...}, ...]
```

## Task Scopes

```python
from superset_core.tasks.decorators import task
from superset_core.tasks.types import TaskScope

@task  # Private by default
def private_task(): ...

@task(scope=TaskScope.SHARED)  # Multiple users can subscribe
def shared_task(): ...

@task(scope=TaskScope.SYSTEM)  # Admin-only visibility
def system_task(): ...
```

| Scope     | Visibility      | Cancel Behavior                             |
| --------- | --------------- | ------------------------------------------- |
| `PRIVATE` | Creator only    | Cancels immediately                         |
| `SHARED`  | All subscribers | Last subscriber cancels; others unsubscribe |
| `SYSTEM`  | Admins only     | Admin cancels                               |

## Task Cleanup

Completed tasks accumulate in the database over time. Configure a scheduled prune job to automatically remove old tasks:

```python
# In your superset_config.py, add to your Celery beat schedule:
CELERY_CONFIG.beat_schedule["prune_tasks"] = {
    "task": "prune_tasks",
    "schedule": crontab(minute=0, hour=0),  # Run daily at midnight
    "kwargs": {
        "retention_period_days": 90,   # Keep tasks for 90 days
        "max_rows_per_run": 10000,     # Limit deletions per run
    },
}
```

The prune job only removes tasks in terminal states (`SUCCESS`, `FAILURE`, `ABORTED`, `TIMED_OUT`). Active tasks (`PENDING`, `IN_PROGRESS`, `ABORTING`) are never pruned.

See `superset/config.py` for a complete example configuration.

### Orphan Reaping

A task whose worker dies mid-execution (OOM kill, crash, lost broker message) would otherwise stay `IN_PROGRESS` forever. To prevent this, a worker writes a liveness heartbeat while it holds a task, and a dedicated `reap_orphaned_tasks` beat job reaps orphans:

- **Heartbeat** — every `GTF_TASK_HEARTBEAT_INTERVAL` seconds (default 15) the executing worker refreshes `tasks.last_heartbeat`. This write is deliberately out-of-band and does not update `changed_on`.
- **Reaping** — `reap_orphaned_tasks` marks any active task whose heartbeat is older than `GTF_ORPHAN_TASK_TIMEOUT` (default 60) as `FAILURE` so waiters and dependents unblock, revokes its Celery job so a redelivered copy (with `task_acks_late`) will not run, and — on engines that support query cancellation, when the dead worker had captured a cancel handle — cancels the abandoned warehouse query out-of-band. A task still being worked on keeps a fresh heartbeat and is never reaped, so this never interferes with a live worker's cooperative abort/cleanup.
- **Self-fencing** — the reaper handles a *dead* worker, but a worker that is alive yet cut off from the metastore (network partition, metastore outage) would keep running a query the reaper has already marked `FAILURE`. To avoid that wasted work, if a worker's heartbeat writes keep failing for longer than `GTF_ORPHAN_TASK_TIMEOUT` — the same window the reaper uses — the worker fails the task from the inside, cancelling any in-flight query. A single failed write is tolerated; only a sustained outage spanning the orphan window fences, so a transient blip never kills a healthy task. There is no handover to another worker: the task simply fails.

Enable the `reap_orphaned_tasks` beat schedule on a short interval (e.g. every minute) so orphaned tasks — and their warehouse queries — do not linger; it is separate from `prune_tasks` (a heavier retention delete that runs infrequently). Keep `GTF_ORPHAN_TASK_TIMEOUT` comfortably larger than the heartbeat interval (≥ ~3×) so a brief pause or CPU-bound stretch is not mistaken for a dead worker.

```python
# In your superset_config.py, add to your Celery beat schedule:
CELERY_CONFIG.beat_schedule["reap_orphaned_tasks"] = {
    "task": "reap_orphaned_tasks",
    "schedule": crontab(minute="*", hour="*"),  # Run every minute
}
```

Unlike `prune_tasks`, the reaper takes no kwargs — it reads `GTF_ORPHAN_TASK_TIMEOUT` from config.

:::note Cancelling the underlying query
For long-running work backed by an external query, register an `on_abort` handler that cancels it (this is how async chart-data query tasks cancel the warehouse query on engines that support cancellation). Without such a handler an abort/timeout frees the task but cannot stop the external work.
:::

:::tip Distributed Coordination for Faster Notifications
By default, abort detection and sync join-and-wait poll the task row in the metadata database (every `TASK_ABORT_POLLING_DEFAULT_INTERVAL` seconds, default 10). Configure `DISTRIBUTED_COORDINATION_CONFIG` (Redis/Valkey) and these become event-driven: completion and abort are signalled over Redis **Streams**, so a waiter wakes when the signal lands instead of polling the database. Because stream entries are persisted, a waiter that reads slightly late, reconnects, or fails over still receives the signal. Each signal stream keeps only its latest entry and is given a TTL, so streams for tasks that are never awaited do not accumulate; set the retention window with `DISTRIBUTED_COORDINATION_SIGNAL_TTL` (default 24h). See [Distributed Coordination Backend](/admin-docs/configuration/cache#signal-cache-backend) for configuration details.
:::

## API Reference

### @task Decorator

```python
@task(
    name: str | None = None,
    scope: TaskScope = TaskScope.PRIVATE,
    timeout: int | None = None
)
```

- `name`: Task identifier (defaults to function name)
- `scope`: `PRIVATE`, `SHARED`, or `SYSTEM`
- `timeout`: Default timeout in seconds (can be overridden via `TaskOptions`)

### TaskContext Methods

| Method                           | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `update_task(progress, payload, immediate=False)` | Update progress and/or custom payload (`immediate=True` bypasses write throttling) |
| `get_dependency_payloads()`      | Return prerequisite tasks' payloads, in dependency-edge order |
| `on_cleanup(handler)`            | Register cleanup handler                      |
| `on_abort(handler)`              | Register abort handler (makes task abortable) |

### TaskOptions

```python
TaskOptions(
    task_key: str | None = None,
    task_name: str | None = None,
    timeout: int | None = None,
    depends_on: list[Task | UUID | str] | None = None
)
```

- `task_key`: Deduplication key (also used as display name if `task_name` is not set)
- `task_name`: Human-readable display name for the Task List UI
- `timeout`: Timeout in seconds (overrides decorator default)
- `depends_on`: Prerequisite tasks to wait for before running. Pass the scheduled `Task` objects (canonical); a `UUID` or UUID string is also accepted (see [Task Dependencies](#task-dependencies))

:::tip
Provide a descriptive `task_name` for better readability in the Task List UI. While `task_key` is used for deduplication and may be technical (e.g., `chart_export_123`), `task_name` can be user-friendly (e.g., `"Export Sales Chart 123"`).
:::

## Error Handling

Let exceptions propagate: the framework captures them automatically and sets task status to `FAILURE`:

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

In the Task List UI, failed tasks show error details when hovering over the status. When stack traces are enabled, a separate bug icon appears in the **Details** column for viewing the full traceback.

Cleanup handlers still run after an exception, so resources can be properly released as necessary.

:::tip
Use descriptive exception messages. In environments where stack traces are hidden (`SHOW_STACKTRACE=False`), users see only the error message and exception type when hovering over failed tasks. Clear messages help users troubleshoot issues without administrator assistance.
:::
