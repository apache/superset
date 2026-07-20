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
import { render } from 'spec/helpers/testing-library';
import type { TaggedObjects } from 'src/types/TaggedObject';
import AllEntitiesTable from './AllEntitiesTable';

// Regression for the tag list page (sc-108439): backend `.url` properties on
// Dashboard / Slice / SavedQuery are router-relative by contract
// (see `superset/models/dashboard.py` `dashboard_link` docstring: "`Dashboard.url`
// itself stays router-relative so frontend callers can apply ensureAppRoot
// exactly once"). The TagDAO emits those router-relative paths verbatim as
// `o.url` on tagged-object responses. AllEntitiesTable therefore must wrap
// `o.url` with `ensureAppRoot` exactly once; otherwise the row hrefs lack
// the `SUPERSET_APP_ROOT` prefix and clicks land on broken links.
//
// Mocking note (same as SliceHeaderControls.subdirectory.test.tsx): the
// component is imported statically, so the `withApplicationRoot` fixture's
// `jest.resetModules()` + dynamic re-import pattern can't retroactively
// change which `getBootstrapData` instance the already-bound module graph
// sees. We mock `src/utils/getBootstrapData` directly with a reconfigurable
// `mockApplicationRoot` factory and flip it per scenario.
//
// Name must start with `mock` so Jest's hoisted jest.mock() factory may
// reference it. `default` returns a STATIC shape (not mockApplicationRoot)
// because consumers like the reducer chain call getBootstrapData() at
// import time — calling mockApplicationRoot inside `default` hits TDZ.

const mockApplicationRoot = jest.fn<string, []>(() => '');

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: () => ({
    common: { application_root: '', static_assets_prefix: '' },
  }),
  applicationRoot: () => mockApplicationRoot(),
  staticAssetsPrefix: () => '',
}));

const BACKEND_URLS = {
  dashboard: '/dashboard/sales/',
  chart: '/explore/?slice_id=42',
  query: '/sqllab?savedQueryId=7',
};

const SAMPLE_OBJECTS: TaggedObjects = {
  dashboard: [
    {
      id: 1,
      type: 'dashboard',
      name: 'Sales',
      url: BACKEND_URLS.dashboard,
      changed_on: '2026-06-01T00:00:00Z',
      created_by: 1,
      creator: 'admin',
      editors: [],
      tags: [],
    },
  ],
  chart: [
    {
      id: 42,
      type: 'chart',
      name: 'Top Customers',
      url: BACKEND_URLS.chart,
      changed_on: '2026-06-01T00:00:00Z',
      created_by: 1,
      creator: 'admin',
      editors: [],
      tags: [],
    },
  ],
  query: [
    {
      id: 7,
      type: 'query',
      name: 'Daily Revenue',
      url: BACKEND_URLS.query,
      changed_on: '2026-06-01T00:00:00Z',
      created_by: 1,
      creator: 'admin',
      editors: [],
      tags: [],
    },
  ],
};

const renderAndCollectHrefs = (): string[] => {
  const { container } = render(
    <AllEntitiesTable
      objects={SAMPLE_OBJECTS}
      setShowTagModal={() => {}}
      canEditTag
    />,
    { useRedux: true, useTheme: true },
  );
  return Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map(a => a.getAttribute('href') ?? '')
    .filter(href => href !== '' && href !== '#');
};

beforeEach(() => {
  mockApplicationRoot.mockReset();
});

test('row hrefs carry the application root under /superset', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  const hrefs = renderAndCollectHrefs();

  expect(hrefs).toEqual(
    expect.arrayContaining([
      `/superset${BACKEND_URLS.dashboard}`,
      `/superset${BACKEND_URLS.chart}`,
      `/superset${BACKEND_URLS.query}`,
    ]),
  );
  hrefs.forEach(href => {
    expect(href).not.toMatch(/^\/superset\/superset\//);
    expect(href.startsWith('/superset')).toBe(true);
  });
});

test('row hrefs are unchanged under the default root-of-domain deployment', () => {
  mockApplicationRoot.mockReturnValue('');
  const hrefs = renderAndCollectHrefs();

  expect(hrefs).toEqual(
    expect.arrayContaining([
      BACKEND_URLS.dashboard,
      BACKEND_URLS.chart,
      BACKEND_URLS.query,
    ]),
  );
  hrefs.forEach(href => {
    expect(href).not.toMatch(/^\/superset/);
  });
});
