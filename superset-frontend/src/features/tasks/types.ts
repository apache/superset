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

export interface Task {
  id: number;
  uuid: string;
  task_key: string;
  task_type: string;
  task_name: string | null;
  status: 'pending' | 'in_progress' | 'success' | 'failure' | 'aborted';
  scope: TaskScope;
  created_on: string;
  changed_on: string;
  changed_on_delta_humanized?: string;
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
  database_id: number | null;
  error_message: string | null;
  payload: Record<string, any>;
  progress: number | null;
  duration_seconds: number | null;
  is_finished: boolean;
  is_successful: boolean;
  is_aborted: boolean;
  subscriber_count: number;
  subscribers: TaskSubscriber[];
}

export enum TaskStatus {
  Pending = 'pending',
  InProgress = 'in_progress',
  Success = 'success',
  Failure = 'failure',
  Aborted = 'aborted',
}
