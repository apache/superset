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
import getBootstrapData from 'src/utils/getBootstrapData';

const KEY_PREFIX = 'superset-ext';

function getCurrentUserId(): number {
  const bootstrapData = getBootstrapData();
  const userId = bootstrapData?.user?.userId;
  if (userId === undefined) {
    throw new Error('Storage APIs require an authenticated user.');
  }
  return userId;
}

function buildKey(...parts: (string | number)[]): string {
  return [KEY_PREFIX, ...parts].join(':');
}

/**
 * Create browser storage (localStorage/sessionStorage) bound to an extension ID.
 */
export function createBrowserStorage(
  storage: Storage,
  extensionId: string,
): typeof StorageTypes.localState {
  const shared: StorageTypes.StorageAccessor = {
    get: async (key: string) => {
      const storageKey = buildKey(extensionId, key);
      const value = storage.getItem(storageKey);
      return value ? JSON.parse(value) : null;
    },
    set: async (key: string, value: StorageTypes.JsonValue) => {
      const storageKey = buildKey(extensionId, key);
      storage.setItem(storageKey, JSON.stringify(value));
    },
    remove: async (key: string) => {
      const storageKey = buildKey(extensionId, key);
      storage.removeItem(storageKey);
    },
  };

  return {
    get: async (key: string) => {
      const userId = getCurrentUserId();
      const storageKey = buildKey(extensionId, 'user', userId, key);
      const value = storage.getItem(storageKey);
      return value ? JSON.parse(value) : null;
    },
    set: async (key: string, value: StorageTypes.JsonValue) => {
      const userId = getCurrentUserId();
      const storageKey = buildKey(extensionId, 'user', userId, key);
      storage.setItem(storageKey, JSON.stringify(value));
    },
    remove: async (key: string) => {
      const userId = getCurrentUserId();
      const storageKey = buildKey(extensionId, 'user', userId, key);
      storage.removeItem(storageKey);
    },
    shared,
  };
}
