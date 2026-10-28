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
 * @fileoverview The `http` namespace is the whole of an extension's access to
 * Superset's API, so what it forwards -- and what it refuses -- is contract.
 */

import { SupersetClient } from '@superset-ui/core';
import { http } from './index';

jest.mock('@superset-ui/core', () => ({
  SupersetClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mocked = SupersetClient as unknown as Record<string, jest.Mock>;

const answer = (json: unknown = { result: [] }, status = 200) => ({
  json,
  response: { status, headers: new Headers({ 'x-trace': 'abc' }) },
});

beforeEach(() => {
  Object.values(mocked).forEach(fn => fn.mockReset().mockResolvedValue(answer()));
});

test.each(['get', 'post', 'put', 'delete'] as const)(
  '%s reaches the client of the same name',
  async verb => {
    await http[verb]({ endpoint: '/api/v1/chart/' });

    expect(mocked[verb]).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/v1/chart/' }),
    );
  },
);

test('the parsed body, status and headers come back', async () => {
  mocked.get.mockResolvedValue(answer({ result: [1, 2] }, 207));

  const res = await http.get<{ result: number[] }>({ endpoint: '/api/v1/x/' });

  expect(res.json.result).toEqual([1, 2]);
  expect(res.status).toBe(207);
  expect(res.headers.get('x-trace')).toBe('abc');
});

test('a JSON payload is forwarded as one', async () => {
  await http.post({ endpoint: '/api/v1/chart/', jsonPayload: { a: 1 } });

  expect(mocked.post).toHaveBeenCalledWith(
    expect.objectContaining({ jsonPayload: { a: 1 } }),
  );
});

test('an absent payload is not forwarded as undefined', async () => {
  // `SupersetClient` branches on the key being present, not on its value.
  await http.get({ endpoint: '/api/v1/chart/' });

  expect(Object.keys(mocked.get.mock.calls[0][0])).toEqual(['endpoint']);
});

test('plain search params become a URLSearchParams', async () => {
  await http.get({ endpoint: '/api/v1/chart/', searchParams: { q: 1, all: true } });

  const { searchParams } = mocked.get.mock.calls[0][0];
  expect(searchParams).toBeInstanceOf(URLSearchParams);
  expect(searchParams.get('q')).toBe('1');
  expect(searchParams.get('all')).toBe('true');
});

test('a URLSearchParams is passed through as given', async () => {
  const given = new URLSearchParams({ q: 'x' });

  await http.get({ endpoint: '/api/v1/chart/', searchParams: given });

  expect(mocked.get.mock.calls[0][0].searchParams).toBe(given);
});

test.each([
  ['an absolute URL', 'https://evil.example.com/api/v1/chart/'],
  ['a protocol-relative URL', '//evil.example.com/api/v1/chart/'],
  ['a bare path', 'api/v1/chart/'],
])('%s is refused', async (_label, endpoint) => {
  // This is the client for *this* Superset, and it carries the session. A
  // caller that means another origin should say so with `fetch`.
  await expect(http.get({ endpoint })).rejects.toThrow(
    'must be a path beginning with "/"',
  );
  expect(mocked.get).not.toHaveBeenCalled();
});
