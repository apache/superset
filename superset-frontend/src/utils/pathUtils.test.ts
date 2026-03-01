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

  expect(ensureAppRoot('https://external.example.com')).toBe(
    'https://external.example.com',
  );
  expect(ensureAppRoot('http://external.example.com')).toBe(
    'http://external.example.com',
  );
  expect(ensureAppRoot('//external.example.com')).toBe(
    '//external.example.com',
  );
});

test('ensureAppRoot should preserve absolute URLs unchanged with custom subdirectory', async () => {
  const { ensureAppRoot } = await loadPathUtils('/superset/');

  expect(ensureAppRoot('https://external.example.com')).toBe(
    'https://external.example.com',
  );
  expect(ensureAppRoot('http://external.example.com')).toBe(
    'http://external.example.com',
  );
  // Non-http absolute schemes: implementation must not rely on http/https check alone
  expect(ensureAppRoot('ftp://files.example.com/data')).toBe(
    'ftp://files.example.com/data',
  );
  expect(ensureAppRoot('mailto:user@example.com')).toBe(
    'mailto:user@example.com',
  );
});

test('ensureAppRoot should preserve protocol-relative URLs unchanged', async () => {
  const { ensureAppRoot } = await loadPathUtils('/superset/');

  expect(ensureAppRoot('//external.example.com')).toBe(
    '//external.example.com',
  );
});

test('makeUrl should preserve absolute and protocol-relative URLs unchanged', async () => {
  const { makeUrl } = await loadPathUtils('/superset/');

  expect(makeUrl('https://external.example.com')).toBe(
    'https://external.example.com',
  );
  expect(makeUrl('//external.example.com')).toBe('//external.example.com');
  // Non-http absolute scheme parity with ensureAppRoot
  expect(makeUrl('ftp://files.example.com/data')).toBe(
    'ftp://files.example.com/data',
  );
});
