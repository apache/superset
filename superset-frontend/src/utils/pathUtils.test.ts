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

afterEach(() => {
  // Clean up the DOM
  document.body.innerHTML = '';
  jest.resetModules();
});

test('ensureAppRoot should add application root prefix to path with default root', async () => {
  document.body.innerHTML = '';
  jest.resetModules();

  const { ensureAppRoot } = await import('./pathUtils');
  expect(ensureAppRoot('/sqllab')).toBe('/sqllab');
  expect(ensureAppRoot('/api/v1/chart')).toBe('/api/v1/chart');
});

test('ensureAppRoot should add application root prefix to path with custom subdirectory', async () => {
  const customData = {
    common: {
      application_root: '/superset/',
    },
  };
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(customData)}'></div>`;
  jest.resetModules();

  // Import getBootstrapData first to initialize the cache
  await import('./getBootstrapData');
  const { ensureAppRoot } = await import('./pathUtils');

  expect(ensureAppRoot('/sqllab')).toBe('/superset/sqllab');
  expect(ensureAppRoot('/api/v1/chart')).toBe('/superset/api/v1/chart');
});

test('ensureAppRoot should handle paths without leading slash', async () => {
  const customData = {
    common: {
      application_root: '/superset/',
    },
  };
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(customData)}'></div>`;
  jest.resetModules();

  await import('./getBootstrapData');
  const { ensureAppRoot } = await import('./pathUtils');

  expect(ensureAppRoot('sqllab')).toBe('/superset/sqllab');
  expect(ensureAppRoot('api/v1/chart')).toBe('/superset/api/v1/chart');
});

test('ensureAppRoot should handle paths with query strings', async () => {
  const customData = {
    common: {
      application_root: '/superset/',
    },
  };
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(customData)}'></div>`;
  jest.resetModules();

  await import('./getBootstrapData');
  const { ensureAppRoot } = await import('./pathUtils');

  expect(ensureAppRoot('/sqllab?new=true')).toBe('/superset/sqllab?new=true');
  expect(ensureAppRoot('/api/v1/chart/export/123/')).toBe(
    '/superset/api/v1/chart/export/123/',
  );
});

test('makeUrl should create URL with default application root', async () => {
  document.body.innerHTML = '';
  jest.resetModules();

  const { makeUrl } = await import('./pathUtils');
  expect(makeUrl('/sqllab')).toBe('/sqllab');
  expect(makeUrl('/api/v1/chart')).toBe('/api/v1/chart');
});

test('makeUrl should create URL with subdirectory prefix', async () => {
  const customData = {
    common: {
      application_root: '/superset/',
    },
  };
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(customData)}'></div>`;
  jest.resetModules();

  await import('./getBootstrapData');
  const { makeUrl } = await import('./pathUtils');

  expect(makeUrl('/sqllab')).toBe('/superset/sqllab');
  expect(makeUrl('/sqllab?new=true')).toBe('/superset/sqllab?new=true');
  expect(makeUrl('/api/v1/sqllab/export/123/')).toBe(
    '/superset/api/v1/sqllab/export/123/',
  );
});

test('makeUrl should handle paths without leading slash', async () => {
  const customData = {
    common: {
      application_root: '/superset/',
    },
  };
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(customData)}'></div>`;
  jest.resetModules();

  await import('./getBootstrapData');
  const { makeUrl } = await import('./pathUtils');

  expect(makeUrl('sqllab?queryId=123')).toBe('/superset/sqllab?queryId=123');
});

test('makeUrl should work with different subdirectory paths', async () => {
  const customData = {
    common: {
      application_root: '/my-app/superset/',
    },
  };
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(customData)}'></div>`;
  jest.resetModules();

  await import('./getBootstrapData');
  const { makeUrl } = await import('./pathUtils');

  expect(makeUrl('/sqllab')).toBe('/my-app/superset/sqllab');
  expect(makeUrl('/dashboard/list')).toBe('/my-app/superset/dashboard/list');
});

test('makeUrl should handle URLs with anchors', async () => {
  const customData = {
    common: {
      application_root: '/superset/',
    },
  };
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(customData)}'></div>`;
  jest.resetModules();

  await import('./getBootstrapData');
  const { makeUrl } = await import('./pathUtils');

  expect(makeUrl('/dashboard/123#anchor')).toBe(
    '/superset/dashboard/123#anchor',
  );
});

// Representative URLs used across the absolute-URL passthrough tests below.
const HTTPS_URL = 'https://external.example.com';
const HTTP_URL = 'http://external.example.com';
const PROTOCOL_RELATIVE_URL = '//external.example.com';
const FTP_URL = 'ftp://files.example.com/data';
const MAILTO_URL = 'mailto:user@example.com';
const TEL_URL = 'tel:+1234567890';

// Sets up bootstrap data and returns a fresh pathUtils module instance.
// Passing appRoot='' (default) simulates no subdirectory deployment.
async function loadPathUtils(appRoot = '') {
  const bootstrapData = { common: { application_root: appRoot } };
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(bootstrapData)}'></div>`;
  jest.resetModules();
  await import('./getBootstrapData');
  return import('./pathUtils');
}

test('ensureAppRoot should preserve absolute and protocol-relative URLs unchanged with default root', async () => {
  const { ensureAppRoot } = await loadPathUtils();

  expect(ensureAppRoot(HTTPS_URL)).toBe(HTTPS_URL);
  expect(ensureAppRoot(HTTP_URL)).toBe(HTTP_URL);
  expect(ensureAppRoot(PROTOCOL_RELATIVE_URL)).toBe(PROTOCOL_RELATIVE_URL);
});

test('ensureAppRoot should preserve absolute URLs unchanged with custom subdirectory', async () => {
  const { ensureAppRoot } = await loadPathUtils('/superset/');

  expect(ensureAppRoot(HTTPS_URL)).toBe(HTTPS_URL);
  expect(ensureAppRoot(HTTP_URL)).toBe(HTTP_URL);
  // Non-http absolute schemes: all safe schemes must pass through
  expect(ensureAppRoot(FTP_URL)).toBe(FTP_URL);
  expect(ensureAppRoot(MAILTO_URL)).toBe(MAILTO_URL);
  expect(ensureAppRoot(TEL_URL)).toBe(TEL_URL);
});

test('ensureAppRoot should preserve protocol-relative URLs unchanged', async () => {
  const { ensureAppRoot } = await loadPathUtils('/superset/');

  expect(ensureAppRoot(PROTOCOL_RELATIVE_URL)).toBe(PROTOCOL_RELATIVE_URL);
});

test('makeUrl should preserve absolute and protocol-relative URLs unchanged', async () => {
  const { makeUrl } = await loadPathUtils('/superset/');

  expect(makeUrl(HTTPS_URL)).toBe(HTTPS_URL);
  expect(makeUrl(PROTOCOL_RELATIVE_URL)).toBe(PROTOCOL_RELATIVE_URL);
  // Non-http absolute scheme parity with ensureAppRoot
  expect(makeUrl(FTP_URL)).toBe(FTP_URL);
});

test('ensureAppRoot should block javascript: and data: schemes (XSS prevention)', async () => {
  const { ensureAppRoot } = await loadPathUtils('/superset/');

  // Dangerous schemes must NOT pass through — they get prefixed to neutralise them.
  // Build the literals via concatenation so the linter's no-script-url rule
  // does not flag this intentional test input.
  const jsUrl = `${'javascript'}:alert(1)`;
  const dataUrl = `${'data'}:text/html,<h1>xss</h1>`;
  expect(ensureAppRoot(jsUrl)).toBe(`/superset/${jsUrl}`);
  expect(ensureAppRoot(dataUrl)).toBe(`/superset/${dataUrl}`);
});

test('ensureAppRoot should prefix unknown schemes instead of passing through', async () => {
  const { ensureAppRoot } = await loadPathUtils('/superset/');

  // Unknown / custom schemes are treated as relative paths
  expect(ensureAppRoot('foo:bar')).toBe('/superset/foo:bar');
});

test('ensureAppRoot should be idempotent — not double-prefix an already-prefixed path', async () => {
  const { ensureAppRoot } = await loadPathUtils('/superset/');

  const once = ensureAppRoot('/sqllab');
  const twice = ensureAppRoot(once);
  expect(twice).toBe(once); // /superset/sqllab, NOT /superset/superset/sqllab
});

test('makeUrl should be idempotent with subdirectory prefix', async () => {
  const { makeUrl } = await loadPathUtils('/superset/');

  const once = makeUrl('/sqllab?new=true');
  const twice = makeUrl(once);
  expect(twice).toBe(once); // /superset/sqllab?new=true, NOT /superset/superset/sqllab?new=true
});
