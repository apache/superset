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
 * Host implementation for Tier 1 Local State (localStorage).
 */

import {
  storage as storageApi,
  type storage as StorageTypes,
} from '@apache-superset/core';
import { buildKey, getCurrentExtensionId, getCurrentUserId } from './utils';

/**
 * Create a browser storage implementation (localStorage or sessionStorage).
 * Used for both localState and sessionState.
 */
export function createBrowserStorageImpl(
  storage: Storage,
): typeof storageApi.localState {
  class SharedAccessor implements StorageTypes.StorageAccessor {
    private extensionId: string;

    constructor(extensionId: string) {
      this.extensionId = extensionId;
    }

    async get(key: string): Promise<StorageTypes.JsonValue | null> {
      const storageKey = buildKey(this.extensionId, key);
      const value = storage.getItem(storageKey);
      return value ? JSON.parse(value) : null;
    }

    async set(key: string, value: StorageTypes.JsonValue): Promise<void> {
      const storageKey = buildKey(this.extensionId, key);
      storage.setItem(storageKey, JSON.stringify(value));
    }

    async remove(key: string): Promise<void> {
      const storageKey = buildKey(this.extensionId, key);
      storage.removeItem(storageKey);
    }
  }

  return {
    async get(key: string): Promise<StorageTypes.JsonValue | null> {
      const extensionId = getCurrentExtensionId();
      const userId = getCurrentUserId();
      const storageKey = buildKey(extensionId, 'user', userId, key);
      const value = storage.getItem(storageKey);
      return value ? JSON.parse(value) : null;
    },

    async set(key: string, value: StorageTypes.JsonValue): Promise<void> {
      const extensionId = getCurrentExtensionId();
      const userId = getCurrentUserId();
      const storageKey = buildKey(extensionId, 'user', userId, key);
      storage.setItem(storageKey, JSON.stringify(value));
    },

    async remove(key: string): Promise<void> {
      const extensionId = getCurrentExtensionId();
      const userId = getCurrentUserId();
      const storageKey = buildKey(extensionId, 'user', userId, key);
      storage.removeItem(storageKey);
    },

    get shared(): StorageTypes.StorageAccessor {
      const extensionId = getCurrentExtensionId();
      return new SharedAccessor(extensionId);
    },
  };
}

/**
 * Local state implementation using localStorage.
 */
export const localState = createBrowserStorageImpl(localStorage);
