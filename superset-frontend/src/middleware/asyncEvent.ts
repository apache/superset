/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/**
 * Await completion of asynchronous chart-data queries (GLOBAL_ASYNC_QUERIES).
 *
 * A 202 from POST /chart/data carries the GTF tasks the query runs as. How their
 * completion is learned depends on whether the realtime websocket is enabled:
 *
 * - `WEBSOCKET_ENABLE` on: the shared socket (src/middleware/realtime.ts) is the
 *   sole mechanism — we do NOT poll while it is the transport. If the socket drops
 *   and reconnects, we run a single `status_changes` catch-up from the pre-task
 *   cursor to pick up anything that completed during the gap; a per-waiter give-up
 *   bounds a message that is genuinely lost.
 * - `WEBSOCKET_ENABLE` off: a shared interval poll of `status_changes` is the only
 *   mechanism (no websocket server deployed).
 *
 * Either way the pre-task cursor from the 202 makes reconciliation exact.
 */
import {
  isFeatureEnabled,
  FeatureFlag,
  makeApi,
  SupersetClient,
} from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import getBootstrapData from 'src/utils/getBootstrapData';
import { getTabId } from 'src/hooks/useTabId';
import {
  connectRealtime,
  subscribeRealtime,
  subscribeRealtimeOpen,
  subscribeRealtimeState,
} from 'src/middleware/realtime';

// The GTF task type chart-data queries run under (see
// superset/tasks/async_queries.py CHART_QUERY_TASK). Polling is filtered to this
// type so a dashboard only tracks its own chart-data work, not every task.
const CHART_QUERY_TASK_TYPE = 'superset.query_object_v1';
const STATUS_CHANGES_URL = '/api/v1/task/status_changes';

// Terminal GTF task statuses (mirror superset_core.tasks.types.TaskStatus).
const STATUS_SUCCESS = 'success';
const TERMINAL_STATUSES = new Set([
  STATUS_SUCCESS,
  'failure',
  'aborted',
  'timed_out',
]);

type TaskStatusChange = { status: string; progress: number | null };
type StatusChangesResponse = {
  statuses: Record<string, TaskStatusChange>;
  cursor: string | null;
};

// The 202 body from POST /chart/data when async: the query tasks to await, a
// status-poll cursor captured server-side *before* the tasks were created (so
// polling from it can never skip a task's terminal transition), and the tab id
// the backend recorded as this tab's consumer (echoed back so a later cancel
// detaches exactly that entry).
export type AsyncJob = {
  task_ids: string[];
  cursor?: string | null;
  tab_id?: string | null;
};

type AppConfig = {
  WEBSOCKET_ENABLE?: boolean;
  WEBSOCKET_URL?: string;
  GLOBAL_ASYNC_QUERIES_POLLING_DELAY?: number;
  GLOBAL_ASYNC_QUERIES_POLLING_MAX_DELAY?: number;
  GLOBAL_ASYNC_QUERIES_POLLING_STALE_TIMEOUT?: number;
};

type Waiter = {
  taskIds: string[];
  pending: Set<string>;
  failed: boolean;
  // Re-issue the original chart-data request once every task has succeeded; the
  // per-query DATA cache is now warm, so it returns synchronously (200).
  resolve: () => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
  // WS mode only: last-resort timer that rejects a waiter whose completion was
  // never delivered (a lost socket message with no reconnect). Cleared on settle.
  giveUpId?: number;
};

let config: AppConfig;
// Whether the realtime websocket is the transport. When true we never poll: the
// socket is the mechanism and a reconnect catch-up reconciles any gap.
let wsEnabled = false;
// Coalescing state for the WS-mode catch-up (see scheduleCatchUp): a microtask is
// pending, a fetch is in flight, and/or a follow-up is queued.
let catchUpScheduled = false;
let catchUpInFlight = false;
let catchUpQueued = false;
// Resolvers awaiting the completion of a catch-up that observed their request (see
// catchUpAndWait) — flushed when the coalesced run chain drains. Lets the WS
// give-up await the last-chance reconciliation exactly, rather than racing a timer.
let catchUpCompletionResolvers: (() => void)[] = [];

const flushCatchUpResolvers = () => {
  const resolvers = catchUpCompletionResolvers;
  catchUpCompletionResolvers = [];
  resolvers.forEach(resolve => resolve());
};
let pollingDelayMs: number;
// Backoff state: the poll starts eager (`pollingDelayMs`), degrades — doubling up
// to `pollBackoffMaxMs` — while awaited tasks are quiet, and snaps back to eager
// the moment an awaited task changes or a new waiter registers.
let currentPollDelayMs: number;
let pollBackoffMaxMs: number;
// Give-up guard: if no awaited task makes progress for `pollStaleTimeoutMs`, the
// poll abandons its waiters (rejecting them) so a stuck/orphaned task can't spin a
// chart — or the poll — forever. `lastProgressAt` is the epoch ms of the last
// progress (or waiter registration); it resets on any awaited-task change.
let pollStaleTimeoutMs: number;
let lastProgressAt: number;
// WS-mode give-up (see waitForAsyncData): spread the per-waiter deadline by up to
// this jitter so many charts don't reach it at the same instant. After the
// last-chance catch-up it triggers, the waiter is rejected only if still unresolved.
const GIVE_UP_JITTER_MS = 5000;
let pollingTimeoutId: number;
// Whether the poll loop is running. It stops entirely when no waiters remain (no
// idle heartbeat) and is restarted by ``ensurePolling`` when a waiter registers.
let pollingActive = false;
// Registry of in-flight waiters keyed by every task uuid they await, so a single
// shared poll loop fans status changes out to whichever requests are awaiting them.
// A SHARED task can be deduplicated across concurrent chart requests, so each task
// id maps to a *set* of waiters (never overwrite an earlier subscriber).
// Initialized eagerly (not just in init()): the shared realtime socket connects
// whenever WEBSOCKET_ENABLE — independent of GLOBAL_ASYNC_QUERIES — so the
// subscribed handler may run applyStatus even when async queries are off, and
// must find a map rather than undefined.
let waitersByTaskId: Map<string, Set<Waiter>> = new Map();
// Server-issued watermark: seeded from a chart request's 202 pre-task cursor
// and advanced by each poll. Always the server's own clock, never the browser's.
let cursor: string | null;
// Incremented on every init() so an in-flight poll can detect it is stale and
// stop instead of scheduling a second loop or mutating fresh state.
let pollingGeneration = 0;

// A poll from a superseded init() must abandon its tick: stop the loop and leave
// the fresh generation's state alone. Returns whether the tick was abandoned.
const stopIfStale = (generation: number): boolean => {
  if (generation === pollingGeneration) return false;
  pollingActive = false;
  return true;
};

// GTF task-status topic emitted by superset-websocket after it fans out backend
// task-status events (see superset/tasks/manager.py TOPIC_TASK_STATUS). Delivery
// is scoped server-side to this principal's (or tab's) routing key, so a message
// that reaches this browser is always its own.
const TASK_STATUS_TOPIC = 'task.status';

const fetchStatusChanges = makeApi<
  { cursor?: string | null; task_type: string },
  StatusChangesResponse
>({
  method: 'GET',
  endpoint: STATUS_CHANGES_URL,
});

const cancelTask = (taskId: string, tabId: string) => {
  // Best-effort task abort/unsubscribe. This prevents pending work from starting
  // and, once execution has begun, cancels the underlying warehouse query on a
  // best-effort, engine-dependent basis (engines that expose a pre-execution
  // cancel id). Failures are non-fatal: the client has stopped waiting.
  //
  // Send the tab id captured at submit time (not read fresh here) so the backend
  // detaches exactly the tab that subscribed: if another tab of the same user is
  // still watching the shared task, it keeps running and only aborts once its
  // last tab leaves. Reading getTabId() at cancel time could send a reassigned id
  // (a duplicate-tab collision) and orphan the original per-tab subscription.
  SupersetClient.post({
    endpoint: `/api/v1/task/${taskId}/cancel`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab_id: tabId }),
  }).catch(error => {
    logging.warn('Failed to cancel task', taskId, error);
  });
};

// Cancel only tasks no local waiter still needs. A SHARED task can back several
// charts for the same principal through a single backend subscriber, so
// cancelling one chart while another local waiter still awaits the same task id
// would tell the server the last subscriber left and abort work the other chart
// needs. Call *after* removing the aborting waiter (or before registering it),
// so a task id still present in the registry means another waiter depends on it.
// `tabId` is the id captured when the aborting request was submitted.
const cancelUnwaitedTasks = (taskIds: string[], tabId: string) => {
  taskIds.forEach(taskId => {
    if (!waitersByTaskId.has(taskId)) cancelTask(taskId, tabId);
  });
};

// Drop a waiter from the registry entry of every task it was awaiting, so a
// settled/aborted waiter never leaks and completion of one task can't re-touch it.
const unregister = (waiter: Waiter) => {
  if (waiter.giveUpId) clearTimeout(waiter.giveUpId);
  waiter.taskIds.forEach(taskId => {
    const waiters = waitersByTaskId.get(taskId);
    if (!waiters) return;
    waiters.delete(waiter);
    if (waiters.size === 0) waitersByTaskId.delete(taskId);
  });
};

const settle = (waiter: Waiter, error?: unknown) => {
  unregister(waiter);
  if (waiter.signal && waiter.onAbort) {
    waiter.signal.removeEventListener('abort', waiter.onAbort);
  }
  if (error !== undefined) {
    waiter.reject(error);
  } else if (waiter.failed) {
    waiter.reject(
      new Error('One or more chart-data queries failed'), // surfaced via getClientErrorObject
    );
  } else {
    waiter.resolve();
  }
};

// Give up on every still-pending waiter (rejecting them), so a stuck/orphaned
// task surfaces an error instead of spinning forever. Collect first — settle()
// mutates waitersByTaskId as it unregisters. Emptying the registry lets the poll
// loop stop on its next tick.
const abandonPolling = () => {
  const stranded = new Set<Waiter>();
  waitersByTaskId.forEach(waiters => waiters.forEach(w => stranded.add(w)));
  stranded.forEach(waiter =>
    settle(waiter, new Error('Timed out waiting for chart-data query results')),
  );
};

// Settle every still-pending waiter when the realtime socket is unhealthy (the
// sole transport is down with no poll fallback), so charts surface a prompt,
// bounded error rather than hanging until the give-up timeout.
const abandonRealtimeWaiters = () => {
  const stranded = new Set<Waiter>();
  waitersByTaskId.forEach(waiters => waiters.forEach(w => stranded.add(w)));
  stranded.forEach(waiter =>
    settle(waiter, new Error('Realtime connection unavailable')),
  );
};

const applyStatus = (taskId: string, status: string) => {
  const waiters = waitersByTaskId.get(taskId);
  if (!waiters || !TERMINAL_STATUSES.has(status)) return;
  // Settle every request awaiting this task, not just the most recent one.
  [...waiters].forEach(waiter => {
    waiter.pending.delete(taskId);
    if (status !== STATUS_SUCCESS) waiter.failed = true;
    if (waiter.pending.size === 0) settle(waiter);
  });
  waitersByTaskId.delete(taskId);
};

// Age the poll toward giving up when it isn't making progress (a quiet no-change
// poll OR a persistent fetch error). Returns true when it has been stale past
// `pollStaleTimeoutMs` — the caller then abandons its waiters and stops — else
// backs off (bounded) so a stuck task or a degraded endpoint isn't polled at the
// eager interval forever. `lastProgressAt` only resets on real progress.
const backOffOrGiveUp = (): boolean => {
  if (Date.now() - lastProgressAt >= pollStaleTimeoutMs) {
    abandonPolling();
    return true;
  }
  currentPollDelayMs = Math.min(currentPollDelayMs * 2, pollBackoffMaxMs);
  return false;
};

const loadStatusChanges = async (generation: number) => {
  if (stopIfStale(generation)) return;
  if (waitersByTaskId.size) {
    try {
      const { statuses, cursor: next } = await fetchStatusChanges({
        cursor,
        task_type: CHART_QUERY_TASK_TYPE,
      });
      if (stopIfStale(generation)) return;
      cursor = next;
      // "Progress" = the batch carried a change for a task we're awaiting; check
      // membership before applyStatus, which deletes a settled task's waiters.
      let progressed = false;
      Object.entries(statuses).forEach(([taskId, { status }]) => {
        if (waitersByTaskId.has(taskId)) progressed = true;
        applyStatus(taskId, status);
      });
      if (progressed) {
        // Reset to eager polling and restart the give-up clock on any change.
        currentPollDelayMs = pollingDelayMs;
        lastProgressAt = Date.now();
      } else if (backOffOrGiveUp()) {
        pollingActive = false;
        return;
      }
    } catch (err) {
      if (stopIfStale(generation)) return;
      logging.warn(err);
      // A persistent status_changes failure must also age toward the give-up and
      // back off — otherwise a WS-off chart spins forever with no error while
      // hammering a degraded endpoint at the eager interval.
      if (backOffOrGiveUp()) {
        pollingActive = false;
        return;
      }
    }
  }
  // Reschedule from the tail so a slow request never overlaps the next tick.
  // Nothing left to await → stop the loop entirely (no idle heartbeat); the next
  // waiter restarts it from the eager interval via ensurePolling.
  if (!waitersByTaskId.size) {
    pollingActive = false;
    currentPollDelayMs = pollingDelayMs;
    return;
  }
  pollingActive = true;
  pollingTimeoutId = window.setTimeout(
    () => loadStatusChanges(generation),
    currentPollDelayMs,
  );
};

// Start (or wake) the poll loop for a freshly registered waiter: poll eagerly
// again, and kick the loop if it had gone idle. Idempotent — a no-op while the
// loop is already running, when async queries are disabled, or when the websocket
// is the transport (WS mode never polls; reconnect catch-up reconciles instead).
const ensurePolling = () => {
  if (wsEnabled) return;
  currentPollDelayMs = pollingDelayMs;
  lastProgressAt = Date.now(); // a fresh request restarts the give-up clock
  if (!pollingActive && isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) {
    pollingActive = true;
    loadStatusChanges(pollingGeneration);
  }
};

// WS mode: reconcile with a single `status_changes` catch-up from the retained
// pre-task cursor — settling anything that completed while the socket was down
// ("pick up where we left off") or before a waiter existed. Not a loop; the
// socket is the steady-state mechanism. Since waitersByTaskId is global, one
// fetch reconciles every pending waiter, so registrations and reconnects are
// coalesced (see scheduleCatchUp) rather than each firing their own request.
const runCatchUp = async () => {
  catchUpScheduled = false;
  if (!wsEnabled || !waitersByTaskId.size) {
    flushCatchUpResolvers();
    return;
  }
  catchUpInFlight = true;
  try {
    // Capture the cursor this fetch starts from; a waiter registering mid-flight
    // can rewind the global cursor to its own earlier 202 watermark and queue a
    // follow-up.
    const requestCursor = cursor;
    const { statuses, cursor: next } = await fetchStatusChanges({
      cursor: requestCursor,
      task_type: CHART_QUERY_TASK_TYPE,
    });
    Object.entries(statuses).forEach(([taskId, { status }]) =>
      applyStatus(taskId, status),
    );
    // Only advance if nobody rewound the cursor while this fetch was in flight;
    // otherwise the queued follow-up must start from that earlier watermark so it
    // doesn't skip statuses in [rewound, requestCursor).
    if (cursor === requestCursor) {
      cursor = next;
    }
  } catch (err) {
    logging.warn(err);
  } finally {
    catchUpInFlight = false;
    // A trigger fired mid-flight (another registration, or a reconnect): run
    // exactly one follow-up to reconcile whatever registered since.
    if (catchUpQueued) {
      catchUpQueued = false;
      catchUpScheduled = true;
      Promise.resolve().then(runCatchUp);
    } else {
      // Chain drained: wake anyone awaiting a catch-up that observed their request.
      flushCatchUpResolvers();
    }
  }
};

// Coalesce catch-up triggers into a single in-flight request. Same-tick triggers
// (a dashboard registering many async charts at once) collapse via a microtask;
// a trigger during an in-flight request schedules exactly one follow-up. Avoids a
// burst of redundant /task/status_changes calls while keeping the design simple.
const scheduleCatchUp = () => {
  if (!wsEnabled) return;
  if (catchUpInFlight) {
    catchUpQueued = true;
    return;
  }
  if (catchUpScheduled) return;
  catchUpScheduled = true;
  Promise.resolve().then(runCatchUp);
};

// Trigger a coalesced catch-up and resolve once a run that observed this call has
// completed. Used by the WS give-up for an exact last-chance reconciliation (await
// the actual reconciliation rather than racing a fixed grace timer). A no-op run
// (WS off / no waiters) still resolves.
const catchUpAndWait = (): Promise<void> => {
  // scheduleCatchUp is a no-op when WS is off (it would never schedule a run, so
  // no resolver would ever flush); resolve immediately in that case.
  if (!wsEnabled) return Promise.resolve();
  return new Promise<void>(resolve => {
    catchUpCompletionResolvers.push(resolve);
    scheduleCatchUp();
  });
};

subscribeRealtimeOpen(scheduleCatchUp);

// The websocket is the sole completion transport when enabled, so a genuinely-down
// server must not hang waiters until the long give-up. On each `reconnecting`
// transition, reconcile via the socket-independent status_changes catch-up (so a
// task that completed while disconnected is still observed); once the socket is
// `unhealthy` (enough consecutive failed reconnects), settle the still-pending
// waiters with a clear error instead of waiting out `pollStaleTimeoutMs`.
subscribeRealtimeState(state => {
  if (!wsEnabled || !waitersByTaskId.size) return;
  if (state === 'reconnecting') {
    scheduleCatchUp();
  } else if (state === 'unhealthy') {
    abandonRealtimeWaiters();
  }
});

/**
 * Handle a `task.status` message from the shared realtime client.
 *
 * The payload is ``{task_id, status}``; because delivery is scoped server-side to
 * this principal's (or tab's) own routing key, the status is authoritative enough
 * to settle the waiter immediately (the ensuing ``refetch`` reads the authorized
 * per-query cache anyway).
 */
export const handleTaskStatus = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return;
  const { task_id: taskId, status } = payload as {
    task_id?: unknown;
    status?: unknown;
  };
  if (typeof taskId === 'string' && typeof status === 'string') {
    applyStatus(taskId, status);
  }
};

// The handler reads the live waiter registry, so it stays correct across init()
// generations.
subscribeRealtime(TASK_STATUS_TOPIC, handleTaskStatus);

/**
 * Await completion of an async chart-data job's query tasks, then re-issue the
 * original request to read the now-cached results.
 *
 * Resolves with the fresh `QueryData[]` once every task has succeeded (the
 * caller's `refetch` returns synchronously from the warm per-query cache);
 * rejects if any task ends in a non-success terminal state, or with an
 * AbortError if the caller aborts (which also cancels the outstanding tasks).
 */
export const waitForAsyncData = async <T = unknown[]>(
  asyncJob: AsyncJob,
  refetch: (queryForceNonces?: string[]) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> => {
  const taskIds = asyncJob.task_ids ?? [];

  // Use the tab id the backend recorded for this job (echoed in the 202), so a
  // cancel detaches exactly the subscription this request created. Falls back to
  // the current tab id for a non-async/legacy job without one. Reading getTabId()
  // fresh at cancel time could send a reassigned id (a duplicate-tab collision)
  // and orphan the original per-tab subscription.
  const submitTabId = asyncJob.tab_id ?? getTabId();

  // Register the waiter synchronously, in the same tick the 202 was received —
  // NOT after an await — so a completion socket event can't arrive before the
  // waiter exists and be dropped.
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      cancelUnwaitedTasks(taskIds, submitTabId);
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const waiter: Waiter = {
      taskIds,
      pending: new Set(taskIds),
      failed: false,
      resolve,
      reject,
      signal,
    };
    if (signal) {
      waiter.onAbort = () => {
        unregister(waiter);
        cancelUnwaitedTasks(taskIds, submitTabId);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', waiter.onAbort, { once: true });
    }
    if (!taskIds.length) {
      settle(waiter);
      return;
    }
    // Rewind the shared poll cursor to this request's server-captured cursor
    // (from the 202), taken *before* its tasks existed. This guarantees the poll
    // starts no later than the tasks' creation, so their terminal transitions
    // can't be skipped — regardless of a concurrent chart having advanced the
    // cursor. ISO-8601 strings compare chronologically.
    if (
      typeof asyncJob.cursor === 'string' &&
      (cursor === null || asyncJob.cursor < cursor)
    ) {
      cursor = asyncJob.cursor;
    }
    taskIds.forEach(taskId => {
      let waiters = waitersByTaskId.get(taskId);
      if (!waiters) {
        waiters = new Set();
        waitersByTaskId.set(taskId, waiters);
      }
      waiters.add(waiter);
    });
    if (wsEnabled) {
      // WS is the transport (no polling). Bound a genuinely-lost completion (a
      // dropped socket message with no reconnect) so a chart can't spin forever;
      // a reconnect catch-up normally settles it well before this fires. Before
      // rejecting, do ONE last-chance reconciliation (not a poll): the socket may
      // have missed a `task.status` while staying open. Await the coalesced
      // `status_changes` catch-up (exact — no timer race even if the endpoint is
      // slow), then reject only if still unresolved (if the catch-up settled the
      // waiter, it's been unregistered and this is a no-op). Jitter the deadline so
      // many dashboard charts don't fire at the same instant.
      waiter.giveUpId = window.setTimeout(
        () => {
          catchUpAndWait()
            .then(() => {
              if (
                waiter.taskIds.some(id => waitersByTaskId.get(id)?.has(waiter))
              ) {
                settle(
                  waiter,
                  new Error('Timed out waiting for chart-data query results'),
                );
              }
            })
            .catch(() => {});
        },
        pollStaleTimeoutMs + Math.random() * GIVE_UP_JITTER_MS,
      );
    }
    // Wake the poll loop (poll mode only; a no-op under WS).
    ensurePolling();
    // WS mode: reconcile once right after registering, to cover a task that
    // completed between the POST and the waiter existing (its socket message may
    // have arrived before this waiter, or before the socket subscribed). Coalesced
    // with sibling registrations/reconnects into one request.
    if (wsEnabled) scheduleCatchUp();
  });

  // Read the warmed results back synchronously. The per-query task ids double as
  // forced-refresh idempotency nonces (see chartAction.requestChartDataResolved),
  // so a forced refresh reads the result its task cached instead of recomputing.
  return refetch(taskIds);
};

export const init = (appConfig?: AppConfig) => {
  pollingGeneration += 1;
  if (pollingTimeoutId) clearTimeout(pollingTimeoutId);

  config = appConfig || getBootstrapData().common.conf;

  // When the websocket transport is enabled it is the sole completion mechanism:
  // we never run the recurring poll, only a one-shot catch-up on
  // registration/reconnect. With it disabled, the interval poll below is the only
  // mechanism. (`config` can be undefined when bootstrap carries no conf — e.g.
  // under test — so read it defensively; this runs before the feature gate.)
  // Require a usable URL too: WEBSOCKET_ENABLE without WEBSOCKET_URL can never open
  // a socket (openSocket no-ops), so treating it as the transport would disable the
  // poll AND never deliver completion — keep polling as the safe fallback instead.
  wsEnabled = Boolean(config?.WEBSOCKET_ENABLE && config?.WEBSOCKET_URL);

  // (Re)connect the shared realtime socket whenever the websocket transport is
  // enabled — independent of GLOBAL_ASYNC_QUERIES, since realtime list views
  // (entity-change nudges) ride the same socket. Idempotent: a no-op when
  // WEBSOCKET_ENABLE is false, and supersedes any prior socket otherwise.
  connectRealtime(config);

  if (!isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) return;

  waitersByTaskId = new Map();
  cursor = null;
  pollingActive = false;
  catchUpScheduled = false;
  catchUpInFlight = false;
  catchUpQueued = false;

  pollingDelayMs = config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY || 500;
  // Backoff ceiling (never below the eager interval) and the give-up window (also
  // the WS-mode per-waiter last-resort timeout), both operator-configurable (ms).
  pollBackoffMaxMs = Math.max(
    pollingDelayMs,
    config.GLOBAL_ASYNC_QUERIES_POLLING_MAX_DELAY || 30_000,
  );
  pollStaleTimeoutMs =
    config.GLOBAL_ASYNC_QUERIES_POLLING_STALE_TIMEOUT || 600_000;
  currentPollDelayMs = pollingDelayMs;
  lastProgressAt = Date.now();

  // Stay idle until a chart request returns 202. The 202 body includes a
  // server-captured pre-task cursor, so reconciliation does not need a startup
  // baseline request.
};

init();
