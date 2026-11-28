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

import fetchMock from 'fetch-mock';
import {
  getChartPermalink,
  getDashboardPermalink,
  isUrlExternal,
  parseUrl,
  rewritePermalinkOrigin,
  toQueryString,
  getDashboardUrlParams,
  getUrlParam,
} from './urlUtils';
import { URL_PARAMS } from '../constants';
import { getActiveFilters } from '../dashboard/util/activeDashboardFilters';

jest.mock('../dashboard/util/activeDashboardFilters', () => ({
  ...jest.requireActual('../dashboard/util/activeDashboardFilters'),
  getActiveFilters: jest.fn(() => ({})),
}));

const mockedGetActiveFilters = jest.mocked(getActiveFilters);

type ActiveFilters = ReturnType<typeof getActiveFilters>;

// BigInt is not a JsonValue, but json-bigint produces it for large integers.
const activeFiltersWithBigInt = (value: bigint): ActiveFilters =>
  ({
    '42_region': { values: [value, 'north'], scope: [42] },
  }) as unknown as ActiveFilters;

test.each([0n, 9007199254740993n, -9007199254740993n])(
  'getDashboardPermalink preserves BigInt filter and chart state values: %s',
  async value => {
    const endpoint = 'http://localhost/api/v1/dashboard/26/permalink';
    const permalink = {
      key: 'test-key',
      url: 'http://localhost/superset/dashboard/p/test-key/',
    };
    const dataMask = {
      filter: {
        filterState: { value: [value], label: 'Selected ID' },
        extraFormData: {
          filters: [{ col: 'id', op: 'IN', val: [value] }],
        },
      },
    };
    fetchMock.post(endpoint, permalink, { name: endpoint });

    try {
      await expect(
        getDashboardPermalink({
          dashboardId: 26,
          dataMask,
          activeTabs: ['tab-1'],
          chartStates: { chart: { selectedValues: [value] } },
          includeChartState: true,
        }),
      ).resolves.toEqual(permalink);

      const calls = fetchMock.callHistory.calls(endpoint);
      expect(calls).toHaveLength(1);
      expect(JSON.parse(calls[0].options?.body as string)).toEqual({
        urlParams: [],
        dataMask: {
          filter: {
            filterState: { value: [value.toString()], label: 'Selected ID' },
            extraFormData: {
              filters: [{ col: 'id', op: 'IN', val: [value.toString()] }],
            },
          },
        },
        activeTabs: ['tab-1'],
        chartStates: { chart: { selectedValues: [value.toString()] } },
      });
      expect(dataMask.filter.filterState.value).toEqual([value]);
    } finally {
      fetchMock.removeRoute(endpoint);
      fetchMock.clearHistory();
    }
  },
);

test('getChartPermalink preserves BigInt values and ordinary JSON values', async () => {
  const endpoint = 'http://localhost/api/v1/explore/permalink';
  const permalink = {
    key: 'chart-key',
    url: 'http://localhost/explore/p/chart-key/',
  };
  const chartState = {
    values: [9007199254740993n, 42, 1.5, 'text', true, null],
  };
  fetchMock.post(endpoint, permalink, { name: endpoint });

  try {
    await expect(
      getChartPermalink({ datasource: '1__table' }, undefined, chartState),
    ).resolves.toEqual(permalink);

    const calls = fetchMock.callHistory.calls(endpoint);
    expect(calls).toHaveLength(1);
    expect(JSON.parse(calls[0].options?.body as string)).toEqual({
      formData: { datasource: '1__table' },
      urlParams: [],
      chartState: {
        values: ['9007199254740993', 42, 1.5, 'text', true, null],
      },
    });
  } finally {
    fetchMock.removeRoute(endpoint);
    fetchMock.clearHistory();
  }
});

test('getDashboardUrlParams preserves BigInt values in preselect_filters', () => {
  mockedGetActiveFilters.mockReturnValue(
    activeFiltersWithBigInt(9007199254740993n),
  );

  try {
    const urlParams = getDashboardUrlParams();
    const preselectFilters = urlParams.find(
      ([key]) => key === 'preselect_filters',
    );

    expect(preselectFilters).toBeDefined();
    expect(JSON.parse(preselectFilters?.[1] ?? 'null')).toEqual({
      '42': { region: ['9007199254740993', 'north'] },
    });
  } finally {
    mockedGetActiveFilters.mockReturnValue({});
  }
});

test('getChartPermalink preserves BigInt values in preselect_filters', async () => {
  const endpoint = 'http://localhost/api/v1/explore/permalink';
  const permalink = {
    key: 'chart-key',
    url: 'http://localhost/explore/p/chart-key/',
  };
  mockedGetActiveFilters.mockReturnValue(
    activeFiltersWithBigInt(-9007199254740993n),
  );
  fetchMock.post(endpoint, permalink, { name: endpoint });

  try {
    await expect(
      getChartPermalink({ datasource: '1__table' }),
    ).resolves.toEqual(permalink);

    const calls = fetchMock.callHistory.calls(endpoint);
    expect(calls).toHaveLength(1);
    const { urlParams } = JSON.parse(calls[0].options?.body as string);
    expect(urlParams).toEqual([
      [
        'preselect_filters',
        JSON.stringify({ '42': { region: ['-9007199254740993', 'north'] } }),
      ],
    ]);
  } finally {
    mockedGetActiveFilters.mockReturnValue({});
    fetchMock.removeRoute(endpoint);
    fetchMock.clearHistory();
  }
});

test('isUrlExternal', () => {
  expect(isUrlExternal('http://google.com')).toBeTruthy();
  expect(isUrlExternal('https://google.com')).toBeTruthy();
  expect(isUrlExternal('//google.com')).toBeTruthy();
  expect(isUrlExternal('google.com')).toBeTruthy();
  expect(isUrlExternal('www.google.com')).toBeTruthy();
  expect(isUrlExternal('mailto:mail@example.com')).toBeTruthy();

  // treat all urls starting with protocol or hostname as external
  // such urls are not handled well by react-router Link component
  expect(isUrlExternal('http://localhost:8888/port')).toBeTruthy();
  expect(isUrlExternal('https://localhost/secure')).toBeTruthy();
  expect(isUrlExternal('http://localhost/about')).toBeTruthy();
  expect(isUrlExternal('HTTP://localhost/about')).toBeTruthy();
  expect(isUrlExternal('//localhost/about')).toBeTruthy();
  expect(isUrlExternal('localhost/about')).toBeTruthy();

  expect(isUrlExternal('/about')).toBeFalsy();
  expect(isUrlExternal('#anchor')).toBeFalsy();
});

test('parseUrl', () => {
  expect(parseUrl('http://google.com')).toEqual('http://google.com');
  expect(parseUrl('//google.com')).toEqual('//google.com');
  expect(parseUrl('mailto:mail@example.com')).toEqual(
    'mailto:mail@example.com',
  );
  expect(parseUrl('google.com')).toEqual('//google.com');
  expect(parseUrl('www.google.com')).toEqual('//www.google.com');

  expect(parseUrl('/about')).toEqual('/about');
  expect(parseUrl('#anchor')).toEqual('#anchor');
});

// toQueryString
test('toQueryString should return an empty string if the input is an empty object', () => {
  expect(toQueryString({})).toBe('');
});

test('toQueryString should correctly convert a single key-value pair to a query string', () => {
  expect(toQueryString({ key: 'value' })).toBe('?key=value');
});

test('toQueryString should correctly convert multiple key-value pairs to a query string', () => {
  expect(toQueryString({ key1: 'value1', key2: 'value2' })).toBe(
    '?key1=value1&key2=value2',
  );
});

test('toQueryString should encode URI components', () => {
  expect(toQueryString({ 'a key': 'a value', email: 'test@example.com' })).toBe(
    '?a%20key=a%20value&email=test%40example.com',
  );
});

test('toQueryString should omit keys with undefined values', () => {
  expect(toQueryString({ key1: 'value1', key2: undefined })).toBe(
    '?key1=value1',
  );
});

test('toQueryString should omit keys with null values', () => {
  expect(toQueryString({ key1: 'value1', key2: null })).toBe('?key1=value1');
});

test('toQueryString should handle numbers and boolean values as parameter values', () => {
  expect(toQueryString({ number: 123, truth: true, lie: false })).toBe(
    '?number=123&truth=true&lie=false',
  );
});

test('toQueryString should handle special characters in keys and values', () => {
  expect(toQueryString({ 'user@domain': 'me&you' })).toBe(
    '?user%40domain=me%26you',
  );
});

test('getDashboardUrlParams should exclude edit parameter by default', () => {
  const locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?edit=true&standalone=false&expand_filters=1',
  } as Location);

  const urlParams = getDashboardUrlParams(['edit']);
  const paramNames = urlParams.map(([key]) => key);

  expect(paramNames).not.toContain('edit');
  expect(paramNames).toContain('standalone');
  expect(paramNames).toContain('expand_filters');

  locationSpy.mockRestore();
});

test('getDashboardUrlParams should exclude multiple parameters when provided', () => {
  const locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?edit=true&standalone=false&debug=true&test=value',
  } as Location);

  const urlParams = getDashboardUrlParams(['edit', 'debug']);
  const paramNames = urlParams.map(([key]) => key);

  expect(paramNames).not.toContain('edit');
  expect(paramNames).not.toContain('debug');
  expect(paramNames).toContain('standalone');
  expect(paramNames).toContain('test');

  locationSpy.mockRestore();
});

test.each([
  // Legacy form. Links, bookmarks and report URLs created before numeric
  // standalone modes existed carry `standalone=true`, and must keep resolving to
  // HideNav (1) rather than null, which callers would read as "not standalone".
  ['?standalone=true', 1],
  ['?standalone=TRUE', 1],
  ['?standalone=false', 0],
  // Canonical numeric modes.
  ['?standalone=0', 0],
  ['?standalone=1', 1],
  ['?standalone=2', 2],
  // Report/thumbnail captures (ChartStandaloneMode.REPORT).
  ['?standalone=3', 3],
  // Absent or unparseable yields null so callers can apply their own default.
  ['', null],
  ['?standalone=banana', null],
])(
  'getUrlParam coerces %s to %p for the numeric standalone param',
  (search, expected) => {
    expect(getUrlParam(URL_PARAMS.standalone, search)).toBe(expected);
  },
);

test('getUrlParam reads from window.location.search by default', () => {
  const locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '?dashboard_page_id=from-window',
  } as Location);

  expect(getUrlParam(URL_PARAMS.dashboardPageId)).toBe('from-window');

  locationSpy.mockRestore();
});

test('getUrlParam uses provided search string instead of window.location.search (Safari race condition fix)', () => {
  // Simulate Safari race condition: window.location.search is stale (empty),
  // but the correct search string is passed in from React Router's useLocation()
  const locationSpy = jest.spyOn(window, 'location', 'get').mockReturnValue({
    ...window.location,
    search: '',
  } as Location);

  // Without the search override, window.location.search is stale — returns null (the bug)
  expect(getUrlParam(URL_PARAMS.dashboardPageId)).toBeNull();

  // With the search override (the fix), returns the correct value
  expect(
    getUrlParam(URL_PARAMS.dashboardPageId, '?dashboard_page_id=correct-id'),
  ).toBe('correct-id');

  locationSpy.mockRestore();
});

const originalLocationForRewriteTests = window.location;

const setBrowsingOriginForRewriteTests = (origin: string) => {
  Object.defineProperty(window, 'location', {
    value: { ...originalLocationForRewriteTests, origin },
    writable: true,
    configurable: true,
  });
};

const restoreLocationForRewriteTests = () => {
  Object.defineProperty(window, 'location', {
    value: originalLocationForRewriteTests,
    writable: true,
    configurable: true,
  });
};

test('rewritePermalinkOrigin replaces backend host with browsing origin', () => {
  // Reproduces the docker-light share-embed bug: the backend returns the
  // internal container hostname; the iframe must use the browsing origin
  // instead.
  setBrowsingOriginForRewriteTests('http://localhost:9004');
  expect(
    rewritePermalinkOrigin(
      'http://superset-light:8088/superset/explore/p/abc/',
    ),
  ).toBe('http://localhost:9004/superset/explore/p/abc/');
  restoreLocationForRewriteTests();
});

test('rewritePermalinkOrigin preserves query string and hash', () => {
  setBrowsingOriginForRewriteTests('http://localhost:9004');
  expect(
    rewritePermalinkOrigin(
      'http://superset-light:8088/superset/explore/p/abc/?standalone=1&height=400#x',
    ),
  ).toBe(
    'http://localhost:9004/superset/explore/p/abc/?standalone=1&height=400#x',
  );
  restoreLocationForRewriteTests();
});

test('rewritePermalinkOrigin is a no-op when origins already match', () => {
  setBrowsingOriginForRewriteTests('https://superset.example.com');
  expect(
    rewritePermalinkOrigin(
      'https://superset.example.com/superset/dashboard/p/xyz/',
    ),
  ).toBe('https://superset.example.com/superset/dashboard/p/xyz/');
  restoreLocationForRewriteTests();
});

test('rewritePermalinkOrigin returns input unchanged when URL cannot be parsed', () => {
  setBrowsingOriginForRewriteTests('http://localhost:9004');
  expect(rewritePermalinkOrigin('not a url')).toBe('not a url');
  expect(rewritePermalinkOrigin('/relative/path')).toBe('/relative/path');
  restoreLocationForRewriteTests();
});

test('rewritePermalinkOrigin returns input unchanged when window.location.origin is missing', () => {
  // Some test setups stub window.location to a minimal shape with no
  // origin (e.g., ShareMenuItems tests). The rewrite must no-op rather
  // than producing "undefined/..." URLs.
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
  expect(
    rewritePermalinkOrigin('http://superset.com/superset/dashboard/p/x/'),
  ).toBe('http://superset.com/superset/dashboard/p/x/');
  restoreLocationForRewriteTests();
});

// M5 opt-OUT: when the Flask config `EMBEDDED_DISABLE_PERMALINK_ORIGIN_REWRITE`
// is True the frontend must hand back the backend-supplied URL untouched —
// proxied/subdir deployments stay on the default (rewrite enabled), but
// operators whose reverse proxy correctly forwards `X-Forwarded-Host` AND who
// want backend literal origins can opt out without touching the call sites.
// The `cachedBootstrapData` lives at module scope, so the fixture has to
// jest.resetModules() AFTER installing the `#app` data-bootstrap shape and
// dynamic-import `urlUtils` to pick up the new value.
async function withRewriteFlag<T>(
  flagValue: boolean,
  body: (
    rewriteFn: (typeof import('./urlUtils'))['rewritePermalinkOrigin'],
  ) => Promise<T> | T,
): Promise<T> {
  const previousBody = document.body.innerHTML;
  const bootstrapData = {
    common: {
      application_root: '',
      static_assets_prefix: '',
      conf: { EMBEDDED_DISABLE_PERMALINK_ORIGIN_REWRITE: flagValue },
    },
  };
  document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(
    bootstrapData,
  )}'></div>`;
  jest.resetModules();
  try {
    const fresh = await import('./urlUtils');
    return await body(fresh.rewritePermalinkOrigin);
  } finally {
    document.body.innerHTML = previousBody;
    jest.resetModules();
  }
}

test('rewritePermalinkOrigin is a no-op when EMBEDDED_DISABLE_PERMALINK_ORIGIN_REWRITE is true', async () => {
  setBrowsingOriginForRewriteTests('http://localhost:9004');
  await withRewriteFlag(true, rewrite => {
    expect(rewrite('http://superset-light:8088/superset/explore/p/abc/')).toBe(
      'http://superset-light:8088/superset/explore/p/abc/',
    );
  });
  restoreLocationForRewriteTests();
});

test('rewritePermalinkOrigin still rewrites when EMBEDDED_DISABLE_PERMALINK_ORIGIN_REWRITE is false (default)', async () => {
  setBrowsingOriginForRewriteTests('http://localhost:9004');
  await withRewriteFlag(false, rewrite => {
    expect(rewrite('http://superset-light:8088/superset/explore/p/abc/')).toBe(
      'http://localhost:9004/superset/explore/p/abc/',
    );
  });
  restoreLocationForRewriteTests();
});
