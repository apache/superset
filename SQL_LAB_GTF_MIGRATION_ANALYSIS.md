# Migrating SQL Lab query execution onto the Global Task Framework (GTF)

**Status:** analysis / design exploration (no code changes).
**Scope assumption (given):** during a transition period the `Query` ORM entity
**remains its own table and the SQL Lab UI keeps keying off it** (`client_id`,
`status`, `results_key`, `progress`, CTAS fields). Only the **execution,
cancellation, timeout, heartbeat/reaping, and status/notification plumbing** move
onto GTF. The `Query` row stays the SQL-Lab-facing source of truth; a GTF `Task`
becomes the execution/cancellation vehicle that drives it.

This document maps the current SQL Lab machinery, the GTF target surface (using
the merged chart-data migration as the worked precedent), what maps cleanly, what
the real gaps are, and a phased plan.

---

## 1. TL;DR / recommendation

- **One GTF `Task` per `Query`** (not per SQL statement). A SQL Lab `Query`
  already means "N statements executed sequentially over one shared
  connection/cursor" with CTAS/commit semantics, so the statement loop stays
  *inside* the task body; GTF only needs to own the task, not understand SQL.
- **Scope = `PRIVATE`**, `task_key = Query.client_id`. SQL Lab runs arbitrary
  user SQL (incl. CTAS side effects), so cross-user `SHARED` dedup — the thing
  chart-data uses — is **not** applicable. GTF's PRIVATE dedup neatly subsumes
  the existing per-user idempotency guard (`is_query_handled`).
- **Biggest win: cancellation + timeouts.** Replace SQL Lab's bespoke,
  per-engine cooperative-stop (DB `Query.status` polling between blocks +
  per-engine `handle_cursor` poll loops + out-of-band session kill + three
  disjoint timeout mechanisms) with GTF's single `on_abort` signal +
  `@task(timeout=…)` + orphan reaper. The warehouse-query-kill seam GTF needs
  **already exists and is proven** for chart-data (`superset/tasks/query_cancel.py`).
- **Keep the results backend.** GTF's `payload` is for small metadata; SQL Lab's
  large Arrow/msgpack result blobs stay in `RESULTS_BACKEND`, and the task body
  keeps writing `Query.results_key`. GTF does not replace it.
- **Frontend can stay on polling initially.** Because the task body keeps
  updating the `Query` row, the existing `/api/v1/query/updated_since` @2s poll
  keeps working unchanged. GTF's per-tab websocket `task-status` push is an
  optional later layer.
- **This "newer stack" is the `superset-core` unified SQL execution API
  (PR #36529)** — `Database.execute()`/`execute_async()` over
  `superset/sql/execution/` (`SQLExecutor`, `QueryResult`/`StatementResult`,
  `AsyncQueryHandle`). It is the natural long-term **execution primitive** for
  both chart-data and SQL Lab, but its **async half is a third, GTF-agnostic
  orchestration** that must be re-hosted on GTF first. **Sequencing conclusion:
  converge async onto GTF before adopting this API for GAQ/SQL Lab; the sync
  primitive is the eventual convergence target once its gaps close. Treat this
  as a follow-up epic, not part of `gaq-to-gtf`.** Full analysis + migration
  order in **§13–§14**.

---

## 2. Current SQL Lab architecture (what moves)

### 2.1 Execution call chain (classic stack — the UI path)

```
POST /api/v1/sqllab/execute/                 superset/sqllab/api.py:545
  → SqlJsonExecutionContext(request.json)    (parse; is_run_asynchronous())
  → ExecuteSqlCommand.run()                  superset/commands/sql_lab/execute.py:94
      → idempotency: is_query_handled → QUERY_ALREADY_CREATED   execute.py:134
      → create Query row + COMMIT            sqllab_execution_context.py:188
      → validate access → render Jinja → re-validate rendered SQL → set limit
      → Sync|Async executor.execute(...)     superset/sqllab/sql_json_executer.py
          - Sync : run inline under utils.timeout(SQLLAB_TIMEOUT) (SIGALRM)  :122
          - Async: get_sql_results.delay(...) ; task.forget()               :173
  → 200 (HAS_RESULTS) | 202 (QUERY_IS_RUNNING)                api.py:594-600

Celery: @celery_app.task("sql_lab.get_sql_results", soft=21600, hard=21660)  sql_lab.py:181
  → execute_sql_statements(...)              sql_lab.py:397
      Query→RUNNING(+start_running_time)     :422
      SQLScript(...).statements ; build_statement_blocks ; CTAS/CVAS ; apply_limit
      open ONE connection+cursor ; capture cancel id → extra[QUERY_CANCEL_KEY]  :511
      for block in blocks:                   :517
          refresh Query; if STOPPED: return  :518   ← cooperative stop (between blocks)
          execute_query() (execute_with_cursor + handle_cursor + fetch_data)
      serialize (Arrow/msgpack|JSON) → zlib → results_backend.set(key)  :581-648
      Query→SUCCESS(+rows,progress=100,results_key,end_time)            :568-682
```

### 2.2 `Query` status lifecycle (source of truth today)

`PENDING` → `RUNNING` (`sql_lab.py:423`) → one of `SUCCESS`
(`:568-682`) / `FAILED` (`handle_query_error :105`) / `TIMED_OUT`
(`SoftTimeLimitExceeded :316`) / `STOPPED` (checked per block `:520`, set by the
*web* worker handling `/stop` in `QueryDAO.stop_query :84`).

### 2.3 Cancellation (today)

- Client `postStopQuery` → `POST /api/v1/query/stop {client_id}` → `QueryRestApi.stop_query`
  (`superset/queries/api.py:250`) → `QueryDAO.stop_query` (`superset/daos/query.py:62`):
  owner-scoped lookup, calls `sql_lab.cancel_query(query)` (`sql_lab.py:725`), then
  sets `Query.status=STOPPED`.
- `cancel_query` opens a **fresh** connection and calls
  `db_engine_spec.cancel_query(cursor, query, cancel_id)` using
  `extra[QUERY_CANCEL_KEY]` — killing the backend session.
- The running worker learns to stop by **(a)** re-reading `Query.status` between
  blocks (`sql_lab.py:518`) and inside per-engine `handle_cursor` poll loops
  (Presto `presto.py:1416`, Trino `trino.py:357`, Impala), or **(b)** its
  backend session being killed → its `cursor.execute/fetch` raises → the handler
  refreshes status and reinterprets it as `SqlLabQueryStoppedException`
  (`sql_lab.py:337`).
- **No abort signal, no abort callback, no cross-worker message** — pure DB-row
  polling + out-of-band session kill.

### 2.4 Timeouts (today — three disjoint mechanisms)

| Path | Mechanism | Note |
|---|---|---|
| Sync | `utils.timeout(SQLLAB_TIMEOUT=30s)` = `signal.SIGALRM` | **main-thread only** (`core.py:799`) |
| Async | Celery `soft_time_limit=21600`, `time_limit=21660` | **hard-coded literals** (`sql_lab.py:183`), *not* read from `SQLLAB_ASYNC_TIME_LIMIT_SEC` |
| Estimate | `utils.timeout(SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT)` | separate endpoint |

`SQLLAB_HARD_TIMEOUT` is a **dead reference** — only in a comment (`sql_lab.py:180`),
never a config value.

### 2.5 Frontend lifecycle (today)

- `runQuery` (`SqlLab/actions/sqlLab.ts:517`) POSTs execute; sync → `querySuccess`
  inline; async → nothing (relies on poll).
- `QueryAutoRefresh` (`components/QueryAutoRefresh/index.tsx`) polls
  **`GET /api/v1/query/updated_since?q={last_updated_ms}`** every **2s**
  (`QUERY_UPDATE_FREQ=2000`), while any query runs and is younger than 6h.
- On `state==success` + new `resultsKey`, `ResultSet` fetches
  **`GET /api/v1/sqllab/results/?q={key,rows}`**.
- Stop: `POST /api/v1/query/stop {client_id}`.
- **No websockets anywhere in SQL Lab.** Query tracked by `client_id` (nanoid,
  browser side) ↔ `Query.client_id` (unique).

### 2.6 SQL-Lab-specific plumbing (must be preserved by whoever runs the query)

`select_as_cta`, `select_as_cta_used`, `ctas_method`, `tmp_table_name`,
`tmp_schema_name`, `select_sql` (CTAS SELECT-back), `results_key`, `progress`,
`limiting_factor`, `tracking_url`, `sql_editor_id`, `tab_name`, `client_id`,
multi-statement/one-shared-cursor, DML/RLS gating, `apply_limit`/`apply_ctas`.
None of this is generic; it stays in the task body.

---

## 3. GTF target surface (what a task type gets for free)

From the chart-data precedent (`superset/tasks/async_queries.py`) and the
framework (`superset/tasks/*`, `superset-core/src/superset_core/tasks/*`):

- **Authoring:** a module-level `@task(name=…, scope=…, timeout=…,
  subscription_policy=…)` function taking only business args; state via ambient
  `get_context()`. `.schedule()` = async (Celery), `__call__` = sync inline
  (blocks, drives full lifecycle). `TaskManager.submit_task` enqueues only when
  `is_new` (dedup joiners never re-run).
- **Dedup + locking:** `SubmitTaskCommand` holds `task_lock(dedup_key)` across
  create-or-join+commit, with a unique-constraint backstop. `dedupe_count`
  tracked.
- **Cancellation:** `ctx.on_abort(handler)` woken by a coordination-service
  signal (Redis Streams) with DB-poll fallback; unified
  abort/unsubscribe/detach in `CancelTaskCommand`; `@task(timeout=…)` →
  ABORTING → `on_abort` → ABORTED; worker **self-fence** on lost metastore
  contact.
- **Warehouse-query kill (already built):** `superset/tasks/query_cancel.py`
  (`capture_cancel_id`/`notify_cursor`/`capture_cancel_query_id`/
  `cancel_chart_query`) + the seam in `Database._execute_sql_with_mutation_and_logging`
  (`core.py:933`). `ctx.set_cancellation(db_id, cancel_id)` persists the handle
  in `private["task"]` so the **orphan reaper** can kill a dead worker's query
  out-of-band (`reap.py:_cancel_orphaned_query`).
- **Heartbeat + reaping:** worker liveness heartbeat (`task_heartbeat`), orphan
  reaper (atomic FAILURE CAS + Celery revoke + out-of-band query cancel).
  `GTF_TASK_HEARTBEAT_INTERVAL=15`, `GTF_ORPHAN_TASK_TIMEOUT=60`.
- **Status polling:** `GET /api/v1/task/status_changes?cursor&task_type` →
  `{uuid: {status, progress}}` + next cursor; base-filtered by `TaskFilter`.
- **Realtime push:** targeted per-principal (and now per-tab) websocket
  `task-status` fanout + lossy `entity-changes` nudges; interval poll is the
  backstop.
- **DAG deps:** `depends_on` all-success gate + dependency payload passing.
- **Progress:** `ctx.update_task(progress=float|int|tuple, immediate=?)`,
  throttled writes, surfaced in `status_changes` as `progress_percent`.

---

## 4. Concept mapping: SQL Lab ↔ GTF (during coexistence)

| SQL Lab concept | GTF equivalent | Transition approach |
|---|---|---|
| `Query` ORM row | stays as-is | **Source of truth for the UI.** Add a nullable `Query.task_uuid` (or reuse `extra`) linking to the `Task`. |
| `Query.client_id` (browser id) | `Task.task_key` + scope PRIVATE | `task_key = client_id`; PRIVATE dedup replaces `is_query_handled`. |
| `Query.status` (PENDING/RUNNING/…) | `Task.status` (PENDING/IN_PROGRESS/…) | Task body **mirrors** its status into `Query.status` on each transition so `/updated_since` keeps working. Map STOPPED↔ABORTED, TIMED_OUT↔TIMED_OUT, FAILED↔FAILURE, SUCCESS↔SUCCESS, RUNNING↔IN_PROGRESS. |
| async enqueue (`get_sql_results.delay`) | `execute_sql_query_task.schedule(query_id)` | one task per Query. |
| sync inline (`SynchronousSqlJsonExecutor`) | `execute_sql_query_task(query_id)` (`__call__`) | inline execution; GTF timeout replaces SIGALRM (works off main thread). |
| `/query/stop` → `cancel_query` + DB STOPPED | `CancelTaskCommand(task_uuid)` → `on_abort` | on_abort handler runs the existing `cancel_query(query)`; STOPPED mirrored to `Query`. |
| per-engine `handle_cursor` stop polling | GTF `on_abort` signal | keep `handle_cursor` for engine progress, but abort becomes signal-driven, not `Query.status`-poll-driven. |
| 3 timeout mechanisms + dead `SQLLAB_HARD_TIMEOUT` | `@task(timeout=SQLLAB_ASYNC_TIME_LIMIT_SEC)` (async) / `TaskOptions(timeout=SQLLAB_TIMEOUT)` (sync) | single, config-driven path; reconcile the hard-coded Celery literals. |
| results backend write + `results_key` | **unchanged** (kept) | task body still serializes + writes `RESULTS_BACKEND`, sets `Query.results_key`. GTF `payload` optionally carries `results_key` for the info bubble. |
| `/query/updated_since` @2s poll | keep initially; later `/task/status_changes` + ws | mirroring Query.status keeps the current poll valid with zero frontend change. |
| per-user concurrency (none today) | optional GTF submit-time guard | not a regression; possible enhancement. |

---

## 5. Proposed task body (sketch)

A single PRIVATE task that wraps the existing statement machinery. The cleanest
form reuses `execute_sql_statements` almost verbatim, moved behind `@task`:

```python
# superset/tasks/sql_lab_queries.py  (new)
SQL_LAB_QUERY_TASK = "superset.sql_lab_query_v1"

@task(name=SQL_LAB_QUERY_TASK, scope=TaskScope.PRIVATE,
      timeout=None)  # per-call timeout via TaskOptions
def execute_sql_lab_query(query_id: int, rendered_query: str, *,
                          store_results: bool, ...) -> None:
    ctx = get_context()
    query = get_query(query_id)
    with override_user(query.user):
        # Register warehouse-query cancellation exactly like chart-data:
        #   capture cancel id off the cursor → ctx.set_cancellation(db_id, id)
        #   → ctx.on_abort(lambda: cancel_query(query))
        # (SQL Lab already captures QUERY_CANCEL_KEY into query.extra today.)
        with _capture_sql_lab_cancellation(query, ctx):
            # The EXISTING execute_sql_statements body: RUNNING, block loop,
            # CTAS/CVAS, apply_limit, shared cursor, results-backend write.
            # Replace the between-block `Query.status==STOPPED` check with the
            # abort flag set by on_abort; keep mirroring Query.status.
            execute_sql_statements(query_id, rendered_query,
                                   store_results=store_results, ...)
        # progress bridge: handle_cursor / block loop → ctx.update_task(progress=…)
```

**Submission** replaces `sql_json_executer.py`:

```python
def submit_sql_lab_query(ctx: SqlJsonExecutionContext, query: Query) -> ...:
    opts = TaskOptions(task_key=query.client_id,
                       timeout=(SQLLAB_ASYNC_TIME_LIMIT_SEC if async else SQLLAB_TIMEOUT))
    if async:
        task = execute_sql_lab_query.schedule(query.id, rendered_query,
                                              store_results=not select_as_cta, options=opts)
        query.set_extra("task_uuid", str(task.uuid))          # link
        return QUERY_IS_RUNNING                                # → 202
    else:
        execute_sql_lab_query(query.id, rendered_query,
                              store_results=..., options=opts)  # inline, blocks
        return HAS_RESULTS
```

**Cancellation** replaces `QueryDAO.stop_query`'s ad-hoc kill:

```python
def stop_query(client_id):
    query = QueryDAO.find_by_client_id(client_id, user_id=g.user.id)
    task_uuid = query.get_extra("task_uuid")
    CancelTaskCommand(UUID(task_uuid)).run()   # → on_abort → cancel_query(query)
    # Task body mirrors ABORTED → Query.status = STOPPED
```

---

## 6. What maps cleanly (low risk)

1. **Cancellation & warehouse-query kill.** GTF's `on_abort` + the
   `query_cancel.py` seam is a drop-in for SQL Lab's needs; SQL Lab *already*
   captures the engine cancel id (`extra[QUERY_CANCEL_KEY]`), so the abort
   handler just calls the existing `cancel_query(query)`. This **removes** the
   between-block `Query.status` polling and lets per-engine `handle_cursor`
   loops watch a local abort flag instead of re-reading the DB row.
2. **Timeouts.** Collapse the three mechanisms into `@task(timeout=…)`; fixes
   the main-thread-only SIGALRM limitation (sync timeouts start working under
   gunicorn threads/gevent) and the hard-coded Celery literals.
3. **Heartbeat / orphan reaping.** SQL Lab has **none** today — a worker OOM
   leaves a query `RUNNING` forever. GTF gives liveness heartbeat + reaper +
   out-of-band query cancel for free.
4. **Idempotency / dedup.** GTF PRIVATE dedup (`task_key=client_id`) subsumes
   `is_query_handled`.
5. **Cross-worker/status sync & realtime.** GTF adds Redis-Streams completion
   signalling and (optional) websocket push; SQL Lab is DB-poll-only today.

---

## 7. The hard parts / genuine gaps (where the work is)

| Gap | Detail | Mitigation |
|---|---|---|
| **Multi-statement / CTAS / CVAS** | A `Query` = N statements over one shared connection/cursor, with CTAS rewrite, DML commit, `select_sql` back-reference, `apply_limit`. GTF chart-data runs a single `get_df`. | Keep the whole statement loop **inside the task body** (reuse `execute_sql_statements`). GTF doesn't need to model statements. |
| **Results backend** | Large Arrow/msgpack blobs in `RESULTS_BACKEND`, `results_key` on `Query`, `SQLLAB_PAYLOAD_MAX_MB`. GTF `payload` is small metadata only. | **Keep the results backend.** Task body owns serialize+compress+`set(key)` and `Query.results_key`, unchanged. |
| **Progress streaming** | SQL Lab reports "block i of n" + engine `handle_cursor`; GTF has `ctx.update_task(progress=…)` but nothing bridges `handle_cursor`. | Bridge `handle_cursor` / block loop → `ctx.update_task(progress=…, immediate=False)`; mirror to `Query.progress`. |
| **Long-lived streaming cursor** | SQL Lab holds a cursor across `execute_with_cursor`+`fetch_data`; a GTF task body *can* block (heartbeat runs on a daemon thread), but no built-in cursor-poll loop or incremental flush. | Task body keeps its own cursor loop; reconcile SQL Lab's soft-time-limit with GTF `timeout`/heartbeat/orphan windows (see below). |
| **Timeout-window reconciliation** | `SQLLAB_ASYNC_TIME_LIMIT_SEC=6h` vs `GTF_ORPHAN_TASK_TIMEOUT=60s` (heartbeat-based, not wall-clock) — different axes. | They're orthogonal: orphan timeout = *liveness* (missed heartbeats), task `timeout` = *wall-clock*. A 6h query heartbeats fine and hits `@task(timeout=6h)`. Document the distinction; ensure heartbeat thread survives blocking query I/O (it does). |
| **Per-user concurrency limits** | Neither SQL Lab **nor** GTF enforces per-user active-query caps today. | Not a regression. Optional: add a submit-time guard in the SQL Lab submit helper. |
| **Query cost estimation** | Separate `/estimate` endpoint, not part of execution. | **Out of scope** — leave as-is. |
| **Two execution stacks** | `sql_lab.py` (UI) vs `superset/sql/execution/` (newer, `StatementResult[]`, per-statement cache, `query_execution.execute_sql`). | **Strategic choice (§8).** |
| **`SQLLAB_BACKEND_PERSISTENCE`, msgpack, `expand_data`, `LimitingFactor`, `tracking_url`** | SQL-Lab-specific result semantics. | Preserved verbatim in the task body. |

---

## 8. Two roads: minimal wrap vs. consolidate on the new executor

**Road A — minimal wrap (lowest risk, recommended first).**
Move `execute_sql_statements` behind an `@task` PRIVATE function; replace
`sql_json_executer.py` (sync/async) with `.schedule()`/`__call__`; replace
`QueryDAO.stop_query`'s kill with `CancelTaskCommand`; mirror `Task.status` →
`Query.status`. Frontend and results backend untouched. Retires the bespoke
`sql_lab.get_sql_results` Celery task, its hard-coded timeouts, the SIGALRM sync
timeout, and the per-engine DB-status polling — replacing them with GTF's
abort/timeout/heartbeat spine.

**Road B — consolidate on `superset/sql/execution/` + GTF (cleaner, larger).**
The newer stack (the `superset-core` **unified SQL execution API**, PR #36529)
already has a per-statement `StatementResult` model and shared
`build_statement_blocks`/`execute_sql_with_cursor`. Point the SQL Lab UI at that
executor core and drive it from a GTF task, retiring `sql_lab.py` entirely and
unifying the stacks. Bigger blast radius (result shape, results-backend contract,
frontend result parsing) **and** it depends on first re-hosting that API's async
half onto GTF — see **§13–§14** for the full unified-API analysis and the
cross-cutting order. **Recommendation:** do Road A first (orchestration
migration), then Road B as part of the follow-up execution-core consolidation.

---

## 9. Phased plan

**Phase 0 — prerequisites.** `GLOBAL_TASK_FRAMEWORK` enabled; coordination
backend (`DISTRIBUTED_COORDINATION_CONFIG`) available (falls back to DB polling
if not). Add a `Query ↔ Task` link (nullable `task_uuid` in `Query.extra` or a
column).

**Phase 1 — task body + submission (async first).**
- New `superset/tasks/sql_lab_queries.py`: `@task(SQL_LAB_QUERY_TASK,
  PRIVATE)` wrapping `execute_sql_statements`; wire `_capture_sql_lab_cancellation`
  (reuse the captured `QUERY_CANCEL_KEY` + `query_cancel.py`).
- Replace `ASynchronousSqlJsonExecutor` with `.schedule()`; keep writing
  `Query.status`/`results_key` from the task body. Keep the 202 contract.
- Status mirroring: task transitions → `Query.status` (STOPPED/TIMED_OUT/…).

**Phase 2 — sync path + cancellation + timeouts.**
- Replace `SynchronousSqlJsonExecutor` with `__call__` (inline) + `TaskOptions
  (timeout=SQLLAB_TIMEOUT)`. Drop the SIGALRM `utils.timeout` for SQL Lab.
- Replace `QueryDAO.stop_query`'s `cancel_query`+DB-STOPPED with
  `CancelTaskCommand`; `on_abort` runs `cancel_query`. Update per-engine
  `handle_cursor` loops to watch the GTF abort flag rather than re-reading
  `Query.status` (or keep both during transition).
- Reconcile timeouts: `@task(timeout=SQLLAB_ASYNC_TIME_LIMIT_SEC)`; delete the
  dead `SQLLAB_HARD_TIMEOUT` reference; stop hard-coding Celery limits.

**Phase 3 — progress + reaping + observability.**
- Bridge block loop / `handle_cursor` → `ctx.update_task(progress=…)`; mirror
  to `Query.progress`. Confirm the orphan reaper cancels an abandoned SQL Lab
  query via the persisted `private["task"]` handle.

**Phase 4 — frontend / realtime (optional, later).**
- Keep `/query/updated_since` polling working throughout (Query row still
  updated). Optionally add GTF `/task/status_changes` + per-tab websocket
  `task-status` subscription for push updates, keyed by the SQL Lab tab id
  (`getTabId()` already exists), with polling as the backstop.

**Phase 5 — cleanup (post-transition, out of this scope's assumption).**
- Once the UI keys off the Task, consider folding SQL-Lab-specific `Query`
  columns into task `private`/`payload`, or (Road B) consolidating executors.

---

## 10. Risks & open questions

1. **Status-mirroring races.** Two writers touch `Query.status` (task body vs.
   the web worker handling `/stop`). GTF centralizes this: `/stop` becomes
   `CancelTaskCommand` (holds the task lock), and the task body mirrors terminal
   state. Ensure the mirror uses the same atomic-CAS discipline GTF uses for
   `Task.status` so a late RUNNING write can't clobber STOPPED.
2. **Sync execution semantics.** Today the sync path runs in the **web worker**
   process (inline). GTF `__call__` also runs inline in-process and drives the
   full lifecycle — good — but verify the web request transaction boundaries and
   the `SubmitTaskCommand` "must own its transaction" guard don't conflict with
   the SQL Lab request's transaction.
3. **`results_backend` required for async.** Preserve the existing guard
   (`SupersetResultsBackendNotConfigureException`) inside the task body.
4. **CTAS commit / DML.** The shared-connection commit-on-mutation logic must
   stay inside the task body; GTF must not wrap the warehouse work in a
   metastore transaction.
5. **Timeout axis confusion.** Clearly document heartbeat/orphan (liveness) vs.
   `@task(timeout)` (wall-clock) — a legitimately long (hours) query must not be
   reaped as orphaned as long as it heartbeats.
6. **Guest/embedded + RLS.** SQL Lab is authenticated-user only; `override_user`
   in the task body must re-establish the query owner for RLS/impersonation
   (mirror chart-data's `_resolve_user`).
7. **Cost-estimate / format / export endpoints** stay outside the task path.
8. **Road B scope** (executor consolidation) is deliberately deferred; decide
   after Phase 3.

---

## 11. Testing strategy

- **Unit:** the new `@task` wrapper (status mirroring for each terminal state;
  CTAS path; results-backend write; abort handler invokes `cancel_query`);
  submit helper (async `.schedule` vs sync `__call__`, PRIVATE dedup on
  `client_id`); `stop_query` → `CancelTaskCommand`.
- **Integration (DB):** end-to-end execute → poll `/query/updated_since` →
  fetch `/sqllab/results` unchanged; `/stop` mid-query aborts and mirrors
  STOPPED; timeout → TIMED_OUT; a killed worker → reaper fails the Query and
  cancels the warehouse query (on a cancellable engine, e.g. Postgres).
- **Engine matrix:** cancellation on Postgres/MySQL/Snowflake/Redshift (explicit
  cancel id) and Presto/Hive/Trino/Impala (`handle_cursor`) — verify the GTF
  abort path drives each.
- **Frontend:** no change required for Phase 1–3 (poll contract preserved);
  add tests only when Phase 4 introduces the `status_changes`/websocket path.

---

## 12. Key files

**SQL Lab (source to migrate):**
`superset/sql_lab.py` (Celery task + `execute_sql_statements` + `cancel_query`),
`superset/sqllab/{api.py,sql_json_executer.py,sqllab_execution_context.py,
command_status.py,execution_context_convertor.py}`,
`superset/commands/sql_lab/{execute.py,results.py,estimate.py}`,
`superset/models/sql_lab.py` (`Query`), `superset/common/db_query_status.py`,
`superset/queries/{api.py,schemas.py}` + `superset/daos/query.py`
(`/updated_since`, `stop_query`), db_engine_spec cancel API
(`superset/db_engine_specs/base.py` + per-engine `handle_cursor`/`cancel_query`).
Newer stack: `superset/sql/execution/{executor.py,celery_task.py}`.
Frontend: `superset-frontend/src/SqlLab/actions/sqlLab.ts`,
`components/QueryAutoRefresh/index.tsx`, `components/ResultSet/index.tsx`.

**GTF (target):**
`superset/tasks/{decorators.py,context.py,manager.py,registry.py,scheduler.py,
heartbeat.py,query_cancel.py,async_queries.py}`,
`superset/commands/tasks/{submit.py,cancel.py,internal_update.py,reap.py}`,
`superset/models/{tasks.py,task_subscribers.py}`, `superset/daos/tasks.py`,
`superset/tasks/api.py`, `superset-core/src/superset_core/tasks/*`.

**Config to reconcile:** `SQLLAB_TIMEOUT`, `SQLLAB_ASYNC_TIME_LIMIT_SEC`
(+ hard-coded Celery literals in `sql_lab.py:183`), dead `SQLLAB_HARD_TIMEOUT`,
`SQLLAB_BACKEND_PERSISTENCE`, `SQLLAB_FORCE_RUN_ASYNC`, `RESULTS_BACKEND`,
`RESULTS_BACKEND_USE_MSGPACK`, `SQLLAB_PAYLOAD_MAX_MB`, `SQL_MAX_ROW`,
`SQLLAB_CTAS_NO_LIMIT`; GTF `GLOBAL_TASK_FRAMEWORK`, `GTF_TASK_HEARTBEAT_INTERVAL`,
`GTF_ORPHAN_TASK_TIMEOUT`, `TASK_ABORT_POLLING_DEFAULT_INTERVAL`,
`TASK_PROGRESS_UPDATE_THROTTLE_INTERVAL`.

---

## 13. The `superset-core` unified SQL execution API (PR #36529)

The user asked whether GAQ (chart-data) and SQL Lab could migrate onto the
`superset-core` **unified SQL execution API** as part of this work. Short answer:
it is the right long-term **execution primitive**, but its **async half competes
with GTF and must be re-hosted on GTF first**, and its sync core has gaps before
either consumer can sit on it. So: valuable convergence target, **premature to
adopt for GAQ/SQL Lab right now**, and a **follow-up epic** rather than part of
`gaq-to-gtf`. Detail below.

### 13.1 What it is

Introduced by PR #36529 as a single, security-complete "run this SQL against this
Database" contract so the four historically-divergent execution paths (Database
model, SQL Lab, charts, MCP) can converge incrementally. The PR explicitly does
**not** consolidate the existing paths — it ships the interface plus four stated
follow-ups (migrate MCP, Database model, SQL Lab, chart execution).

- **Public surface** — `superset-core/src/superset_core/queries/types.py`
  (dataclasses): `QueryOptions` (catalog/schema/limit/timeout/template_params/
  cache/dry_run), `QueryResult` (status + `statements: list[StatementResult]`),
  `StatementResult` (`original_sql`/`executed_sql`/`data: pd.DataFrame|None`/
  `row_count`/`execution_time_ms`), `AsyncQueryHandle` (`get_status()`/
  `get_result()`/`cancel()`), `QueryStatus`. Exposed via
  `Database.execute(sql, options) -> QueryResult` and
  `Database.execute_async(sql, options) -> AsyncQueryHandle`
  (`superset/models/core.py:1547,1563`, thin delegators to `SQLExecutor`).
- **Host implementation** — `superset/sql/execution/executor.py` `SQLExecutor`:
  `_prepare_sql` centralizes Jinja + RLS (AST) + limit + catalog/schema +
  disallowed functions/tables + DML permission; `execute()` runs sync under
  `utils.timeout(SQLLAB_TIMEOUT)`; `execute_async()` creates a `Query` row and
  enqueues the Celery task. Module-level `build_statement_blocks` +
  `execute_sql_with_cursor` are the **shared** multi-statement loop (honoring the
  `run_multiple_statements_as_one` × `MUTATE_AFTER_SPLIT` matrix).
- **Async task** — `superset/sql/execution/celery_task.py`
  `@celery_app.task("query_execution.execute_sql")`, own `AsyncQueryHandle`
  polling `Query.status` + reading the SQL Lab `results_backend`.

### 13.2 Current status (verified)

- **Live only via the MCP `execute_sql` tool, synchronous `execute()` only**
  (`superset/mcp_service/sql_lab/tool/execute_sql.py:198`).
- **The async half is dormant/experimental** — `execute_async()` has **no
  production caller**; the Celery task, `AsyncQueryHandle`, results-backend
  readback and cancel are exercised only by unit tests.
- **Not GTF-integrated at all** — no `@task`/`TaskContext`/`status_changes`/
  coordination; its own Celery task, own async handle, own cancel path.
- **`query_execution.execute_sql` is not in `CeleryConfig.imports`**
  (registers only because the executor imports the module at enqueue time) — a
  deployment-correctness gap.
- Chart-data does **not** use it — it runs the **old** `Database.get_df` (wrapped
  by GTF via `notify_cursor`); SQL Lab does **not** use it either
  (`sql_lab.get_sql_results`).

### 13.3 The duplication we must not entrench: three async stacks + two caches

After the epic there are **three** async execution orchestrations:

1. **GTF** — chart-data (`execute_chart_query`), the epic's target.
2. **`AsyncQueryHandle`** — the unified API's own Celery async (dormant).
3. **`sql_lab.get_sql_results`** — legacy SQL Lab.

and **two** caches inside the unified API alone (sync → `cache_manager.data_cache`
with a deterministic hash key; async → SQL Lab `results_backend` with a uuid key),
neither matching chart-data's `CacheRegion.DATA` + `query_cache_key`. Adopting the
unified API's *async* half for GAQ/SQL Lab now would add a competing async layer
immediately after the epic removed one — the opposite of convergence.

### 13.4 Target layering (the resolution)

Treat the two halves separately:

- **Sync `Database.execute()` = the one execution primitive.** It already owns the
  security/prep surface and the shared statement loop — exactly what every caller
  needs. This is the convergence target.
- **GTF = the one async orchestrator.** Lifecycle, dedup, cancel signal,
  heartbeat/reaping, status polling, subscriptions, per-tab fanout, DAG.
- **`execute_async()`/`AsyncQueryHandle` becomes a thin adapter over GTF** (a GTF
  task body calls the sync `Database.execute()`), and the standalone
  `query_execution.execute_sql` task is retired. Because that async half is
  **dormant**, this re-hosting is cheap and low-risk **if done before any
  consumer adopts it**.

End state: unified API (sync primitive) *under* GTF (async orchestrator) — they
become complementary layers instead of competitors.

### 13.5 Could GAQ (chart-data) migrate onto it?

**Partially, and not directly.** Chart-data is **not** raw SQL execution: it is
`QueryContextProcessor.get_df_payload_result` → `get_df` → warehouse, then pandas
post-processing (contribution totals, filters, annotation data, timing sidecars,
`applied_filter_columns`, result formatting). The unified API returns a
`DataFrame`/records `StatementResult`, not the chart-data payload. So GAQ does not
"call `Database.execute()`" wholesale.

The realistic path is the PR's **"migrate Database model"** follow-up:
**reimplement `Database.get_df` on the `SQLExecutor` core**, so chart-data's
existing GTF task keeps its QueryContext post-processing on top of a `get_df` that
now shares the unified warehouse/prep/security path. GAQ's **async stays GTF**
(unchanged) — only the warehouse-fetch primitive underneath converges. Net: GAQ
converges on the unified API's *sync execution*, never on its *async half*.

### 13.6 Could SQL Lab migrate onto it (during this work)?

**Yes — it is the PR's explicit follow-up — but only after the async half is on
GTF and the sync core's gaps close.** Combine with the SQL-Lab-on-GTF plan
(§8 Road B): the GTF SQL Lab task body calls `Database.execute()` instead of
`execute_sql_statements`, retiring `sql_lab.py`. Blockers to close first:

- **CTAS/CVAS, tmp-table lifecycle, `LimitingFactor`, `select_sql` back-reference**
  are **absent** from the sync executor — SQL Lab depends on them.
- **Result shape:** SQL Lab clients expect Arrow-backed `results_key` payloads;
  the sync executor returns records via `data_cache`. Unify the caching/serialize
  story (or make the region/serialization caller-selectable).
- **Cooperative cancel** exists only on the async path (`QUERY_CANCEL_KEY` set by
  the Celery task) and hooks neither GTF nor the sync path — must route through
  GTF `on_abort`.
- **`CeleryConfig.imports`** gap (if any Celery-run path remains).

### 13.7 Gaps to close before the unified API can carry both consumers

1. Re-host `execute_async`/`AsyncQueryHandle` on GTF (retire the standalone task).
2. Add CTAS/CVAS + tmp-table + `LimitingFactor` to the sync executor.
3. Unify caching (region + key + serialization) across sync/async and reconcile
   with chart-data's `CacheRegion.DATA`/`query_cache_key` and SQL Lab's
   `results_backend`/`results_key`.
4. Route cancellation through GTF `on_abort` + `query_cancel.py` (drop the
   parallel `AsyncQueryHandle.cancel`).
5. Reimplement `get_df` on the executor core (so chart-data converges).
6. Keep chart-data's QueryContext payload assembly as a layer *above* the
   primitive (do not push it into `SQLExecutor`).

---

## 14. Recommended cross-cutting order (GAQ + SQL Lab + unified API)

Ordered to **minimize duplication and risk**, with the dependency rationale:

0. **`gaq-to-gtf` ships as-is** (chart-data async on GTF). It already correctly
   does **not** adopt `AsyncQueryHandle`. ✅ (in flight)

1. **[cheap, do early — ideally a small follow-up right after the epic]
   Re-host the unified API's async on GTF while it is still dormant.** Make
   `Database.execute_async()` orchestrate through a GTF task whose body calls the
   sync `Database.execute()`; retire `query_execution.execute_sql` /
   `AsyncQueryHandle` polling. Doing this *before* any consumer adopts the async
   half prevents entrenching a third async stack. Low risk precisely because it
   is unused in production today.

2. **SQL Lab → GTF orchestration, execution unchanged (Road A).** Wrap the
   existing `execute_sql_statements` in a GTF PRIVATE task; move cancel/timeout/
   heartbeat onto GTF. Independent of the executor work; delivers the biggest
   correctness wins (unified cancel/timeout, orphan reaping SQL Lab lacks today).

3. **Reimplement `Database.get_df` on the `SQLExecutor` core (Database-model
   follow-up).** The linchpin: once `get_df` uses the unified prep/security/
   statement loop, **both** chart-data (via `get_df`) and SQL Lab (if switched to
   `execute()`) share one warehouse path.

4. **SQL Lab execution → `Database.execute()` (Road B).** Swap the GTF SQL Lab
   task body from `execute_sql_statements` to the unified `execute()`, after its
   CTAS/caching/LimitingFactor gaps (§13.7) are closed. Retire `sql_lab.py`.

5. **Chart-data converges automatically** once step 3 lands (it already runs
   through `get_df`); its post-processing and GTF async are unchanged.

6. **MCP + remaining Database-model callers** (the PR's other follow-ups) can
   slot in anywhere after step 3.

**Do this as part of `gaq-to-gtf`?** No. The epic's scope (GAQ → GTF) is met.
The only thing worth deciding *within* the epic is the **layering contract** —
record that **GTF is the async orchestrator and the unified API is the sync
execution primitive**, so #36529's follow-ups target GTF (step 1) rather than
growing `AsyncQueryHandle`. Everything else (steps 1–6) is a **follow-up epic**
("unify SQL execution on GTF"). Bundling it into `gaq-to-gtf` would couple two
large migrations, delay the epic's merge, and expand its blast radius across SQL
Lab + MCP + the Database model.

**Why this order minimizes duplication/risk:**
- Step 1 kills the third async stack while it is cheapest (dormant).
- Step 2 is orthogonal and independently shippable (no executor dependency), so
  SQL Lab gets the cancel/timeout/reaping wins without waiting on the executor.
- Step 3 is the single point that lets chart-data and SQL Lab share a warehouse
  path — done once, both benefit.
- No step requires two async orchestrations or two cancel paths to coexist beyond
  a transition window, and each step is independently valuable if the sequence
  stalls.
