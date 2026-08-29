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
 * A 202 from POST /chart/data carries the GTF tasks the query runs as. Their
 * completion is learned two ways: the shared realtime socket
 * (src/middleware/realtime.ts) delivers per-principal status events, and a
 * single shared poll of /task/status_changes runs while anything is awaited. The
 * socket is best-effort and only accelerates things; the poll is the correctness
 * backstop.
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
  type RealtimeMessage,
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

// The 202 body from POST /chart/data when async: the query tasks to await, plus
// a status-poll cursor captured server-side *before* the tasks were created, so
// polling from it can never skip a task's terminal transition.
export type AsyncJob = { task_ids: string[]; cursor?: string | null };

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
};

let config: AppConfig;
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

// Browser channel prefix for per-principal messages emitted by
// superset-websocket after it fans out backend task-status events. The browser
// socket is JWT-bound to its own principal routing key, so it only ever receives
// its own realtime messages.
const REALTIME_CHANNEL_PREFIX = 'realtime:';

const fetchStatusChanges = makeApi<
  { cursor?: string | null; task_type: string },
  StatusChangesResponse
>({
  method: 'GET',
  endpoint: STATUS_CHANGES_URL,
});

const cancelTask = (taskId: string) => {
  // Best-effort task abort/unsubscribe. This can prevent pending work from
  // starting, but chart tasks do not cancel an underlying warehouse query after
  // execution starts. Failures are non-fatal: the client has stopped waiting.
  //
  // Send this tab's id so the backend detaches only this tab from a shared task:
  // if another tab of the same user is still watching it, the task keeps running
  // and only aborts once its last tab leaves.
  SupersetClient.post({
    endpoint: `/api/v1/task/${taskId}/cancel`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tab_id: getTabId() }),
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
const cancelUnwaitedTasks = (taskIds: string[]) => {
  taskIds.forEach(taskId => {
    if (!waitersByTaskId.has(taskId)) cancelTask(taskId);
  });
};

// Drop a waiter from the registry entry of every task it was awaiting, so a
// settled/aborted waiter never leaks and completion of one task can't re-touch it.
const unregister = (waiter: Waiter) => {
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
      } else {
        // No progress: give up if we've been stale too long (a stuck/orphaned
        // task), else back off (bounded).
        if (Date.now() - lastProgressAt >= pollStaleTimeoutMs) {
          abandonPolling();
          pollingActive = false;
          return;
        }
        currentPollDelayMs = Math.min(currentPollDelayMs * 2, pollBackoffMaxMs);
      }
    } catch (err) {
      if (stopIfStale(generation)) return;
      logging.warn(err);
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
// loop is already running or when async queries are disabled.
const ensurePolling = () => {
  currentPollDelayMs = pollingDelayMs;
  lastProgressAt = Date.now(); // a fresh request restarts the give-up clock
  if (!pollingActive && isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) {
    pollingActive = true;
    loadStatusChanges(pollingGeneration);
  }
};

/**
 * Handle a realtime message from the shared client.
 *
 * A per-principal chart-data payload is ``{task_id, status}``; because delivery
 * is scoped to this principal's own JWT-bound channel the status is
 * authoritative enough to settle the waiter immediately (the ensuing ``refetch``
 * reads the authorized per-query cache anyway). Other channels (e.g. the
 * ``entity-changes:*`` list-view nudges) are not chart-data's concern.
 */
export const handleRealtimeMessage = (message: RealtimeMessage) => {
  const { channel, payload } = message;
  if (!channel.startsWith(REALTIME_CHANNEL_PREFIX)) return;
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
subscribeRealtime(handleRealtimeMessage);

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
  refetch: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> => {
  const taskIds = asyncJob.task_ids ?? [];

  // Register the waiter synchronously, in the same tick the 202 was received —
  // NOT after an await — so a completion socket event can't arrive before the
  // waiter exists and be dropped.
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      cancelUnwaitedTasks(taskIds);
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
        cancelUnwaitedTasks(taskIds);
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
    // Wake the poll loop (eager again) now that there's something to await.
    ensurePolling();
  });

  return refetch();
};

export const init = (appConfig?: AppConfig) => {
  pollingGeneration += 1;
  if (pollingTimeoutId) clearTimeout(pollingTimeoutId);

  config = appConfig || getBootstrapData().common.conf;

  // (Re)connect the shared realtime socket whenever the websocket transport is
  // enabled — independent of GLOBAL_ASYNC_QUERIES, since realtime list views
  // (tier-1 entity-change nudges) ride the same socket. Idempotent: a no-op when
  // WEBSOCKET_ENABLE is false, and supersedes any prior socket otherwise.
  connectRealtime(config);

  if (!isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) return;

  waitersByTaskId = new Map();
  cursor = null;
  pollingActive = false;

  pollingDelayMs = config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY || 500;
  // Backoff ceiling (never below the eager interval) and the no-progress give-up
  // window, both operator-configurable (ms).
  pollBackoffMaxMs = Math.max(
    pollingDelayMs,
    config.GLOBAL_ASYNC_QUERIES_POLLING_MAX_DELAY || 30_000,
  );
  pollStaleTimeoutMs =
    config.GLOBAL_ASYNC_QUERIES_POLLING_STALE_TIMEOUT || 600_000;
  currentPollDelayMs = pollingDelayMs;
  lastProgressAt = Date.now();

  // Stay idle until a chart request returns 202. The 202 body includes a
  // server-captured pre-task cursor, so polling does not need a startup
  // baseline request.
};

init();
