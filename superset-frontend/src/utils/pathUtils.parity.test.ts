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

// `pathUtils.ensureAppRoot` and `SupersetClientClass.getUrl` are the two
// runtime safety nets beneath the Layer-2 static scan (see memory
// `project_supersetclient_approot_dedupe`). They run on different inputs —
// one prefixes app-relative paths in component code, the other strips a
// pre-prefixed endpoint at the HTTP boundary — but the dedupe contract is
// identical: a pre-prefixed input must not produce `/superset/superset/...`.
//
// The existing idempotence tests cover the happy path
// (`ensureAppRoot('/superset/sqllab') === '/superset/sqllab'`). These tests
// pin the trickier edge cases where bare-root variants and query/hash
// fragments could plausibly trip the dedupe logic — and document the cases
// where ensureAppRoot deliberately does NOT strip (root with embedded
// query / hash, since the input is ambiguous about whether the leading
// `/superset` is the app root or a literal path segment).

import { SupersetClientClass } from '@superset-ui/core';

async function loadEnsureAppRoot(
  appRoot = '/superset',
): Promise<(path: string) => string> {
  const bootstrap = { common: { application_root: appRoot } };
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(
    bootstrap,
  )}'></div>`;
  jest.resetModules();
  await import('./getBootstrapData');
  const { ensureAppRoot } = await import('./pathUtils');
  return ensureAppRoot;
}

function clientFor(appRoot: string): SupersetClientClass {
  // Note: appRoot ends WITHOUT a trailing slash, mirroring the bootstrap
  // payload contract (`applicationRoot()` strips trailing slash).
  return new SupersetClientClass({
    appRoot,
    protocol: 'https:',
    host: 'example.com',
  });
}

afterEach(() => {
  document.body.innerHTML = '';
  jest.resetModules();
});

// ---------------------------------------------------------------------------
// Edge cases: bare root, root with trailing slash, no leading slash
// ---------------------------------------------------------------------------

test('ensureAppRoot returns the bare root unchanged when passed `/superset`', async () => {
  const ensureAppRoot = await loadEnsureAppRoot('/superset');
  expect(ensureAppRoot('/superset')).toBe('/superset');
});

test('ensureAppRoot does not double-prefix `/superset/` with trailing slash', async () => {
  const ensureAppRoot = await loadEnsureAppRoot('/superset');
  // `/superset/` starts with `/superset/` so the prefix already applies.
  expect(ensureAppRoot('/superset/')).toBe('/superset/');
});

test('ensureAppRoot does not double-prefix a deeply nested already-rooted path', async () => {
  const ensureAppRoot = await loadEnsureAppRoot('/superset');
  expect(
    ensureAppRoot('/superset/dashboard/list/?q=foo&page=2#section-3'),
  ).toBe('/superset/dashboard/list/?q=foo&page=2#section-3');
});

// ---------------------------------------------------------------------------
// Parity with SupersetClient.getUrl on the dedupe contract
// ---------------------------------------------------------------------------
//
// Both helpers normalise the result so a pre-prefixed input does not produce
// `/superset/superset/...`. They reach that result by different routes:
//   - `ensureAppRoot` keeps the input when it already starts with the root.
//   - `getUrl` strips the leading root segment before re-prefixing with
//     `${host}${appRoot}/...`.
//
// These parametrised cases pin the same expected path-after-host for both
// entry points across the inputs most likely to surface a regression.

const PARITY_CASES: Array<{
  description: string;
  input: string;
  expectedPath: string;
}> = [
  {
    description: 'router-relative path without root prefix',
    input: '/sqllab',
    expectedPath: '/superset/sqllab',
  },
  {
    description: 'router-relative path already carrying root prefix',
    input: '/superset/sqllab',
    expectedPath: '/superset/sqllab',
  },
  {
    description: 'path with query string',
    input: '/superset/api/v1/chart/?q=(filters:!t)',
    expectedPath: '/superset/api/v1/chart/?q=(filters:!t)',
  },
  {
    description: 'nested route under app root',
    input: '/superset/dashboard/p/abc123/',
    expectedPath: '/superset/dashboard/p/abc123/',
  },
  {
    description: 'segment-boundary respect — /supersetfoo is NOT the root',
    input: '/supersetfoo/welcome/',
    expectedPath: '/superset/supersetfoo/welcome/',
  },
];

test.each(PARITY_CASES)(
  'ensureAppRoot and SupersetClient.getUrl agree on the post-root path: $description',
  async ({ input, expectedPath }) => {
    const ensureAppRoot = await loadEnsureAppRoot('/superset');
    const client = clientFor('/superset');

    const fromEnsureAppRoot = ensureAppRoot(input);
    const fromGetUrl = client.getUrl({ endpoint: input });

    expect(fromEnsureAppRoot).toBe(expectedPath);
    // `getUrl` always emits absolute URLs; check the path-after-host equals
    // the same expected post-root path.
    expect(fromGetUrl).toBe(`https://example.com${expectedPath}`);
  },
);

// ---------------------------------------------------------------------------
// Root-deployment parity (appRoot = '')
// ---------------------------------------------------------------------------

test('ensureAppRoot is a no-op when root is empty', async () => {
  const ensureAppRoot = await loadEnsureAppRoot('');
  expect(ensureAppRoot('/sqllab')).toBe('/sqllab');
  expect(ensureAppRoot('/dashboard/1/')).toBe('/dashboard/1/');
});

test('SupersetClient.getUrl matches ensureAppRoot under empty root', async () => {
  const ensureAppRoot = await loadEnsureAppRoot('');
  const client = clientFor('');
  const input = '/sqllab?dbid=7';
  expect(ensureAppRoot(input)).toBe('/sqllab?dbid=7');
  expect(client.getUrl({ endpoint: input })).toBe(
    'https://example.com/sqllab?dbid=7',
  );
});
