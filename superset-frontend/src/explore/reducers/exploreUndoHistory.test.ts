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
import type {
  ControlPanelConfig,
  ControlStateMapping,
  Dataset,
} from '@superset-ui/chart-controls';
import handlebarsControlPanel from '../../../plugins/plugin-chart-handlebars/src/plugin/controlPanel';
import separatorControlPanel from 'src/explore/controlPanels/Separator';
import type { ExploreState } from './exploreReducer';
import {
  buildHistoryFrame,
  NON_CONTROL_FORM_DATA_FIELDS,
  pickNonControlFormData,
  restoreHistoryFrame,
} from './exploreUndoHistory';

const SEPARATOR_VIZ = 'undo-history-separator';
const HANDLEBARS_VIZ = 'undo-history-handlebars';

beforeAll(() => {
  const registry = getChartControlPanelRegistry();
  registry.registerValue(SEPARATOR_VIZ, separatorControlPanel);
  registry.registerValue(
    HANDLEBARS_VIZ,
    handlebarsControlPanel as ControlPanelConfig,
  );
});

afterAll(() => {
  const registry = getChartControlPanelRegistry();
  registry.remove(SEPARATOR_VIZ);
  registry.remove(HANDLEBARS_VIZ);
});

const buildState = (
  overrides: Partial<ExploreState> & { form_data: QueryFormData },
): ExploreState => ({
  datasource: {
    type: DatasourceType.Table,
    columns: [],
    metrics: [],
  } as unknown as Dataset,
  controls: {},
  undoHistory: { past: [], future: [], restoreEpoch: 0 },
  ...overrides,
});

const controlValues = (values: Record<string, unknown>): ControlStateMapping =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name, { value }]),
  ) as unknown as ControlStateMapping;

test('buildHistoryFrame merges non-control form data under controls-derived data', () => {
  const state = buildState({
    form_data: {
      viz_type: 'stale-viz',
      dashboardId: '7',
      layer_filter_scope: { 1: { scope: ['ROOT_ID'] } },
      filter_data_mapping: { 1: { col: 'a' } },
      own_color_scheme: 'own',
      dashboard_color_scheme: 'dash',
      standardizedFormData: { controls: {}, memorized: [] },
    } as unknown as QueryFormData,
    controls: controlValues({ viz_type: 'table', row_limit: 10 }),
  });

  const { formData } = buildHistoryFrame(state);

  expect(formData).toEqual({
    dashboardId: '7',
    layer_filter_scope: { 1: { scope: ['ROOT_ID'] } },
    filter_data_mapping: { 1: { col: 'a' } },
    own_color_scheme: 'own',
    dashboard_color_scheme: 'dash',
    standardizedFormData: { controls: {}, memorized: [] },
    // controls win over the same key in `form_data`
    viz_type: 'table',
    row_limit: 10,
  });
});

test('buildHistoryFrame carries hiddenFormData through and defaults undefined to an empty object', () => {
  const hiddenFormData = { a: 1 } as unknown as Partial<QueryFormData>;
  const base = { form_data: {} as QueryFormData };

  expect(
    buildHistoryFrame(buildState({ ...base, hiddenFormData })).hiddenFormData,
  ).toBe(hiddenFormData);
  expect(buildHistoryFrame(buildState(base)).hiddenFormData).toEqual({});
});

test('pickNonControlFormData keeps exactly the listed non-control fields', () => {
  const everyListedKey = Object.fromEntries(
    NON_CONTROL_FORM_DATA_FIELDS.map(key => [key, `${key}-value`]),
  );

  expect(
    pickNonControlFormData({
      ...everyListedKey,
      viz_type: 'table',
      row_limit: 10,
    } as unknown as QueryFormData),
  ).toEqual(everyListedKey);
  expect(
    pickNonControlFormData({ dashboardId: 3 } as unknown as QueryFormData),
  ).toEqual({ dashboardId: 3 });
  expect(pickNonControlFormData({} as QueryFormData)).toEqual({});
  expect(pickNonControlFormData(undefined)).toEqual({});
  expect([...NON_CONTROL_FORM_DATA_FIELDS].sort()).toEqual([
    'dashboardId',
    'dashboard_color_scheme',
    'filter_data_mapping',
    'layer_filter_scope',
    'own_color_scheme',
    'standardizedFormData',
  ]);
});

test('restoreHistoryFrame writes back form_data and hiddenFormData verbatim and recomputes controls', () => {
  const state = buildState({
    form_data: {
      viz_type: SEPARATOR_VIZ,
      markup_type: 'markdown',
      code: 'live',
    } as unknown as QueryFormData,
    controls: controlValues({
      viz_type: SEPARATOR_VIZ,
      markup_type: 'markdown',
      code: 'live',
    }),
    hiddenFormData: { stale: true } as unknown as Partial<QueryFormData>,
  });
  const frame = {
    formData: {
      viz_type: SEPARATOR_VIZ,
      markup_type: 'html',
      code: '<b>restored</b>',
      dashboardId: 4,
    } as unknown as QueryFormData,
    hiddenFormData: { kept: 1 } as unknown as Partial<QueryFormData>,
  };

  const restored = restoreHistoryFrame(state, frame);

  expect(restored.form_data).toBe(frame.formData);
  expect(restored.hiddenFormData).toBe(frame.hiddenFormData);
  expect(restored.controls.markup_type.value).toBe('html');
  expect(restored.controls.code.value).toBe('<b>restored</b>');
  expect(restored.controls).toHaveProperty('viz_type');
});

test('restoreHistoryFrame re-derives sibling-dependent control props from the restored frame', () => {
  const state = buildState({
    form_data: {
      viz_type: SEPARATOR_VIZ,
      markup_type: 'markdown',
      code: 'text',
    } as unknown as QueryFormData,
    controls: controlValues({
      viz_type: SEPARATOR_VIZ,
      markup_type: 'markdown',
      code: 'text',
    }),
  });

  const restored = restoreHistoryFrame(state, {
    formData: {
      viz_type: SEPARATOR_VIZ,
      markup_type: 'html',
      code: 'text',
    } as unknown as QueryFormData,
    hiddenFormData: {},
  });

  expect(restored.controls.markup_type.value).toBe('html');
  expect(restored.controls.code.language).toBe('html');
});

test('restoreHistoryFrame restores a falsy handlebarsTemplate instead of the pre-restore template', () => {
  const template = '<ul>{{#each data}}<li>{{this}}</li>{{/each}}</ul>';
  const state = buildState({
    form_data: {
      viz_type: HANDLEBARS_VIZ,
      handlebarsTemplate: template,
    } as unknown as QueryFormData,
    controls: controlValues({
      viz_type: HANDLEBARS_VIZ,
      handlebarsTemplate: template,
    }),
  });

  const restored = restoreHistoryFrame(state, {
    formData: {
      viz_type: HANDLEBARS_VIZ,
      handlebarsTemplate: '',
    } as unknown as QueryFormData,
    hiddenFormData: {},
  });

  expect(restored.controls.handlebarsTemplate.value).toBe('');
});
