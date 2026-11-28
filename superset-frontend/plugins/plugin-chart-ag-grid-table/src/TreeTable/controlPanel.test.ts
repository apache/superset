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
  ControlPanelState,
  ControlState,
  ControlStateMapping,
  CustomControlItem,
} from '@superset-ui/chart-controls';
import {
  treeLevelsSection,
  treeModeOnInit,
  mapLevelsStateToProps,
} from './controlPanel';
import levelsToMirrors from './levelsToMirrors';
import { TreeLevel } from './types';

const config = {
  controlPanelSections: [treeLevelsSection],
  onInit: treeModeOnInit,
};

const items = config.controlPanelSections.flatMap(section =>
  (section?.controlSetRows ?? []).flat(),
) as CustomControlItem[];

const item = (name: string) => items.find(control => control?.name === name);

test('the Levels section supplies the only Levels heading', () => {
  expect(config.controlPanelSections[0]?.label).toBe('Levels');
  expect(item('levels')?.config.label).toBeUndefined();
});

test('Levels help states the repeated child-column contract and consequence', () => {
  expect(config.controlPanelSections[0]?.description).toBe(
    'All levels come from this dataset. Each child row is linked to its parent. Parent columns must be the same on every row. Child level columns must be the same on every dataset row for one child ID; otherwise the count and Load more can disagree.',
  );
});

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
    columns: ['step'],
    detail_fields: [],
  },
];

test('initial controls derive mirrors before saved and queried snapshots are taken', () => {
  const stale = {
    query_mode: { value: 'tree' },
    levels: { value: levels },
    tree_columns: { value: ['removed', 'step_id'], hidden: true },
    tree_metrics: { value: ['old_count'], hidden: true },
    tree_orderby: { value: [['removed', true]], hidden: true },
  } as unknown as ControlStateMapping;
  const initialized = config.onInit?.(stale);
  expect(initialized).toMatchObject({
    levels: { value: levels },
    ...Object.fromEntries(
      Object.entries(levelsToMirrors(levels)).map(([key, value]) => [
        key,
        { value, hidden: true },
      ]),
    ),
  });
  expect(stale.tree_orderby.value).toEqual([['removed', true]]);
  expect(
    config.onInit?.(initialized as unknown as ControlStateMapping),
  ).toEqual(initialized);
});

test.each(['tree_columns', 'tree_metrics', 'tree_orderby'])(
  'mirror %s is a full hidden control config',
  name => {
    expect(item(name)?.config).toEqual({
      type: 'HiddenControl',
      hidden: true,
    });
    expect(item(name)?.config).not.toHaveProperty('visibility');
  },
);

test('levels is a LevelsControl with two default levels and the helpers', () => {
  const levelsConfig = item('levels')?.config;
  expect(levelsConfig?.type).toBe('LevelsControl');
  expect(levelsConfig?.label).toBeUndefined();
  expect(levelsConfig?.mirrorsOf).toBe(levelsToMirrors);
  expect(levelsConfig?.validators).toEqual([]);
  expect(levelsConfig?.default).toBeUndefined();
  expect(
    levelsConfig?.shouldMapStateToProps?.(
      {} as ControlPanelState,
      {
        controls: { query_mode: { value: 'tree' } },
      } as unknown as ControlPanelState,
      {} as ControlState,
    ),
  ).toBe(true);
  expect(levelsConfig?.initialLevels).toEqual([
    {
      key: 'level-1',
      name: '',
      id_column: '',
      columns: [],
      detail_fields: [],
    },
    {
      key: 'level-2',
      name: '',
      id_column: '',
      columns: [],
      detail_fields: [],
      children_shown: 100,
      apply_date_filter: false,
    },
  ]);
});

test.each(['aggregate', 'raw'])(
  'Levels mapping is skipped for %s and does not build options',
  mode => {
    const state = {
      controls: { query_mode: { value: mode } },
    } as unknown as ControlPanelState;
    expect(
      item('levels')?.config.shouldMapStateToProps?.(
        state,
        state,
        {} as ControlState,
      ),
    ).toBe(false);
    Object.defineProperty(state, 'datasource', {
      get: () => {
        throw new Error('Non-Tree datasource accessed');
      },
    });
    expect(mapLevelsStateToProps(state, {} as ControlState)).toEqual({
      externalValidationErrors: [],
    });
  },
);

test('Tree onInit isolates mirrors from Table V2 metrics and leaves other modes unchanged', () => {
  const controls = {
    query_mode: { value: 'aggregate' },
    levels: { value: levels },
    metrics: { value: ['count'] },
  } as unknown as ControlStateMapping;
  expect(treeModeOnInit(controls)).toBe(controls);
  const initialized = treeModeOnInit({
    ...controls,
    query_mode: { value: 'tree' },
  } as unknown as ControlStateMapping);
  expect(initialized.metrics.value).toEqual(['count']);
  expect(
    Object.fromEntries(
      Object.keys(levelsToMirrors(levels)).map(key => [
        key,
        initialized[key].value,
      ]),
    ),
  ).toEqual(levelsToMirrors(levels));
});

test('mapStateToProps returns none of the keys that reset a control on dataset change', () => {
  const state = {
    datasource: {
      columns: [
        { column_name: 'session_id', groupby: true },
        { column_name: 'session_started_at', groupby: true, is_dttm: true },
        { column_name: 'hidden', groupby: false },
      ],
      metrics: [],
      main_dttm_col: 'session_started_at',
      type: 'table',
    },
    controls: { query_mode: { value: 'tree' } },
    form_data: {
      tree_columns: ['session_id'],
      tree_metrics: [],
      tree_orderby: [],
    },
  } as unknown as ControlPanelState;
  const props = mapLevelsStateToProps(state, {} as ControlState);
  ['columns', 'options', 'savedMetrics', 'valueKey'].forEach(key =>
    expect(props).not.toHaveProperty(key),
  );
  expect(props.datasourceColumns).toEqual([
    'session_id',
    'session_started_at',
    'hidden',
  ]);
  expect(
    props.columnOptions.map((c: { column_name: string }) => c.column_name),
  ).toEqual(['session_id', 'session_started_at']);
  expect(
    props.temporalOptions?.map(c => (c as { column_name: string }).column_name),
  ).toEqual(['session_started_at']);
  expect(props.formMirrors).toEqual({
    tree_columns: ['session_id'],
    tree_metrics: [],
    tree_orderby: [],
  });
});
