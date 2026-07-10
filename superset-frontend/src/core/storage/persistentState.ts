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
  PersistentListOptions,
  PersistentListResult,
  PersistentSetOptions,
  PersistentStorageAccessor,
  PersistentStorageTier,
} from '@apache-superset/core/storage';
import { SupersetClient } from '@superset-ui/core';
import { resolveSetPayload } from './binaryCodec';

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

  const buildListUrl = (
    options: PersistentListOptions,
    isShared?: boolean,
  ): string => {
    const encodedPublisher = encodeURIComponent(publisher);
    const encodedName = encodeURIComponent(name);
    const url = `/api/v1/extensions/${encodedPublisher}/${encodedName}/storage/persistent`;
    const params = new URLSearchParams();
    if (isShared) params.set('shared', 'true');
    if (options.resourceType) params.set('resource_type', options.resourceType);
    if (options.resourceUuid) params.set('resource_uuid', options.resourceUuid);
    params.set('page', String(options.page));
    params.set('page_size', String(options.pageSize));
    const query = params.toString();
    return query ? `${url}?${query}` : url;
  };

  const list = async <T = JsonValue>(
    options: PersistentListOptions,
    isShared: boolean,
  ): Promise<PersistentListResult<T>> => {
    const response = await SupersetClient.get({
      endpoint: buildListUrl(options, isShared),
    });
    return {
      entries: response.json?.result ?? [],
      count: response.json?.count ?? 0,
    };
  };

  const shared: PersistentStorageAccessor = {
    async get<T = JsonValue>(key: string): Promise<T | null> {
      const response = await SupersetClient.get({
        endpoint: buildUrl(key, true),
      });
      return (response.json?.result ?? null) as T | null;
    },
    async set<T = JsonValue>(
      key: string,
      value: T,
      options?: PersistentSetOptions,
    ): Promise<void> {
      const payload = resolveSetPayload(value, options?.codec);
      await SupersetClient.put({
        endpoint: buildUrl(key, true),
        body: JSON.stringify({
          value: payload.value,
          encrypt: options?.encrypt ?? false,
          codec: payload.codec,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async list<T = JsonValue>(
      options: PersistentListOptions,
    ): Promise<PersistentListResult<T>> {
      return list<T>(options, true);
    },
    async remove(key: string): Promise<void> {
      await SupersetClient.delete({ endpoint: buildUrl(key, true) });
    },
  };

  return {
    async get<T = JsonValue>(key: string): Promise<T | null> {
      const response = await SupersetClient.get({ endpoint: buildUrl(key) });
      return (response.json?.result ?? null) as T | null;
    },
    async set<T = JsonValue>(
      key: string,
      value: T,
      options?: PersistentSetOptions,
    ): Promise<void> {
      const payload = resolveSetPayload(value, options?.codec);
      await SupersetClient.put({
        endpoint: buildUrl(key),
        body: JSON.stringify({
          value: payload.value,
          encrypt: options?.encrypt ?? false,
          codec: payload.codec,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async list<T = JsonValue>(
      options: PersistentListOptions,
    ): Promise<PersistentListResult<T>> {
      return list<T>(options, false);
    },
    async remove(key: string): Promise<void> {
      await SupersetClient.delete({ endpoint: buildUrl(key) });
    },
    shared,
  };
}
