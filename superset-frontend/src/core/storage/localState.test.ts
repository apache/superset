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

import { createBrowserStorage } from './localState';

const MOCK_USER_ID = 42;

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({ user: { userId: MOCK_USER_ID } }),
}));

describe('createBrowserStorage', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    const store: Record<string, string> = {};
    mockStorage = {
      getItem: jest.fn((k: string) => store[k] ?? null),
      setItem: jest.fn((k: string, v: string) => {
        store[k] = v;
      }),
      removeItem: jest.fn((k: string) => {
        delete store[k];
      }),
      clear: jest.fn(),
      get length() {
        return Object.keys(store).length;
      },
      key: jest.fn(),
    };
  });

  describe('user-scoped operations', () => {
    it('gets a value scoped to current user', async () => {
      const api = createBrowserStorage(mockStorage, 'acme.dashboard');
      (mockStorage.getItem as jest.Mock).mockReturnValueOnce(
        JSON.stringify({ collapsed: true }),
      );
      const result = await api.get('sidebar');
      expect(mockStorage.getItem).toHaveBeenCalledWith(
        `superset-ext:acme.dashboard:user:${MOCK_USER_ID}:sidebar`,
      );
      expect(result).toEqual({ collapsed: true });
    });

    it('returns null for missing keys', async () => {
      const api = createBrowserStorage(mockStorage, 'acme.dashboard');
      const result = await api.get('nonexistent');
      expect(result).toBeNull();
    });

    it('sets a value scoped to current user', async () => {
      const api = createBrowserStorage(mockStorage, 'acme.dashboard');
      await api.set('theme', 'dark');
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        `superset-ext:acme.dashboard:user:${MOCK_USER_ID}:theme`,
        JSON.stringify('dark'),
      );
    });

    it('removes a value scoped to current user', async () => {
      const api = createBrowserStorage(mockStorage, 'acme.dashboard');
      await api.remove('theme');
      expect(mockStorage.removeItem).toHaveBeenCalledWith(
        `superset-ext:acme.dashboard:user:${MOCK_USER_ID}:theme`,
      );
    });
  });

  describe('shared operations', () => {
    it('gets a shared value (no user scope)', async () => {
      const api = createBrowserStorage(mockStorage, 'acme.dashboard');
      (mockStorage.getItem as jest.Mock).mockReturnValueOnce(
        JSON.stringify('abc-123'),
      );
      const result = await api.shared.get('device_id');
      expect(mockStorage.getItem).toHaveBeenCalledWith(
        'superset-ext:acme.dashboard:device_id',
      );
      expect(result).toBe('abc-123');
    });

    it('sets a shared value', async () => {
      const api = createBrowserStorage(mockStorage, 'acme.dashboard');
      await api.shared.set('global_flag', true);
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'superset-ext:acme.dashboard:global_flag',
        JSON.stringify(true),
      );
    });

    it('removes a shared value', async () => {
      const api = createBrowserStorage(mockStorage, 'acme.dashboard');
      await api.shared.remove('global_flag');
      expect(mockStorage.removeItem).toHaveBeenCalledWith(
        'superset-ext:acme.dashboard:global_flag',
      );
    });
  });

  describe('isolation', () => {
    it('isolates keys between different extensions', async () => {
      const api1 = createBrowserStorage(mockStorage, 'acme.ext1');
      const api2 = createBrowserStorage(mockStorage, 'acme.ext2');

      await api1.set('key', 'value1');
      await api2.set('key', 'value2');

      const calls = (mockStorage.setItem as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('acme.ext1');
      expect(calls[1][0]).toContain('acme.ext2');
      expect(calls[0][0]).not.toBe(calls[1][0]);
    });
  });
});
