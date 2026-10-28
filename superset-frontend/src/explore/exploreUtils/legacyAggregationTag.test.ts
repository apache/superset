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
import { LEGACY_AGGREGATION_TAG } from 'src/explore/constants';
import { removeLegacyAggregationTag } from './legacyAggregationTag';

const deleteEndpoint = `glob:*/api/v1/tag/2/42/${LEGACY_AGGREGATION_TAG}`;
const chartEndpoint = 'glob:*/api/v1/chart/42';

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
  jest.restoreAllMocks();
});

test('resolves true after a successful tag DELETE without touching the chart', async () => {
  fetchMock.delete(deleteEndpoint, {});
  fetchMock.get(chartEndpoint, 500);
  fetchMock.put(chartEndpoint, 500);

  await expect(removeLegacyAggregationTag(42)).resolves.toBe(true);

  expect(fetchMock.callHistory.calls(deleteEndpoint)).toHaveLength(1);
  expect(fetchMock.callHistory.calls(chartEndpoint)).toHaveLength(0);
});

test('treats a 422 (chart was never tagged) as nothing left to remove', async () => {
  // The tag DELETE route maps `TaggedObjectNotFoundError` to a 422.
  fetchMock.delete(deleteEndpoint, {
    status: 422,
    body: { message: 'Tag could not be removed' },
  });
  fetchMock.get(chartEndpoint, 500);

  await expect(removeLegacyAggregationTag(42)).resolves.toBe(true);

  expect(fetchMock.callHistory.calls(chartEndpoint)).toHaveLength(0);
});

test('treats a 404 as nothing left to remove', async () => {
  fetchMock.delete(deleteEndpoint, {
    status: 404,
    body: { message: 'Not found' },
  });
  fetchMock.get(chartEndpoint, 500);

  await expect(removeLegacyAggregationTag(42)).resolves.toBe(true);

  expect(fetchMock.callHistory.calls(chartEndpoint)).toHaveLength(0);
});

test('falls back to the chart tag list when the tag route is forbidden', async () => {
  // A role with `can_write` on Chart (plus `can_tag`) but not on Tag.
  fetchMock.delete(deleteEndpoint, {
    status: 403,
    body: { message: 'Forbidden' },
  });
  fetchMock.get(chartEndpoint, {
    result: {
      tags: [
        { id: 3, name: 'keep-me', type: 1 },
        { id: 7, name: LEGACY_AGGREGATION_TAG, type: 1 },
        // Owner-type tags aren't part of the editable custom list.
        { id: 9, name: 'owner:1', type: 3 },
      ],
    },
  });
  fetchMock.put(chartEndpoint, { result: {} });

  await expect(removeLegacyAggregationTag(42)).resolves.toBe(true);

  const [putCall] = fetchMock.callHistory.calls(chartEndpoint, {
    method: 'PUT',
  });
  expect(JSON.parse(putCall.options.body as string)).toEqual({ tags: [3] });
});

test('skips the chart PUT when the forbidden DELETE raced an earlier removal', async () => {
  fetchMock.delete(deleteEndpoint, {
    status: 403,
    body: { message: 'Forbidden' },
  });
  fetchMock.get(chartEndpoint, {
    result: { tags: [{ id: 3, name: 'keep-me', type: 1 }] },
  });
  fetchMock.put(chartEndpoint, 500);

  await expect(removeLegacyAggregationTag(42)).resolves.toBe(true);

  expect(
    fetchMock.callHistory.calls(chartEndpoint, { method: 'PUT' }),
  ).toHaveLength(0);
});

test('resolves false (never rejects) when neither route is permitted', async () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  fetchMock.delete(deleteEndpoint, {
    status: 403,
    body: { message: 'Forbidden' },
  });
  fetchMock.get(chartEndpoint, {
    result: { tags: [{ id: 7, name: LEGACY_AGGREGATION_TAG, type: 1 }] },
  });
  fetchMock.put(chartEndpoint, { status: 403, body: { message: 'Forbidden' } });

  await expect(removeLegacyAggregationTag(42)).resolves.toBe(false);

  expect(warn).toHaveBeenCalledTimes(1);
});

test('resolves false on an unexpected tag DELETE failure without a fallback', async () => {
  const warn = jest.spyOn(logging, 'warn').mockImplementation(() => {});
  fetchMock.delete(deleteEndpoint, 500);
  fetchMock.get(chartEndpoint, 500);

  await expect(removeLegacyAggregationTag(42)).resolves.toBe(false);

  expect(fetchMock.callHistory.calls(chartEndpoint)).toHaveLength(0);
  expect(warn).toHaveBeenCalledTimes(1);
});
