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
import { SupersetClient } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';

const ERROR_DETAIL_TIMEOUT_MS = 5000;
type CompletenessReason = 'incomplete' | 'unverified';

const fetchCompletenessReason = async (
  taskId: string,
  signal: AbortSignal,
): Promise<CompletenessReason | null> => {
  try {
    // Use the protected detail route; status notifications carry no error data.
    const { json } = await SupersetClient.get({
      endpoint: `/api/v1/task/${encodeURIComponent(taskId)}`,
      signal,
    });
    const task: unknown = json?.result;
    if (
      !task ||
      typeof task !== 'object' ||
      !('status' in task) ||
      task.status !== 'failure' ||
      !('task_type' in task) ||
      task.task_type !== 'superset.query_object_v1' ||
      !('payload' in task)
    )
      return null;
    const { payload } = task;
    if (
      !payload ||
      typeof payload !== 'object' ||
      !('semantic_result_error' in payload)
    )
      return null;
    const reason = payload.semantic_result_error;
    return reason === 'incomplete' || reason === 'unverified' ? reason : null;
  } catch {
    // Access revocation, unavailable details and malformed responses all fall back.
    return null;
  }
};

export const getAsyncQueryError = async (
  taskIds: string[],
  signal?: AbortSignal,
  failureMessage?: string,
): Promise<Error> => {
  const controller = new AbortController();
  let abort!: () => void;
  const cancelled = new Promise<null>(resolve => {
    abort = () => {
      controller.abort();
      resolve(null);
    };
  });
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = window.setTimeout(abort, ERROR_DETAIL_TIMEOUT_MS);
  try {
    const reasons = await Promise.race([
      Promise.all(
        taskIds.map(taskId =>
          fetchCompletenessReason(taskId, controller.signal),
        ),
      ),
      cancelled,
    ]);
    // Keep this fixed guidance aligned with SemanticResultCompletenessError
    // in superset/exceptions.py; never substitute text from task details.
    // A mixed failure must not imply that this guidance fixes every failed query.
    if (reasons?.length && reasons.every(reason => reason === 'incomplete')) {
      return new Error(
        t(
          'The semantic layer returned only part of this query result. Narrow the time range or selected dimensions, or request a smaller explicit row limit, then retry. Result pagination is not supported yet.',
        ),
      );
    }
    if (reasons?.length && reasons.every(reason => reason === 'unverified')) {
      return new Error(
        t(
          'The semantic layer could not verify that this query result is complete. Retry the query; if it continues, ask an administrator to check the semantic-layer connection.',
        ),
      );
    }
    // The status endpoint supplies sanitized ordinary query errors. Do not use
    // that fallback when any task has a recognized completeness failure.
    if (
      reasons?.length &&
      reasons.every(reason => reason === null) &&
      failureMessage
    ) {
      return new Error(failureMessage);
    }
    return new Error(t('One or more chart-data queries failed'));
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
    controller.abort();
  }
};
