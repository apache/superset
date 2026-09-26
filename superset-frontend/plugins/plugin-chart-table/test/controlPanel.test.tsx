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
import {
  DatasourceType,
  getChartControlPanelRegistry,
  QueryFormData,
} from '@superset-ui/core';
import {
  ColumnMeta,
  Dataset,
  isCustomControlItem,
  ControlConfig,
  ControlPanelState,
  ControlState,
  ColorSchemeEnum,
  ObjectFormattingEnum,
} from '@superset-ui/chart-controls';
import config from '../src/controlPanel';
import { useState } from 'react';
import { render, screen, userEvent } from 'spec/helpers/testing-library';
import CheckboxControl from 'src/explore/components/controls/CheckboxControl';
import {
  ControlPanelsContainer,
  ControlPanelsContainerProps,
} from 'src/explore/components/ControlPanelsContainer';

const findConditionalFormattingControl = (): ControlConfig | null => {
  for (const section of config.controlPanelSections) {
    if (!section) continue;
    for (const row of section.controlSetRows) {
      for (const control of row) {
        if (
          isCustomControlItem(control) &&
          control.name === 'conditional_formatting'
        ) {
          return control.config;
        }
      }
    }
  }
  return null;
};

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
  datasourceColumns: Partial<Dataset>['columns'] = [],
): ControlPanelState => ({
  slice: { slice_id: 123 },
  datasource: {
    verbose_map: { col1: 'Column 1', col2: 'Column 2' },
    columns: datasourceColumns,
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

test('columnOptions falls back to datasource columns when queriesResponse is empty', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  const datasourceColumns = [
    { column_name: 'revenue', type_generic: GenericDataType.Numeric },
    { column_name: 'name', type_generic: GenericDataType.String },
  ];
  const explore = createMockExplore(undefined, datasourceColumns);
  const chart = { chartStatus: 'success' as const, queriesResponse: null };
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  expect(result.columnOptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ value: 'revenue' }),
      expect.objectContaining({ value: 'name' }),
    ]),
  );
  expect(result.allColumns).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ value: 'revenue' }),
      expect.objectContaining({ value: 'name' }),
    ]),
  );
});

test('columnOptions prefers queriesResponse over datasource columns', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  const datasourceColumns = [
    { column_name: 'revenue', type_generic: GenericDataType.Numeric },
    { column_name: 'extra_col', type_generic: GenericDataType.String },
  ];
  const explore = createMockExplore(undefined, datasourceColumns);
  const chart = createMockChart();
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  expect(result.columnOptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ value: 'col1' }),
      expect.objectContaining({ value: 'col2' }),
    ]),
  );
  expect(result.columnOptions).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ value: 'extra_col' })]),
  );
});

test('columnOptions falls back to datasource when queriesResponse has empty colnames', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  const datasourceColumns = [
    { column_name: 'revenue', type_generic: GenericDataType.Numeric },
  ];
  const explore = createMockExplore(undefined, datasourceColumns);
  const chart = {
    chartStatus: 'success' as const,
    queriesResponse: [{ colnames: [], coltypes: [] }],
  };
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  expect(result.columnOptions).toEqual(
    expect.arrayContaining([expect.objectContaining({ value: 'revenue' })]),
  );
});

test('columnOptions returns empty when both queriesResponse and datasource have no columns', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  const explore = createMockExplore(undefined, []);
  const chart = { chartStatus: 'success' as const, queriesResponse: null };
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  expect(result.columnOptions).toEqual([]);
  expect(result.allColumns).toEqual([]);
});

test('allColumns includes ENTIRE_ROW when falling back to datasource columns', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  const datasourceColumns = [
    { column_name: 'revenue', type_generic: GenericDataType.Numeric },
  ];
  const explore = createMockExplore(undefined, datasourceColumns);
  const chart = { chartStatus: 'success' as const, queriesResponse: null };
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  expect(result.allColumns).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ value: ObjectFormattingEnum.ENTIRE_ROW }),
    ]),
  );
});

test('columnOptions defaults type_generic to String when missing from datasource columns', () => {
  const controlConfig = findConditionalFormattingControl();
  expect(controlConfig).toBeTruthy();

  const datasourceColumns = [{ column_name: 'untyped_col' }];
  const explore = createMockExplore(undefined, datasourceColumns);
  const chart = { chartStatus: 'success' as const, queriesResponse: null };
  const result = controlConfig!.mapStateToProps!(
    explore,
    createMockControlStateForConditionalFormatting(),
    chart,
  );

  expect(result.columnOptions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        value: 'untyped_col',
        dataType: GenericDataType.String,
      }),
    ]),
  );
});

function getControl(name: string): ControlConfig {
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
  throw new Error(`Missing control: ${name}`);
}

const pagination = getControl('server_pagination');
const pageLength = getControl('server_page_length');

function panelState(
  features?: string[],
  type = 'semantic_view',
  value = false,
): ControlPanelState {
  return {
    datasource: { type, semantic_view_features: features } as Dataset,
    form_data: {
      datasource: `1__${type}`,
      viz_type: 'table',
      server_pagination: value,
    },
    controls: { server_pagination: { type: 'CheckboxControl', value } },
    slice: { slice_id: 1 },
    common: {},
  };
}

test('recomputes pagination controls when datasource metadata changes', () => {
  const registry = getChartControlPanelRegistry();
  registry.registerValue('table', {
    controlPanelSections: [
      {
        label: 'Options',
        expanded: true,
        controlSetRows: [
          [{ name: 'server_pagination', config: pagination }],
          [{ name: 'server_page_length', config: pageLength }],
        ],
      },
    ],
  });
  const state = panelState(['ROW_OFFSET']);
  const props = {
    actions: { setControlValue: jest.fn() },
    chart: { chartStatus: 'success', queriesResponse: null },
    controls: {
      ...state.controls,
      server_page_length: { type: 'SelectControl', value: 10 },
    },
    datasource_type: DatasourceType.SemanticView,
    exploreState: state,
    form_data: state.form_data,
    isDatasourceMetaLoading: false,
    errorMessage: null,
    onQuery: jest.fn(),
    onStop: jest.fn(),
    canStopQuery: false,
    chartIsStale: false,
  } as unknown as ControlPanelsContainerProps;

  try {
    const { rerender } = render(<ControlPanelsContainer {...props} />, {
      useRedux: true,
    });
    expect(screen.getByRole('checkbox')).toBeEnabled();
    rerender(
      <ControlPanelsContainer
        {...props}
        exploreState={{
          ...props.exploreState,
          datasource: panelState([]).datasource as Dataset,
        }}
      />,
    );
    expect(screen.getByRole('checkbox')).toBeDisabled();
  } finally {
    registry.remove('table');
  }
});

test.each([
  ['server_pagination', pagination],
  ['server_page_length', pageLength],
])('%s remaps when datasource capabilities change', (_, control) => {
  const before = panelState(['ROW_OFFSET']);
  const after = panelState([]);
  const controlState = after.controls.server_pagination;

  expect(control.shouldMapStateToProps?.(before, after, controlState)).toBe(
    true,
  );
  expect(control.mapStateToProps?.(after, controlState)).toMatchObject({
    disabled: true,
  });
});

function renderPagination(state: ControlPanelState, onChange = jest.fn()) {
  return render(
    <CheckboxControl
      name="server_pagination"
      label="Server pagination"
      {...pagination.mapStateToProps?.(state, state.controls.server_pagination)}
      value={Boolean(state.controls.server_pagination.value)}
      onChange={onChange}
    />,
  );
}

test.each([undefined, [], ['UNKNOWN'], ['row_offset']])(
  'disables unsupported semantic pagination with explanation: %s',
  async features => {
    const onChange = jest.fn();
    const state = panelState(features);
    renderPagination(state, onChange);
    const checkbox = screen.getByRole('checkbox');
    expect(pagination.type).toBe('CheckboxControl');
    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveAccessibleDescription(
      'This semantic view does not support server pagination.',
    );
    await userEvent.click(screen.getByText('Server pagination'));
    expect(onChange).not.toHaveBeenCalled();
  },
);

test('fails closed while semantic datasource metadata is unavailable', () => {
  const state = { ...panelState(), datasource: null };
  renderPagination(state);
  expect(screen.getByRole('checkbox')).toBeDisabled();
});

test.each([
  ['semantic_view', ['ROW_OFFSET']],
  ['table', undefined],
  ['table', []],
])('keeps %s pagination editable with %s', async (type, features) => {
  const onChange = jest.fn();
  renderPagination(panelState(features, type), onChange);
  expect(screen.getByRole('checkbox')).toBeEnabled();
  await userEvent.click(screen.getByRole('checkbox'));
  expect(onChange).toHaveBeenCalledWith(true);
  expect(
    screen.queryByText(/does not support server pagination/),
  ).not.toBeInTheDocument();
});

test('disables dependent page length without hiding or resetting saved state', () => {
  const state = panelState([], 'semantic_view', true);
  expect(
    pageLength.mapStateToProps?.(state, state.controls.server_pagination),
  ).toMatchObject({ disabled: true });
  expect(
    pageLength.visibility?.(
      { ...state, actions: { setDatasource: jest.fn() }, exportState: {} },
      {},
    ),
  ).toBe(true);
  expect(state.controls.server_pagination.value).toBe(true);
});

test('saved true survives datasource changes until an explicit keyboard edit', async () => {
  const saved = Object.freeze({ server_pagination: true });
  const onEdit = jest.fn();
  function Editor({ features }: { features?: string[] }) {
    const [value, setValue] = useState<boolean>(saved.server_pagination);
    const state = panelState(features, 'semantic_view', value);
    return (
      <CheckboxControl
        name="server_pagination"
        label="Server pagination"
        {...pagination.mapStateToProps?.(
          state,
          state.controls.server_pagination,
        )}
        value={value}
        onChange={next => {
          setValue(next);
          onEdit(next);
        }}
      />
    );
  }
  const { rerender } = render(<Editor features={['ROW_OFFSET']} />);
  expect(screen.getByRole('checkbox')).toBeChecked();
  rerender(<Editor features={[]} />);
  expect(screen.getByRole('checkbox')).toBeChecked();
  expect(screen.getByRole('checkbox')).toBeDisabled();
  expect(onEdit).not.toHaveBeenCalled();
  await userEvent.tab();
  expect(
    screen.getByRole('button', { name: 'Turn off server pagination' }),
  ).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(screen.getByRole('checkbox')).not.toBeChecked();
  expect(onEdit).toHaveBeenCalledTimes(1);
  expect(onEdit).toHaveBeenCalledWith(false);
  expect(saved.server_pagination).toBe(true);
  expect(
    screen.queryByRole('button', { name: 'Turn off server pagination' }),
  ).not.toBeInTheDocument();
});
