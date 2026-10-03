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
import { t } from '@apache-superset/core/translation';
import { getClientErrorObject } from '@superset-ui/core';

/** Only locally defined copy crosses this presentation boundary. */
export async function metadataSyncError(
  error: Parameters<typeof getClientErrorObject>[0],
): Promise<string> {
  const fallback = t('Unable to sync metadata. Try again later.');
  try {
    const parsed = await getClientErrorObject(error);
    const messages: Record<string, string> = {
      unsupported: t('This semantic layer does not support metadata sync.'),
      configuration: t(
        'Complete the semantic layer configuration before syncing metadata.',
      ),
      in_progress: t(
        'A metadata sync is already in progress. Try again shortly.',
      ),
      configuration_changed: t(
        'The semantic view or connection changed. Reopen the editor and try again.',
      ),
      upstream: t(
        'The semantic layer could not return its catalog. Try again later.',
      ),
      invalid_payload: t(
        'The semantic layer returned an invalid or oversized catalog.',
      ),
      deadline: t('Metadata sync timed out. Try again later.'),
      unavailable: t('Metadata storage is unavailable. Try again later.'),
      indeterminate: t(
        'Metadata sync could not be confirmed. Reopen the editor to reload fields before trying again.',
      ),
    };
    if (parsed.status === 401 || parsed.status === 403) {
      return t(
        'You no longer have permission to sync metadata. Reopen the editor or sign in again.',
      );
    }
    if (parsed.status === 404)
      return t('This semantic view is no longer available. Reopen the editor.');
    return Object.hasOwn(messages, parsed.error)
      ? messages[parsed.error]
      : fallback;
  } catch {
    return fallback;
  }
}
