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
 * Slice 7 live-wire assertions for `normalizeBackendUrls` (PR #39925).
 *
 * The contract under test is the inbound seam at `SupersetClientClass.request()`
 * threading `this.appRoot` through `callApiAndParseWithTimeout` → `parseResponse`
 * → `normalizeBackendUrls`. The earlier `normalizeBackendUrls.test.ts` proves
 * the pure function in isolation; this file proves the *plumbing* — kills the
 * false-assurance gap that a pure-function suite creates while the module is
 * unwired.
 *
 * Coverage:
 *   - `json` path: a recognised URL field is stripped end-to-end.
 *   - `json-bigint` path: a recognised URL field is stripped *and* a sibling
 *     BigInt-typed value in the same object survives un-mutated (regression
 *     against the `cloneDeepWith` customizer × `walk()` interleave).
 *   - Empty `appRoot` is an explicit no-op (Layer-2 invariant: the normaliser
 *     should be inert when no subdirectory is configured).
 */

import fetchMock from 'fetch-mock';

import { SupersetClient, SupersetClientClass } from '@superset-ui/core';
import { LOGIN_GLOB } from './fixtures/constants';

beforeAll(() => fetchMock.mockGlobal());
afterAll(() => fetchMock.hardReset());

describe('SupersetClient inbound normaliser plumbing (Slice 7)', () => {
  beforeAll(() => {
    fetchMock.get(LOGIN_GLOB, { result: '1234' });
  });

  afterAll(() => fetchMock.removeRoutes().clearHistory());

  afterEach(() => {
    SupersetClient.reset();
    fetchMock.removeRoutes().clearHistory();
  });

  test('strips appRoot from a recognised URL field on the json path', async () => {
    const chartsUrl = 'https://host/superset/api/v1/chart/';
    fetchMock.get(chartsUrl, {
      result: [
        { id: 1, explore_url: '/superset/explore/?slice_id=1' },
        { id: 2, explore_url: '/superset/explore/?slice_id=2' },
      ],
    });

    SupersetClient.configure({
      protocol: 'https:',
      host: 'host',
      appRoot: '/superset',
      csrfToken: 'csrf',
    });
    await SupersetClient.init();

    const response = await SupersetClient.get<'json'>({
      endpoint: '/api/v1/chart/',
    });
    const payload = response.json as {
      result: Array<{ id: number; explore_url: string }>;
    };

    expect(payload.result[0].explore_url).toBe('/explore/?slice_id=1');
    expect(payload.result[1].explore_url).toBe('/explore/?slice_id=2');
  });

  test('does not strip when appRoot is empty (inert under root deployment)', async () => {
    const chartsUrl = 'https://host/api/v1/chart/';
    fetchMock.get(chartsUrl, {
      result: [{ id: 1, explore_url: '/explore/?slice_id=1' }],
    });

    SupersetClient.configure({
      protocol: 'https:',
      host: 'host',
      // appRoot omitted → DEFAULT_APP_ROOT ('')
      csrfToken: 'csrf',
    });
    await SupersetClient.init();

    const response = await SupersetClient.get<'json'>({
      endpoint: '/api/v1/chart/',
    });
    const payload = response.json as {
      result: Array<{ explore_url: string }>;
    };
    expect(payload.result[0].explore_url).toBe('/explore/?slice_id=1');
  });

  test('json-bigint: strips URL field and preserves a sibling BigInt un-mutated', async () => {
    // A large integer (> Number.MAX_SAFE_INTEGER) becomes a BigInt under the
    // `json-bigint` path's `cloneDeepWith` customizer. A sibling URL string at
    // a recognised field must be normalised *and* the BigInt must remain
    // identical — proving the `cloneDeepWith` × normaliser interleave is safe.
    const bigInt = '9223372036854775807'; // 2^63 - 1, far beyond Number.MAX_SAFE_INTEGER
    const url = 'https://host/superset/api/v1/chart/payload';
    const raw = `{ "id": ${bigInt}, "explore_url": "/superset/explore/?slice_id=42" }`;
    fetchMock.get(url, raw);

    SupersetClient.configure({
      protocol: 'https:',
      host: 'host',
      appRoot: '/superset',
      csrfToken: 'csrf',
    });
    await SupersetClient.init();

    const response = await SupersetClient.get<'json-bigint'>({
      endpoint: '/api/v1/chart/payload',
      parseMethod: 'json-bigint',
    });
    const payload = response.json as { id: bigint; explore_url: string };

    expect(payload.explore_url).toBe('/explore/?slice_id=42');
    expect(typeof payload.id).toBe('bigint');
    expect(payload.id).toBe(BigInt(bigInt));
    expect(payload.id.toString()).toBe(bigInt);
  });

  test('plumbs the appRoot param through request → callApiAndParseWithTimeout → parseResponse', async () => {
    // End-to-end seam assertion: prove that swapping `this.appRoot` on the
    // class instance changes the normalisation behaviour observed at the
    // response, which can only happen if the value flows all the way to
    // `parseResponse`. A `parseResponse`-in-isolation test would miss the
    // wiring regression this guards against.
    const url = 'https://host/preset/superset/api/v1/chart/wired';
    fetchMock.get(url, {
      explore_url: '/preset/superset/explore/?slice_id=1',
    });

    const client = new SupersetClientClass({
      protocol: 'https:',
      host: 'host',
      appRoot: '/preset/superset',
      csrfToken: 'csrf',
    });
    await client.init();

    const response = await client.get<'json'>({
      endpoint: '/api/v1/chart/wired',
    });
    const payload = response.json as { explore_url: string };
    expect(payload.explore_url).toBe('/explore/?slice_id=1');
  });
});
