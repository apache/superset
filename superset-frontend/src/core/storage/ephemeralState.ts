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

import { type storage as StorageTypes } from '@apache-superset/core';
import { SupersetClient } from '@superset-ui/core';

/**
 * Create ephemeral state (server cache) bound to an extension ID.
 */
export function createEphemeralState(
  extensionId: string,
): typeof StorageTypes.ephemeralState {
  const [publisher, name] = extensionId.split('.');
  const buildUrl = (key: string, shared?: boolean): string => {
    const encodedPublisher = encodeURIComponent(publisher);
    const encodedName = encodeURIComponent(name);
    const encodedKey = encodeURIComponent(key);
    const url = `/api/v1/extensions/${encodedPublisher}/${encodedName}/storage/ephemeral/${encodedKey}`;
    return shared ? `${url}?shared=true` : url;
  };

  const shared: typeof StorageTypes.ephemeralState.shared = {
    get: async (key: string) => {
      const response = await SupersetClient.get({
        endpoint: buildUrl(key, true),
      });
      return response.json?.result ?? null;
    },
    set: async (
      key: string,
      value: StorageTypes.JsonValue,
      options: StorageTypes.ephemeralState.SetOptions,
    ) => {
      await SupersetClient.put({
        endpoint: buildUrl(key, true),
        body: JSON.stringify({ value, ttl: options.ttl }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    remove: async (key: string) => {
      await SupersetClient.delete({ endpoint: buildUrl(key, true) });
    },
  };

  return {
    get: async (key: string) => {
      const response = await SupersetClient.get({ endpoint: buildUrl(key) });
      return response.json?.result ?? null;
    },
    set: async (
      key: string,
      value: StorageTypes.JsonValue,
      options: StorageTypes.ephemeralState.SetOptions,
    ) => {
      await SupersetClient.put({
        endpoint: buildUrl(key),
        body: JSON.stringify({ value, ttl: options.ttl }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    remove: async (key: string) => {
      await SupersetClient.delete({ endpoint: buildUrl(key) });
    },
    shared,
  };
}
