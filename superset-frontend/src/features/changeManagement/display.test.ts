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
import { assetUrl, changeCount, datasetChangeCount } from './display';
import type { ChangeRequest, DatasetDetail } from './types';

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
