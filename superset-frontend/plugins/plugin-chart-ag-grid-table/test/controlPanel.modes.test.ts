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
  BaseControlConfig,
  ControlType,
  ControlPanelsContainerProps,
  ControlPanelState,
  ControlSetItem,
  ControlState,
  isCustomControlItem,
  sharedControls,
} from '@superset-ui/chart-controls';
import { QueryMode, FeatureFlag, DatasourceType } from '@superset-ui/core';
import config from '../src/controlPanel';

function resolveControl(
  item: ControlSetItem,
): BaseControlConfig<ControlType> | undefined {
  if (typeof item === 'string') return sharedControls[item];
  if (!item || !('name' in item)) return undefined;
  return {
    ...sharedControls[item.name],
    ...(isCustomControlItem(item) ? item.config : {}),
    ...(!isCustomControlItem(item) && 'override' in item ? item.override : {}),
  };
}

function state(mode: QueryMode | 'tree', serverPagination: boolean) {
  return {
    controls: {
      query_mode: { value: mode },
      server_pagination: { value: serverPagination },
      groupby: { value: ['name'], options: [] },
      metrics: { value: ['count'] },
      percent_metrics: { value: [] },
      all_columns: { value: ['name'] },
      time_compare: { value: [] },
    },
    form_data: { query_mode: mode },
    datasource: { columns: [] },
  } as unknown as ControlPanelsContainerProps & ControlPanelState;
}

function findControl(name: string): BaseControlConfig<ControlType> {
  for (const section of config.controlPanelSections) {
    if (!section) continue;
    for (const item of section.controlSetRows.flat()) {
      if (isCustomControlItem(item) && item.name === name) {
        return resolveControl(item)!;
      }
    }
  }
  throw new Error(`Missing ${name}`);
}

test.each([QueryMode.Aggregate, QueryMode.Raw])(
  '%s visible controls and sections with pagination on/off',
  mode => {
    for (const serverPagination of [false, true]) {
      const props = state(mode, serverPagination);
      const visible = config.controlPanelSections
        .filter(section => section !== null)
        .filter(
          section => section.visibility?.(props, {} as ControlState) !== false,
        )
        .map(section => ({
          label: section.label,
          visible: section.visibility?.(props, {} as ControlState) ?? true,
          controls: section.controlSetRows.flat().flatMap(item => {
            if (!item) return [];
            const name =
              typeof item === 'string' ? item : 'name' in item ? item.name : '';
            const control = resolveControl(item);
            if (
              !control ||
              control.hidden ||
              control.visibility?.(props, {} as ControlState) === false
            )
              return [];
            return [name];
          }),
        }));
      expect({ mode, serverPagination, visible }).toMatchSnapshot();
    }
    const { label } = findControl('server_page_length');
    expect(
      typeof label === 'function'
        ? label(state(mode, false), {} as ControlState)
        : label,
    ).toBe('Server Page Length');
    expect(findControl('server_page_length').default).toBe(10);
    expect(findControl('row_limit').default).toBe(10000);
  },
);

test.each([false, true])(
  'Tree row limit ignores retained server pagination %s',
  serverPagination => {
    const props = state('tree', serverPagination);
    props.form_data.server_pagination = serverPagination;
    props.common = {
      conf: { SQL_MAX_ROW: 100000, TABLE_VIZ_MAX_ROW_SERVER: 500000 },
    } as ControlPanelState['common'];
    const control = findControl('row_limit');
    const mapped = control.mapStateToProps?.(props, {} as ControlState, {
      queriesResponse: null,
    });
    const validationState = { ...control, ...mapped } as ControlState;
    const errors = control.validators
      ?.map(validate => validate(150000, validationState))
      .filter(Boolean);
    expect(errors).toEqual([
      'Lower the row limit to SQL_MAX_ROW (100000) or less.',
    ]);
    expect(
      mapped?.choices.every(([value]: [number, string]) => value <= 100000),
    ).toBe(true);
    expect(
      control.validators
        ?.map(validate => validate(100000, validationState))
        .filter(Boolean),
    ).toEqual([]);
  },
);

test('Tree page length stays enabled on a datasource without server pagination', () => {
  const props = state('tree', false);
  props.datasource!.type = DatasourceType.SemanticView;
  props.form_data.datasource = '1__semantic_view';
  const control = findControl('tree_server_page_length');
  expect(control.disabled ?? false).toBe(false);
  expect(
    findControl('server_page_length').visibility?.(props, {} as ControlState),
  ).toBe(false);
  props.controls.query_mode.value = QueryMode.Aggregate;
  expect(
    findControl('server_page_length').mapStateToProps?.(
      props,
      {} as ControlState,
      {
        queriesResponse: null,
      },
    )?.disabled,
  ).toBe(true);
});

test('Tree option respects the flag and saved mode, with Tree-only controls', () => {
  const flags = window.featureFlags;
  const mode = findControl('query_mode');
  const resolve = (queryMode: QueryMode | 'tree') =>
    mode.mapStateToProps?.(state(queryMode, false), {} as ControlState, {
      queriesResponse: null,
    });
  try {
    window.featureFlags = {
      ...flags,
      [FeatureFlag.TableV2TreeModeEnabled]: false,
    };
    expect(resolve('tree')?.options).toEqual([
      ['aggregate', 'Aggregate'],
      ['raw', 'Raw records'],
      ['tree', 'Tree'],
    ]);
    expect(resolve('tree')?.value).toBe('tree');
    window.featureFlags = {
      ...flags,
      [FeatureFlag.TableV2TreeModeEnabled]: true,
    };
    expect(resolve(QueryMode.Aggregate)?.options).toEqual([
      ['aggregate', 'Aggregate'],
      ['raw', 'Raw records'],
      ['tree', 'Tree'],
    ]);
    const props = state('tree', false);
    const visibleSections = config.controlPanelSections.filter(
      section => section && section.visibility?.(props, {}) !== false,
    );
    expect(visibleSections.map(section => section?.label)).toEqual([
      'Query',
      'Levels',
    ]);
    const queryControls = visibleSections[0]?.controlSetRows
      .flat()
      .filter(item => {
        const control = resolveControl(item);
        return (
          control &&
          !control.hidden &&
          control.type !== 'HiddenControl' &&
          control.visibility?.(props, {} as ControlState) !== false
        );
      })
      .map(item =>
        typeof item === 'string'
          ? item
          : item && 'name' in item
            ? item.name
            : '',
      );
    expect(queryControls).toEqual([
      'query_mode',
      'adhoc_filters',
      'tree_server_page_length',
      'row_limit',
    ]);
    const pageLength = findControl('tree_server_page_length');
    expect(pageLength.label).toBe('Page length');
    expect(pageLength.freeForm).toBe(false);
    expect(pageLength.choices).toEqual([
      [10, '10'],
      [20, '20'],
      [50, '50'],
      [100, '100'],
      [200, '200'],
    ]);
    expect(
      pageLength.mapStateToProps?.(props, {} as ControlState, {
        queriesResponse: null,
      })?.default,
    ).toBe(50);
    expect(findControl('server_pagination').resetOnHide).toBe(false);
    expect(findControl('query_mode').rerender).toContain('levels');
    expect(findControl('levels').default).toBeUndefined();
    expect(findControl('row_limit').default).toBe(10000);
  } finally {
    window.featureFlags = flags;
  }
});

test.each([QueryMode.Aggregate, QueryMode.Raw])(
  '%s radio offers exactly Aggregate and Raw records with flags off',
  mode => {
    const control = findControl('query_mode');
    const mapped = control.mapStateToProps?.(
      state(mode, false),
      {} as ControlState,
      { queriesResponse: null },
    );
    expect(mapped?.options ?? control.options).toEqual([
      ['aggregate', 'Aggregate'],
      ['raw', 'Raw records'],
    ]);
  },
);
