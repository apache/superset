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

/**
 * Host implementation for Tier 2 Ephemeral State (Server Cache).
 */

import {
  storage as storageApi,
  type storage as StorageTypes,
} from '@apache-superset/core';
import { SupersetClient } from '@superset-ui/core';
import { DEFAULT_TTL, getCurrentExtensionId } from './utils';

/**
 * Build the API URL for ephemeral state operations.
 */
function buildEphemeralStateUrl(
  extensionId: string,
  key: string,
  isShared: boolean,
): string {
  const basePath = '/api/v1/extensions/storage/ephemeral';
  return isShared
    ? `${basePath}/shared/${extensionId}/${key}`
    : `${basePath}/${extensionId}/${key}`;
}

/**
 * Shared ephemeral state accessor implementation.
 */
class SharedEphemeralStateAccessor
  implements StorageTypes.ephemeralState.EphemeralStateAccessor
{
  private extensionId: string;

  constructor(extensionId: string) {
    this.extensionId = extensionId;
  }

  async get(key: string): Promise<unknown> {
    const url = buildEphemeralStateUrl(this.extensionId, key, true);
    const response = await SupersetClient.get({ endpoint: url });
    return response.json?.result ?? null;
  }

  async set(
    key: string,
    value: unknown,
    options?: StorageTypes.ephemeralState.SetOptions,
  ): Promise<void> {
    const url = buildEphemeralStateUrl(this.extensionId, key, true);
    await SupersetClient.put({
      endpoint: url,
      body: JSON.stringify({
        value,
        ttl: options?.ttl ?? DEFAULT_TTL,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async remove(key: string): Promise<void> {
    const url = buildEphemeralStateUrl(this.extensionId, key, true);
    await SupersetClient.delete({ endpoint: url });
  }
}

/**
 * Ephemeral state implementation using REST API.
 * By default, all operations are user-scoped.
 */
export const ephemeralState: typeof storageApi.ephemeralState = {
  DEFAULT_TTL,

  async get(key: string): Promise<unknown> {
    const extensionId = getCurrentExtensionId();
    const url = buildEphemeralStateUrl(extensionId, key, false);
    const response = await SupersetClient.get({ endpoint: url });
    return response.json?.result ?? null;
  },

  async set(
    key: string,
    value: unknown,
    options?: StorageTypes.ephemeralState.SetOptions,
  ): Promise<void> {
    const extensionId = getCurrentExtensionId();
    const url = buildEphemeralStateUrl(extensionId, key, false);
    await SupersetClient.put({
      endpoint: url,
      body: JSON.stringify({
        value,
        ttl: options?.ttl ?? DEFAULT_TTL,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  },

  async remove(key: string): Promise<void> {
    const extensionId = getCurrentExtensionId();
    const url = buildEphemeralStateUrl(extensionId, key, false);
    await SupersetClient.delete({ endpoint: url });
  },

  shared(): StorageTypes.ephemeralState.EphemeralStateAccessor {
    const extensionId = getCurrentExtensionId();
    return new SharedEphemeralStateAccessor(extensionId);
  },
};

/**
 * Create ephemeral state implementation bound to a specific extension ID.
 */
export function createBoundEphemeralState(
  extensionId: string,
): typeof storageApi.ephemeralState {
  class BoundSharedEphemeralAccessor
    implements StorageTypes.ephemeralState.EphemeralStateAccessor
  {
    async get(key: string): Promise<unknown> {
      const url = buildEphemeralStateUrl(extensionId, key, true);
      const response = await SupersetClient.get({ endpoint: url });
      return response.json?.result ?? null;
    }

    async set(
      key: string,
      value: unknown,
      options?: StorageTypes.ephemeralState.SetOptions,
    ): Promise<void> {
      const url = buildEphemeralStateUrl(extensionId, key, true);
      await SupersetClient.put({
        endpoint: url,
        body: JSON.stringify({
          value,
          ttl: options?.ttl ?? DEFAULT_TTL,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    }

    async remove(key: string): Promise<void> {
      const url = buildEphemeralStateUrl(extensionId, key, true);
      await SupersetClient.delete({ endpoint: url });
    }
  }

  return {
    DEFAULT_TTL,

    async get(key: string): Promise<unknown> {
      const url = buildEphemeralStateUrl(extensionId, key, false);
      const response = await SupersetClient.get({ endpoint: url });
      return response.json?.result ?? null;
    },

    async set(
      key: string,
      value: unknown,
      options?: StorageTypes.ephemeralState.SetOptions,
    ): Promise<void> {
      const url = buildEphemeralStateUrl(extensionId, key, false);
      await SupersetClient.put({
        endpoint: url,
        body: JSON.stringify({
          value,
          ttl: options?.ttl ?? DEFAULT_TTL,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },

    async remove(key: string): Promise<void> {
      const url = buildEphemeralStateUrl(extensionId, key, false);
      await SupersetClient.delete({ endpoint: url });
    },

    shared(): StorageTypes.ephemeralState.EphemeralStateAccessor {
      return new BoundSharedEphemeralAccessor();
    },
  };
}
