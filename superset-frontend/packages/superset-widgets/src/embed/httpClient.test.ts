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
import { createGuestTokenSource, guestTokenExpiry } from './guestToken';
import { createHttpWidgetClient } from './httpClient';

const DOMAIN = 'https://superset.example.com/';

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  }) as Response;

const tokenWithExp = (exp: number) =>
  `header.${btoa(JSON.stringify({ exp })).replace(/=+$/, '')}.signature`;

let fetchMock: jest.Mock;
const originalFetch = global.fetch;

beforeEach(() => {
  fetchMock = jest.fn();
  global.fetch = fetchMock;
});

afterAll(() => {
  global.fetch = originalFetch;
});

test('an inline widget posts its type and props with the guest token', async () => {
  fetchMock.mockResolvedValue(
    jsonResponse(200, { result: { columns: ['n'], rows: [{ n: 1 }] } }),
  );
  const client = createHttpWidgetClient({
    supersetDomain: DOMAIN,
    getGuestToken: async () => 'token-1',
  });

  const result = await client.fetchData({
    instanceId: 'a',
    widget: { type: 'metric-tile', props: { dataBinding: { datasetId: 17 } } },
    filters: [
      { column: 'state', operator: 'IN', value: ['CA'], datasource: 17 },
    ],
  });

  expect(result).toEqual({ columns: ['n'], rows: [{ n: 1 }] });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://superset.example.com/api/v1/widget/data');
  expect(init.method).toBe('POST');
  expect(init.mode).toBe('cors');
  expect(init.credentials).toBe('omit');
  expect(init.headers['X-GuestToken']).toBe('token-1');
  expect(JSON.parse(init.body)).toEqual({
    widget: { type: 'metric-tile', props: { dataBinding: { datasetId: 17 } } },
    filters: [{ column: 'state', operator: 'IN', value: ['CA'] }],
  });
});

test('a saved widget is selected by id only, and session mode sends cookies', async () => {
  fetchMock.mockResolvedValue(jsonResponse(200, { result: ['boy', 'girl'] }));
  const client = createHttpWidgetClient({ supersetDomain: DOMAIN });

  const values = await client.fetchValues({
    instanceId: 'a',
    widget: { id: 'uuid-1', type: 'filter.select', props: { column: 'x' } },
  });

  expect(values).toEqual(['boy', 'girl']);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://superset.example.com/api/v1/widget/values');
  expect(init.credentials).toBe('include');
  expect(init.headers).not.toHaveProperty('X-GuestToken');
  expect(JSON.parse(init.body)).toEqual({ id: 'uuid-1' });
});

test("the server's message surfaces as the error", async () => {
  fetchMock.mockResolvedValue(
    jsonResponse(403, { message: 'Guest may not access this widget' }),
  );
  const client = createHttpWidgetClient({
    supersetDomain: DOMAIN,
    getGuestToken: async () => 'token-1',
  });

  await expect(client.getSavedWidget!('uuid-1')).rejects.toThrow(
    '403: Guest may not access this widget',
  );
  expect(fetchMock.mock.calls[0][0]).toBe(
    'https://superset.example.com/api/v1/widget/uuid-1',
  );
});

test('without a guest token, a 401 asks the viewer to sign in to Superset', async () => {
  fetchMock.mockResolvedValue(jsonResponse(401, { msg: 'Not authorized' }));
  const client = createHttpWidgetClient({ supersetDomain: DOMAIN });

  await expect(client.getSavedWidget!('uuid-1')).rejects.toThrow(
    'Sign in to Superset at https://superset.example.com to see this widget.',
  );
});

test('without a guest token, a 403 says the account cannot access the data', async () => {
  fetchMock.mockResolvedValue(jsonResponse(403, { message: 'Forbidden' }));
  const client = createHttpWidgetClient({ supersetDomain: DOMAIN });

  await expect(client.getSavedWidget!('uuid-1')).rejects.toThrow(
    'Your Superset account cannot access this data.',
  );
});

test('guest tokens are reused until close to expiry, with one fetch for concurrent callers', async () => {
  const inAnHour = Math.floor(Date.now() / 1000) + 3600;
  const almostExpired = Math.floor(Date.now() / 1000) + 30;
  const fetchToken = jest
    .fn()
    .mockResolvedValueOnce(tokenWithExp(almostExpired))
    .mockResolvedValueOnce(tokenWithExp(inAnHour));
  const source = createGuestTokenSource(fetchToken);

  const [first, second] = await Promise.all([source.get(), source.get()]);
  expect(first).toBe(second);
  expect(fetchToken).toHaveBeenCalledTimes(1);

  // Inside the refresh margin, so the next call fetches a fresh token.
  const refreshed = await source.get();
  expect(refreshed).toBe(tokenWithExp(inAnHour));
  await source.get();
  expect(fetchToken).toHaveBeenCalledTimes(2);
  expect(guestTokenExpiry(refreshed)).toBe(inAnHour * 1000);
});
