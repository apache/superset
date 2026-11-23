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
import { render } from '@testing-library/react';
import { ChartProps } from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import Heatmap from '../../src/Heatmap/Heatmap';
import transformProps from '../../src/Heatmap/transformProps';
import { HeatmapChartProps, HeatmapFormData } from '../../src/Heatmap/types';
import Echart from '../../src/components/Echart';
import { EventHandlers } from '../../src/types';
import { heatmapCellKey } from '../../src/Heatmap/crossFilter';

jest.mock('../../src/components/Echart', () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const mockedEchart = jest.mocked(Echart);

const baseFormData: HeatmapFormData = {
  datasource: '1__table',
  viz_type: 'heatmap',
  xAxis: 'day_of_week',
  groupby: ['hour'],
  metric: 'count',
  linearColorScheme: 'blue_white_yellow',
  normalized: false,
  normalizeAcross: 'heatmap',
  borderColor: { r: 255, g: 255, b: 255, a: 1 },
  borderWidth: 1,
  showLegend: true,
  showValues: false,
  showPercentage: false,
  legendType: 'continuous',
  bottomMargin: 'auto',
  leftMargin: 'auto',
  xscaleInterval: 1,
  yscaleInterval: 1,
  xAxisLabelRotation: 0,
  valueBounds: [null, null],
};

const queriesData = [
  {
    data: [
      { day_of_week: 'Monday', hour: 9, count: 10 },
      { day_of_week: 'Tuesday', hour: 10, count: 20 },
    ],
    colnames: ['day_of_week', 'hour', 'count'],
    coltypes: [1, 0, 0],
  },
];

function setup(
  overrides: {
    emitCrossFilters?: boolean;
    filterState?: { selectedValues?: string[] | null };
    setDataMask?: jest.Mock | undefined;
  } = {},
) {
  const setDataMask =
    overrides.setDataMask !== undefined ? overrides.setDataMask : jest.fn();
  const onContextMenu = jest.fn();

  const chartProps = {
    ...new ChartProps({
      formData: baseFormData,
      width: 800,
      height: 600,
      queriesData,
      theme: supersetTheme,
      hooks: { onContextMenu, setDataMask },
      filterState: overrides.filterState ?? {},
      emitCrossFilters: overrides.emitCrossFilters ?? true,
    }),
    emitCrossFilters: overrides.emitCrossFilters ?? true,
    filterState: overrides.filterState ?? {},
  } as unknown as HeatmapChartProps;

  const transformed = transformProps(chartProps);
  render(
    <Heatmap
      {...transformed}
      setDataMask={setDataMask}
      emitCrossFilters={overrides.emitCrossFilters ?? true}
      filterState={overrides.filterState ?? {}}
    />,
  );

  const lastCall = mockedEchart.mock.calls[mockedEchart.mock.calls.length - 1];
  const { eventHandlers } = lastCall[0] as { eventHandlers: EventHandlers };
  return { eventHandlers, setDataMask };
}

beforeEach(() => {
  mockedEchart.mockClear();
});

test('clicking a cell emits setDataMask with expected extraFormData and filterState', () => {
  const { eventHandlers, setDataMask } = setup();

  eventHandlers.click({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
  });

  const expectedKey = heatmapCellKey('Monday', 9);
  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: {
      filters: [
        { col: 'day_of_week', op: 'IN', val: ['Monday'] },
        { col: 'hour', op: 'IN', val: [9] },
      ],
    },
    filterState: {
      label: 'Monday (9)',
      value: 'Monday (9)',
      selectedValues: [expectedKey],
    },
  });
});

test('clicking selected cell clears setDataMask', () => {
  const selectedKey = heatmapCellKey('Monday', 9);
  const { eventHandlers, setDataMask } = setup({
    filterState: { selectedValues: [selectedKey] },
  });

  eventHandlers.click({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
  });

  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: { filters: [] },
    filterState: {
      label: null,
      value: null,
      selectedValues: null,
    },
  });
});

test('clicking a different cell replaces selection', () => {
  const existingKey = heatmapCellKey('Monday', 9);
  const { eventHandlers, setDataMask } = setup({
    filterState: { selectedValues: [existingKey] },
  });

  eventHandlers.click({
    data: {
      xValue: 'Tuesday',
      yValue: 10,
      value: [1, 1, 20],
    },
  });

  const nextKey = heatmapCellKey('Tuesday', 10);
  expect(setDataMask).toHaveBeenCalledWith({
    extraFormData: {
      filters: [
        { col: 'day_of_week', op: 'IN', val: ['Tuesday'] },
        { col: 'hour', op: 'IN', val: [10] },
      ],
    },
    filterState: {
      label: 'Tuesday (10)',
      value: 'Tuesday (10)',
      selectedValues: [nextKey],
    },
  });
});

test('clicking when emitCrossFilters is false does not call setDataMask', () => {
  const { eventHandlers, setDataMask } = setup({ emitCrossFilters: false });

  eventHandlers.click({
    data: {
      xValue: 'Monday',
      yValue: 9,
      value: [0, 0, 10],
    },
  });

  expect(setDataMask).not.toHaveBeenCalled();
});

test('clicking when setDataMask is undefined does not throw', () => {
  const { eventHandlers } = setup({ setDataMask: undefined });

  expect(() => {
    eventHandlers.click({
      data: {
        xValue: 'Monday',
        yValue: 9,
        value: [0, 0, 10],
      },
    });
  }).not.toThrow();
});

test('clicking with non-cell data does not call setDataMask', () => {
  const { eventHandlers, setDataMask } = setup();

  eventHandlers.click({ data: undefined });
  eventHandlers.click({ data: {} });
  eventHandlers.click({ data: [0, 0, 10] });

  expect(setDataMask).not.toHaveBeenCalled();
});
