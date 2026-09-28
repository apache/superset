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
import { logging } from '@apache-superset/core/utils';
import {
  updateFilterKey,
  createFilterKey,
  getFilterValue,
  getPermalinkValue,
} from './keyValue';

jest.mock('@apache-superset/core/utils', () => ({
  logging: { error: jest.fn() },
}));

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  jest.clearAllMocks();
});

test('updateFilterKey PUTs the value to the dashboard filter_state key endpoint and resolves the message', async () => {
  fetchMock.put(
    'glob:*/api/v1/dashboard/7/filter_state/existing-key',
    { message: 'Value updated' },
    { name: 'update-filter-key' },
  );

  const result = await updateFilterKey('7', '{"a":1}', 'existing-key');

  const calls = fetchMock.callHistory.calls('update-filter-key');
  expect(calls).toHaveLength(1);
  expect(calls[0].options?.method).toBe('put');
  expect(JSON.parse(calls[0].options?.body as string)).toEqual({
    value: '{"a":1}',
  });
  expect(result).toBe('Value updated');
});

test('updateFilterKey appends the tab id as a query param', async () => {
  fetchMock.put(
    'glob:*/api/v1/dashboard/7/filter_state/existing-key?tab_id=tab-1',
    { message: 'Value updated' },
    { name: 'update-filter-key-tab' },
  );

  await updateFilterKey('7', '{"a":1}', 'existing-key', 'tab-1');

  expect(fetchMock.callHistory.calls('update-filter-key-tab')).toHaveLength(1);
});

test('updateFilterKey logs and resolves null when the request fails', async () => {
  fetchMock.put('glob:*/api/v1/dashboard/7/filter_state/existing-key', 500);

  const result = await updateFilterKey('7', '{"a":1}', 'existing-key');

  expect(result).toBeNull();
  expect(logging.error).toHaveBeenCalled();
});

test('createFilterKey POSTs the value to the dashboard filter_state endpoint and resolves the new key', async () => {
  fetchMock.post(
    'glob:*/api/v1/dashboard/7/filter_state',
    { key: 'brand-new-key' },
    { name: 'create-filter-key' },
  );

  const result = await createFilterKey(7, '{"a":1}');

  const calls = fetchMock.callHistory.calls('create-filter-key');
  expect(calls).toHaveLength(1);
  expect(calls[0].options?.method).toBe('post');
  expect(JSON.parse(calls[0].options?.body as string)).toEqual({
    value: '{"a":1}',
  });
  expect(result).toBe('brand-new-key');
});

test('createFilterKey logs and resolves null when the request fails', async () => {
  fetchMock.post('glob:*/api/v1/dashboard/7/filter_state', 500);

  const result = await createFilterKey(7, '{"a":1}');

  expect(result).toBeNull();
  expect(logging.error).toHaveBeenCalled();
});

test('getFilterValue GETs the keyed filter_state and parses the stringified value', async () => {
  fetchMock.get(
    'glob:*/api/v1/dashboard/7/filter_state/some-key',
    { value: '{"b":2}' },
    { name: 'get-filter-value' },
  );

  const result = await getFilterValue(7, 'some-key');

  expect(fetchMock.callHistory.calls('get-filter-value')).toHaveLength(1);
  expect(result).toEqual({ b: 2 });
});

test('getFilterValue logs and resolves null when the request fails', async () => {
  fetchMock.get('glob:*/api/v1/dashboard/7/filter_state/some-key', 404);

  const result = await getFilterValue(7, 'some-key');

  expect(result).toBeNull();
  expect(logging.error).toHaveBeenCalled();
});

test('getPermalinkValue GETs the dashboard permalink endpoint and resolves the parsed payload', async () => {
  const permalinkPayload = { dashboardId: '7', state: {} };
  fetchMock.get(
    'glob:*/api/v1/dashboard/permalink/perma-key',
    permalinkPayload,
    { name: 'get-permalink-value' },
  );

  const result = await getPermalinkValue('perma-key');

  expect(fetchMock.callHistory.calls('get-permalink-value')).toHaveLength(1);
  expect(result).toEqual(permalinkPayload);
});

test('getPermalinkValue logs and resolves null when the request fails', async () => {
  fetchMock.get('glob:*/api/v1/dashboard/permalink/perma-key', 500);

  const result = await getPermalinkValue('perma-key');

  expect(result).toBeNull();
  expect(logging.error).toHaveBeenCalled();
});
