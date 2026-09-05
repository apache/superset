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

# SQL execution on the Global Task Framework

**Status:** design / in-progress epic (umbrella branch `villebro/sqllab-gtf`).

This is the follow-up epic to the Global Async Queries → GTF migration
([#43407](https://github.com/apache/superset/pull/43407)), whose summary noted
that *"SQL Lab async query execution … remains on its existing path and is
intentionally deferred to a later migration."* This is that migration — and it
goes further, converging SQL Lab **and** the unified SQL execution API
([#36529](https://github.com/apache/superset/pull/36529)) onto a single
execution primitive and a single async orchestrator (GTF).

## Why

Before this epic Superset has **three** SQL execution stacks:

1. **Legacy SQL Lab** — the `sql_lab.get_sql_results` Celery task
   (`superset/sql_lab.py`) with **frozen** 6h Celery time limits, a
   main-thread-only `SIGALRM` sync timeout, DB-row-polling cancellation (the web
   worker writes `Query.status=STOPPED`; the running worker notices between
   statement blocks), no heartbeat/orphan reaping, and a 2s
   `/query/updated_since` frontend poll.
2. **The unified SQL execution API** (`Database.execute()` / `execute_async()`
   over `superset/sql/execution/`) — intended as the single "run SQL against a
   Database" contract, but used in production only by the MCP `execute_sql` tool
   (sync only). Its `execute_async()` half is a **third**, GTF-agnostic Celery
   stack (`AsyncQueryHandle`, `superset/sql/execution/celery_task.py`) with no
   production caller.
3. **GTF** — the shared `@task` / `.schedule()` framework that chart-data
   already runs on after #43407.

This epic collapses (1) and (2)'s async half into (3), leaving one synchronous
execution primitive and one async orchestrator.

## Architecture

Three layers, one hard invariant.

```
Layer 1 — SYNC EXECUTION FEATURE (a library, NOT a task)
  superset/sql/execution/  →  SQLExecutor / Database.execute()
    prepare:   Jinja, parse, catalog+schema resolve, RLS, limit,
               CTAS/CVAS rewrite, LimitingFactor
    security:  disallowed functions/tables, DML gate
    run:       build_statement_blocks + execute_sql_with_cursor
               (shared cursor, per-statement mutation, progress, commit,
                engine-cancel seam via notify_cursor)
    results:   records (MCP) | Arrow→results_backend + results_key +
               expand_data (SQL Lab)

Layer 2 — GTF TASK BODIES (async orchestration; each a SINGLE task)
  execute_sql_query   (PRIVATE, task_key=Query.client_id)  → Database.execute()
  execute_chart_query (SHARED)                             → get_df → Layer 1

Layer 3 — ENTRY POINTS (HTTP handlers; the ONLY schedulers)
  Database.execute_async()  →  execute_sql_query.schedule()
  SQL Lab POST /execute/    →  sync: Database.execute() | async: execute_async()
```

**Invariant:** code already running inside a GTF task calls the Layer-1
synchronous feature directly (`Database.execute()` / `get_df`); it never calls
`execute_async()`. Only a non-task HTTP handler schedules a task. This keeps
chart-data at one task per `QueryObject` and SQL Lab at one task per query — no
task ever spawns a nested task just to run its SQL.

The `Query` ORM row stays the SQL-Lab-facing source of truth; the GTF task
mirrors its terminal status into `Query.status` so the existing
`/query/updated_since` poll keeps working while the frontend adopts the GTF
`task.status` realtime push (reusing the transport chart-data uses), with
polling as the correctness backstop.

## PR-by-PR breakdown (child PRs into `villebro/sqllab-gtf`)

The epic is delivered as a stack of focused child PRs, each merged into this
umbrella branch and squashed:

1. **Execution feature foundation** — extend the `superset-core` query options
   contract; share `apply_ctas`/`apply_limit` into the execution feature; add
   the `notify_cursor` engine-cancel seam to the shared statement loop; add
   `caller_owns_timeout` and `existing_query_id` hooks to `SQLExecutor`.
2. **SQL-Lab-complete executor** — CTAS/CVAS, `LimitingFactor`, `expand_data`,
   and the Arrow→results-backend result mode in `Database.execute()`.
3. **GTF SQL task** — `execute_sql_query` (PRIVATE) + subscription policy +
   cancellation; repoint `Database.execute_async()` to schedule it; retire the
   `AsyncQueryHandle` Celery stack.
4. **SQL Lab onto the unified API** — `/execute/` and the stop/poll path drive
   `Database.execute()` / `execute_async()`; retire `sql_lab.get_sql_results`
   and the sync/async `SqlJsonExecutor`s.
5. **Frontend realtime** — SQL Lab subscribes to `task.status` (reusing
   `realtime.ts`/`asyncEvent.ts`), with the poll as backstop; progress bridging.
6. **Chart-data convergence (decoupled)** — reimplement `Database.get_df` on the
   Layer-1 core so chart-data and SQL Lab share one warehouse path.

## Shipped so far (merged into `villebro/sqllab-gtf`)

_None yet — see the open child PRs._
