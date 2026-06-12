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
import type { JsonObject } from '@superset-ui/core';
import type { HydrateChartData } from 'src/dashboard/actions/hydrate';
import { CHART_TYPE, MARKDOWN_TYPE } from 'src/dashboard/util/componentTypes';
import { resolveSnapshotCharts } from './useDashboardVersionPreview';

const liveChart = (sliceId: number, name: string): HydrateChartData => ({
  slice_id: sliceId,
  slice_url: `/explore/?slice_id=${sliceId}`,
  slice_name: name,
  form_data: { slice_id: sliceId, viz_type: 'table' },
  description: '',
  description_markeddown: '',
  owners: [],
  modified: '',
  changed_on: '2025-12-05T17:18:00',
});

const chartSlot = (key: string, chartId: number): JsonObject => ({
  [key]: {
    type: CHART_TYPE,
    id: key,
    children: [],
    meta: { chartId, uuid: `uuid-${chartId}`, width: 4, height: 50 },
  },
});

afterEach(() => {
  fetchMock.removeRoutes();
  fetchMock.clearHistory();
});

test('resolveSnapshotCharts passes no charts when the snapshot has no layout', async () => {
  const result = await resolveSnapshotCharts([liveChart(1, 'Live')], null);
  expect(result).toEqual({ charts: [], positionData: null });
});

test('resolveSnapshotCharts keeps only charts the snapshot layout references', async () => {
  const layout = { ...chartSlot('CHART-a', 1) };
  const inSnapshot = liveChart(1, 'In snapshot');
  const addedLater = liveChart(2, 'Added after snapshot');

  const { charts, positionData } = await resolveSnapshotCharts(
    [inSnapshot, addedLater],
    layout,
  );

  // Charts added to the dashboard after the snapshot must be dropped,
  // otherwise hydrate appends them to the previewed layout as new rows.
  expect(charts).toEqual([inSnapshot]);
  expect(positionData).toBe(layout);
});

test('resolveSnapshotCharts fetches charts removed from the dashboard since the snapshot', async () => {
  fetchMock.get('glob:*/api/v1/explore/?slice_id=9', {
    result: {
      slice: { slice_name: 'Removed chart', description: 'desc' },
      form_data: { viz_type: 'big_number' },
    },
  });
  const layout = { ...chartSlot('CHART-a', 1), ...chartSlot('CHART-b', 9) };

  const { charts, positionData } = await resolveSnapshotCharts(
    [liveChart(1, 'Live')],
    layout,
  );

  expect(charts).toHaveLength(2);
  const fetched = charts.find(chart => chart.slice_id === 9);
  expect(fetched).toMatchObject({
    slice_id: 9,
    slice_name: 'Removed chart',
    form_data: { viz_type: 'big_number', slice_id: 9 },
  });
  expect(positionData).toBe(layout);
});

test('resolveSnapshotCharts swaps unreachable charts for a markdown placeholder', async () => {
  fetchMock.get('glob:*/api/v1/explore/?slice_id=9', 404);
  const layout = { ...chartSlot('CHART-a', 1), ...chartSlot('CHART-b', 9) };

  const { charts, positionData } = await resolveSnapshotCharts(
    [liveChart(1, 'Live')],
    layout,
  );

  expect(charts.map(chart => chart.slice_id)).toEqual([1]);
  expect((positionData as JsonObject)['CHART-a'].type).toBe(CHART_TYPE);
  const placeholder = (positionData as JsonObject)['CHART-b'];
  expect(placeholder.type).toBe(MARKDOWN_TYPE);
  expect(placeholder.meta).toEqual({
    width: 4,
    height: 50,
    code: 'This chart no longer exists.',
  });
});
