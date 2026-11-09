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
 * @fileoverview What the `http` namespace actually puts on the wire.
 *
 * `index.test.ts` mocks `SupersetClient`, so all it can say is which method
 * the adapter reached for and with what argument. These go through the real
 * client down to `fetch`, because what the published contract promises here
 * is decided below the adapter -- in `callApi` and `parseResponse` -- and a
 * mocked client agrees with whatever it is handed.
 */

import fetchMock from 'fetch-mock';
import { SupersetClient } from '@superset-ui/core';
import { http } from './index';

const REVIEWS = 'glob:*/api/v1/acme/reviews/';
const CHARTS = 'glob:*/api/v1/chart/*';

beforeAll(() => {
  fetchMock.mockGlobal();
  fetchMock.get('glob:*/api/v1/security/csrf_token/*', { result: '1234' });
  SupersetClient.configure({ protocol: 'http:', host: 'localhost' }).init();
});

afterAll(() => fetchMock.hardReset());

afterEach(() => fetchMock.clearHistory().removeRoutes());

const sentHeaders = (headers: unknown) => new Headers(headers as HeadersInit);

test('del sends the payload it was given', async () => {
  fetchMock.delete(REVIEWS, { result: 'deleted' });

  await http.del({
    endpoint: '/api/v1/acme/reviews/',
    jsonPayload: { ids: [42] },
  });

  const [call] = fetchMock.callHistory.calls(REVIEWS);
  expect(call.options.body).toBe('{"ids":[42]}');
  expect(sentHeaders(call.options.headers).get('content-type')).toBe(
    'application/json',
  );
});

test('del without a payload sends no body and no content type', async () => {
  fetchMock.delete(REVIEWS, { result: 'deleted' });

  await http.del({ endpoint: '/api/v1/acme/reviews/' });

  const [call] = fetchMock.callHistory.calls(REVIEWS);
  expect(call.options.body).toBeUndefined();
  expect(sentHeaders(call.options.headers).has('content-type')).toBe(false);
});

// `searchParams` are documented as appended to the endpoint, and an endpoint
// with a query of its own is the ordinary case: a rison `q=(...)` filter is
// how Superset's API is asked for anything but the default page.
const queryOf = (url: string) => new URL(url).searchParams;

test('search params join a query the endpoint already carries', async () => {
  fetchMock.get(CHARTS, { result: [] });

  await http.get({
    endpoint: '/api/v1/chart/?q=(page_size:1)',
    searchParams: { _: 123 },
  });

  const [call] = fetchMock.callHistory.calls(CHARTS);
  expect(queryOf(call.url).get('q')).toBe('(page_size:1)');
  expect(queryOf(call.url).get('_')).toBe('123');
});

test('search params win over the same key on the endpoint', async () => {
  fetchMock.get(CHARTS, { result: [] });

  await http.get({
    endpoint: '/api/v1/chart/?q=(page_size:1)&order_column=slice_name',
    searchParams: { q: '(page_size:5)' },
  });

  const [call] = fetchMock.callHistory.calls(CHARTS);
  expect(queryOf(call.url).getAll('q')).toEqual(['(page_size:5)']);
  expect(queryOf(call.url).get('order_column')).toBe('slice_name');
});

test("an endpoint's own query survives on its own", async () => {
  fetchMock.get(CHARTS, { result: [] });

  await http.get({ endpoint: '/api/v1/chart/?q=(page_size:1)' });

  const [call] = fetchMock.callHistory.calls(CHARTS);
  expect(queryOf(call.url).get('q')).toBe('(page_size:1)');
});

test('a 204 is a successful response with no json', async () => {
  // Werkzeug sends a 204 with no body at all, and a successful DELETE
  // frequently is one.
  fetchMock.delete(REVIEWS, { status: 204 });

  const res = await http.del({ endpoint: '/api/v1/acme/reviews/' });

  expect(res.status).toBe(204);
  expect(res.json).toBeUndefined();
});

test('a body is still parsed, and an error still rejects', async () => {
  fetchMock.get(CHARTS, { status: 200, body: { result: [{ id: 1 }] } });
  fetchMock.delete(REVIEWS, { status: 404, body: { message: 'Not found' } });

  const res = await http.get<{ result: { id: number }[] }>({
    endpoint: '/api/v1/chart/',
  });
  expect(res.json?.result).toEqual([{ id: 1 }]);

  await expect(
    http.del({ endpoint: '/api/v1/acme/reviews/' }),
  ).rejects.toMatchObject({ status: 404 });
});

test("an endpoint's own query is sent exactly as it was written", async () => {
  fetchMock.get(CHARTS, { result: [] });

  await http.get({ endpoint: '/api/v1/chart/?q=(page_size:1)' });

  const [call] = fetchMock.callHistory.calls(CHARTS);
  // Not `?q=%28page_size%3A1%29`. Werkzeug reads the two the same, but the
  // literal URL is the ETag cache key in `callApi` and what access logs and
  // proxy rules match on, so a query nobody asked to change should not be
  // respelled on its way out.
  expect(call.url).toContain('?q=(page_size:1)');
});

test('the content type of a body the adapter serialized is the adapter’s', async () => {
  fetchMock.delete(REVIEWS, { result: 'deleted' });

  await http.del({
    endpoint: '/api/v1/acme/reviews/',
    jsonPayload: { ids: [42] },
    headers: { 'Content-Type': 'text/plain' },
  });

  const [call] = fetchMock.callHistory.calls(REVIEWS);
  // `headers` is documented as "the host supplies CSRF and content type".
  // Honouring a caller's `text/plain` over a JSON body would send something
  // no endpoint can parse while the contract says the host had it covered.
  expect(sentHeaders(call.options.headers).get('content-type')).toBe(
    'application/json',
  );
});

test('a 2xx body that is not JSON fails with the status and the headers', async () => {
  fetchMock.get(CHARTS, {
    status: 200,
    body: '<!doctype html><title>Sign in</title>',
    headers: { 'content-type': 'text/html' },
  });

  // The 204's complaint, one case over: a bare SyntaxError says neither what
  // came back nor from where.
  await expect(http.get({ endpoint: '/api/v1/chart/' })).rejects.toMatchObject({
    status: 200,
  });
});
