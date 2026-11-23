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
import { GenericDataType } from '@apache-superset/core/common';
import {
  fetchPlacementData,
  fetchWidgetData,
  runtimeFilters,
  withTemporalValues,
} from './chartData';

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
    coltypes: {},
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

test('temporal columns read as dates, and nothing else changes', () => {
  expect(
    withTemporalValues(
      [
        { ds: Date.UTC(2024, 0, 31), at: Date.UTC(2024, 0, 31, 9, 30), n: 5 },
        { ds: null, at: Date.UTC(2024, 1, 1), n: 6 },
      ],
      {
        ds: GenericDataType.Temporal,
        at: GenericDataType.Temporal,
        n: GenericDataType.Numeric,
      },
    ),
  ).toEqual([
    { ds: '2024-01-31', at: '2024-01-31 09:30:00', n: 5 },
    { ds: null, at: '2024-02-01', n: 6 },
  ]);
});

test("reads a saved widget's own data route, without a canvas", async () => {
  const endpoint =
    'glob:*/api/v1/widget/00000000-0000-4000-8000-0000000000aa/data';
  fetchMock.post(endpoint, {
    result: {
      datasets: [
        {
          name: 'main',
          inline_data: [{ revenue: 5, day: 1704067200000 }],
          coltypes: {
            revenue: GenericDataType.Numeric,
            day: GenericDataType.Temporal,
          },
          query: 'SELECT 5',
        },
      ],
    },
  });

  const data = await fetchWidgetData({
    widgetId: '00000000-0000-4000-8000-0000000000aa',
    filters: [{ datasetId: 13, column: 'country', values: ['USA'] }],
  });

  // Read as the placement route's answer is, temporal columns as dates.
  expect(data).toEqual({
    rows: [{ revenue: 5, day: '2024-01-01' }],
    coltypes: {
      revenue: GenericDataType.Numeric,
      day: GenericDataType.Temporal,
    },
    query: 'SELECT 5',
    language: undefined,
  });
  const call = fetchMock.callHistory.lastCall(endpoint);
  expect(
    new Headers(call?.options.headers as HeadersInit).get('X-Canvas-Draft'),
  ).toBeNull();
  expect(JSON.parse(call?.options.body as string)).toEqual({
    runtime_filters: [{ datasetId: 13, column: 'country', values: ['USA'] }],
  });
  fetchMock.removeRoutes();
});
