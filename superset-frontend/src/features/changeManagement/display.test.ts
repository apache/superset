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
import {
  afterRemovalPath,
  assetUrl,
  changeCount,
  datasetChangeCount,
  show,
  totalChangeCount,
} from './display';
import type { ChangeRequest, DatasetDetail } from './types';

const mockApplicationRoot = jest.fn<string, []>(() => '');

// `assetUrl` reads the app root through `ensureAppRoot`, which resolves it
// per call, so mocking the reader is enough. `jest.mock` is hoisted above
// the imports, so it still applies despite sitting below them.
jest.mock('src/utils/getBootstrapData', () => {
  const actual = jest.requireActual<
    typeof import('src/utils/getBootstrapData')
  >('src/utils/getBootstrapData');
  return {
    __esModule: true,
    ...actual,
    applicationRoot: () => mockApplicationRoot(),
  };
});

const request = (over: Partial<ChangeRequest> = {}): ChangeRequest =>
  ({
    id: 1,
    asset_type: 'dataset',
    asset_id: 7,
    asset_title: 'cleaned_sales_data',
    status: 'draft',
    is_open: true,
    note: null,
    review_note: null,
    operation: 'update',
    changes: [],
    ...over,
  }) as ChangeRequest;

const renamedMetric: DatasetDetail = {
  impact: { charts: 33, dashboards: 2 },
  sql: { before: null, after: null },
  metrics: {
    added: [],
    removed: [],
    changed: [
      {
        name: 'count',
        fields: [
          { field: 'verbose_name', before: 'COUNT(*)', after: 'Order count' },
        ],
      },
    ],
  },
};

test('a dataset definition change is counted', () => {
  // The panel listed this renamed metric and then said "0 changes ·
  // Nothing differs from the live version" underneath it, because the
  // count read only `changes`, which a dataset request leaves empty.
  expect(datasetChangeCount(renamedMetric)).toBe(1);
  expect(changeCount(request({ dataset_detail: renamedMetric }))).toBe(
    '1 change',
  );
});

test('SQL that did not move is not counted as a change', () => {
  expect(datasetChangeCount(renamedMetric)).toBe(1);
  expect(
    datasetChangeCount({
      ...renamedMetric,
      sql: { before: 'select 1', after: 'select 2' },
    }),
  ).toBe(2);
});

test('a request with nothing in it still reads as zero', () => {
  expect(changeCount(request())).toBe('0 changes');
  expect(datasetChangeCount(undefined)).toBe(0);
  expect(datasetChangeCount(null)).toBe(0);
});

test('every asset type resolves to one live URL', () => {
  expect(assetUrl(request({ asset_type: 'dashboard', asset_id: 3 }))).toBe(
    '/superset/dashboard/3/',
  );
  expect(assetUrl(request({ asset_type: 'chart', asset_id: 9 }))).toBe(
    '/explore/?slice_id=9',
  );
  expect(assetUrl(request({ asset_type: 'dataset' }))).toBe(
    '/tablemodelview/list/',
  );
});

describe('assetUrl under a subdirectory deployment', () => {
  afterEach(() => mockApplicationRoot.mockReturnValue(''));

  // These are real `href`s, not router pushes, so nothing adds the root for
  // them. A bare path resolves against the wrong place under a subdirectory,
  // and inside the host app's iframe it leaves the host entirely (QA-22).
  test('a dashboard link carries the application root', () => {
    mockApplicationRoot.mockReturnValue('/analytics');

    expect(assetUrl(request({ asset_type: 'dashboard', asset_id: 3 }))).toBe(
      '/analytics/superset/dashboard/3/',
    );
  });

  test('a chart link carries it, query string intact', () => {
    mockApplicationRoot.mockReturnValue('/analytics');

    expect(assetUrl(request({ asset_type: 'chart', asset_id: 9 }))).toBe(
      '/analytics/explore/?slice_id=9',
    );
  });

  test('the dataset list carries it too', () => {
    mockApplicationRoot.mockReturnValue('/analytics');

    expect(assetUrl(request({ asset_type: 'dataset' }))).toBe(
      '/analytics/tablemodelview/list/',
    );
  });

  test('nothing is added when Superset serves from the domain root', () => {
    expect(assetUrl(request({ asset_type: 'dashboard', asset_id: 3 }))).toBe(
      '/superset/dashboard/3/',
    );
  });
});

describe('where an approved delete leaves the reviewer', () => {
  afterEach(() => mockApplicationRoot.mockReturnValue(''));

  // Approving a delete from the asset's own page left the reviewer standing
  // on the removed asset's page, which renders "Missing dataset. The dataset
  // linked to this chart may have been deleted": the wrong noun, and nothing
  // to act on. The queue outlives any asset (D-14).
  test('the landing place is the Approvals queue', () => {
    expect(afterRemovalPath()).toBe('/approvals/');
  });

  test('it is never the page of the asset that has just gone', () => {
    const chart = request({ asset_type: 'chart', asset_id: 9 });
    const dashboard = request({ asset_type: 'dashboard', asset_id: 3 });

    expect(afterRemovalPath()).not.toBe(assetUrl(chart));
    expect(afterRemovalPath()).not.toBe(assetUrl(dashboard));
  });

  // Unlike `assetUrl`, this is pushed onto the router rather than used as an
  // `href`, and the router carries the application root as its basename, so a
  // root added here would be a second copy of it.
  test('the application root is left to the router', () => {
    mockApplicationRoot.mockReturnValue('/analytics');

    expect(afterRemovalPath()).toBe('/approvals/');
  });
});

test('nothing and the empty string both read as a dash', () => {
  // C21. `String(value ?? '—')` passes '' through, so a field cleared to
  // nothing drew a blank where its new value belongs.
  expect(show(null)).toBe('—');
  expect(show(undefined)).toBe('—');
  expect(show('')).toBe('—');
});

test('a value that is there is shown as it is, falsy or not', () => {
  expect(show(0)).toBe('0');
  expect(show(false)).toBe('false');
  expect(show('Revenue')).toBe('Revenue');
});

// ---- the count has to agree with the list underneath it --------------------

const datasetRequest = (over: Partial<ChangeRequest> = {}): ChangeRequest =>
  ({
    id: 1,
    asset_type: 'dataset',
    asset_id: 42,
    status: 'pending',
    operation: 'update',
    changes: [],
    ...over,
  }) as unknown as ChangeRequest;

test('a dataset request is counted once, not twice', () => {
  // The server sends BOTH shapes for a dataset save: top-level entries for
  // the fields that moved, and a definition diff describing the same edits.
  // Added together they made the approve dialog promise "these 10 changes"
  // over a dialog listing five -- at the irreversible step.
  const request = datasetRequest({
    changes: [
      { field: 'sql' },
      { field: 'columns' },
      { field: 'metrics' },
      { field: 'table_name' },
      { field: 'cache_timeout' },
    ],
    dataset_detail: {
      sql: { before: 'SELECT 1', after: 'SELECT 2' },
      columns: { added: [], changed: [{ name: 'beta', fields: [] }], removed: [] },
      metrics: { added: [], changed: [{ name: 'total', fields: [] }], removed: [] },
      settings: [{ field: 'cache_timeout' }, { field: 'table_name' }],
    },
  } as unknown as Partial<ChangeRequest>);

  // sql 1 + columns 1 + metrics 1 + settings 2
  expect(datasetChangeCount(request.dataset_detail)).toBe(5);
  expect(totalChangeCount(request)).toBe(5);
});

test('and the definition diff is what it counts, because that is what is rendered', () => {
  // `DatasetReviewModal` renders these rows and its tab badges count them,
  // so this is the number the reader can check against the screen.
  const request = datasetRequest({
    changes: [{ field: 'metrics' }, { field: 'sql' }],
    dataset_detail: {
      metrics: { added: [], changed: [{ name: 'total', fields: [] }], removed: [] },
    },
  } as unknown as Partial<ChangeRequest>);

  expect(totalChangeCount(request)).toBe(1);
});

test('a chart or dashboard request still counts its own entries', () => {
  const request = {
    id: 2,
    asset_type: 'chart',
    asset_id: 7,
    status: 'pending',
    operation: 'update',
    changes: [{ field: 'slice_name' }, { field: 'params' }],
  } as unknown as ChangeRequest;

  expect(totalChangeCount(request)).toBe(2);
});

test('an unreadable entry is shown in place of a change, not counted as one', () => {
  const request = {
    id: 3,
    asset_type: 'chart',
    asset_id: 7,
    status: 'pending',
    operation: 'update',
    changes: [{ field: 'slice_name' }, { field: 'params', unreadable: true }],
  } as unknown as ChangeRequest;

  expect(totalChangeCount(request)).toBe(1);
});

test('a dataset request with no definition diff falls back to its entries', () => {
  // An older server, or a delete, where the detail is absent. Counting zero
  // here would read as "nothing differs" on a request that plainly does.
  const request = datasetRequest({ changes: [{ field: 'table_name' }] });

  expect(totalChangeCount(request)).toBe(1);
});
