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
import { createEphemeralState } from './ephemeralState';

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
  const store = createEphemeralState('myorg.myext');
  await store.get('job_progress');
  expect(mockGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/extensions/myorg/myext/storage/ephemeral/job_progress',
  });
});

test('get returns result from response', async () => {
  mockGet.mockResolvedValue({ json: { result: { pct: 42 } } });
  const store = createEphemeralState('myorg.myext');
  const result = await store.get('job_progress');
  expect(result).toEqual({ pct: 42 });
});

test('get returns null when result is absent', async () => {
  mockGet.mockResolvedValue({ json: {} });
  const store = createEphemeralState('myorg.myext');
  expect(await store.get('key')).toBeNull();
});

test('set calls correct URL and includes value and ttl in body', async () => {
  const store = createEphemeralState('myorg.myext');
  await store.set('job_progress', { pct: 42 }, { ttl: 300 });
  expect(mockPut).toHaveBeenCalledWith({
    endpoint: '/api/v1/extensions/myorg/myext/storage/ephemeral/job_progress',
    body: JSON.stringify({ value: { pct: 42 }, ttl: 300, codec: 'json' }),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('set passes codec from options', async () => {
  const store = createEphemeralState('myorg.myext');
  await store.set('job_progress', 'sk-...', { ttl: 300, codec: 'pickle' });
  expect(mockPut).toHaveBeenCalledWith({
    endpoint: '/api/v1/extensions/myorg/myext/storage/ephemeral/job_progress',
    body: JSON.stringify({ value: 'sk-...', ttl: 300, codec: 'pickle' }),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('set auto base64-encodes a Uint8Array value with no codec specified', async () => {
  const store = createEphemeralState('myorg.myext');
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  await store.set('icon', bytes, { ttl: 300 });
  const body = JSON.parse(mockPut.mock.calls[0][0].body);
  expect(body.codec).toBe('base64');
  expect(body.value).toBe(btoa('\x89PNG'));
});

test('remove calls correct URL', async () => {
  const store = createEphemeralState('myorg.myext');
  await store.remove('job_progress');
  expect(mockDelete).toHaveBeenCalledWith({
    endpoint: '/api/v1/extensions/myorg/myext/storage/ephemeral/job_progress',
  });
});

test('keys are URL-encoded', async () => {
  const store = createEphemeralState('myorg.myext');
  await store.get('key with spaces');
  expect(mockGet).toHaveBeenCalledWith({
    endpoint:
      '/api/v1/extensions/myorg/myext/storage/ephemeral/key%20with%20spaces',
  });
});

test('publisher and name are URL-encoded', async () => {
  const store = createEphemeralState('my org.my ext');
  await store.get('key');
  expect(mockGet).toHaveBeenCalledWith({
    endpoint: '/api/v1/extensions/my%20org/my%20ext/storage/ephemeral/key',
  });
});

test('shared.get appends ?shared=true', async () => {
  const store = createEphemeralState('myorg.myext');
  await store.shared.get('result');
  expect(mockGet).toHaveBeenCalledWith({
    endpoint:
      '/api/v1/extensions/myorg/myext/storage/ephemeral/result?shared=true',
  });
});

test('shared.set appends ?shared=true and includes value and ttl', async () => {
  const store = createEphemeralState('myorg.myext');
  await store.shared.set('result', [1, 2, 3], { ttl: 600 });
  expect(mockPut).toHaveBeenCalledWith({
    endpoint:
      '/api/v1/extensions/myorg/myext/storage/ephemeral/result?shared=true',
    body: JSON.stringify({ value: [1, 2, 3], ttl: 600, codec: 'json' }),
    headers: { 'Content-Type': 'application/json' },
  });
});

test('shared.remove appends ?shared=true', async () => {
  const store = createEphemeralState('myorg.myext');
  await store.shared.remove('result');
  expect(mockDelete).toHaveBeenCalledWith({
    endpoint:
      '/api/v1/extensions/myorg/myext/storage/ephemeral/result?shared=true',
  });
});
