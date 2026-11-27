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
import { ControlStateMapping } from '@superset-ui/chart-controls';
import { QueryMode, QueryFormData, VizType } from '@superset-ui/core';
import AgGridTableChartPlugin from '@superset-ui/plugin-chart-ag-grid-table';
import { getControlsState } from 'src/explore/store';
import { getChartFormDiffs } from 'src/utils/getChartFormDiffs';
import { getFormDataFromControls } from './getFormDataFromControls';
import levelsToMirrors from '../../../plugins/plugin-chart-ag-grid-table/src/TreeTable/levelsToMirrors';

const treeFormData = {
  viz_type: VizType.TableAgGrid,
  query_mode: 'tree',
  datasource: '1__table',
  row_limit: 1000,
  levels: [
    {
      key: 'parent',
      name: 'Parent',
      id_column: 'parent',
      columns: ['value'],
      detail_fields: [],
      time_column: 'ds',
    },
    {
      key: 'child',
      name: 'Child',
      id_column: 'child',
      parent_column: 'parent',
      columns: ['value'],
      detail_fields: [],
    },
  ],
};

new AgGridTableChartPlugin().configure({ key: VizType.TableAgGrid }).register();

test('reopening a saved Tree chart preserves its mirrors and Aggregate metrics', () => {
  const input = {
    ...treeFormData,
    ...levelsToMirrors(treeFormData.levels!),
    metrics: ['count'],
  };
  const state = {
    datasource: {
      type: 'table',
      columns: ['parent', 'child', 'value', 'ds'].map(column_name => ({
        column_name,
        is_dttm: column_name === 'ds',
      })),
      metrics: [],
    },
    form_data: input,
    controls: Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, { value }]),
    ),
  };
  const hydrate = (formData: QueryFormData) =>
    getFormDataFromControls(
      getControlsState(state, formData) as ControlStateMapping,
    );
  const baseline = hydrate(input);
  const reopened = hydrate(baseline);
  expect(getChartFormDiffs(baseline, reopened)).toEqual({});
  expect(reopened.metrics).toEqual(['count']);
  expect(reopened.levels).toEqual(treeFormData.levels);
  for (const [key, value] of Object.entries(
    levelsToMirrors(treeFormData.levels!),
  ))
    expect(reopened[key]).toEqual(value);
});

test.each([QueryMode.Aggregate, QueryMode.Raw])(
  'saved Table V2 %s hydration preserves its baseline and adds no Tree values',
  mode => {
    const input: QueryFormData = {
      viz_type: VizType.TableAgGrid,
      datasource: '1__table',
      query_mode: mode,
      groupby: ['name'],
      metrics: ['count'],
      all_columns: ['name'],
      temporal_columns_lookup: { name: false },
    };
    const state = {
      datasource: {
        type: 'table',
        columns: [{ column_name: 'name', is_dttm: false }],
        metrics: [],
      },
      controls: Object.fromEntries(
        Object.entries(input).map(([name, value]) => [name, { value }]),
      ),
      form_data: input,
    };
    const hydrate = (formData: QueryFormData) => {
      const hydrationState = { ...state, form_data: formData };
      return getFormDataFromControls(
        getControlsState(hydrationState, formData) as ControlStateMapping,
      );
    };
    const saved = hydrate(input);
    const reopened = hydrate(saved);
    expect(getChartFormDiffs(saved, reopened)).toEqual({});
    expect(
      Object.fromEntries(
        Object.entries(reopened).filter(([, value]) => value !== undefined),
      ),
    ).toMatchSnapshot();
    for (const name of [
      'levels',
      'tree_columns',
      'tree_metrics',
      'tree_orderby',
      'tree_server_page_length',
    ]) {
      expect(reopened[name]).toBeUndefined();
    }
  },
);
