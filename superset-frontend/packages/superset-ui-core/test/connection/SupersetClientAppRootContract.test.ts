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
import { SupersetClientClass } from '@superset-ui/core';

// SupersetClient is expected to apply the configured appRoot exactly once.
// Callers must pass router-relative endpoints; pre-prefixing causes the
// double-prefix bug documented below.

describe('SupersetClient applies the application root exactly once', () => {
  const buildClient = () =>
    new SupersetClientClass({
      protocol: 'https:',
      host: 'config_host',
      appRoot: '/superset',
    });

  test('endpoint without leading slash is concatenated correctly', () => {
    expect(buildClient().getUrl({ endpoint: 'api/v1/chart' })).toBe(
      'https://config_host/superset/api/v1/chart',
    );
  });

  test('endpoint with leading slash is normalised to a single root segment', () => {
    expect(buildClient().getUrl({ endpoint: '/api/v1/chart' })).toBe(
      'https://config_host/superset/api/v1/chart',
    );
  });

  // Runtime safety net: if a caller pre-prefixes the endpoint (e.g. by wrapping
  // with ensureAppRoot before calling), getUrl strips the duplicate. The L2
  // static invariant still flags the pattern at the call site — this guards
  // against the bug reaching production if the static check is bypassed.
  test('dedupes a leading application-root segment from a pre-prefixed endpoint', () => {
    expect(buildClient().getUrl({ endpoint: '/superset/api/v1/chart' })).toBe(
      'https://config_host/superset/api/v1/chart',
    );
  });

  // If an upstream bug emits a doubly-prefixed endpoint, a single-segment
  // strip would still leak the second prefix to the wire. The greedy loop
  // mirrors `stripAppRoot` so the runtime safety net fully neutralises
  // repeated prefixes.
  test('greedily strips repeated application-root segments', () => {
    expect(
      buildClient().getUrl({ endpoint: '/superset/superset/api/v1/chart' }),
    ).toBe('https://config_host/superset/api/v1/chart');
    expect(
      buildClient().getUrl({
        endpoint: '/superset/superset/superset/api/v1/chart',
      }),
    ).toBe('https://config_host/superset/api/v1/chart');
  });

  test('dedupe is segment-boundary aware — `/supersetfoo` is not a prefix match', () => {
    expect(buildClient().getUrl({ endpoint: '/supersetfoo/x' })).toBe(
      'https://config_host/superset/supersetfoo/x',
    );
  });

  test('dedupes the bare application root to an empty endpoint', () => {
    expect(buildClient().getUrl({ endpoint: '/superset' })).toBe(
      'https://config_host/superset/',
    );
  });

  test('empty application root produces no prefix segment', () => {
    const client = new SupersetClientClass({
      protocol: 'https:',
      host: 'config_host',
    });
    expect(client.getUrl({ endpoint: '/api/v1/chart' })).toBe(
      'https://config_host/api/v1/chart',
    );
  });
});
