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

import type {
  JsonValue,
  PersistentSetOptions,
  PersistentStorageAccessor,
  PersistentStorageTier,
} from '@apache-superset/core/storage';
import { SupersetClient } from '@superset-ui/core';

/**
 * Create persistent state (database-backed) bound to an extension ID.
 */
export function createPersistentState(
  extensionId: string,
): PersistentStorageTier {
  const MAX_KEY_LENGTH = 255;
  const [publisher, name] = extensionId.split('.');

  const buildUrl = (key: string, shared?: boolean): string => {
    if (key.length > MAX_KEY_LENGTH) {
      throw new Error(
        `Persistent storage key must be ${MAX_KEY_LENGTH} characters or less.`,
      );
    }
    const encodedPublisher = encodeURIComponent(publisher);
    const encodedName = encodeURIComponent(name);
    const encodedKey = encodeURIComponent(key);
    const url = `/api/v1/extensions/${encodedPublisher}/${encodedName}/storage/persistent/${encodedKey}`;
    return shared ? `${url}?shared=true` : url;
  };

  const shared: PersistentStorageAccessor = {
    async get(key: string) {
      const response = await SupersetClient.get({
        endpoint: buildUrl(key, true),
      });
      return response.json?.result ?? null;
    },
    async set(key: string, value: JsonValue, options?: PersistentSetOptions) {
      await SupersetClient.put({
        endpoint: buildUrl(key, true),
        body: JSON.stringify({ value, encrypt: options?.encrypt ?? false }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async remove(key: string) {
      await SupersetClient.delete({ endpoint: buildUrl(key, true) });
    },
  };

  return {
    async get(key: string) {
      const response = await SupersetClient.get({ endpoint: buildUrl(key) });
      return response.json?.result ?? null;
    },
    async set(key: string, value: JsonValue, options?: PersistentSetOptions) {
      await SupersetClient.put({
        endpoint: buildUrl(key),
        body: JSON.stringify({ value, encrypt: options?.encrypt ?? false }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async remove(key: string) {
      await SupersetClient.delete({ endpoint: buildUrl(key) });
    },
    shared,
  };
}
