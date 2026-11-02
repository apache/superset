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
 * Recovery from a rejected CSRF token.
 *
 * See https://github.com/apache/superset/issues/43550: a mutation sent with an
 * expired token used to fail with an opaque 400, leaving the stale token in
 * place so every later mutation failed too until the page was reloaded.
 */
import fetchMock, { type CallLog } from 'fetch-mock';
import { SupersetClientClass } from '@superset-ui/core';
import { LOGIN_GLOB } from './fixtures/constants';

const SAVE_URL = 'glob:*/api/v1/dataset/1';
const STALE_TOKEN = 'stale-csrf-token';
const FRESH_TOKEN = 'fresh-csrf-token';

const csrfRejection = {
  status: 400,
  body: {
    errors: [
      {
        message: '400 Bad Request: The CSRF token has expired.',
        error_type: 'CSRF_ERROR',
        level: 'warning',
      },
    ],
  },
};

const unrelatedRejection = {
  status: 400,
  body: {
    errors: [
      {
        message: 'Dataset parameters are invalid.',
        error_type: 'GENERIC_BACKEND_ERROR',
        level: 'error',
      },
    ],
  },
};

const saved = { status: 200, body: { result: 'saved' } };

/** The token a recorded call actually put on the wire. */
function sentToken(callLog: CallLog): string | undefined {
  // fetch-mock lowercases header names on the recorded options.
  const headers = callLog?.options?.headers as
    | Record<string, string>
    | undefined;
  return headers?.['x-csrftoken'];
}

const saveCalls = () => fetchMock.callHistory.calls('save');
const csrfCalls = () => fetchMock.callHistory.calls('csrf');

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());

beforeEach(() => {
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(LOGIN_GLOB, { result: FRESH_TOKEN }, { name: 'csrf' });
});

test('refreshes the token and replays the request once', async () => {
  let attempts = 0;
  fetchMock.put(
    SAVE_URL,
    () => {
      attempts += 1;
      return attempts === 1 ? csrfRejection : saved;
    },
    { name: 'save' },
  );
  const client = new SupersetClientClass({ csrfToken: STALE_TOKEN });

  const { json } = await client.put({
    endpoint: '/api/v1/dataset/1',
    jsonPayload: { description: 'edited' },
  });

  expect(json).toEqual({ result: 'saved' });
  expect(saveCalls()).toHaveLength(2);
  expect(csrfCalls()).toHaveLength(1);
  // The replay must carry the new token, not the one that was just rejected.
  expect(saveCalls().map(sentToken)).toEqual([STALE_TOKEN, FRESH_TOKEN]);
  expect(client.csrfToken).toBe(FRESH_TOKEN);
});

test('gives up after a single replay rather than looping', async () => {
  fetchMock.put(SAVE_URL, csrfRejection, { name: 'save' });
  const client = new SupersetClientClass({ csrfToken: STALE_TOKEN });

  const rejection = await client
    .put({ endpoint: '/api/v1/dataset/1', jsonPayload: { description: 'x' } })
    .then(() => null)
    .catch(error => error);

  expect((rejection as Response).status).toBe(400);
  // One original attempt plus exactly one replay.
  expect(saveCalls()).toHaveLength(2);
  expect(csrfCalls()).toHaveLength(1);
});

test('leaves a rejection that is not about CSRF alone', async () => {
  fetchMock.put(SAVE_URL, unrelatedRejection, { name: 'save' });
  const client = new SupersetClientClass({ csrfToken: STALE_TOKEN });

  const rejection = await client
    .put({ endpoint: '/api/v1/dataset/1', jsonPayload: { description: 'x' } })
    .then(() => null)
    .catch(error => error);

  expect((rejection as Response).status).toBe(400);
  expect(saveCalls()).toHaveLength(1);
  expect(csrfCalls()).toHaveLength(0);
  // The caller still gets an unread body to parse.
  await expect((rejection as Response).json()).resolves.toEqual(
    unrelatedRejection.body,
  );
});

test('concurrent failures share one token refresh', async () => {
  const inFlight = 3;
  let attempts = 0;
  fetchMock.put(
    SAVE_URL,
    () => {
      attempts += 1;
      return attempts <= inFlight ? csrfRejection : saved;
    },
    { name: 'save' },
  );
  const client = new SupersetClientClass({ csrfToken: STALE_TOKEN });

  const results = await Promise.all(
    Array.from({ length: inFlight }, () =>
      client.put({
        endpoint: '/api/v1/dataset/1',
        jsonPayload: { description: 'x' },
      }),
    ),
  );

  expect(results.map(({ json }) => json)).toEqual(
    Array.from({ length: inFlight }, () => ({ result: 'saved' })),
  );
  expect(saveCalls()).toHaveLength(inFlight * 2);
  // The point of the shared promise: one refresh, not one per request.
  expect(csrfCalls()).toHaveLength(1);
});

test('surfaces the original rejection when the refresh itself fails', async () => {
  fetchMock.removeRoutes();
  fetchMock.get(LOGIN_GLOB, { status: 500, body: 'nope' }, { name: 'csrf' });
  fetchMock.put(SAVE_URL, csrfRejection, { name: 'save' });
  const client = new SupersetClientClass({ csrfToken: STALE_TOKEN });

  const rejection = await client
    .put({ endpoint: '/api/v1/dataset/1', jsonPayload: { description: 'x' } })
    .then(() => null)
    .catch(error => error);

  // The caller hears about the save it asked for, not the refresh.
  expect((rejection as Response).status).toBe(400);
  await expect((rejection as Response).json()).resolves.toEqual(
    csrfRejection.body,
  );
  expect(saveCalls()).toHaveLength(1);
  expect(csrfCalls()).toHaveLength(1);
  // A failed refresh must not leave a rejected promise cached, or every later
  // request would fail in ensureAuth without reaching the network.
  expect(client.csrfPromise).toBeUndefined();
});
