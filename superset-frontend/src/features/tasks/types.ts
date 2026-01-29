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

export interface TaskSubscriber {
  user_id: number;
  first_name: string;
  last_name: string;
  subscribed_at: string;
}

export enum TaskScope {
  Private = 'private',
  Shared = 'shared',
  System = 'system',
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

  // Error info - set when task fails
  error_message: string | null;
  exception_type: string | null;
  stack_trace: string | null;
}

export interface Task {
  id: number;
  uuid: string;
  task_key: string;
  task_type: string;
  task_name: string | null;
  status:
    | 'pending'
    | 'in_progress'
    | 'success'
    | 'failure'
    | 'aborting'
    | 'aborted'
    | 'timed_out';
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
  payload: Record<string, any>;
  properties: TaskProperties;
  duration_seconds: number | null;
  subscriber_count: number;
  subscribers: TaskSubscriber[];
}

// Derived status helpers (frontend computes these from status and properties)
export function isTaskFinished(task: Task): boolean {
  return ['success', 'failure', 'aborted', 'timed_out'].includes(task.status);
}

export function isTaskAborting(task: Task): boolean {
  return task.status === 'aborting';
}

export function canAbortTask(task: Task): boolean {
  if (task.status === 'pending') return true;
  if (task.status === 'in_progress' && task.properties.is_abortable === true)
    return true;
  if (task.status === 'aborting') return true; // Idempotent
  return false;
}

export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Success = 'success',
  Failure = 'failure',
  Aborting = 'aborting',
  Aborted = 'aborted',
  TimedOut = 'timed_out',
}
