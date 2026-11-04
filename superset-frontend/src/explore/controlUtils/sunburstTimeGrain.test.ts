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
  DatasourceType,
  getChartControlPanelRegistry,
  QueryFormData,
} from '@superset-ui/core';
import {
  ControlPanelState,
  ControlStateMapping,
} from '@superset-ui/chart-controls';
import exploreReducer, {
  ExploreState,
} from 'src/explore/reducers/exploreReducer';
import { SET_FIELD_VALUE } from 'src/explore/actions/exploreActions';
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
    { column_name: 'created_at', is_dttm: true },
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
    DatasourceType.Table,
    {
      datasource,
      controls: {},
      form_data: savedFormData,
      metadata: { owners: [] },
    } as unknown as ControlPanelState,
    savedFormData,
  );
  return getFormDataFromControls(controls as ControlStateMapping);
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

test('Explore grains all temporal levels rather than retaining a hidden Time Column', () => {
  const saved = {
    ...mcpSavedFormData,
    columns: ['ship_date', 'ts'],
  } as QueryFormData;
  const explored = exploreFormData(saved);
  expect(explored.granularity_sqla).toBeUndefined();
  expect(buildQuery(explored).queries[0].columns).toEqual([
    expect.objectContaining({ sqlExpression: 'ship_date', timeGrain: 'P1M' }),
    expect.objectContaining({ sqlExpression: 'ts', timeGrain: 'P1M' }),
  ]);
});

test.each(['created_at', 'ts'])(
  'Edit dataset writing Time Column %s does not change Sunburst hierarchy grains',
  timeColumn => {
    const saved = {
      ...mcpSavedFormData,
      granularity_sqla: undefined,
      columns: ['ts', 'ship_date', 'region'],
    } as QueryFormData;
    const controls = getAllControlsState(
      VIZ_TYPE,
      DatasourceType.Table,
      {
        datasource,
        controls: {},
        form_data: saved,
        metadata: { owners: [] },
      } as unknown as ControlPanelState,
      saved,
    ) as ControlStateMapping;
    const before = getFormDataFromControls(controls);
    const state: ExploreState = { controls, form_data: before };
    const updated = exploreReducer(state, {
      type: SET_FIELD_VALUE,
      controlName: 'granularity_sqla',
      value: timeColumn,
    });
    const after = getFormDataFromControls(updated.controls);
    expect(after.granularity_sqla).toBeUndefined();
    expect(buildQuery(after).queries[0].columns).toEqual(
      buildQuery(before).queries[0].columns,
    );
    expect(buildQuery(after).queries[0].columns).toEqual([
      expect.objectContaining({ sqlExpression: 'ts', timeGrain: 'P1M' }),
      expect.objectContaining({ sqlExpression: 'ship_date', timeGrain: 'P1M' }),
      'region',
    ]);
    expect(buildQuery(after).queries[0].granularity).toBeUndefined();
  },
);

test.each(['created_at', 'ts'])(
  'dashboard edit or chart-type carryover of Time Column %s is not retained by Sunburst controls',
  timeColumn => {
    const explored = exploreFormData({
      ...mcpSavedFormData,
      columns: ['ts', 'ship_date', 'region'],
      granularity_sqla: timeColumn,
    } as QueryFormData);
    expect(explored.granularity_sqla).toBeUndefined();
    expect(buildQuery(explored).queries[0].columns).toEqual([
      expect.objectContaining({ sqlExpression: 'ts', timeGrain: 'P1M' }),
      expect.objectContaining({ sqlExpression: 'ship_date', timeGrain: 'P1M' }),
      'region',
    ]);
  },
);
