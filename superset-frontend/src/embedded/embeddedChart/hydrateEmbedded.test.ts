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
import { HYDRATE_DASHBOARD } from 'src/dashboard/actions/hydrate';
import dashboardLayout from 'src/dashboard/reducers/dashboardLayout';
import nativeFilters from 'src/dashboard/reducers/nativeFilters';
import dashboardStateReducer from 'src/dashboard/reducers/dashboardState';
import sliceEntities from 'src/dashboard/reducers/sliceEntities';
import { CommonBootstrapData } from 'src/types/bootstrapTypes';
import hydrateEmbedded, { EmbeddedChartData } from './hydrateEmbedded';

const SLICE_ID = 103;

const chartData = {
  slice: {
    slice_id: SLICE_ID,
    slice_url: `/explore/?slice_id=${SLICE_ID}`,
    slice_name: 'Preferred Employment Style',
    form_data: {
      viz_type: 'treemap_v2',
      datasource: '4__table',
      slice_id: SLICE_ID,
    },
    description: null,
    changed_on: '2026-01-01T00:00:00',
  },
  dataset: { uid: '4__table', id: 4 },
} as unknown as EmbeddedChartData;

const common = { locale: 'en' } as unknown as CommonBootstrapData;

const build = () => hydrateEmbedded(chartData, common);

test('dispatches HYDRATE_DASHBOARD rather than a parallel action', () => {
  expect(build().type).toEqual(HYDRATE_DASHBOARD);
});

test('keys the fabricated state by slice id', () => {
  const { data } = build();
  expect(Object.keys(data.charts)).toEqual([String(SLICE_ID)]);
  expect(data.sliceEntities.slices[SLICE_ID].slice_name).toEqual(
    'Preferred Employment Style',
  );
  expect(data.dataMask[SLICE_ID]).toBeDefined();
  expect(data.dashboardState.sliceIds).toEqual([SLICE_ID]);
});

test('keeps the actions that would navigate out of the iframe switched off', () => {
  const { dashboardInfo } = build().data;
  expect(dashboardInfo.superset_can_explore).toBe(false);
  expect(dashboardInfo.superset_can_share).toBe(false);
  expect(dashboardInfo.crossFiltersEnabled).toBe(false);
  // Chart.tsx reads this one, so downloads stay available.
  expect(dashboardInfo.superset_can_download).toBe(true);
});

/**
 * The regression this file exists for. `nativeFilters` and `dashboardLayout`
 * read `action.data.<slice>` with no optional chaining, so omitting either one
 * throws at runtime — and only in the embedded path, where a dashboard
 * developer would never see it. Run the real reducers against the real payload
 * rather than asserting on shape, so this keeps holding if they change.
 */
describe('every HYDRATE_DASHBOARD handler survives the fabricated payload', () => {
  const cases: [string, (state: any, action: any) => unknown][] = [
    ['dashboardLayout', dashboardLayout],
    ['nativeFilters', nativeFilters],
    ['dashboardState', dashboardStateReducer],
    ['sliceEntities', sliceEntities],
  ];

  test.each(cases)('%s', (_name, reducer) => {
    expect(() => reducer(undefined, build())).not.toThrow();
  });
});

test('carries a layout tree so the layout reducer has a root to hydrate', () => {
  const layout = build().data.dashboardLayout.present;
  expect(layout.ROOT_ID).toBeDefined();
  expect(layout.GRID_ID).toBeDefined();
});

test('carries an empty native filter map', () => {
  expect(build().data.nativeFilters.filters).toEqual({});
});
