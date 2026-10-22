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
import { getChartControlPanelRegistry, QueryFormData } from '@superset-ui/core';
import { ControlPanelState } from '@superset-ui/chart-controls';
import controlPanel from '../../../plugins/plugin-chart-echarts/src/Sunburst/controlPanel';
import buildQuery from '../../../plugins/plugin-chart-echarts/src/Sunburst/buildQuery';
import { getAllControlsState } from './getControlState';
import { getFormDataFromControls } from './getFormDataFromControls';

const VIZ_TYPE = 'sunburst_v2';

// The shape the MCP chart builder saves for a Sunburst with a temporal level and
// a monthly grain: the grain sits in the legacy granularity_sqla/time_grain_sqla
// pair rather than in the hierarchy columns.
const mcpSavedFormData = {
  datasource: '1__table',
  viz_type: VIZ_TYPE,
  columns: ['ts', 'region'],
  metric: 'count',
  granularity_sqla: 'ts',
  time_grain_sqla: 'P1M',
  row_limit: 100,
  sort_by_metric: true,
} as unknown as QueryFormData;

const datasource = {
  id: 1,
  type: 'table',
  columns: [
    { column_name: 'ts', is_dttm: true },
    { column_name: 'region', is_dttm: false },
    { column_name: 'ship_date', is_dttm: true },
  ],
  metrics: [{ metric_name: 'count' }],
  time_grain_sqla: [
    ['P1D', 'Day'],
    ['P1M', 'Month'],
  ],
};

beforeAll(() => {
  getChartControlPanelRegistry().registerValue(VIZ_TYPE, controlPanel);
});

afterAll(() => {
  getChartControlPanelRegistry().remove(VIZ_TYPE);
});

function exploreFormData(savedFormData: QueryFormData): QueryFormData {
  // Explore rebuilds form data from the viz's controls only, so keys without a
  // control on the Sunburst panel are dropped.
  const controls = getAllControlsState(
    VIZ_TYPE,
    'table' as never,
    {
      datasource,
      controls: {},
      form_data: savedFormData,
      metadata: { owners: [] },
    } as unknown as ControlPanelState,
    savedFormData,
  );
  return getFormDataFromControls(controls as never);
}

test('an MCP-saved Sunburst opened in Explore queries its temporal level at the saved grain', () => {
  const formData = exploreFormData(mcpSavedFormData);

  expect(formData.time_grain_sqla).toBe('P1M');
  const [query] = buildQuery(formData).queries;
  expect(query.columns).toEqual([
    {
      timeGrain: 'P1M',
      columnType: 'BASE_AXIS',
      sqlExpression: 'ts',
      label: 'ts',
      expressionType: 'SQL',
      isColumnReference: true,
    },
    'region',
  ]);
  expect(query.extras?.time_grain_sqla).toBe('P1M');
  // The saved hierarchy stays plain column names for cross-filters and the
  // embedded anti-tamper check.
  expect(formData.columns).toEqual(['ts', 'region']);
});

test('a Sunburst saved without a grain stays raw in Explore until a grain is chosen', () => {
  const {
    time_grain_sqla: _grain,
    granularity_sqla: _subject,
    ...saved
  } = mcpSavedFormData;
  const formData = exploreFormData(saved as QueryFormData);

  expect(formData.time_grain_sqla).toBeUndefined();
  const [raw] = buildQuery(formData).queries;
  expect(raw.columns).toEqual(['ts', 'region']);
  expect(raw.extras?.time_grain_sqla).toBeUndefined();

  // Choosing a grain in the Sunburst time grain control grains the temporal
  // level; Explore resolves temporal levels from the datasource lookup.
  const [grained] = buildQuery({
    ...formData,
    time_grain_sqla: 'P1W',
  } as QueryFormData).queries;
  expect(grained.columns).toEqual([
    {
      timeGrain: 'P1W',
      columnType: 'BASE_AXIS',
      sqlExpression: 'ts',
      label: 'ts',
      expressionType: 'SQL',
      isColumnReference: true,
    },
    'region',
  ]);
});

test('Explore preserves an MCP time-column subject in a two-temporal-level hierarchy', () => {
  const saved = {
    ...mcpSavedFormData,
    columns: ['ship_date', 'ts'],
  } as QueryFormData;
  const explored = exploreFormData(saved);
  expect(explored.granularity_sqla).toBe('ts');
  expect(buildQuery(explored).queries[0].columns).toEqual(
    buildQuery(saved).queries[0].columns,
  );
});
