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
import {
  isFeatureEnabled,
  FeatureFlag,
  makeApi,
  SupersetClient,
} from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import getBootstrapData from 'src/utils/getBootstrapData';
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

// The 202 body from POST /chart/data when async: the query tasks to await.
export type AsyncJob = { task_ids: string[] };

type AppConfig = Record<string, any>;

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
let pollingTimeoutId: number;
// Registry of in-flight waiters keyed by every task uuid they await, so a single
// shared poll loop fans status changes out to whichever requests are awaiting them.
// A SHARED task can be deduplicated across concurrent chart requests, so each task
// id maps to a *set* of waiters (never overwrite an earlier subscriber).
// Initialized eagerly (not just in init()): the shared realtime socket connects
// whenever WEBSOCKET_ENABLED — independent of GLOBAL_ASYNC_QUERIES — so the
// subscribed handler may run applyStatus even when async queries are off, and
// must find a map rather than undefined.
let waitersByTaskId: Map<string, Set<Waiter>> = new Map();
// Server-issued watermark: fetched as a baseline at init (before any chart query
// is triggered) so no task created afterwards is missed, then advanced by each
// poll. Always the server's own clock, never the browser's.
let cursor: string | null;
// Incremented on every init() so an in-flight poll can detect it is stale and
// stop instead of scheduling a second loop or mutating fresh state.
let pollingGeneration = 0;

// Per-principal channel prefix (mirrors superset-websocket routing and
// TaskManager.REALTIME_CHANNEL_PREFIX). The browser socket is JWT-bound to its
// own principal channel, so it only ever receives its own realtime messages.
// The shared realtime client (src/middleware/realtime.ts) owns the socket; here
// we only consume the tier-2 messages relevant to chart-data completion. The
// socket is best-effort — the interval poll below is the correctness backstop.
const REALTIME_CHANNEL_PREFIX = 'realtime:';

const fetchStatusChanges = makeApi<
  { cursor?: string | null; task_type: string },
  StatusChangesResponse
>({
  method: 'GET',
  endpoint: STATUS_CHANGES_URL,
});

const cancelTask = (taskId: string) => {
  // Best-effort server-side cancel so an abandoned query stops consuming
  // warehouse resources. Failures are non-fatal: the client has already stopped
  // waiting on the task.
  SupersetClient.post({
    endpoint: `/api/v1/task/${taskId}/cancel`,
  }).catch(error => {
    logging.warn('Failed to cancel task', taskId, error);
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

const settle = (waiter: Waiter) => {
  unregister(waiter);
  if (waiter.signal && waiter.onAbort) {
    waiter.signal.removeEventListener('abort', waiter.onAbort);
  }
  if (waiter.failed) {
    waiter.reject(
      new Error('One or more chart-data queries failed'), // surfaced via getClientErrorObject
    );
  } else {
    waiter.resolve();
  }
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
  if (generation !== pollingGeneration) return;
  if (waitersByTaskId.size) {
    try {
      const { statuses, cursor: next } = await fetchStatusChanges({
        cursor,
        task_type: CHART_QUERY_TASK_TYPE,
      });
      if (generation !== pollingGeneration) return;
      cursor = next;
      Object.entries(statuses).forEach(([taskId, { status }]) =>
        applyStatus(taskId, status),
      );
    } catch (err) {
      if (generation !== pollingGeneration) return;
      logging.warn(err);
    }
  }
  // Reschedule from the tail so a slow request never overlaps the next tick.
  pollingTimeoutId = window.setTimeout(
    () => loadStatusChanges(generation),
    pollingDelayMs,
  );
};

/**
 * Handle a realtime message from the shared client (src/middleware/realtime.ts).
 *
 * For a per-principal (tier-2) chart-data message the payload is
 * ``{task_id, status}``; because delivery is scoped to this principal's own
 * JWT-bound channel, the status is authoritative enough to settle the waiter
 * immediately (the ensuing ``refetch`` reads the authorized per-query cache
 * anyway). Any other channel (e.g. the public ``entity-changes:*`` list-view
 * nudges) is ignored here — chart-data only cares about its own tasks.
 */
export const handleRealtimeMessage = (message: RealtimeMessage) => {
  const { channel, payload } = message;
  if (!channel.startsWith(REALTIME_CHANNEL_PREFIX)) return;
  const taskId = payload?.task_id;
  const status = payload?.status;
  if (typeof taskId === 'string' && typeof status === 'string') {
    applyStatus(taskId, status);
  }
};

// Consume the shared realtime socket once at module load. The handler reads the
// live waiter registry, so it stays correct across init() generations.
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
  // NOT after an await. The 202 is returned when the tasks are *scheduled*, not
  // finished, so at this point the shared poll cursor is <= now < any task's
  // future terminal transition; the poll is therefore guaranteed to observe the
  // completion. Awaiting anything here (e.g. the init baseline) would open a gap
  // in which a fast task could finish and a concurrent chart's poll advance the
  // cursor past its terminal update, and the socket event (no waiter yet) would
  // be dropped — hanging the request.
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      taskIds.forEach(cancelTask);
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
        taskIds.forEach(cancelTask);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', waiter.onAbort, { once: true });
    }
    if (!taskIds.length) {
      settle(waiter);
      return;
    }
    taskIds.forEach(taskId => {
      let waiters = waitersByTaskId.get(taskId);
      if (!waiters) {
        waiters = new Set();
        waitersByTaskId.set(taskId, waiters);
      }
      waiters.add(waiter);
    });
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
  // WEBSOCKET_ENABLED is false, and supersedes any prior socket otherwise.
  connectRealtime(config);

  if (!isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) return;

  const generation = pollingGeneration;
  waitersByTaskId = new Map();
  cursor = null;

  pollingDelayMs = config.GLOBAL_ASYNC_QUERIES_POLLING_DELAY || 500;

  // Establish a baseline cursor before any chart query is triggered, so tasks
  // created afterwards are all caught by the changed-since poll, then start the
  // shared poll loop from that watermark.
  fetchStatusChanges({ task_type: CHART_QUERY_TASK_TYPE })
    .then(({ cursor: baseline }) => {
      if (generation === pollingGeneration) cursor = baseline;
    })
    .catch(err => {
      // A missing baseline just means the first poll starts from "everything
      // changed so far"; the >= cursor semantics still catch our tasks.
      logging.warn('Failed to fetch async baseline cursor', err);
    })
    .finally(() => {
      loadStatusChanges(generation);
    });
};

init();
