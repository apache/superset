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
import { fetchPlacementData, runtimeFilters } from './chartData';

test('sends the select filter values that have a selection', () => {
  expect(
    runtimeFilters([
      {
        value: { datasetId: 13, column: 'country', values: ['USA', 'France'] },
      },
      { value: { datasetId: 7, column: 'deal_size', values: [] } },
      { value: null },
      { value: 'not a select filter' },
    ]),
  ).toEqual([{ datasetId: 13, column: 'country', values: ['USA', 'France'] }]);
});

test('reads the placement data route, with the draft token in a header', async () => {
  const endpoint = 'glob:*/api/v1/canvas/7/placement/revenue%2F1/data';
  fetchMock.post(endpoint, {
    result: {
      datasets: [
        {
          name: 'main',
          row_count: 1,
          inline_data: [{ revenue: 3 }],
          query: 'SELECT 1',
          language: 'sql',
        },
      ],
    },
  });

  const data = await fetchPlacementData({
    canvasId: 7,
    placementId: 'revenue/1',
    draftToken: 'abc',
    filters: [{ datasetId: 13, column: 'country', values: ['USA'] }],
  });

  expect(data).toEqual({
    rows: [{ revenue: 3 }],
    query: 'SELECT 1',
    language: 'sql',
  });
  const call = fetchMock.callHistory.lastCall(endpoint);
  expect(
    new Headers(call?.options.headers as HeadersInit).get('X-Canvas-Draft'),
  ).toBe('abc');
  expect(JSON.parse(call?.options.body as string)).toEqual({
    runtime_filters: [{ datasetId: 13, column: 'country', values: ['USA'] }],
  });
  fetchMock.removeRoutes();
});
