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

new AgGridTableChartPlugin().configure({ key: VizType.TableAgGrid }).register();

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
    ]) {
      expect(reopened[name]).toBeUndefined();
    }
  },
);
