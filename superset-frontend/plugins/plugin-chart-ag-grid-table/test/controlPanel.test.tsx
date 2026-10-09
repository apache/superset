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
import { GenericDataType } from '@apache-superset/core/common';
import { QueryFormData } from '@superset-ui/core';
import {
  ColumnMeta,
  Dataset,
  isCustomControlItem,
  ControlConfig,
  ControlPanelState,
  ControlState,
  ColorSchemeEnum,
} from '@superset-ui/chart-controls';
import config from '../src/controlPanel';

const findNamedControl = (name: string): ControlConfig | null => {
  for (const section of config.controlPanelSections) {
    if (!section) continue;
    for (const row of section.controlSetRows) {
      for (const control of row) {
        if (isCustomControlItem(control) && control.name === name) {
          return control.config;
        }
      }
    }
  }
  return null;
};

const getPaginationControl = (name: string): ControlConfig => {
  const control = findNamedControl(name);
  if (control) return control;
  throw new Error(`Missing pagination control: ${name}`);
};

const findConditionalFormattingControl = (): ControlConfig | null =>
  findNamedControl('conditional_formatting');

const findMetricsMapStateToProps = ():
  | ControlConfig['mapStateToProps']
  | null => {
  for (const section of config.controlPanelSections) {
    if (!section) continue;
    for (const row of section.controlSetRows) {
      for (const control of row) {
        if (
          control &&
          typeof control === 'object' &&
          'name' in control &&
          (control as { name: string }).name === 'metrics' &&
          'override' in control
        ) {
          return (
            control as {
              override: { mapStateToProps: ControlConfig['mapStateToProps'] };
            }
          ).override.mapStateToProps;
        }
      }
    }
  }
  return null;
};

const createMockControlState = (value: string[] | undefined): ControlState => ({
  type: 'SelectControl',
  value,
  label: '',
  default: undefined,
  renderTrigger: false,
});

const createMockExplore = (
  timeCompareValue: string[] | undefined,
): ControlPanelState => ({
  slice: { slice_id: 123 },
  datasource: {
    verbose_map: { col1: 'Column 1', col2: 'Column 2' },
    columns: [],
  } as Partial<Dataset> as Dataset,
  controls: {
    time_compare: createMockControlState(timeCompareValue),
  },
  form_data: {
    time_compare: timeCompareValue,
    datasource: 'test',
    viz_type: 'table',
  } as QueryFormData,
  common: {},
  metadata: {},
});

const createMockChart = () => ({
  chartStatus: 'success' as const,
  queriesResponse: [
    {
      colnames: ['col1', 'col2'],
      coltypes: [GenericDataType.Numeric, GenericDataType.Numeric],
    },
  ],
});

const createMockControlStateForConditionalFormatting = (): ControlState => ({
  type: 'CollectionControl',
  value: [],
  label: '',
  default: undefined,
  renderTrigger: false,
});

test('extraColorChoices not included when time comparison is disabled', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();
  expect(controlConfig?.mapStateToProps).toBeTruthy();

  const explore = createMockExplore(undefined);
  const chart = createMockChart();
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  expect(result.extraColorChoices).toEqual([]);
  expect(result.columnOptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ value: 'col1' }),
      expect.objectContaining({ value: 'col2' }),
    ]),
  );
});

test('extraColorChoices included when time comparison is enabled', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  const explore = createMockExplore(['P1D']);
  const chart = createMockChart();
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  expect(result.extraColorChoices).toEqual([
    {
      label: expect.stringContaining('Trend colors'),
      colors: [ColorSchemeEnum.Green, ColorSchemeEnum.Red],
    },
  ]);
  expect(result.columnOptions).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ value: 'col1' })]),
  );
});

test('extraColorChoices not included when time_compare is empty array', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  const explore = createMockExplore([]);
  const chart = createMockChart();
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  expect(result.extraColorChoices).toEqual([]);
});

test('numericColumns resolves dataType by position, not a stale name lookup', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  const explore = createMockExplore(undefined);
  // Two columns share the name "metric" (e.g. a dimension and a metric
  // both aliased the same way); only the second occurrence is Numeric.
  const chart = {
    chartStatus: 'success' as const,
    queriesResponse: [
      {
        colnames: ['metric', 'metric'],
        coltypes: [GenericDataType.String, GenericDataType.Numeric],
      },
    ],
  };
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  // Resolving dataType via `colnames.indexOf(colname)` would always find
  // the first "metric" (String) and misclassify this numeric column.
  expect(result.columnOptions).toEqual([
    expect.objectContaining({
      value: 'metric',
      dataType: GenericDataType.Numeric,
    }),
  ]);
});

test('consistency between extraColorChoices and columnOptions', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  const explore = createMockExplore(['P1D']);
  const chart = createMockChart();
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  const hasExtraColorChoices = result.extraColorChoices.length > 0;
  const hasComparisonColumns = result.columnOptions.some(
    (col: { value: string }) =>
      col.value.includes('Main') ||
      col.value.includes('#') ||
      col.value.includes('△'),
  );

  expect(hasExtraColorChoices).toBe(true);
  expect(hasComparisonColumns).toBe(true);
});

test('uses controls.time_compare.value not form_data.time_compare', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  const explore: ControlPanelState = {
    ...createMockExplore(undefined),
    form_data: {
      ...createMockExplore(undefined).form_data,
      time_compare: ['P1D'],
    },
  };
  const chart = createMockChart();
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  expect(result.extraColorChoices).toEqual([]);
});

test('static extraColorChoices removed from config', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  expect(controlConfig?.extraColorChoices).toBeUndefined();
});

const createMockExploreWithColumns = (
  columns: Partial<ColumnMeta>[],
): ControlPanelState => ({
  slice: { slice_id: 123 },
  datasource: {
    verbose_map: {},
    columns,
    metrics: [],
  } as Partial<Dataset> as Dataset,
  controls: {},
  form_data: {
    datasource: 'test',
    viz_type: 'table',
  } as QueryFormData,
  common: {},
  metadata: {},
});

const createMockMetricsControlState = (): ControlState => ({
  type: 'MetricsControl',
  value: [],
  label: '',
  default: undefined,
  renderTrigger: false,
});

test('column_config mapStateToProps expands comparison columns for metrics', () => {
  const controlConfig = findNamedControl('column_config');
  const explore = {
    ...createMockExplore(['1 year ago']),
    form_data: {
      ...createMockExplore(['1 year ago']).form_data,
      metrics: ['col1'],
    },
  };
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    createMockChart(),
  );

  expect(result.columnsPropsObject.colnames).toEqual(
    expect.arrayContaining(['Main col1', '# col1', '△ col1', '% col1']),
  );
  expect(result.columnsPropsObject.childColumnMap['Main col1']).toBe(false);
  expect(result.columnsPropsObject.childColumnMap['# col1']).toBe(true);
});

test('metrics control includes non-filterable columns', () => {
  const mapStateToProps = findMetricsMapStateToProps();
  expect(mapStateToProps).toBeTruthy();

  const explore = createMockExploreWithColumns([
    { column_name: 'filterable_col', filterable: true },
    { column_name: 'non_filterable_col', filterable: false },
  ]);
  const result = mapStateToProps!(explore, createMockMetricsControlState());

  expect(result.columns).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ column_name: 'filterable_col' }),
      expect.objectContaining({ column_name: 'non_filterable_col' }),
    ]),
  );
});

test.each([
  ['semantic_view', undefined, true],
  ['semantic_view', [], true],
  ['semantic_view', ['UNKNOWN'], true],
  ['semantic_view', ['ROW_OFFSET'], false],
  ['table', undefined, false],
])(
  'AG Grid pagination gate: %s with %s disables=%s',
  (type, features, disabled) => {
    const panel = getPaginationControl('server_pagination');
    const length = getPaginationControl('server_page_length');
    const base = createMockExplore(undefined);
    const state: ControlPanelState = {
      ...base,
      datasource: {
        uid: `1__${type}`,
        type,
        semantic_view_features: features,
      } as Dataset,
      form_data: {
        ...base.form_data,
        datasource: `1__${type}`,
        server_pagination: true,
      },
      controls: {
        ...base.controls,
        server_pagination: { type: 'CheckboxControl', value: true },
      },
    };

    expect(
      panel.shouldMapStateToProps?.(
        state,
        state,
        state.controls.server_pagination,
      ),
    ).toBe(true);
    expect(
      panel.mapStateToProps?.(state, state.controls.server_pagination),
    ).toMatchObject({
      disabled,
      resetLabel: 'Turn off server pagination',
      disabledReason: 'This semantic view does not support server pagination.',
    });
    expect(
      length.mapStateToProps?.(state, state.controls.server_page_length),
    ).toMatchObject({ disabled });
    expect(state.controls.server_pagination.value).toBe(true);
  },
);

test('AG Grid fails closed while semantic datasource metadata loads', () => {
  const panel = getPaginationControl('server_pagination');
  const base = createMockExplore(undefined);
  const state: ControlPanelState = {
    ...base,
    datasource: null,
    form_data: { ...base.form_data, datasource: '1__semantic_view' },
  };
  expect(
    panel.mapStateToProps?.(state, state.controls.server_pagination),
  ).toMatchObject({ disabled: true, resetLabel: undefined });
});

test.each([undefined, [], ['ROW_OFFSET']])(
  'AG Grid matches opaque provider uid before parsing datasource type: %s',
  features => {
    const base = createMockExplore(undefined);
    const state: ControlPanelState = {
      ...base,
      datasource: {
        ...base.datasource,
        uid: 'cube__orders',
        type: 'semantic_view',
        semantic_view_features: features,
      } as Dataset,
      form_data: { ...base.form_data, datasource: 'cube__orders' },
    };
    const disabled = !features?.includes('ROW_OFFSET');
    for (const name of ['server_pagination', 'server_page_length']) {
      expect(
        getPaginationControl(name).mapStateToProps?.(
          state,
          state.controls[name],
        ),
      ).toMatchObject({ disabled });
    }
  },
);

test('ignores stale offset capability when switching opaque semantic UIDs', () => {
  const state = createMockExplore(undefined);
  state.datasource = {
    ...state.datasource,
    uid: 'cube__orders',
    type: 'semantic_view',
    semantic_view_features: ['ROW_OFFSET'],
  } as Dataset;
  state.form_data.datasource = 'cube__customers';

  for (const name of ['server_pagination', 'server_page_length']) {
    expect(
      getPaginationControl(name).mapStateToProps?.(state, state.controls[name]),
    ).toMatchObject({ disabled: true });
  }
});

test.each(['server_pagination', 'server_page_length'])(
  'AG Grid %s ignores stale offset capability from another semantic view',
  name => {
    const base = createMockExplore(undefined);
    const state: ControlPanelState = {
      ...base,
      datasource: {
        ...base.datasource,
        uid: '1__semantic_view',
        type: 'semantic_view',
        semantic_view_features: ['ROW_OFFSET'],
      } as Dataset,
      form_data: {
        ...base.form_data,
        datasource: '2__semantic_view',
        server_pagination: true,
      },
    };

    expect(
      getPaginationControl(name).mapStateToProps?.(state, state.controls[name]),
    ).toMatchObject({ disabled: true });
    expect(state.form_data.server_pagination).toBe(true);
  },
);

test.each([
  ['table', 'semantic_view', true],
  ['semantic_view', 'table', false],
])(
  'AG Grid trusts form datasource %s -> %s while metadata is stale',
  (previous, next, disabled) => {
    const panel = getPaginationControl('server_pagination');
    const base = createMockExplore(undefined);
    const state: ControlPanelState = {
      ...base,
      datasource: {
        ...base.datasource,
        type: previous,
        semantic_view_features: [],
      } as Dataset,
      form_data: {
        ...base.form_data,
        datasource: `2__${next}`,
        server_pagination: true,
      },
    };
    expect(
      panel.mapStateToProps?.(state, state.controls.server_pagination),
    ).toMatchObject({ disabled });
  },
);
