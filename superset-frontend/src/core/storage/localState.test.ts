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

import getBootstrapData from 'src/utils/getBootstrapData';
import { createBrowserStorage } from './localState';

jest.mock('src/utils/getBootstrapData');
const mockedGetBootstrapData = getBootstrapData as jest.Mock;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  mockedGetBootstrapData.mockReturnValue({ user: { userId: 42 } });
});

test('get returns null when key is not in storage', async () => {
  const store = createBrowserStorage(localStorage, 'org.ext');
  const result = await store.get('missing');
  expect(result).toBeNull();
});

test('get returns parsed value for user-scoped key', async () => {
  localStorage.setItem(
    'superset-ext:org.ext:user:42:prefs',
    JSON.stringify({ theme: 'dark' }),
  );
  const store = createBrowserStorage(localStorage, 'org.ext');
  const result = await store.get('prefs');
  expect(result).toEqual({ theme: 'dark' });
});

test('set writes value under user-scoped namespaced key', async () => {
  const store = createBrowserStorage(localStorage, 'org.ext');
  await store.set('prefs', { theme: 'dark' });
  expect(localStorage.getItem('superset-ext:org.ext:user:42:prefs')).toBe(
    JSON.stringify({ theme: 'dark' }),
  );
});

test('remove deletes user-scoped key', async () => {
  localStorage.setItem('superset-ext:org.ext:user:42:prefs', '{}');
  const store = createBrowserStorage(localStorage, 'org.ext');
  await store.remove('prefs');
  expect(localStorage.getItem('superset-ext:org.ext:user:42:prefs')).toBeNull();
});

test('get throws when user is not authenticated', async () => {
  mockedGetBootstrapData.mockReturnValue({ user: {} });
  const store = createBrowserStorage(localStorage, 'org.ext');
  await expect(store.get('key')).rejects.toThrow('authenticated user');
});

test('set throws when user is not authenticated', async () => {
  mockedGetBootstrapData.mockReturnValue({ user: {} });
  const store = createBrowserStorage(localStorage, 'org.ext');
  await expect(store.set('key', 'value')).rejects.toThrow('authenticated user');
});

test('different extensions use isolated keys', async () => {
  const store1 = createBrowserStorage(localStorage, 'org.ext1');
  const store2 = createBrowserStorage(localStorage, 'org.ext2');
  await store1.set('key', 'value1');
  await store2.set('key', 'value2');
  expect(await store1.get('key')).toBe('value1');
  expect(await store2.get('key')).toBe('value2');
});

test('different users use isolated keys', async () => {
  const store = createBrowserStorage(localStorage, 'org.ext');
  mockedGetBootstrapData.mockReturnValue({ user: { userId: 1 } });
  await store.set('key', 'user1-value');
  mockedGetBootstrapData.mockReturnValue({ user: { userId: 2 } });
  expect(await store.get('key')).toBeNull();
});

test('shared.get returns null when key is not in storage', async () => {
  const store = createBrowserStorage(localStorage, 'org.ext');
  expect(await store.shared.get('key')).toBeNull();
});

test('shared.set writes value without user scope', async () => {
  const store = createBrowserStorage(localStorage, 'org.ext');
  await store.shared.set('device', 'abc-123');
  expect(localStorage.getItem('superset-ext:org.ext:device')).toBe('"abc-123"');
});

test('shared.get reads value without user scope', async () => {
  localStorage.setItem('superset-ext:org.ext:device', '"abc-123"');
  const store = createBrowserStorage(localStorage, 'org.ext');
  expect(await store.shared.get('device')).toBe('abc-123');
});

test('shared.remove deletes key without user scope', async () => {
  localStorage.setItem('superset-ext:org.ext:device', '"abc-123"');
  const store = createBrowserStorage(localStorage, 'org.ext');
  await store.shared.remove('device');
  expect(localStorage.getItem('superset-ext:org.ext:device')).toBeNull();
});

test('works with sessionStorage', async () => {
  const store = createBrowserStorage(sessionStorage, 'org.ext');
  await store.set('step', 3);
  expect(await store.get('step')).toBe(3);
});
