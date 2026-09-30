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

export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Success = 'success',
  Failure = 'failure',
  Aborting = 'aborting',
  Aborted = 'aborted',
  TimedOut = 'timed_out',
}

export interface TaskSubscriber {
  // Authenticated subscribers carry a user_id + profile; embedded guests have
  // no ab_user, so they arrive as is_guest with an anonymized label (G1/G2/…).
  user_id: number | null;
  first_name?: string;
  last_name?: string;
  is_guest?: boolean;
  label?: string;
  subscribed_at: string;
}

/**
 * A prerequisite task in the dependency graph (DAG). The dependent task only
 * runs once every prerequisite reaches a terminal SUCCESS.
 */
export interface TaskDependency {
  uuid: string;
  task_name: string | null;
  status: TaskStatus;
}

export enum TaskScope {
  Private = 'private',
  Shared = 'shared',
  System = 'system',
}

/**
 * Internal, debug-only task state, under `properties.private`. Present in API
 * responses only in debug mode. Isolated namespaces so a task-specific key can
 * never collide with a framework key or a subscription policy's bookkeeping.
 */
export interface TaskPrivateProperties {
  // Framework-owned orchestration + error debug.
  framework?: {
    celery_task_id?: string;
    exception_type?: string;
    stack_trace?: string;
    [key: string]: unknown;
  };
  // Freeform task-type-specific handles (e.g. cancel_query_id/cancel_database_id).
  task?: Record<string, unknown>;
  // Subscription-policy bookkeeping (e.g. chart-data's per-tab consumer list).
  subscription?: Record<string, unknown>;
}

/**
 * Task properties - runtime state and execution config stored in JSON blob.
 */
export interface TaskProperties {
  // Execution config - set at task creation
  execution_mode: 'async' | 'sync' | null;
  timeout: number | null;

  // Runtime state - set by framework during execution
  is_abortable: boolean | null;
  progress_percent: number | null;
  progress_current: number | null;
  progress_total: number | null;

  // Consumer-facing failure reason (public). The exception class and traceback
  // are internal debug detail under `private.framework` (debug mode only).
  error_message: string | null;

  // Dedup tracking - times a submit joined this task instead of creating a new
  // one (a new subscriber or an existing subscriber's resubmit); 0 when unique.
  dedupe_count: number | null;

  // Internal, debug-only; absent from API responses outside debug mode.
  private?: TaskPrivateProperties;
}

export interface Task {
  id: number;
  uuid: string;
  task_key: string;
  task_type: string;
  task_name: string | null;
  status: TaskStatus;
  scope: TaskScope;
  created_on: string;
  created_on_delta_humanized?: string;
  changed_on: string;
  started_at: string | null;
  ended_at: string | null;
  created_by: {
    id: number;
    first_name: string;
    last_name: string;
  } | null;
  changed_by?: {
    first_name: string;
    last_name: string;
  } | null;
  user_id: number | null;
  payload: Record<string, unknown>;
  properties: TaskProperties;
  duration_seconds: number | null;
  subscriber_count: number;
  subscribers: TaskSubscriber[];
  // Prerequisite tasks this task depends on (all_success DAG semantics).
  depends_on?: TaskDependency[];
  // Downstream tasks that depend on this task (reverse of depends_on).
  required_by?: TaskDependency[];
}

// Derived status helpers (frontend computes these from status and properties)
export function isTaskFinished(task: Task): boolean {
  return [
    TaskStatus.Success,
    TaskStatus.Failure,
    TaskStatus.Aborted,
    TaskStatus.TimedOut,
  ].includes(task.status);
}

export function isTaskAborting(task: Task): boolean {
  return task.status === TaskStatus.Aborting;
}

export function canAbortTask(task: Task): boolean {
  if (task.status === TaskStatus.Pending) return true;
  if (
    task.status === TaskStatus.InProgress &&
    task.properties.is_abortable === true
  )
    return true;
  if (task.status === TaskStatus.Aborting) return true; // Idempotent
  return false;
}
