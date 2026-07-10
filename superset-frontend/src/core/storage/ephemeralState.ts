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
  EphemeralSetOptions,
  EphemeralStorageAccessor,
  EphemeralStorageTier,
  JsonValue,
} from '@apache-superset/core/storage';
import { SupersetClient } from '@superset-ui/core';
import { resolveSetPayload } from './binaryCodec';

/**
 * Create ephemeral state (server cache) bound to an extension ID.
 */
export function createEphemeralState(
  extensionId: string,
): EphemeralStorageTier {
  const [publisher, name] = extensionId.split('.');
  const buildUrl = (key: string, shared?: boolean): string => {
    const encodedPublisher = encodeURIComponent(publisher);
    const encodedName = encodeURIComponent(name);
    const encodedKey = encodeURIComponent(key);
    const url = `/api/v1/extensions/${encodedPublisher}/${encodedName}/storage/ephemeral/${encodedKey}`;
    return shared ? `${url}?shared=true` : url;
  };

  const shared: EphemeralStorageAccessor = {
    async get<T = JsonValue>(key: string): Promise<T | null> {
      const response = await SupersetClient.get({
        endpoint: buildUrl(key, true),
      });
      return (response.json?.result ?? null) as T | null;
    },
    async set<T = JsonValue>(
      key: string,
      value: T,
      options: EphemeralSetOptions,
    ): Promise<void> {
      const payload = resolveSetPayload(value, options.codec);
      await SupersetClient.put({
        endpoint: buildUrl(key, true),
        body: JSON.stringify({
          value: payload.value,
          ttl: options.ttl,
          codec: payload.codec,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
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
      options: EphemeralSetOptions,
    ): Promise<void> {
      const payload = resolveSetPayload(value, options.codec);
      await SupersetClient.put({
        endpoint: buildUrl(key),
        body: JSON.stringify({
          value: payload.value,
          ttl: options.ttl,
          codec: payload.codec,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    async remove(key: string): Promise<void> {
      await SupersetClient.delete({ endpoint: buildUrl(key) });
    },
    shared,
  };
}
