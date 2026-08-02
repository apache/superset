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
import { buildPageContext } from './usePage';

function setUrl(path: string) {
  window.history.pushState({}, '', path);
}

test('parses the id-or-slug from the SPA dashboard route', () => {
  setUrl('/dashboard/world_health/?native_filters_key=1U81xfDPb04M');
  expect(buildPageContext('dashboard')).toEqual({
    page: 'dashboard',
    resource: { kind: 'dashboard', id_or_slug: 'world_health' },
  });
});

test('parses the id from the legacy dashboard route', () => {
  setUrl('/superset/dashboard/5/');
  expect(buildPageContext('dashboard')).toEqual({
    page: 'dashboard',
    resource: { kind: 'dashboard', id_or_slug: '5' },
  });
});

test('omits the resource when the dashboard path does not match', () => {
  setUrl('/unexpected/route/');
  expect(buildPageContext('dashboard')).toEqual({ page: 'dashboard' });
});

test('parses slice_id on the explore page as a chart resource', () => {
  setUrl('/explore/?slice_id=123&form_data_key=abc');
  expect(buildPageContext('explore')).toEqual({
    page: 'explore',
    resource: { kind: 'chart', id_or_slug: '123' },
  });
});

test('ignores a non-numeric slice_id', () => {
  setUrl('/explore/?slice_id=abc');
  expect(buildPageContext('explore')).toEqual({ page: 'explore' });
});

test('sends no resource for pages without an active entity', () => {
  setUrl('/dashboard/world_health/');
  expect(buildPageContext('home')).toEqual({ page: 'home' });
});

test('page context carries the resolved resource name once available', async () => {
  const { clearResourceNameCache, fetchResourceName } =
    await import('../api/resourceName');
  clearResourceNameCache();
  setUrl('/dashboard/world_health/');

  // Before resolution: the id alone, so a turn sent immediately still works.
  expect(buildPageContext('dashboard').resource).toEqual({
    kind: 'dashboard',
    id_or_slug: 'world_health',
  });

  Object.defineProperty(globalThis, 'fetch', {
    writable: true,
    configurable: true,
    value: jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ result: { dashboard_title: "World Bank's Data" } }),
    })),
  });
  await fetchResourceName({ kind: 'dashboard', id_or_slug: 'world_health' });

  expect(buildPageContext('dashboard').resource).toEqual({
    kind: 'dashboard',
    id_or_slug: 'world_health',
    name: "World Bank's Data",
  });
});

test('an unresolvable name leaves the context unchanged', async () => {
  const { clearResourceNameCache, fetchResourceName } =
    await import('../api/resourceName');
  clearResourceNameCache();
  setUrl('/dashboard/secret/');
  Object.defineProperty(globalThis, 'fetch', {
    writable: true,
    configurable: true,
    value: jest.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
    })),
  });

  await fetchResourceName({ kind: 'dashboard', id_or_slug: 'secret' });
  expect(buildPageContext('dashboard').resource).toEqual({
    kind: 'dashboard',
    id_or_slug: 'secret',
  });
});

test('sibling dashboard routes are not mistaken for a dashboard slug', () => {
  setUrl('/dashboard/list/');
  expect(buildPageContext('dashboard')).toEqual({ page: 'dashboard' });
  setUrl('/dashboard/new/');
  expect(buildPageContext('dashboard')).toEqual({ page: 'dashboard' });
});
