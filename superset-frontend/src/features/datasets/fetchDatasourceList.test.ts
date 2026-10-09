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
import { isFeatureEnabled } from '@superset-ui/core';
import { fetchDatasourceList } from './fetchDatasourceList';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(() => false),
}));

const mockIsFeatureEnabled = jest.mocked(isFeatureEnabled);

const emptyPage = { result: [], count: 0 };

beforeEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  fetchMock.get('glob:*/api/v1/dataset/*', emptyPage);
  fetchMock.get('glob:*/api/v1/datasource/*', emptyPage);
  mockIsFeatureEnabled.mockReturnValue(false);
});

const requestedUrls = () =>
  fetchMock.callHistory.calls().map(call => decodeURIComponent(call.url));

test('uses the combined endpoint when the flag is on and the dataset endpoint when off', async () => {
  mockIsFeatureEnabled.mockReturnValue(true);
  await fetchDatasourceList('orders', 0, 25);
  mockIsFeatureEnabled.mockReturnValue(false);
  await fetchDatasourceList('orders', 0, 25);

  const urls = requestedUrls();
  expect(urls[0]).toContain('/api/v1/datasource/');
  expect(urls[1]).toContain('/api/v1/dataset/');
});

test('exactMatch with datasetsOnly stays on the dataset endpoint with an eq filter', async () => {
  mockIsFeatureEnabled.mockReturnValue(true);
  await fetchDatasourceList('orders', 0, 1, {
    exactMatch: true,
    datasetsOnly: true,
  });

  const urls = requestedUrls();
  expect(urls[0]).toContain('/api/v1/dataset/');
  expect(urls[0]).toContain('opr:eq');
});

test('exactMatch without datasetsOnly is refused, not silently unfiltered', async () => {
  // The combined endpoint's filter parser honours only substring (ct) name
  // filters; an eq filter is dropped and the page comes back unfiltered.
  mockIsFeatureEnabled.mockReturnValue(true);
  expect(() =>
    // @ts-expect-error deliberately violating the option coupling
    fetchDatasourceList('orders', 0, 1, { exactMatch: true }),
  ).toThrow(/exactMatch requires datasetsOnly/);
  expect(requestedUrls()).toHaveLength(0);
});
