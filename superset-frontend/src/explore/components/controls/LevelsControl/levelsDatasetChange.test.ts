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
import { ControlStateMapping, Dataset } from '@superset-ui/chart-controls';
import {
  DatasourceType,
  getChartControlPanelRegistry,
  QueryFormData,
  VizType,
} from '@superset-ui/core';
import AgGridTableChartPlugin, {
  TreeLevel,
} from '@superset-ui/plugin-chart-ag-grid-table';
import { getControlsState } from 'src/explore/store';
import { applyMapStateToPropsToControl } from 'src/explore/controlUtils/getControlState';
import {
  setControlValue,
  updateFormDataByDatasource,
} from 'src/explore/actions/exploreActions';
import { getFormDataFromControls } from 'src/explore/controlUtils/getFormDataFromControls';
import exploreReducer, {
  ExploreState,
} from 'src/explore/reducers/exploreReducer';

const column = (column_name: string, is_dttm = false) => ({
  column_name,
  groupby: true,
  is_dttm,
});

const dataset = (id: number, columnNames: string[]) =>
  ({
    id,
    uid: `${id}__table`,
    type: DatasourceType.Table,
    datasource_name: `ds${id}`,
    main_dttm_col: 'session_started_at',
    columns: columnNames.map(name =>
      column(name, name.endsWith('_started_at')),
    ),
    metrics: [],
  }) as unknown as Dataset & { uid: string };

const levels: TreeLevel[] = [
  {
    key: 'level-1',
    name: 'Session',
    id_column: 'session_id',
    time_column: 'session_started_at',
    columns: ['channel'],
    detail_fields: [],
  },
  {
    key: 'level-2',
    name: 'Step',
    id_column: 'step_id',
    parent_column: 'session_id',
    columns: ['step_order'],
    detail_fields: [],
    children_shown: 100,
    apply_date_filter: false,
  },
];

beforeAll(() => {
  getChartControlPanelRegistry().registerValue(
    VizType.TableAgGrid,
    new AgGridTableChartPlugin().controlPanel,
  );
});

afterAll(() => {
  getChartControlPanelRegistry().remove(VizType.TableAgGrid);
});

type ExploreAction = Parameters<typeof exploreReducer>[1];

function hydrate(datasource: Dataset, formData: QueryFormData) {
  const initial = { form_data: formData, datasource };
  const controls = getControlsState(
    initial as unknown as Parameters<typeof getControlsState>[0],
    formData,
  ) as ControlStateMapping;
  const state = {
    datasource,
    controls,
    form_data: formData,
  } as unknown as ExploreState;
  Object.entries(controls).forEach(([key, controlState]) => {
    controls[key] = applyMapStateToPropsToControl(
      controlState,
      state as never,
    ) as ControlStateMapping[string];
  });
  return state;
}

test('a dataset change keeps Levels and lists the columns the new dataset lacks', () => {
  const oldDataset = dataset(1, [
    'session_id',
    'channel',
    'session_started_at',
    'step_id',
    'step_order',
  ]);
  const newDataset = dataset(2, [
    'session_id',
    'session_started_at',
    'step_id',
  ]);
  const formData = {
    datasource: oldDataset.uid,
    viz_type: VizType.TableAgGrid,
    query_mode: 'tree',
    levels,
  } as QueryFormData;
  const state = hydrate(oldDataset, formData);
  const controls = state.controls as ControlStateMapping;
  expect(controls.levels.value).toEqual(levels);
  expect(controls.levels.validationErrors).toEqual([]);

  const next = exploreReducer(
    state,
    updateFormDataByDatasource(oldDataset, newDataset) as ExploreAction,
  );
  const nextControls = next.controls as ControlStateMapping;
  expect(next.form_data.levels).toEqual(levels);
  expect(nextControls.levels.value).toEqual(levels);
  expect(next.controlsTransferred).not.toContain('levels');
  expect(nextControls.levels.validationErrors).toEqual([
    'Not in this dataset: channel, step_order.',
  ]);
});

test('a new Tree table gets two empty levels and lists their missing fields', () => {
  const ds = dataset(1, ['session_id', 'session_started_at']);
  let state = hydrate(ds, {
    datasource: ds.uid,
    viz_type: VizType.TableAgGrid,
    query_mode: 'tree',
  } as QueryFormData);
  const seed = (state.controls as ControlStateMapping).levels.initialLevels;
  state = exploreReducer(
    state,
    setControlValue('levels', seed) as ExploreAction,
  );
  const controls = state.controls as ControlStateMapping;
  expect(
    (controls.levels.value as TreeLevel[]).map(level => level.key),
  ).toEqual(['level-1', 'level-2']);
  expect(controls.levels.validationErrors).toEqual([
    'Level 1 is missing: Name, ID column, Time column. Level 2 is missing: Name, ID column, Linked to parent by.',
  ]);
  expect(controls.tree_columns.value).toEqual([]);
  expect(controls.tree_metrics.value).toEqual([]);
  expect(controls.tree_orderby.value).toEqual([]);
});

test('a chart saved with no levels keeps an empty list and asks for a level', () => {
  const ds = dataset(1, ['session_id', 'session_started_at']);
  const state = hydrate(ds, {
    datasource: ds.uid,
    viz_type: VizType.TableAgGrid,
    query_mode: 'tree',
    levels: [],
  } as QueryFormData);
  const controls = state.controls as ControlStateMapping;
  expect(controls.levels.value).toEqual([]);
  expect(controls.levels.validationErrors).toEqual(['Add at least one level.']);
});

test('levels and the three mirrors all reach the form data that Save posts', () => {
  const ds = dataset(1, [
    'session_id',
    'channel',
    'session_started_at',
    'step_id',
    'step_order',
  ]);
  let state = hydrate(ds, {
    datasource: ds.uid,
    viz_type: VizType.TableAgGrid,
    query_mode: 'tree',
  } as QueryFormData);
  const { mirrorsOf } = (state.controls as ControlStateMapping).levels;
  const mirrors = mirrorsOf(levels) as Record<string, unknown[]>;
  expect(mirrors.tree_columns).toEqual([
    'session_id',
    'channel',
    'step_id',
    'step_order',
  ]);
  [
    setControlValue('levels', levels),
    ...Object.entries(mirrors).map(([key, value]) =>
      setControlValue(key, value),
    ),
  ].forEach(action => {
    state = exploreReducer(state, action as ExploreAction);
  });
  const saved = getFormDataFromControls(state.controls as ControlStateMapping);
  expect(saved.levels).toEqual(levels);
  expect(saved.tree_columns).toEqual(mirrors.tree_columns);
  expect(saved.tree_metrics).toEqual(mirrors.tree_metrics);
  expect(saved.tree_orderby).toEqual(mirrors.tree_orderby);
  expect(
    (state.controls as ControlStateMapping).levels.validationErrors,
  ).toEqual([]);
});
