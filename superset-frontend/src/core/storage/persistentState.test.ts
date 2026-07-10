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
import { createPersistentState } from './persistentState';

jest.mock('@superset-ui/core', () => ({
  SupersetClient: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockGet = SupersetClient.get as jest.Mock;
const mockPut = SupersetClient.put as jest.Mock;
const mockDelete = SupersetClient.delete as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ json: { result: null } });
  mockPut.mockResolvedValue({});
  mockDelete.mockResolvedValue({});
});

test('get calls correct URL with publisher/name pattern', async () => {
  const store = createPersistentState('myorg.myext');
  await store.get('prefs');
  expect(mockGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/extensions/myorg/myext/storage/persistent/prefs',
  });
});

test('get returns result from response', async () => {
  mockGet.mockResolvedValue({ json: { result: { theme: 'dark' } } });
  const store = createPersistentState('myorg.myext');
  expect(await store.get('prefs')).toEqual({ theme: 'dark' });
});

test('get returns null when result is absent', async () => {
  mockGet.mockResolvedValue({ json: {} });
  const store = createPersistentState('myorg.myext');
  expect(await store.get('key')).toBeNull();
});

test('set calls correct URL with value in body', async () => {
  const store = createPersistentState('myorg.myext');
  await store.set('prefs', { theme: 'dark' });
  expect(mockPut).toHaveBeenCalledWith({
    endpoint: '/api/v1/extensions/myorg/myext/storage/persistent/prefs',
    body: JSON.stringify({
      value: { theme: 'dark' },
      encrypt: false,
      codec: 'json',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('set passes codec from options', async () => {
  const store = createPersistentState('myorg.myext');
  await store.set('prefs', 'sk-...', { codec: 'pickle' });
  expect(mockPut).toHaveBeenCalledWith({
    endpoint: '/api/v1/extensions/myorg/myext/storage/persistent/prefs',
    body: JSON.stringify({
      value: 'sk-...',
      encrypt: false,
      codec: 'pickle',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('set auto base64-encodes a Uint8Array value with no codec specified', async () => {
  const store = createPersistentState('myorg.myext');
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  await store.set('icon', bytes);
  const body = JSON.parse(mockPut.mock.calls[0][0].body);
  expect(body.codec).toBe('base64');
  expect(body.value).toBe(btoa('\x89PNG'));
});

test('set respects an explicit codec for a Uint8Array value instead of auto-encoding', async () => {
  const store = createPersistentState('myorg.myext');
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  await store.set('icon', bytes, { codec: 'pickle' });
  expect(mockPut).toHaveBeenCalledWith({
    endpoint: '/api/v1/extensions/myorg/myext/storage/persistent/icon',
    body: JSON.stringify({
      value: bytes,
      encrypt: false,
      codec: 'pickle',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('remove calls correct URL', async () => {
  const store = createPersistentState('myorg.myext');
  await store.remove('prefs');
  expect(mockDelete).toHaveBeenCalledWith({
    endpoint: '/api/v1/extensions/myorg/myext/storage/persistent/prefs',
  });
});

test('throws when key exceeds 255 characters', async () => {
  const store = createPersistentState('myorg.myext');
  const longKey = 'a'.repeat(256);
  await expect(store.get(longKey)).rejects.toThrow('255 characters or less');
  await expect(store.set(longKey, 'value')).rejects.toThrow(
    '255 characters or less',
  );
  await expect(store.remove(longKey)).rejects.toThrow('255 characters or less');
});

test('keys are URL-encoded', async () => {
  const store = createPersistentState('myorg.myext');
  await store.get('key/with/slashes');
  expect(mockGet).toHaveBeenCalledWith({
    endpoint:
      '/api/v1/extensions/myorg/myext/storage/persistent/key%2Fwith%2Fslashes',
  });
});

test('publisher and name are URL-encoded', async () => {
  const store = createPersistentState('my org.my ext');
  await store.get('key');
  expect(mockGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/extensions/my%20org/my%20ext/storage/persistent/key',
  });
});

test('shared.get appends ?shared=true', async () => {
  const store = createPersistentState('myorg.myext');
  await store.shared.get('config');
  expect(mockGet).toHaveBeenCalledWith({
    endpoint:
      '/api/v1/extensions/myorg/myext/storage/persistent/config?shared=true',
  });
});

test('shared.set appends ?shared=true', async () => {
  const store = createPersistentState('myorg.myext');
  await store.shared.set('config', { version: 2 });
  expect(mockPut).toHaveBeenCalledWith({
    endpoint:
      '/api/v1/extensions/myorg/myext/storage/persistent/config?shared=true',
    body: JSON.stringify({
      value: { version: 2 },
      encrypt: false,
      codec: 'json',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('shared.remove appends ?shared=true', async () => {
  const store = createPersistentState('myorg.myext');
  await store.shared.remove('config');
  expect(mockDelete).toHaveBeenCalledWith({
    endpoint:
      '/api/v1/extensions/myorg/myext/storage/persistent/config?shared=true',
  });
});
