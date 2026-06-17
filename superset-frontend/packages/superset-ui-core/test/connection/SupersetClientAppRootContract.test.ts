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

  // A trailing slash on the configured appRoot is stripped at construction
  // (SupersetClientClass `appRoot.replace(/\/$/, '')`). Without it, a root of
  // '/superset/' produced 'https://host/superset//foo', and the dedupe block's
  // `startsWith('/superset//')` check silently failed to dedupe a pre-prefixed
  // endpoint. This pins both behaviours against regression.
  test('trailing-slash appRoot is normalised to a single root segment', () => {
    const client = new SupersetClientClass({
      protocol: 'https:',
      host: 'config_host',
      appRoot: '/superset/',
    });
    expect(client.getUrl({ endpoint: '/api/v1/chart' })).toBe(
      'https://config_host/superset/api/v1/chart',
    );
    // and a pre-prefixed endpoint is still deduped, not doubled
    expect(client.getUrl({ endpoint: '/superset/api/v1/chart' })).toBe(
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

  // Single-pass strip preserves a legitimate `/superset/superset/<slug>`
  // route. Backend-supplied router-relative URLs are stripped of the root at
  // the call sites that surface them (via `normalizeBackendUrlString`) before
  // any re-prefixing helper sees them, so a doubled leading segment reaching
  // `getUrl` is a real route, not a double-prefix bug. This pin guards against
  // silent regression to a greedy strip.
  test('strips exactly one application-root segment (single-pass)', () => {
    expect(
      buildClient().getUrl({ endpoint: '/superset/superset/api/v1/chart' }),
    ).toBe('https://config_host/superset/superset/api/v1/chart');
    expect(
      buildClient().getUrl({
        endpoint: '/superset/superset/superset/api/v1/chart',
      }),
    ).toBe('https://config_host/superset/superset/superset/api/v1/chart');
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
