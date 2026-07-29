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
  ControlConfig['mapStateToProps'] | null => {
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
      value: ColorSchemeEnum.Green,
      label: expect.stringContaining('Green for increase'),
    },
    {
      value: ColorSchemeEnum.Red,
      label: expect.stringContaining('Red for increase'),
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
