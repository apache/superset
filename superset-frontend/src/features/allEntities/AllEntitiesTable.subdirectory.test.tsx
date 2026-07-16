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

// The tag list page renders the `url` the backend puts on each tagged object.
// Those are router-relative paths (`Dashboard.url`, `Slice.url`,
// `SavedQuery.url`) that never carry SUPERSET_APP_ROOT, so the component must
// prefix them itself or the links 404 under a subdirectory deployment.
//
// The component is imported statically, so re-importing getBootstrapData with
// different bootstrap data can't change what the already-bound module graph
// sees. Mock the module instead and flip applicationRoot() per scenario. The
// name must start with `mock` for Jest's hoisted factory to reference it.
const mockApplicationRoot = jest.fn<string, []>(() => '');

jest.mock('src/utils/getBootstrapData', () => {
  const actual = jest.requireActual<
    typeof import('src/utils/getBootstrapData')
  >('src/utils/getBootstrapData');
  return {
    __esModule: true,
    default: actual.default,
    applicationRoot: () => mockApplicationRoot(),
    staticAssetsPrefix: actual.staticAssetsPrefix,
  };
});

// eslint-disable-next-line import/first
import AllEntitiesTable from './AllEntitiesTable';

const BACKEND_URLS = {
  dashboard: '/superset/dashboard/5/',
  chart: '/explore/?slice_id=42',
  query: '/sqllab?savedQueryId=7',
};

const SAMPLE_OBJECTS: TaggedObjects = {
  dashboard: [
    {
      id: 5,
      type: 'dashboard',
      name: 'Sales',
      url: BACKEND_URLS.dashboard,
      changed_on: '2026-06-01T00:00:00Z',
      created_by: 1,
      creator: 'admin',
      owners: [],
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
      owners: [],
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
      owners: [],
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
    { useRedux: true, useRouter: true, useTheme: true },
  );
  // eslint-disable-next-line testing-library/no-node-access
  return Array.from(container.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map(a => a.getAttribute('href') ?? '')
    .filter(href => href !== '' && href !== '#');
};

beforeEach(() => {
  mockApplicationRoot.mockReset();
});

test('row hrefs carry the application root under a subdirectory deployment', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  const hrefs = renderAndCollectHrefs();

  // Every href is the app root followed by the backend's router-relative path.
  // The dashboard route is itself /superset/dashboard/<id>/, so the repeated
  // segment is correct — it matches what `<Link to={url}>` renders elsewhere
  // via the router's basename.
  expect(hrefs).toEqual(
    expect.arrayContaining([
      `/superset${BACKEND_URLS.dashboard}`,
      `/superset${BACKEND_URLS.chart}`,
      `/superset${BACKEND_URLS.query}`,
    ]),
  );
  hrefs.forEach(href => {
    expect(href.startsWith('/superset')).toBe(true);
  });
});

test('row hrefs carry the application root for a non-colliding root', () => {
  mockApplicationRoot.mockReturnValue('/analytics');
  const hrefs = renderAndCollectHrefs();

  expect(hrefs).toEqual(
    expect.arrayContaining([
      `/analytics${BACKEND_URLS.dashboard}`,
      `/analytics${BACKEND_URLS.chart}`,
      `/analytics${BACKEND_URLS.query}`,
    ]),
  );
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
    expect(href).not.toMatch(/^\/\//);
  });
});
